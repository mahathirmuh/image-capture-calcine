# Camera API Integration

Rewire this app (React + TanStack Start) from browser webcam capture to the Canon Camera Control edge API. Read `src/routes/index.tsx`, `src/lib/capture-prefs.ts`, and `src/lib/gallery-store.ts` first to understand the current flow before changing anything.

## Context

Right now capture is 100% client-side: `navigator.mediaDevices.getUserMedia()` streams a live `<video>`, `capture()` snapshots a `<canvas>` frame into a `Blob`, and `saveImage()` writes that `Blob` to a user-picked folder via the File System Access API, plus an IndexedDB gallery. None of that talks to a backend.

There is now a real backend: the Canon Camera Control edge API (Fastify, Node), running at `http://<edge-host>:3000` in dev / `:30000` in Docker. It controls a physical Canon EOS R50 over USB via `gphoto2`. The full contract is `docs/openapi.yaml` in that repo (`canon-camera-control-api`) — read it for exact schemas if anything below is ambiguous.

## Relevant edge API endpoints

- `POST /v1/sessions` — body `{ ownerType: "operator", ownerId: string, leaseSeconds: number }` → `201` with `{ sessionId, leaseToken, expiresAt, ... }`. A session is a single-writer lock: only one active session can exist at a time; a second `POST` while one is active returns `409 SESSION_CONFLICT`.
- `DELETE /v1/sessions/:sessionId` — header `X-Session-Token: <leaseToken>` → `204`. Always release when done (component unmount, "Stop camera" click, tab close via `visibilitychange`/`beforeunload` best-effort).
- `GET /v1/camera/preview` — header `X-Session-Token` required → `200` with `image/jpeg` binary, ~200KB, a single frame (not a stream). Each call does a real `gphoto2 --capture-preview` round-trip over USB — **measured at ~1.0-1.2 seconds per call** against real hardware (not the couple hundred ms you might assume), so well under 1fps. See `CAMERA_PREVIEW_POLLING.md` for the full polling design based on this number. Can return `422` if preview isn't available in the current camera state.
- `POST /v1/captures` — header `X-Session-Token` required, body:
  ```json
  { "captureTarget": "memoryCard", "downloadToEdge": true, "keepOnCamera": true }
  ```
  → `202` with `{ jobId, status: "queued", type: "captureStill" }`. This is async — capture itself takes ~3-4 seconds end to end (confirmed via live test against real hardware).
  **Do not set `filenameTemplate`.** It is passed straight through to the `gphoto2` CLI, which only expands its own `%Y%m%d`-style strftime tokens — the `{YYYY}{MM}{DD}` token syntax `formatFilename()` uses in this app is NOT understood by the edge API and will be used as a literal filename (this was tried and confirmed broken: it produced a file literally named `capture-{YYYY}{MM}{DD}-{HH}{mm}{ss}.jpg` on the edge node). Leave it unset so the edge API assigns its own internal name — this app already has its own naming via `formatFilename()`, applied client-side after fetching the bytes from `/v1/media/:assetId/content`, so the two naming schemes never need to interact.
- `GET /v1/jobs/:jobId` → `200` with `{ jobId, status, result, error }`. Poll (e.g. every 500ms) until `status` is `"succeeded"` or `"failed"`. On success, `result.asset.assetId` is what you need next; `result.cameraPath` and `result.asset.cameraPath` are informational only.
- `GET /v1/media/:assetId/content` — just added on the API side, verified working → `200` with the raw image bytes (`Content-Type` matches the asset's `mimeType`, e.g. `image/jpeg`). This is a plain `fetch()`-able binary endpoint; `response.blob()` gives you the same kind of `Blob` the current canvas-capture code already produces.
- `GET /v1/media/:assetId` — JSON metadata only (filename, sizeBytes, sha256, createdAt). Useful for display, not for getting the actual bytes.

Auth: bearer token is optional and currently unset in dev — don't build a login flow, just leave a spot to add an `Authorization: Bearer` header later if a token env var is present.

## What to build

1. **API client module** — new file, e.g. `src/lib/camera-api.ts`. Wrap each endpoint above as a typed function (`createSession`, `releaseSession`, `getPreviewFrame`, `triggerCapture`, `pollJob`, `getMediaContent`). Base URL should come from an env var (e.g. `CAMERA_API_URL`, default `http://localhost:3000`), not hardcoded.

2. **Avoid CORS by proxying through this app's own server.** This app is TanStack Start and already has a server entry (`src/server.ts`), so add server routes (e.g. under `src/routes/api/camera/`) that forward requests to the edge API server-side. The browser should only ever call same-origin `/api/camera/...` — never the edge API directly. This also means the edge API's base URL and (future) bearer token stay server-side, never shipped to the client.

3. **Rewrite the capture flow in `src/routes/index.tsx`:**
   - Remove `getUserMedia`, `enumerateDevices`, the live `<video>` element, and the "Camera device" dropdown (there's exactly one camera on the edge node — this concept doesn't apply anymore).
   - On mount (or on a "Start camera" click, your call): create a session, store `sessionId`/`leaseToken` in state. On unmount / "Stop camera": release it. Handle `409 SESSION_CONFLICT` with a clear message ("camera is in use by another client") rather than a generic error.
   - Replace the live preview with the sequential polling loop described in `CAMERA_PREVIEW_POLLING.md` (do that as its own pass — it's detailed enough to need its own read).
   - Rewrite `capture()` to: `triggerCapture()` → `pollJob(jobId)` until terminal → on success, `getMediaContent(result.asset.assetId)` → the returned `Blob` replaces what the canvas used to produce. Feed it into the exact same `setPreview`/`setPreviewBlob` state as today so everything downstream (save-to-folder, gallery) needs zero changes.
   - Add a loading/disabled state on the "Capture image" button while the job is in flight (this used to be instant; now it's ~3-4s).
   - Surface job failure (`status: "failed"`, `error.code`/`error.message`) in the existing `error` state UI.

4. **Keep unchanged:** `capture-prefs.ts` (folder/filename/format prefs), `gallery-store.ts` (IndexedDB gallery), the File System Access folder picker, and the filename-token formatting (`formatFilename`) in `index.tsx` — none of that cares where the `Blob` came from.

## Verification

- `npm run dev` (or `bun dev`), confirm the app still loads with no camera connected (edge API reachable but camera disconnected should show a sensible error, not a crash).
- With the Canon EOS R50 connected and the edge API running, do one real end-to-end capture through the UI and confirm the saved file opens as a valid JPEG.
- Confirm releasing the session actually happens (check `DELETE /v1/sessions/:id` fires) when navigating away or stopping — a leaked session blocks every other client for the full `leaseSeconds` lease.
