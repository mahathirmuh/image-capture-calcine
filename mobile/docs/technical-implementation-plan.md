# Mobile Technical Implementation Plan

## Current Stack

- Mobile UI: React 19 + Vite + TypeScript
- Mobile packaging: Capacitor Android
- Local Android build target: Java 17 compatibility override in `mobile/android/build.gradle` because the current workstation JDK is 17 while generated Capacitor Android files request Java 21 by default
- Session persistence: `@capacitor/preferences`
- Backend API: app server routes under `/api/v1`
- Database: MSSQL

## Mobile Architecture

### App Shell

- `mobile/src/App.tsx` controls authentication bootstrap, tab switching, and screen selection
- Current navigation is state-based, not router-based

### Auth Layer

- `mobile/src/lib/auth.ts` owns login, refresh, logout, restore, and token persistence
- Base URL resolution order:
  1. `VITE_API_BASE_URL`
  2. `MOBILE_API_BASE_URL`
  3. `API_BASE_URL`
- API key resolution order:
  1. `VITE_API_KEY`
  2. `MOBILE_API_KEY`
  3. first entry in `API_KEYS`

### Current Screen State

- `Login`: wired to live auth API
- `Today Sessions`: wired to live `GET /sessions`, including operator-plant scoping, summary chips, loading/error/empty states, and tap-to-capture handoff
- `Today Sessions` sends the device-local `date` query explicitly so operator coverage does not drift when the app server timezone differs from the plant/operator timezone
- `Capture`: uses live camera session, live preview polling, capture, job polling, automatic save/finalize APIs, latest-result preview lookup for the selected slot, and explicit in-screen progress/success feedback for operators
- `Recent Captures`: wired to live `GET /captures` with plant scoping, latest-20 loading, and loading/error/empty states
- `Capture Detail`: wired to live `GET /captures/{id}` and attempts preview loading from `GET /captures/{id}/image`
- `My Device`: wired to live `GET /devices` and `GET /devices/{code}/status` with primary-device resolution and degraded/offline handling
- `Settings`: wired to persisted mobile preferences, runtime snapshot diagnostics, and sign-out

## M1 Implementation Notes

- `mobile/src/lib/sessionCoverage.ts` flattens nested `SessionCoverage` payloads into operator checklist items
- status derivation currently supports `completed`, `missing`, and `upcoming`
- `/sessions` does not expose a contract-level `retake` state, so that state remains deferred until backend contract support exists
- `mobile/src/App.tsx` stores the selected session and passes it into `Capture`
- `mobile/src/screens/CaptureScreen.tsx` runs the selected or automatic session through the shared camera lifecycle

## M2 Implementation Notes

- `mobile/src/lib/captures.ts` maps backend capture records into operator-facing history/detail view data
- history uses the backend default newest-first ordering and limits the first load to 20 rows
- `Capture Detail` handles image fetch failure gracefully, which is important for `FILE_NOT_READY` and missing-file cases
- repeated `Capture Detail` opens now reuse an in-memory LRU image cache so the same JPEG is not downloaded again during the same app run
- full-size detail images are now also persisted in IndexedDB with a bounded local cache so reopened records stay fast after app restart
- `History` cards now attempt lightweight preview thumbnails via `GET /captures/{id}/thumb`, then fall back to placeholder if the server has no thumb yet
- when the mobile client downloads a full image, it also derives and stores a local thumb so previously opened records still show preview cards even when the server thumb is missing
- after login/session restore, the mobile shell now warms history thumbnails in the background for the operator scope using paged requests and bounded concurrency; this improves the first visit to `History` without blocking app startup
- runtime browser verification for `History -> Detail` has passed

## M3 Implementation Notes

- `mobile/src/lib/camera.ts` wraps camera session, session renew/release, live preview frame loading, capture, job polling, and capture-finalize contracts
- the mobile client supplies the scheduled plant when creating a session, validates it against the operator account, and pins all subsequent preview, command, job, renewal, release and finalize calls to the returned device identity
- while the capture screen is open, the mobile client now polls `GET /camera/preview` for JPEG frames and refreshes the lease with `POST /camera/session/renew`
- the capture screen releases the lease through `DELETE /camera/session/{sessionId}` when the operator leaves the screen so the camera becomes available faster for the next client
- when no checklist session has been selected from `Today Sessions`, the capture screen now derives the active session from the device clock using the fixed session schedule and only enables direct capture during the defined two-hour windows (`HH:00` to `HH+1:59`)
- the capture screen now exposes a slot selector (`Train 1/Train 2` on Acid, `Bin 1/Bin 2` on Chloride) and auto-finalizes every successful camera job through `POST /captures/finalize`
- outside the defined session windows, the capture screen blocks `Start Session` and `Capture`, greys out those buttons, and shows `Session not available, please take sample at defined sessions`
- when the backend returns `SESSION_CONFLICT` while starting a camera session, the capture screen now shows a blocking operator popup plus a warning notice instead of leaving the failure only in the lower error card
- latest-result preview now queries recent captures for the selected plant/session and matches by `captureBin` to avoid opening the wrong slot
- the capture screen now uses a single primary live-preview surface, moves `Capture` beside the session control, removes operator-facing autofocus, and shows capture-in-progress plus capture-complete feedback so the workflow feels deterministic on slower cameras
- browser verification on 2026-08-30 confirmed `Start Session` on mobile now switches the screen into `Live preview active` and renders real camera frames

