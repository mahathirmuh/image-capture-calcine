# Capture Calcine design context

## Intent
Internal sampling and camera operations. Preserve the existing compact Indonesian interface, white panels, muted backgrounds, and semantic status colors. Camera identity must be explicit when multiple devices are active.

## Runtime owners
Tokens and typography: `src/styles.css`. Select/listbox: `src/components/ui/select.tsx` (Radix). Gallery status remains within its existing responsive panel; labels include device name, code, and plant. No new palette or typography is introduced.

## Interaction
Use an authored Select with keyboard navigation and an accessible label. Loading disables duplicate refresh/selection requests. Missing selection is a selection state, not proof of a disconnected camera. Errors stay inline with a retry action. Never choose the first device when multiple active choices exist.

## Scope
The Gallery status selector is read-only with respect to cameras and the registry. It persists only the browser's selected identity. Capture resolves its own target from the selected plant's current registry assignment; it never inherits Gallery's choice. Operators remain locked to their assigned plant. Location changes clear the previous preview and release the old device's lease before starting the new one. Location controls are disabled during capture, autofocus, or save. The existing native location select is retained for this narrow behavior fix, with platform-owned popup geometry.

## Mobile camera workflow
Mobile retains its existing English operator interface, AppLogo, native buttons, inline alerts and stylesheet tokens. Behavioral owners are `mobile/src/lib/camera.ts` for pinned target requests and serialized lease operations, `CaptureScreen.tsx` for lifecycle/readiness, and `mobile/src/lib/devices.ts` for active plant eligibility. The mobile functional specification is the workflow contract. No new selector, visual tokens or administrator workflow is introduced. Capture waits for preview readiness; missing/ambiguous assignments are actionable assignment errors. Camera identity is shown beside readiness.

Mobile accounts with explicit ALL scope use the selected scheduled session plant for Capture and My Device. Without selection, camera operations remain idle and My Device directs the operator to Today Sessions. Single-plant accounts keep their assigned scope.


## Mobile direct capture and themes
Single-plant direct capture synthesizes the current scheduled context and reuses the same pinned-device lifecycle; ALL still requires selection. Automatic window expiry waits for an in-flight capture to finish saving. Light/dark and high-contrast tokens remain owned by `mobile/src/styles.css` and applied by the persisted preferences in App. The session-conflict overlay uses native HTML dialog modal behavior (top layer, focus containment, Escape, inert background), with application-owned copy, OK action and theme tokens.


### Devices maintenance (2026-09-08)

Registry create and edit are separate flows: edit hydrates the selected database ID and endpoint, code stays immutable, and save confirmation follows database success. Admins can activate/deactivate devices and soft-delete inactive entries through explicit confirmation; capture history remains intact. Runtime panels follow the selected device and clear stale responses. Show unavailable source data honestly: endpoint host is not OS hostname, camera configuration is not QC, and registration must not display invented hardware metadata. See [Devices CRUD and diagnostics](docs/devices-crud-and-diagnostics.md) for behavior and verification.


### Device telemetry integration (2026-09-08)

Overview and Health share `DeviceTelemetryPanel`. Show CPU/RAM as host metrics, disk as the application data filesystem, and label identity/network as host or runtime. Include measurement time; null sensors never become zero. Refresh telemetry every 30 seconds while visible, independently of USB operations. Old agents show an upgrade message, and stale responses cannot follow the user to another device. QC remains separate and unsupported.


### Automatic registration identity (2026-09-09)

Device Code is read-only and detected from the entered Camera API endpoint on blur or explicit probe. Do not ask operators to copy it manually. Changing an endpoint invalidates prior verification. Re-registering a deleted code restores its original database identity and history; listed duplicates are rejected.

## Gallery viewing scope (2026-09-09)

Only the authenticated server response establishes gallery visibility. Single-plant users see their plant; Superadmin and explicit ALL users see all. Keep the existing layout while stating the scope under the title. Loading or denied scope must not expose local cache or look like a successful empty gallery. Filters, visible counts, CSV and thumbnails follow the authorized records; retain hidden cache without displaying it. Gallery state is reset on account changes. Device-control restrictions remain separate from gallery viewing permissions.
