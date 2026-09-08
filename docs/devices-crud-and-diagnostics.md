# Devices CRUD and diagnostics maintenance

Scope: web administrator registry maintenance; mobile remains operator-only. This extends the post-M5 maintenance work, without changing historical mobile phases.

## Decisions

- Create uses a new unique code; edit requires a stable database ID and keeps the code immutable. A deleted code can be re-registered: reactivate the original row/ID transactionally and create a current assignment while retaining history.
- The registry is authoritative for edit hydration, including Edge API URL. New registration starts blank instead of copying the last browser profile.
- Registry writes require a currently active admin account on the server. Authenticated registry reads respect account plant scope (administrators can manage all registry records).
- Status changes do not delete data. Deletion is soft, only after deactivation, preserving capture references/history and closing current assignment.
- Profile save confirmation follows database success; failures remain retryable.
- Runtime status, details, configs and preset operations use the selected device identity and ignore obsolete responses.
- Camera identity, USB state, camera settings/storage and nullable battery/lens fields use the existing camera endpoints. Host monitoring now uses the additive `/v1/device/telemetry` contract; legacy 404 shows an upgrade message. QC remains unsupported and is never synthesized from camera configuration.
- Address from Edge API URL is an endpoint hostname/IP, not proof of host network identity. Device ID is not a hostname.

## Verification

Verified on 2026-09-08:

- `npm test`: 327 tests across 37 suites passed, including create/edit duplicate rejection, code immutability, admin authorization, plant-scoped reads, activation/deactivation, soft deletion preserving captures, endpoint selection, camera read failures and nullable fields.
- Browser smoke test using the real route components with an isolated mock registry: new registration started blank and saved successfully; edit hydrated the URL and immutable code; save succeeded; a failed response showed an error without success; deactivation cleared old runtime data; deletion removed only the selected fixture record; activation requested the newly selected target. No production database writes or camera mutations were performed for these checks.
- Removed static example OS, IP, hostname, agent version and last-seen values from registration. Code-format validation no longer claims hardware discovery.
- Live read-only probe of the configured Edge API: `/v1/device` and `/v1/camera/status` returned HTTP 200 and `ready`. Battery and lens were actually `null`; one storage volume and eight camera settings were returned. Device identity response has no host telemetry fields.
- Production build and targeted ESLint passed. Root `tsc --noEmit` still reports repository-wide type errors, including missing `mssql` declarations and unrelated existing camera/mobile types; it is not a clean typecheck release gate.

Existing `docs/openapi.yaml` reviewed: web registry writes are TanStack server functions, not new REST routes; GET /devices stays compatible and filters deleted records. No migration is planned; existing active/deleted flags and assignment history are used.

## Monitoring integration follow-up (2026-09-08)

Camera API now provides `/v1/device/telemetry`: host CPU/RAM, supported CPU temperature, OS/hostname, uptime, data-filesystem capacity, namespace-labelled network addresses and sample timestamp. The Capture Calcine server validates the versioned response with Zod and resolves the selected device through its existing authorization policy.

The Devices overview and health tab share one presentation component. Telemetry refreshes every 30 seconds only while visible, coalesces in-flight calls and ignores stale responses after device changes. Camera disconnection does not prevent reading system metrics. Unsupported sensors and read failures stay null, not zero.

Linux production Compose in the Camera API repository now supplies narrowly scoped read-only host inputs. Disk is the filesystem holding the application's data, and container network addresses remain labelled as runtime addresses. Edge and app deployments are both required; no production deployment was performed during implementation.

Verification: 334 app tests, production build and targeted ESLint passed. The edge build and 22 tests passed. A real local collector response validated against both its OpenAPI schema and the app's Zod schema. Browser smoke checks with isolated fixtures verified the same telemetry in overview/health, monitoring during camera disconnection, and the older-agent upgrade message with normal camera controls remaining available. Root typecheck still has unrelated repository errors.

The main `docs/openapi.yaml` was explicitly reviewed: no public REST payload/path changed because this integration uses an authenticated TanStack server function. The Camera API's OpenAPI was updated with the new path, response schema, nullability, source scopes and bearer policy.

Battery/lens still depend on actual camera reporting. QC needs an image-analysis pipeline with a source capture and timestamp. Actual Linux sensors and host mounts must be verified after deployment.

## Automatic identity and re-registration (2026-09-09)

Registration reads `deviceId` automatically from the existing `/v1/device` probe after the endpoint field loses focus, or through Uji koneksi. Code is read-only; a blank display name is populated from the detected identity. Changing the endpoint invalidates detection and ignores outstanding results. New registration requires a successful identity read; an edited device cannot silently switch to a different identity.

Re-registering a deleted code restores the existing database ID, active flag and current assignment in the same serializable transaction. Capture/history rows are retained. A code still listed (including inactive devices) is rejected and must be edited instead.

OpenAPI reviewed: no public REST or Camera API contract changes; the internal probe server function adds a structured deviceCode from the existing deviceId response. No migration required.

Verification: 335 tests passed, production build and targeted ESLint passed. Browser fixture confirmed automatic code/name population on endpoint blur without clicking the probe button; registry regression verifies restoration with the original ID and no device INSERT or history deletion. No production registry writes or deployment performed.
