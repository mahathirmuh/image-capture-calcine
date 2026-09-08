import {
  requestResponseWithSession,
  requestWithSession,
  type AuthSession,
} from "./auth";

export type CameraLease = {
  deviceId: number;
  deviceCode: string | null;
  plant: string | null;
  ownerId: string;
  session: {
    sessionId: string;
    leaseToken: string;
    expiresAt: string;
  };
};

export type CameraJob = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export type FinalizedCapture = {
  recordId: number;
  replaced: boolean;
  fileName: string;
  filePath: string;
  saveMethod: "app-network" | "spooled";
  forwarded: boolean;
  pending: number;
  deviceCode: string | null;
  plant: string;
  captureSession: string;
  captureBin: string;
  capturedAt: string;
};

type CameraJobAccepted = {
  deviceCode: string | null;
  job: CameraJob;
};

export function sessionValid(lease: CameraLease | null) {
  if (!lease || !Number.isInteger(lease.deviceId) || lease.deviceId < 1 || !lease.plant) return false;
  const expiresAt = Date.parse(lease.session.expiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt > Date.now() + 10_000;
}

export async function createCameraSession(
  session: AuthSession,
  options: { leaseSeconds?: number; deviceId?: number; plant: string },
): Promise<{ session: AuthSession; data: CameraLease }> {
  return requestWithSession<CameraLease>(session, "/camera/session", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function ensureCameraSession(
  session: AuthSession,
  lease: CameraLease | null,
  plant: string,
): Promise<{ session: AuthSession; data: CameraLease }> {
  if (!plant || plant === "ALL" || session.user.plant !== plant) {
    throw new Error("The selected session must match your assigned plant.");
  }
  if (lease && (lease.plant !== plant || lease.ownerId !== session.user.username)) {
    throw new Error("Camera assignment changed. Restart the camera session.");
  }
  if (sessionValid(lease)) {
    return { session, data: lease as CameraLease };
  }

  const response = await createCameraSession(session, { plant });
  if (!sessionValid(response.data) || response.data.plant !== plant || response.data.ownerId !== session.user.username) {
    await releaseCameraSession(response.session, response.data).catch(() => undefined);
    throw new Error("The camera response does not match your assigned plant.");
  }
  return response;
}

export async function renewCameraSession(
  session: AuthSession,
  lease: CameraLease,
  options: { leaseSeconds?: number } = {},
): Promise<{ session: AuthSession; data: CameraLease }> {
  const leaseSeconds = options.leaseSeconds ?? 120;
  const response = await requestWithSession<{
    ok: boolean;
    deviceCode: string | null;
    plant: string | null;
    session: CameraLease["session"];
  }>(session, "/camera/session/renew", {
    method: "POST",
    body: JSON.stringify({
      sessionId: lease.session.sessionId,
      leaseToken: lease.session.leaseToken,
      leaseSeconds,
      plant: lease.plant,
      deviceId: lease.deviceId,
    }),
  });

  return {
    session: response.session,
    data: {
      ...lease,
      deviceId: lease.deviceId,
      deviceCode: response.data.deviceCode ?? lease.deviceCode,
      plant: response.data.plant ?? lease.plant,
      session: response.data.session,
    },
  };
}

export async function releaseCameraSession(
  session: AuthSession,
  lease: CameraLease,
): Promise<{ session: AuthSession; data: { released: boolean; alreadyClosed: boolean; sessionId: string } }> {
  return requestWithSession(session, `/camera/session/${encodeURIComponent(lease.session.sessionId)}`, {
    method: "DELETE",
    body: JSON.stringify({
      leaseToken: lease.session.leaseToken,
      plant: lease.plant,
      ...(lease.deviceId ? { deviceId: lease.deviceId } : {}),
    }),
  });
}

export async function getPreviewFrame(
  session: AuthSession,
  lease: CameraLease,
): Promise<{ session: AuthSession; response: Response }> {
  return requestResponseWithSession(session, `/camera/preview?${cameraTargetQuery(lease)}`, {
    method: "GET",
    headers: {
      "X-Session-Token": lease.session.leaseToken,
    },
  });
}

export async function finalizeCaptureResult(
  session: AuthSession,
  payload: {
    assetId: string;
    capturedAt: number;
    plant: string;
    captureSession: string;
    slot: 1 | 2;
    deviceId?: number | null;
  },
): Promise<{ session: AuthSession; data: FinalizedCapture }> {
  return requestWithSession<FinalizedCapture>(session, "/captures/finalize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function triggerAutofocus(
  session: AuthSession,
  lease: CameraLease,
): Promise<{ session: AuthSession; data: CameraJobAccepted }> {
  return requestWithSession<CameraJobAccepted>(session, "/camera/autofocus", {
    method: "POST",
    body: JSON.stringify({ leaseToken: lease.session.leaseToken, deviceId: lease.deviceId, plant: lease.plant }),
  });
}

export async function triggerCapture(
  session: AuthSession,
  lease: CameraLease,
): Promise<{ session: AuthSession; data: CameraJobAccepted }> {
  return requestWithSession<CameraJobAccepted>(session, "/camera/capture", {
    method: "POST",
    body: JSON.stringify({ leaseToken: lease.session.leaseToken, deviceId: lease.deviceId, plant: lease.plant }),
  });
}

export async function getJob(
  session: AuthSession,
  jobId: string,
  lease: CameraLease,
): Promise<{ session: AuthSession; data: CameraJob }> {
  return requestWithSession<CameraJob>(session, `/jobs/${encodeURIComponent(jobId)}?${cameraTargetQuery(lease)}`, {
    method: "GET",
  });
}

function cameraTargetQuery(lease: CameraLease) {
  if (!Number.isInteger(lease.deviceId) || lease.deviceId < 1 || !lease.plant) {
    throw new Error("Camera assignment is unavailable. Restart the camera session.");
  }
  return new URLSearchParams({ deviceId: String(lease.deviceId), plant: lease.plant }).toString();
}

// Serialize lease changes across screen remounts, including late responses.
let sessionOperations: Promise<unknown> = Promise.resolve();
export function queueCameraSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = sessionOperations.catch(() => undefined).then(operation);
  sessionOperations = next;
  return next;
}
