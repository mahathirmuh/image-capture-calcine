# Device selection maintenance — 2026-09-08

## Scope and checklist

- [x] Trace the Gallery "Ada lebih dari satu device aktif" message after registration.
- [x] Review the existing local Gallery change that passes the saved profile's device code on initial status load and refresh.
- [x] Preserve the REST resolver's second positional argument (`actorUserId`); optional `deviceCode` is the third argument.
- [x] Verify selection and positional argument compatibility with regression tests.
- [x] Verify the Gallery status in local development against the actual registered camera (2026-09-08 14:28).
- [x] Bind Capture selection and its complete session/media lifecycle to the selected plant's registry placement.
- [x] Make sidebar read the selected identity and refresh when it changes.
- [ ] Follow up on Dashboard, Devices, and Storage callers that still omit explicit device selection.
- [ ] Address the separate IndexedDB version mismatch between directory preferences and gallery storage.

## Findings

Registration saves a device profile in browser localStorage. The original Gallery status call omitted that selection. With multiple eligible active devices, the resolver returns `DEVICE_AMBIGUOUS` before contacting an edge API; the displayed disconnected state therefore does not establish an API/network failure.

The existing local fix sends `loadDeviceProfile()?.deviceCode` to `getDeviceStatus`. The resolver continues to enforce the user's plant scope and active-device checks. An absent profile still requires an explicit selection, and a removed device code returns `DEVICE_NOT_FOUND`.

Review found that inserting `deviceCode` as the second resolver argument would reinterpret the REST user's numeric ID as a device code. Keeping `actorUserId` second preserves the existing REST call contract.

## Verification

- Node v22.14.0: Vitest passed all four tests in `src/lib/server/edge-target.test.ts` (selected code routing, ambiguous selection, missing code, REST actor argument).
- Full TypeScript check was run and failed with errors elsewhere in the project, including `LucideIcon` imported from React, incomplete `DeviceStatus` fixtures, and profile/settings type mismatches. This is not a clean project-wide verification.
- `docs/openapi.yaml` reviewed: no update needed. The Gallery change is a TanStack server function input, outside the documented REST surface; the REST identity argument is preserved.
- No production database changes, camera operations, or deployment were performed.

This is web/backend maintenance; the completed mobile M5 phase is unchanged.

## Follow-up: explicit Gallery selection

- Added a registry-backed Radix device selector to Gallery, with loading, empty, missing-choice, inline failure/retry, and stale-response protection in `use-edge-status-selection.ts`.
- Added independent browser identity persistence with legacy profile fallback; reading a device code no longer requires validating the entire camera settings profile. Registration/profile saves also update the identity preference. Sidebar reads it and listens for selection/storage changes.
- A missing or inactive saved code requires another explicit choice; multiple active devices are never resolved by taking the first row.
- Node/Vitest: 25 tests passed across selection, resolver, and existing device profile suites. Format and diff checks passed. TypeScript remains blocked by existing project errors; no errors were reported in the new selection hook/helper/tests.
- Browser verification: `http://localhost:8080/gallery` rendered both registered devices in the accessible dropdown; `edge-camera-02` / Chloride Plant was restored. Opening the list and closing with Escape worked. The Gallery ambiguity message was replaced by the actual response from `10.60.20.96:3000`: gphoto2 could not find the camera on the USB port. This verifies target resolution, not a successful camera capture. Sidebar's latest selection synchronization is code/test reviewed; its updated live response is not yet verified.
- Build attempted via npm: stopped at Nitro output cleanup with `EPERM` removing `.output/server/node_modules`; no running application process was stopped. Strict design audit reported existing application-wide contract/ownership and native-dialog findings; broad UI compliance and narrow-viewport verification remain pending.
- OpenAPI remains unchanged: no REST contract change. No camera capture or database write was performed during verification.

## Capture plant routing — user-confirmed behavior

The Capture location controls camera selection as well as naming and storage. Acid operators may only use Acid cameras; accounts assigned to all plants may select Acid or Chloride. Registry `device_assignments` joined to `locations` is authoritative for plant and station. Browser profiles and the Gallery selection cannot override this assignment.

- Resolve the sole active device within the requested plant before acquiring a session. Missing/multiple assignments or missing per-device API URLs produce explicit errors; no global URL or first-row fallback is used for plant-scoped Capture.
- Recheck account plant access and expected device placement in the backend for every scoped operation. Keep the REST actor argument unchanged.
- Pin device ID and plant to create/renew/release, preview, capture, autofocus, job polling, media fetch, and network save. Capture metadata uses the resolved device code, name, and station.
- On location changes, cancel old startup attempts, clear old frames/results, release the old lease, and automatically connect the newly assigned camera. Release late successful leases and discard stale frames/errors. Wait for operator scope and preferences before starting any camera.
- Block location changes during capture, autofocus, and save. Existing operator location lock remains enforced server-side as well as in the UI.
- Added React effect tests using `react-test-renderer` via npm; no Bun commands were used. The initial 18 plant-access/lifecycle tests passed, including permission denial, reassignment, ambiguous placement, missing URL, delayed lease release, and stale preview handling.
- Reviewed `docs/openapi.yaml`: the public REST contract is unchanged. The new plant selection is a TanStack server-function input; existing REST caller identity and operator checks are preserved.
- Mobile remains completed through M5; this maintenance changes web Capture and shared backend helpers, not mobile workflows.
