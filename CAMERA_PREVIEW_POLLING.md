# Live Preview Via Polling

This is a focused follow-up to `CAMERA_API_INTEGRATION.md` — read that first for the overall session/capture flow, API client module location, and the CORS-avoidance proxy setup. This file is just about the "camera preview" panel in `src/routes/index.tsx`.

## The constraint (measured, not assumed)

The edge API has no live/streamed preview. `GET /v1/camera/preview` triggers a real `gphoto2 --capture-preview` round trip over USB every single call. Measured live against a Canon EOS R50 on the edge host: **5 consecutive calls averaged ~1.0-1.2 seconds each**, returning a ~200KB, 960x640 JPEG. That's under 1 fps — there is no way to get smooth video out of this endpoint, full stop. Do not build UI copy or a polling interval that implies otherwise.

This also means: **never fire the next preview request before the previous one resolves.** A fixed `setInterval(fn, 500)` would stack up overlapping in-flight requests, each queued behind the previous `gphoto2` process on the edge node (capture is effectively serialized per session anyway), causing growing lag and possibly out-of-order frame arrival. Use a self-scheduling loop instead (`await` the fetch, then `setTimeout` the next call), not a fixed-tick interval.

## Design

- **Requires an active session.** `GET /v1/camera/preview` needs `X-Session-Token`, same as capture. The polling loop should only run while a session is held (see `CAMERA_API_INTEGRATION.md` for session lifecycle) — don't start it before a session exists, and stop it immediately when the session is released.
- **Sequential loop, not `setInterval`:**
  ```ts
  let cancelled = false;

  async function pollLoop() {
    while (!cancelled) {
      try {
        const blob = await getPreviewFrame(sessionToken);
        setPreviewFrameUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch (e) {
        // one failed frame shouldn't kill the loop — log/surface it, keep going
      }
      if (!cancelled) await sleep(200); // small gap on top of the ~1-1.2s call itself
    }
  }
  ```
  Stopping is just setting `cancelled = true` before the next loop iteration checks it — no need to track timer IDs.
- **Pause when not visible.** Each call is a real hardware operation competing with capture-still for the same USB device. Stop the loop when the browser tab is hidden (`document.visibilitychange`) or the camera panel/route unmounts, and resume on visibility return — don't burn USB round trips against a tab nobody is looking at.
- **UI copy:** call it "Preview" or "Refresh preview," not "Live camera" or anything implying continuous video. Consider showing the frame with a subtle loading/pulse state between updates so the ~1s cadence doesn't read as the app being stuck. A visible "last updated Xs ago" or a spinner during the in-flight fetch both work.
- **Manual refresh option:** given the ~1s-per-frame reality, a "Refresh preview" button that does one fetch on demand (no loop) is a legitimate alternative to continuous polling — probably better UX for a desk/studio capture tool than a slow flipbook. Your call which one (or both — e.g. auto-poll only while explicitly toggled on) fits this app best.
- **Error handling:** `GET /v1/camera/preview` can return `422` if the camera can't produce a preview in its current state (e.g. mid-capture, or an unsupported mode) — treat this as "preview temporarily unavailable," not a fatal error; the next poll attempt should just try again.

## What NOT to build

- No WebRTC, no MJPEG multipart stream, no `<video>` element for this — the edge API doesn't support any of those, and building client code that assumes one exists will just fail silently or hang.
- No polling interval faster than the loop above allows (i.e., never shorter than the actual round-trip time). If you want "faster," that's a backend/hardware limitation to raise separately, not something to work around client-side.

## Verification

- With the Canon EOS R50 connected, open the capture page and confirm the preview panel updates roughly once per second (or on manual refresh, once per click) with a real, current frame from the camera — not a stale/cached one.
- Switch tabs away and back; confirm polling actually stops while hidden (check the Network tab — no preview requests firing while the tab is backgrounded) and resumes on return.
- Trigger a still capture while the preview loop is running; confirm the two don't visibly fight each other (the session model should already serialize this — the preview loop will just briefly see slower responses or a transient `422`/`409`, not crash).
