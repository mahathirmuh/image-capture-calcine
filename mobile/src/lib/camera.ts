import { requestWithSession, type AuthSession } from "./auth";

export type CameraLease = {
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

type CameraJobAccepted = {
  deviceCode: string | null;
  job: CameraJob;
};

function sessionValid(lease: CameraLease | null) {
  if (!lease) return false;
  const expiresAt = Date.parse(lease.session.expiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt > Date.now() + 10_000;
}

export async function createCameraSession(
  session: AuthSession,
  options: { leaseSeconds?: number; deviceId?: number } = {},
): Promise<{ session: AuthSession; data: CameraLease }> {
  return requestWithSession<CameraLease>(session, "/camera/session", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function ensureCameraSession(
  session: AuthSession,
  lease: CameraLease | null,
): Promise<{ session: AuthSession; data: CameraLease }> {
  if (sessionValid(lease)) {
    return { session, data: lease as CameraLease };
  }

  return createCameraSession(session);
}

export async function triggerAutofocus(
  session: AuthSession,
  leaseToken: string,
): Promise<{ session: AuthSession; data: CameraJobAccepted }> {
  return requestWithSession<CameraJobAccepted>(session, "/camera/autofocus", {
    method: "POST",
    body: JSON.stringify({ leaseToken }),
  });
}

export async function triggerCapture(
  session: AuthSession,
  leaseToken: string,
): Promise<{ session: AuthSession; data: CameraJobAccepted }> {
  return requestWithSession<CameraJobAccepted>(session, "/camera/capture", {
    method: "POST",
    body: JSON.stringify({ leaseToken }),
  });
}

export async function getJob(
  session: AuthSession,
  jobId: string,
): Promise<{ session: AuthSession; data: CameraJob }> {
  return requestWithSession<CameraJob>(session, `/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });
}
