# Mobile plant-camera alignment audit

Date: 2026-09-08. Post-M5 audit following web plant-scoped camera selection. The initial findings below were implemented in the follow-up recorded at the end of this document.

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

## Implementation follow-up (2026-09-08)

Implemented all six findings: pinned camera target on preview/commands/jobs/renew/release/finalize; expected plant validation in REST; no Acid fallback; automatic session creation with cross-remount serialization and late-response release; strict active same-plant My Device selection with stale-request protection; preview-based capture readiness and resolved station persistence. Updated OpenAPI for optional expected plant and job device targeting. Camera response identity is validated before accepting a lease. Existing callers can omit optional fields; mobile sends them.

Verification evidence:
- 33 tests passed across mobile request/assignment, mobile Capture lifecycle, REST target propagation and shared edge resolver suites. Includes StrictMode replay, delayed session response after unmount, preview failure gating, cross-plant context rejection, invalid job targets, changed placement and API-key write denial.
- Mobile TypeScript/Vite production build passed using npm.
- Backend production build passed in the existing isolated `.capture-verification` checkout after copying current source and OpenAPI, avoiding the running development output directory.
- OpenAPI parsed successfully with `js-yaml`; duplicate mapping keys are rejected by its default loader.
- ESLint code checks passed with `prettier/prettier` disabled to avoid repository CRLF/format churn. The initial full formatter lint failed on formatting differences; it is not recorded as a full lint pass.
- The premium static root audit reported 13 existing findings in unrelated web controls (ownership metadata, literal action detection and textarea styling). No broad UI compliance claim is made. Mobile interaction behavior was verified with component tests, not a browser or physical APK in this follow-up.
- Remaining operational verification: deploy backend, rebuild/install the APK, and exercise Acid/Chloride operators against physical cameras and confirm saved station metadata. Tests used mocks and did not trigger a real capture or write a production capture record.
