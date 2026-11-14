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
6. Phone sign-in can fail with `Cannot reach the server` although the app and the server work (found 2026-11-13). The production hostname exists only in the office DNS; public DNS has no record for it. The office Wi-Fi also hands out public resolvers that accept DNS-over-TLS, so Android's default Private DNS ("Automatic") can resolve through them and get no address. Mobile data fails the same way. Sign-in can also fail only some of the time (checked 2026-11-14): only one of the two office DNS servers has the record, because the other holds a separate copy of the zone without it. The result then depends on which server the phone asks. Per-phone workaround (partial): stay on the office Wi-Fi with Private DNS set to Off. Decision (2026-11-14, owner): fix the network, not the app. The office Wi-Fi DHCP hands out only the office DNS servers that carry the record. The second office DNS server and the public resolvers are dropped; the second server also fails to resolve internet names. Stopgap on owner request (2026-11-14): APK 1.5.1 calls the server's public address, which is not recorded here, so sign-in no longer depends on the office DNS. Pending: IT applies the change, then a phone sign-in is verified with Private DNS back on its default. Sign-in outside the office would need a public endpoint, which is a separate decision.

## Resolved Decisions

1. `Today Sessions` uses `GET /sessions` plus `SessionCoverage` as the live backend source.
2. `Today Sessions` is implemented as a flat operator checklist instead of grouped time buckets.
3. `Recent Captures` defaults to operator-plant scoping and loads the latest 20 records first.
4. `My Device` and Capture require one active camera assigned to the operator plant. Missing/ambiguous assignments require administrator correction; no recency or cross-plant fallback.
5. `My Device` keeps diagnostics read-only on mobile for now; operators can manually refresh status, while remote diagnostics remain in the admin workflow.
6. `Settings` uses persisted mobile preferences for `Light Mode`, `High-Contrast Mode` and `History Warm-Up`, and shows runtime snapshot data from the active build/session.

7. Explicit `ALL` operator scope is supported: Capture and My Device follow the concrete plant of the selected scheduled session; no selection means no camera connection. A single-plant account remains restricted.

## Recording Rule

Any ambiguity discovered during menu integration should be added here before implementing around it silently.

8. Single-plant direct capture uses the device-local active window. Explicit selected sessions retain recovery behavior. Align operator device and backend timezone with the plant during deployment verification.


## Flexible schedule decisions — 2026-10-05

Fixed/device-clock scheduling decisions above are superseded by versioned schedules per plant and explicit plant timezone (default Asia/Makassar). Recovery is limited to already-started sessions today/yesterday. New schedule settings take effect tomorrow or later. Old APK finalization is incompatible; install 1.1.0 for verification after backend release. Physical Android/camera and network-share E2E acceptance remain user verification steps.
