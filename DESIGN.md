# Capture Calcine design context

## Intent
Internal sampling and camera operations. Preserve the existing compact Indonesian interface, white panels, muted backgrounds, and semantic status colors. Camera identity must be explicit when multiple devices are active.

## Runtime owners
Tokens and typography: `src/styles.css`. Select/listbox: `src/components/ui/select.tsx` (Radix). Gallery status remains within its existing responsive panel; labels include device name, code, and plant. No new palette or typography is introduced.

## Interaction
Use an authored Select with keyboard navigation and an accessible label. Loading disables duplicate refresh/selection requests. Missing selection is a selection state, not proof of a disconnected camera. Errors stay inline with a retry action. Never choose the first device when multiple active choices exist.

## Scope
The Gallery status selector is read-only with respect to cameras and the registry. It persists only the browser's selected identity. Capture resolves its own target from the selected plant's current registry assignment; it never inherits Gallery's choice. Operators remain locked to their assigned plant. Location changes clear the previous preview and release the old device's lease before starting the new one. Location controls are disabled during capture, autofocus, or save. The existing native location select is retained for this narrow behavior fix, with platform-owned popup geometry.
