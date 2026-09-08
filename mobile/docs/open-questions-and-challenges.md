# Mobile Open Questions And Challenges

## Open Questions

1. Should mobile continue to rely on `X-API-Key` for `POST /auth/login`, or should login be opened for mobile clients in a later backend phase?
2. Multiple eligible camera selection is resolved below; no operator device picker is planned.

## Current Challenges

1. M0–M5 API integration is complete; plant-camera alignment still needs deployment and physical Android/camera verification.
2. The current mobile app uses state-based navigation; deeper workflow linking may later justify router-based navigation.
3. Public/mobile web access depends on deployed backend CORS support, not only local code changes.
4. `Today Sessions` currently derives only `completed`, `missing`, and `upcoming` because `/sessions` has no dedicated `retake` state in the contract.
5. Some older capture records may not have server-side thumbnails yet; `History` now falls back to placeholder or locally cached thumbs until the backend thumb store is fully populated.

## Resolved Decisions

1. `Today Sessions` uses `GET /sessions` plus `SessionCoverage` as the live backend source.
2. `Today Sessions` is implemented as a flat operator checklist instead of grouped time buckets.
3. `Recent Captures` defaults to operator-plant scoping and loads the latest 20 records first.
4. `My Device` and Capture require one active camera assigned to the operator plant. Missing/ambiguous assignments require administrator correction; no recency or cross-plant fallback.
5. `My Device` keeps diagnostics read-only on mobile for now; operators can manually refresh status, while remote diagnostics remain in the admin workflow.
6. `Settings` uses persisted mobile preferences for `High-Contrast Mode` and `History Warm-Up`, and shows runtime snapshot data from the active build/session.

## Recording Rule

Any ambiguity discovered during menu integration should be added here before implementing around it silently.

7. Explicit `ALL` operator scope is supported: Capture and My Device follow the concrete plant of the selected scheduled session; no selection means no camera connection. A single-plant account remains restricted.
