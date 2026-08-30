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
- `Capture`: uses live camera session, autofocus, capture, and job polling APIs, and now includes latest-result preview lookup for the selected slot
- `Recent Captures`: wired to live `GET /captures` with plant scoping, latest-20 loading, and loading/error/empty states
- `Capture Detail`: wired to live `GET /captures/{id}` and attempts preview loading from `GET /captures/{id}/image`
- `My Device`: wired to live `GET /devices` and `GET /devices/{code}/status` with primary-device resolution and degraded/offline handling
- `Settings`: UI only

## M1 Implementation Notes

- `mobile/src/lib/sessionCoverage.ts` flattens nested `SessionCoverage` payloads into operator checklist items
- status derivation currently supports `completed`, `missing`, and `upcoming`
- `/sessions` does not expose a contract-level `retake` state, so that state remains deferred until backend contract support exists
- `mobile/src/App.tsx` stores the selected session and passes it into `Capture`
- `mobile/src/screens/CaptureScreen.tsx` shows selected session context before live camera APIs are integrated

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

- `mobile/src/lib/camera.ts` wraps camera session, autofocus, capture, and job polling contracts
- the mobile client currently asks backend to resolve the operator device implicitly unless backend requires explicit device selection
- lease tokens are reused until close to expiry, then a new camera session is requested
- latest-result preview now queries recent captures for the selected plant/session and matches by `captureBin` to avoid opening the wrong slot
- runtime verification has covered success and conflict paths in browser, but final uncontested re-check of the latest-result preview is still pending

## M4 Implementation Notes

- `mobile/src/lib/devices.ts` selects a primary device by preferring active devices that match the operator plant, then falling back to the most recently active device
- `mobile/src/screens/MyDeviceScreen.tsx` renders loading, error, degraded, offline, and success-friendly states from live backend data
- diagnostics CTA remains informational only in this phase

## Backend Contract Surface Relevant To Mobile

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /captures`
- `GET /captures/{id}`
- `GET /captures/{id}/image`
- `GET /sessions`
- `GET /devices`
- `GET /devices/{code}/status`
- `POST /camera/session`
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
