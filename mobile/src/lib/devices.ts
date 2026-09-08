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

export function pickPrimaryDevice(
  devices: DeviceListItem[],
  preferredPlant: string | null,
): DeviceListItem | null {
  if (!preferredPlant || preferredPlant === "ALL") {
    throw new Error("Your account needs an assigned plant. Contact your administrator.");
  }
  const eligible = devices.filter((device) => device.isActive && device.plant === preferredPlant);
  if (eligible.length > 1) {
    throw new Error("More than one active camera is assigned to your plant. Contact your administrator.");
  }
  return eligible[0] ?? null;
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
