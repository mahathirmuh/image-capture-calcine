const SELECTION_KEY = "capture-system:selected-edge-device:v1";
const PROFILE_KEY = "capture-system:device-profile:v1";
export const EDGE_SELECTION_CHANGED = "capture-system:edge-selection-changed";

export function loadSelectedEdgeDevice(): string {
  if (typeof window === "undefined") return "";
  try {
    const selected = window.localStorage.getItem(SELECTION_KEY)?.trim();
    if (selected) return selected;
    // Device identity does not depend on camera settings schema migrations.
    const profile = JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? "null");
    return typeof profile?.deviceCode === "string" ? profile.deviceCode.trim() : "";
  } catch {
    return "";
  }
}

export function saveSelectedEdgeDevice(code: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTION_KEY, code);
    window.dispatchEvent(new Event(EDGE_SELECTION_CHANGED));
  } catch {
    // The current page selection still works when browser storage is disabled.
  }
}

export function resolveSelectedEdgeDevice(
  devices: { deviceCode: string; isActive: boolean }[],
  saved: string,
): string {
  const active = devices.filter((device) => device.isActive);
  if (saved) return active.some((device) => device.deviceCode === saved) ? saved : "";
  return active.length === 1 ? active[0].deviceCode : "";
}