## M4 Implementation Notes

- `mobile/src/lib/devices.ts` accepts exactly one active device in the assigned operator plant; missing or ambiguous assignments never fall back to another camera
- `mobile/src/screens/MyDeviceScreen.tsx` renders loading, error, degraded, offline, and success-friendly states from live backend data
- diagnostics stay read-only on mobile in this phase, while a manual `Refresh Status` action lets operators re-check live telemetry without leaving the screen
- the device screen also records a visible last-refresh badge so operators can judge how fresh the snapshot is

## M5 Implementation Notes

- `mobile/src/lib/preferences.ts` persists lightweight mobile operator preferences through Capacitor Preferences in internal app storage
- `mobile/src/App.tsx` now hydrates preferences during boot, applies light/dark theme plus high-contrast mode to the app shell, and gates thumbnail warm-up based on the saved setting
- `mobile/src/screens/SettingsScreen.tsx` exposes only real preferences (`Light Mode`, `High-Contrast Mode`, `History Warm-Up`), shows active runtime snapshot values, and reuses the existing sign-out/session cleanup flow
- runtime snapshot values come from the active build and session (`__MOBILE_APP_VERSION__`, configured API path, access expiry, refresh expiry) instead of placeholders, while the API host is intentionally hidden from operator-facing settings
- mobile branding now reuses the shared app logo asset from the main frontend/public resources for the login hero, top app bar, favicon, Android launcher icons, and Android splash screens

## Backend Contract Surface Relevant To Mobile

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /captures`
- `POST /captures/finalize`
- `GET /captures/{id}`
- `GET /captures/{id}/image`
- `GET /sessions`
- `GET /devices`
- `GET /devices/{code}/status`
- `POST /camera/session`
- `POST /camera/session/renew`
- `DELETE /camera/session/{sessionId}`
- `GET /camera/preview`
- `POST /camera/capture`
- `POST /camera/autofocus`
- `GET /jobs/{jobId}`

## Planned Integration Order

1. `Today Sessions`
2. `Recent Captures` + `Capture Detail`
3. `Capture`
4. `My Device`
5. `Settings` cleanup and config handling

## Verification Standard

Per phase, record:
- build result
- API contract review
- workflow verification
- unresolved blockers in `mobile/docs/open-questions-and-challenges.md`

## Post-M5 camera alignment (2026-09-08)

Capture automatically starts a lease when entering a valid scheduled context. Account or scheduled-context changes remount the workflow, invalidate pending results, release the old lease, and clear preview state. Session operations are serialized across remounts; late successful sessions are released. Capture requires a valid lease and a successful preview with no current preview error. Slots are disabled during capture. My Device shares the same one-active-camera-per-plant eligibility rule, with backend authorization authoritative for live access. REST finalization records the resolved station.

REST accepts optional expected `plant` on camera requests and optional `deviceId`/`plant` on job polling. Existing clients can omit them; mobile always sends the resolved target. Deploy the updated backend before using the rebuilt mobile client. See `plant-camera-alignment-audit.md` for verification.

### All-plant operator access (2026-09-08)

Explicit account scope `ALL` allows selecting a scheduled session from any plant. Camera destination is always that session's concrete plant, never `ALL`. Single-plant accounts remain restricted and missing account assignments remain blocked on mobile. For ALL accounts, Capture stays idle without a selected scheduled session. Single-plant accounts may use the active automatic session described below. Changing the selected context releases the previous camera before connecting the next. My Device uses the selected session's plant for `ALL` accounts and offers Open Today Sessions when none is selected. Access is based on account scope, not username or a special case for Widji. REST continues to recheck current database permissions and device placement.


## Remote Integration With Direct Capture — 2026-09-08

Remote baseline: f6f34aa. `automaticCaptureSession.ts` resolves device-local windows and stable keys containing the session-start date (including the previous date after midnight). `CaptureContext` feeds the resulting context into the existing keyed workflow. Window checks run every second and on visibility change; start/capture handlers also check the current clock to reject a click before the next timer tick. During capture, context updates wait until finalization finishes. The original command-start timestamp is supplied to finalize.

The backend's existing session-date calculation remains responsible for storage dates; no new timestamp or session-date field is introduced. Device clock/timezone must match plant operations; the existing backend timezone assumption still requires deployment verification. Explicit selected sessions retain their previous recovery behavior. The native HTML dialog owns modal focus/inert behavior; stylesheet tokens cover both themes, including disabled controls.

OpenAPI reviewed: existing plant/device targeting and finalize fields are sufficient. No additional REST contract or database changes beyond the fetched remote baseline.
