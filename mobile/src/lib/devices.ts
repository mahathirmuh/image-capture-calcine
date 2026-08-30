import { requestWithSession, type AuthSession } from "./auth";

export type DeviceListItem = {
  code: string;
  name: string | null;
  cameraModel: string | null;
  connectionType: string | null;
  isActive: boolean;
  plant: string | null;
  station: string | null;
  bin: string | null;
  captureCount: number;
  lastCapturedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DeviceStatusResponse = {
  deviceCode: string;
  deviceName: string | null;
  plant: string | null;
  edge: Record<string, unknown>;
};

type DeviceListResponse = {
  total: number;
  devices: DeviceListItem[];
};

function rankDevice(device: DeviceListItem, preferredPlant: string | null) {
  const plantMatch = preferredPlant && preferredPlant !== "ALL" && device.plant === preferredPlant ? 1000 : 0;
  const activeScore = device.isActive ? 100 : 0;
  const lastCaptureScore = device.lastCapturedAt ? Date.parse(device.lastCapturedAt) / 1_000_000_000 : 0;
  return plantMatch + activeScore + lastCaptureScore;
}

export function pickPrimaryDevice(
  devices: DeviceListItem[],
  preferredPlant: string | null,
): DeviceListItem | null {
  if (!devices.length) return null;

  return [...devices].sort((left, right) => {
    return rankDevice(right, preferredPlant) - rankDevice(left, preferredPlant);
  })[0] ?? null;
}

export async function listDevices(
  session: AuthSession,
): Promise<{ session: AuthSession; data: DeviceListResponse }> {
  return requestWithSession<DeviceListResponse>(session, "/devices", { method: "GET" });
}

export async function getDeviceStatus(
  session: AuthSession,
  code: string,
): Promise<{ session: AuthSession; data: DeviceStatusResponse }> {
  return requestWithSession<DeviceStatusResponse>(session, `/devices/${encodeURIComponent(code)}/status`, {
    method: "GET",
  });
}
