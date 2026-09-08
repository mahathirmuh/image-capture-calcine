# Gallery plant access — 2026-09-09

## Request and policy

- [x] Restore the failed `/gallery` page.
- [x] Acid and Chloride operators see only their assigned plant.
- [x] Superadmin (`role=admin`) and explicitly unrestricted (`plant=ALL`) accounts see every plant.
- [x] Missing scope/session, deleted or disabled accounts fail closed; unknown-plant captures require unrestricted viewing access.
- [x] Apply the same scope to metadata, image URLs, thumbnail reads/writes, counts, filters, export, local-cache display, and REST capture reads.
- [x] Review and update `docs/openapi.yaml`; verify code and browser behavior.

This is web/backend maintenance; mobile remains completed through M5. No mobile admin workflows or camera-control permissions are added. Gallery viewing for an admin assigned to Acid is unrestricted; camera control remains governed by the existing capture-plant policy.

## Loading failure

The live browser reported `Failed to fetch dynamically imported module: /src/routes/gallery.tsx?tsr-split=component`. An HTTP crawl found 404 responses for optimized `react-day-picker` and `@radix-ui/react-popover` dependencies. Standalone UI previews sharing the repository's node_modules used the same default Vite cache.

`vite.config.ts` now isolates the app cache in `node_modules/.vite-app` and prebundles those lazy gallery dependencies. Preview fixtures use their own cache directory. The development-only error boundary displays the error message for diagnosis; production retains the generic message. Changing cacheDir through hot reload initially mixed the old React cache with the new React DOM cache (`Cannot read properties of null (reading use)`). A full Vite process restart was required. After the fix, all 131 imported module URLs returned successfully.

## Data and authorization

`server/gallery-access.ts` re-reads the current active database account on every access request. Cookie/token role claims do not grant viewing rights. Capture-time `metadata_json.plant` takes precedence over the location fallback, so relocating a device does not move older photos. Invalid legacy JSON does not crash plant resolution.

The list SQL applies the account plant before TOP/order; dashboard and REST summary queries scope rows before aggregation. REST GET/HEAD capture metadata/image/thumb and session coverage enforce the same policy. API integration keys retain their existing read-only cross-plant access. Out-of-scope user requests return 403; inactive/deleted accounts return 401.

The browser waits for an authorized list before showing cached images. Cache entries linked to records absent from the authorized list are hidden, including deleted records. Other-plant cached data is preserved in storage rather than deleted. CSV exports use the visible filtered registry-backed cards. Switching signed-in identity remounts the gallery, clearing old selections and signed URLs. The sidebar badge counts authorized network capture records.

## Verification

- `npm test`: **43 files, 372 tests passed**. New tests cover fresh account permissions, Acid/Chloride/ALL/admin, unknown plants, missing/deleted/disabled accounts, unauthorized full-image/thumbnail access, thumbnail writes, SQL list/summary scope, REST GET/HEAD bypass attempts, missing-record thumbnails, and shared browser cache filtering.
- Targeted ESLint passed for changed gallery, scope, media, sidebar, tests, Vite and root-error files. REST API semantic lint passed; existing unrelated Prettier findings in that file remain.
- Production build passed. Root typecheck still has pre-existing repository errors (including absent MSSQL declarations); gallery preference state type errors were corrected.
- OpenAPI parses successfully; all 143 local references resolve across 24 paths.
- Live localhost browser after the full development-server restart: gallery opened and loaded 170 registry records / 161 network image cards for the current Superadmin account; the date-filter calendar opened successfully. The live dashboard also returned 170 total records, confirming the aggregate queries execute against the current database.
- Isolated browser fixture using the real gallery component: Acid displayed only Acid; Chloride only Chloride; ALL and Superadmin displayed both plus the unknown-plant record; denied access showed zero photos despite populated cache. Acid's location dropdown contained only Acid. No fixture account/database writes or physical camera commands were performed.

## Limits

Changes have been verified locally, not deployed by this task. During verification, HEAD advanced externally to `2f684d4`, which includes the implementation; this task did not run git commit or push. Restricted-account browser checks used deterministic fixtures and authorization tests, not changes to operational user accounts. Existing signed image URLs remain valid until their five-minute expiry. Shared browser storage is filtered by the app, not encrypted or erased; previously downloaded files cannot be recalled. Gallery and sidebar use the existing bounded registry list; this is not unlimited historical pagination.
