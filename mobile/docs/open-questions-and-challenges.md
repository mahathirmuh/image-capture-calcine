# Mobile Open Questions And Challenges

## Open Questions

1. Should mobile continue to rely on `X-API-Key` for `POST /auth/login`, or should login be opened for mobile clients in a later backend phase?
2. If `POST /camera/session` returns ambiguity because more than one camera is eligible, what is the final operator-facing device selection rule?

## Current Challenges

1. Several mobile screens still render mock data and need phased API integration.
2. The current mobile app uses state-based navigation; deeper workflow linking may later justify router-based navigation.
3. Public/mobile web access depends on deployed backend CORS support, not only local code changes.
4. `Today Sessions` currently derives only `completed`, `missing`, and `upcoming` because `/sessions` has no dedicated `retake` state in the contract.
5. Some older capture records may not have server-side thumbnails yet; `History` now falls back to placeholder or locally cached thumbs until the backend thumb store is fully populated.

## Resolved Decisions

1. `Today Sessions` uses `GET /sessions` plus `SessionCoverage` as the live backend source.
2. `Today Sessions` is implemented as a flat operator checklist instead of grouped time buckets.
3. `Recent Captures` defaults to operator-plant scoping and loads the latest 20 records first.
4. `My Device` currently resolves the primary device by preferring active devices that match the operator plant, then falling back to the most recently active device.

## Recording Rule

Any ambiguity discovered during menu integration should be added here before implementing around it silently.
