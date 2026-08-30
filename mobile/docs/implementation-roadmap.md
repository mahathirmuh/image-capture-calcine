# Mobile Implementation Roadmap

## Active Phase

- Current execution targets: `Completed through M5 - Settings And Runtime Config Cleanup`
- Last completed phase: `M5 - Settings And Runtime Config Cleanup`
- Rule: do not advance phase status without recorded verification evidence

## Phase M0 - Documentation Foundation

### Status

- `Completed`

### Objective

Establish mobile-specific source-of-truth documents and working contract before wiring additional operator menus.

### Source Documents

- `mobile/AGENTS.md`
- `docs/openapi.yaml`
- `mobile/src/App.tsx`
- `mobile/src/lib/auth.ts`

### Checklist

- [x] Create mobile-specific project plan
- [x] Create mobile-specific product principles
- [x] Create mobile-specific functional specification
- [x] Create mobile-specific technical implementation plan
- [x] Create mobile-specific database schema specification
- [x] Create mobile open questions document
- [x] Record verification evidence for the documentation baseline

### Output

- `mobile/docs/project-plan.md`
- `mobile/docs/product-principles.md`
- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/database-schema-specification.md`
- `mobile/docs/open-questions-and-challenges.md`

### Challenge / Verification

- Verified the current mobile app structure from `mobile/src/App.tsx`
- Verified the current auth/session implementation from `mobile/src/lib/auth.ts`
- Verified backend contract entry points in `docs/openapi.yaml`

## Phase M1 - Today Sessions Live Data

### Status

- `Completed`

### Objective

Replace mock/static `Today Sessions` behavior with backend-driven operator session data and connect session selection into the capture flow.

### Source Documents

- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Execution Breakdown

1. Contract alignment
   - confirm `GET /sessions` request scope and date/plant filtering
   - confirm `SessionCoverage` fields that can drive operator UI without assumption
   - record contract gaps before UI logic depends on them
2. Data shaping
   - map plant/session/slot payload into a flat checklist model
   - derive operator-facing status from `captured`, `record`, `date`, and `hour`
   - derive compact summary counts used by the header chips
3. Screen integration
   - replace static data on `Today Sessions`
   - implement loading, empty, error, and success states
   - keep tap target behavior simple for gloved/operator usage
4. App-shell handoff
   - store selected session in `App.tsx`
   - switch to `Capture` tab after selection
   - expose selected session context on the `Capture` screen even before live camera wiring exists
5. Verification and sync
   - run mobile build
   - capture evidence in this roadmap
   - synchronize related mobile docs if implementation reality changed

### Checklist

- [x] Review `GET /sessions` contract and `SessionCoverage` schema
- [x] Use `GET /sessions` as the source for coverage items and summary
- [x] Scope the request to the operator plant when `session.user.plant` is available and not `ALL`
- [x] Flatten nested plant/session/slot coverage into operator-friendly checklist items
- [x] Map uncaptured future sessions to `upcoming`
- [x] Map uncaptured past/current sessions to `missing`
- [x] Map captured sessions to `completed`
- [x] Surface captured time as trailing metadata when a record exists
- [x] Record the current contract gap: `/sessions` does not expose a dedicated `retake` state
- [x] Implement loading state for initial fetch
- [x] Implement error state for request failure
- [x] Implement empty state when no items are returned
- [x] Implement refresh action for the live screen
- [x] Preserve operator-focused tap interaction to enter capture flow
- [x] Store selected session state centrally in `App.tsx`
- [x] Pass selected session context into the `Capture` screen
- [x] Verify the handoff flow with a production mobile build
- [x] Record verification evidence in roadmap and technical docs

### Output

- Live `Today Sessions` screen wired to backend data
- Session selection handed off to `Capture`

### Challenge / Verification

- Reviewed `SessionCoverage` schema in `docs/openapi.yaml`
- Verified `TodaySessionsScreen` uses live `GET /sessions` data with operator plant scoping
- Verified `App.tsx` stores selected session state and routes selection into the `Capture` tab
- Verified `CaptureScreen` renders selected session context from shared app state
- Ran `npm run build` in `mobile/` successfully on 2026-08-30 after the latest M1 wiring changes

## Phase M2 - Recent Captures And Capture Detail Live Data

### Status

- `Completed`

### Objective

Replace mock capture history/detail data with backend-backed operator results.

### Source Documents

- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Execution Breakdown

1. Contract review for `GET /captures`, `GET /captures/{id}`, and `GET /captures/{id}/image`
2. Decide operator-oriented default filters and sort order
3. Replace mock list data with live history data
4. Replace detail metadata with live payload
5. Define image loading and fallback behavior
6. Verify list-to-detail navigation and document evidence

### Checklist

- [x] Review capture list/detail contracts in `docs/openapi.yaml`
- [x] Decide default date range, plant scope, and result ordering for operators
- [x] Create mobile mapping from `CaptureRecord` payloads to history cards
- [x] Replace mock history list data with live API data
- [x] Implement loading, empty, and error states for history
- [x] Create detail loader for `GET /captures/{id}`
- [x] Define image loading behavior for preview and failure fallback
- [x] Replace mock detail metadata with live API data
- [x] Verify history-to-detail navigation
- [x] Record partial verification evidence

### Output

- Live `Recent Captures` screen
- Live `Capture Detail` screen

### Challenge / Verification

- Reviewed `GET /captures`, `GET /captures/{id}`, and `GET /captures/{id}/image` contracts in `docs/openapi.yaml`
- Implemented plant-scoped history loading with default `limit=20` and descending backend order
- Implemented detail fetch plus binary image preview loading with graceful fallback when image retrieval fails
- Added mobile-side in-memory image cache for repeated detail opens so the same preview is reused without refetching during the same app session
- Added persistent IndexedDB-backed cache for full-size detail images so previously opened captures stay warm after app restart
- Added lightweight history thumbnail loading through `GET /captures/{id}/thumb`, with placeholder fallback when the server thumb is not available
- Added local thumb derivation from downloaded detail images so history cards can still reuse preview images across sessions even if the backend thumb store is incomplete
- Added background thumbnail warm-up after login/session restore for the operator scope, using paged fetches and bounded concurrency so startup stays responsive while the cache fills progressively
- Ran `npm run build` in `mobile/` successfully on 2026-08-30 after M2 history/detail wiring changes
- Verified runtime browser flow on 2026-08-30: login -> History -> open first record -> Capture Detail metadata rendered successfully
- Verified first history item opened as `14.00 • TRAIN 2`
- Verified detail metadata rendered for captured time, session, plant, station/bin, status, file name, device, and captured-by
- Verified `npm run dev:capacitor` succeeds on 2026-08-30 after overriding Android compile compatibility to Java 17 in `mobile/android/build.gradle` for the current local JDK
- Evidence screenshots captured during browser verification:
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/capture-detail-screen.png`
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/capture-detail-metadata.png`

## Phase M3 - Capture Workflow Integration

### Status

- `Completed`

### Objective

Connect the operator capture screen to live camera session, autofocus, capture, and job polling APIs.

### Source Documents

- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Execution Breakdown

1. Clarify selected-session to device/camera ownership rules
2. Establish camera session lifecycle
3. Wire autofocus and capture actions
4. Poll async job status until terminal state
5. Show latest result preview and failure states
6. Verify primary and failure workflow paths

### Checklist

- [x] Define device/session ownership rules for operator-triggered capture
- [x] Define when the mobile client opens, reuses, or closes a camera session
- [x] Implement camera session acquisition via `POST /camera/session`
- [x] Implement live preview polling via `GET /camera/preview`
- [x] Implement camera session renewal via `POST /camera/session/renew`
- [x] Implement camera session release via `DELETE /camera/session/{sessionId}`
- [x] Replace `Change Session` with explicit `Stop Session`
- [x] Add in-screen slot selector for `Train 1/Train 2` or `Bin 1/Bin 2`
- [x] Implement capture action via `POST /camera/capture`
- [x] Implement capture auto-save/finalize via `POST /captures/finalize`
- [x] Implement job polling via `GET /jobs/{jobId}`
- [x] Show live status transitions for queued, running, succeeded, and failed
- [x] Connect latest result preview to live capture results
- [x] Simplify capture UX to one live-preview surface plus explicit capture progress/success feedback
- [x] Replace the text capture CTA with a camera-icon primary action
- [x] Implement user-visible failure handling for timeout or device/API unavailability
- [x] Record verification evidence

### Output

- Live capture workflow

### Challenge / Verification

- Reviewed `POST /camera/session`, `POST /camera/capture`, `POST /captures/finalize`, and `GET /jobs/{jobId}` contracts in `docs/openapi.yaml`
- Implemented camera-session creation and reuse logic with lease-expiry checks in `mobile/src/lib/camera.ts`
- Implemented mobile live preview frame polling via `GET /camera/preview`, plus lease renewal/release via `POST /camera/session/renew` and `DELETE /camera/session/{sessionId}`
- Implemented explicit `Stop Session` action and in-screen slot switching on the mobile capture screen
- Implemented live capture job triggering, job polling, and automatic finalize/save in `mobile/src/screens/CaptureScreen.tsx`
- Implemented latest-result preview lookup tied to the selected plant/session/slot so the capture preview does not open the wrong record
- Simplified the capture screen UX so operators see one live preview, a top-level capture action beside session control, and explicit progress/success messaging during slow capture processing
- Replaced the text-only capture CTA with a camera-icon primary button while preserving loading lock states and accessibility labels
- Implemented operator-visible failure states for session conflict, edge unavailability, and polling timeout through shared API error handling
- Ran `npm run build` in `mobile/` successfully on 2026-08-30 after M3 capture workflow wiring changes
- Verified in browser on 2026-08-30 that the refreshed mobile capture UX at `http://127.0.0.1:5173` shows `Capture` beside `Start/Stop Session`, removes autofocus, locks actions during `Capturing...`, shows process messaging, and surfaces `Capture complete` after the job finishes
- Verified in browser on 2026-08-30 that the capture action is now rendered as a camera-icon button beside `Start Session`, while slot selection still shows `Train 1` and `Train 2`
- Ran `npm run build` in root app successfully on 2026-08-30 after exposing mobile preview/session lifecycle endpoints in the REST API
- Verified statically on 2026-08-30 that successful mobile capture jobs now continue into backend finalize/save instead of stopping at the camera job response
- Verified in browser runtime that selected-session handoff works, camera session start succeeds, autofocus job reaches `Succeeded`, and capture job reaches `Succeeded`
- Verified preview-to-detail navigation once during browser runtime, then found a slot-mismatch issue in preview lookup and fixed it by matching `captureBin`
- Verified browser failure path after the fix: session conflict surfaced as `Kamera sedang dipakai client lain.`
- Verified on 2026-08-30 that the local mobile app at `http://127.0.0.1:5174` logs in, opens a missing session, starts the camera session, and reaches `Live preview active` with repeated `GET /camera/preview` requests against the local app server at `http://127.0.0.1:3000`
- Evidence screenshot captured during mobile live-preview verification:
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/page-2026-08-30T10-01-39-190Z.png`
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/mobile-capture-camera-icon-2026-08-30.png`

