# Mobile plant-camera alignment audit

Date: 2026-09-08. Post-M5 audit following web plant-scoped camera selection. The changes below are proposed, not implemented.

## Findings and follow-up

The shared backend resolver already restricts operators to their account plant. Mobile can resolve one active camera in that plant despite active cameras in other plants. End-to-end target binding still needs adjustment.

| Priority | Evidence | Required adjustment |
| --- | --- | --- |
| P1 | `src/lib/camera.ts` receives a session `deviceId`, but preview, capture and autofocus omit it. Renew, release and finalize already carry it. | Require the resolved identity and pass the same device ID throughout camera operations. |
| P1 | Root `src/lib/server/api-rest.ts`: `handleJob` resolves without a device ID. OpenAPI job polling has no target parameter. | Add validated device targeting to polling, or bind jobs to their original target server-side. Update REST, mobile polling and OpenAPI together while preserving authorization. |
| P1 | `CaptureScreen.tsx` defaults missing plant context to Acid Plant; `ensureCameraSession` checks expiry only. | Reject missing/conflicting account and scheduled-session plants. Validate lease identity and current placement server-side. Clear old leases/frames on context changes and release late session responses after cancellation. Existing tab unmount cleanup should be preserved. |
| P2 | `src/lib/devices.ts` ranks by plant, activity and recency; My Device chooses the first result while Capture uses backend resolution. | Use the same authoritative active-device assignment for both screens. Show missing/ambiguous assignment states instead of ranking fallback. This finding does not establish an authorization bypass. |
| P2 | Capture readiness uses `!!lease`; session start is manual. | Separate lease ownership from edge/USB readiness. To match requested automatic connection, resolve/start the assigned camera on entry to a valid scheduled session with lifecycle cancellation and release protection. |
| P2 | REST finalization records `station: null`. | Record resolved device placement, matching web behavior. Preserve the existing rejection of device/plant mismatches. |

Mobile remains operator-only with English UI. Plant context comes from the account and selected scheduled session, without an administrator plant selector. Missing or multiple eligible assignments must fail closed.

## Contract and documentation

Reviewed `docs/openapi.yaml`: session creation, preview, capture and autofocus already accept device IDs. Explicit job targeting requires a contract extension. Any added expected-plant parameter also requires a contract update. This audit changes no API behavior or contract.

Read the mobile project plan, product principles, functional specification, technical implementation plan, database schema, roadmap and open questions. Revise M3 implicit resolution and M4 primary-device ranking when implementing these changes. The multiple-eligible-camera question remains relevant; stale mock-screen wording in open questions also needs refreshing during follow-up.

Mobile connects to the main Capture Calcine REST API, not directly to the camera-control service. Camera hostname/port changes belong in the backend registry, not the APK API base URL. Both updated backend code and a rebuilt mobile client must reach the tested environment.

## Verification

- `npm run build` in `mobile/` passed on 2026-09-08: TypeScript and Vite, 50 modules. No Bun used.
- No application source changed; no APK installation or physical camera operation tested in this audit.
- Follow-up acceptance: Acid/Chloride operator scoping, cross-plant denial, missing/inactive/ambiguous assignments, reassignment during a lease, pinned preview/actions/jobs, navigation during session creation, edge/USB failures, and recorded plant/device/station metadata.
- Build success alone does not verify those runtime behaviors. M0–M5 completion remains unchanged; proposed adjustments are pending.