## Phase M4 - My Device Live Status

### Status

- `Completed`

### Objective

Connect the operator device screen to real device and device-status data.

### Source Documents

- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Execution Breakdown

1. Define which device the operator should see by default
2. Load device catalog from backend
3. Load health/status for the chosen device
4. Render success, degraded, offline, and loading states
5. Decide diagnostics CTA behavior for this phase
6. Verify device status rendering and fallback handling

### Checklist

- [x] Define assigned-device selection rule for operator context
- [x] Review `GET /devices` and `GET /devices/{code}/status` contracts
- [x] Load device overview data from `GET /devices`
- [x] Select the primary device for the signed-in operator
- [x] Load live device health data from `GET /devices/{code}/status`
- [x] Implement success, offline/degraded, loading, and error states
- [x] Decide whether diagnostics CTA is informational or functional in this phase
- [x] Record verification evidence

### Output

- Live `My Device` screen

### Challenge / Verification

- Reviewed `GET /devices` and `GET /devices/{code}/status` contracts in `docs/openapi.yaml`
- Implemented device list/status client helpers and primary-device selection in `mobile/src/lib/devices.ts`
- Implemented live My Device loading, degraded/offline messaging, and operator-context rendering in `mobile/src/screens/MyDeviceScreen.tsx`
- Ran `npm run build` in `mobile/` successfully on 2026-08-30 after M4 device-status wiring changes
- Finalized diagnostics behavior for this phase as read-only guidance plus a manual `Refresh Status` CTA for operators
- Added visible last-refresh badge so operators can judge the freshness of the live telemetry snapshot
- Verified in browser on 2026-08-30 that `My Device` renders live telemetry, shows the read-only diagnostics message, and changes the refresh CTA into `Refreshing...` while the device status reload is running
- Evidence screenshot captured during device verification:
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/mobile-device-readonly-2026-08-30.png`

## Phase M5 - Settings And Runtime Config Cleanup

### Status

- `Completed`

### Objective

Finish the operator settings surface and align runtime configuration behavior with mobile deployment needs.

### Source Documents

- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Execution Breakdown

1. Separate real operator preferences from display-only account information
2. Finalize sign-out and local session cleanup behavior
3. Recheck runtime environment resolution for web preview and Capacitor builds
4. Remove leftover placeholder content
5. Verify settings and auth cleanup behavior

### Checklist

- [x] Decide which settings are real preferences versus display-only status
- [x] Wire sign-out and session-clearing behavior end-to-end
- [x] Review runtime backend configuration strategy for mobile builds
- [x] Remove leftover mock/placeholder settings behavior
- [x] Verify logout, restore, and environment-driven startup behavior
- [x] Record verification evidence

### Output

- Clean operator settings experience

### Challenge / Verification

- Reviewed current mobile runtime base-URL/API-key resolution in `mobile/src/lib/auth.ts` and Vite compile-time defines in `mobile/vite.config.ts`
- Added persisted mobile preferences for `High-Contrast Mode` and `History Warm-Up` through Capacitor Preferences
- Wired app bootstrap to hydrate preferences before render, apply high-contrast mode, and conditionally run thumbnail warm-up after login/session restore
- Replaced settings placeholders with real operator preferences and live runtime snapshot values (app version, API path, access expiry, refresh expiry), while intentionally hiding the API host from operator-facing settings
- Switched mobile branding to the shared app logo asset so the login hero, top app bar, and favicon match the main frontend resources
- Replaced the default Capacitor Android launcher icons and splash assets with resized variants of the shared app logo so native Android branding matches the mobile UI
- Confirmed existing sign-out flow still clears mobile session state through the shared auth/logout path
- Ran `npm run build` in `mobile/` successfully on 2026-08-30 after M5 settings/runtime cleanup changes
- Verified in browser on 2026-08-30 that the settings screen renders the two persisted preferences, hides the API host, and exposes runtime snapshot values from the active build/session without reverting to mock data
- Verified in browser on 2026-08-30 that the shared app logo is rendered in the mobile top app bar after the branding update
- Verified on 2026-08-30 that Android launcher and splash resources under `mobile/android/app/src/main/res` no longer use the default Capacitor art and now resolve to generated logo variants across all densities
- Evidence screenshot captured during settings verification:
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/mobile-settings-runtime-2026-08-30.png`
  - `/var/folders/s4/_h6390qs7rscy8lyhg58xd300000gn/T/trae/screenshots/mobile-settings-logo-privacy-2026-08-30.png`
