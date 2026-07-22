// Server-side client for the Canon Camera Control edge API.
//
// This TanStack Start version (1.168.x) doesn't yet have file-based API
// routes (no `createServerFileRoute`/`src/routes/api/*`), so `createServerFn`
// is the proxy mechanism instead: each export below is an RPC that only ever
// runs on this app's own server. The browser calls these functions directly
// (via the framework's generated same-origin endpoint) and never talks to the
// edge API host, so `CAMERA_API_URL` and the future bearer token never reach
// the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toEdgeProfileSettings, type DeviceProfile } from "./device-config";
import { getServerEnv } from "./env";

function baseUrl() {
  return getServerEnv().CAMERA_API_URL;
}

function edgeHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getServerEnv().CAMERA_API_TOKEN;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

type ApiFailure = { ok: false; code: string; message: string };
type ApiSuccess<T> = { ok: true } & T;
type ErrorWithCode = Error & { code?: string };

export type CameraConfigValue = string | number | boolean | null;
export type CameraConfig = {
  key: string;
  label: string;
  type: "toggle" | "enum" | "text" | "integer" | "float";
  writable: boolean;
  supported: boolean;
  value: CameraConfigValue;
  choices?: CameraConfigValue[];
  rawPath?: string | null;
};

export type CameraProfile = {
  profileId: string;
  name: string;
  description: string | null;
  settings: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
  lastAppliedAt: string | null;
};

export type CameraSession = {
  sessionId: string;
  leaseToken: string;
  expiresAt: string;
};

const sessionRefSchema = z.object({ sessionId: z.string(), leaseToken: z.string() });

function createApiError(code: string, message: string): ErrorWithCode {
  const error = new Error(message) as ErrorWithCode;
  error.code = code;
  return error;
}

export const createSession = createServerFn({ method: "POST" })
  .validator(z.object({ ownerId: z.string(), leaseSeconds: z.number() }))
  .handler(async ({ data }): Promise<ApiSuccess<{ session: CameraSession }> | ApiFailure> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/v1/sessions`, {
        method: "POST",
        headers: edgeHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          ownerType: "operator",
          ownerId: data.ownerId,
          leaseSeconds: data.leaseSeconds,
        }),
      });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
    if (res.status === 409) {
      return {
        ok: false,
        code: "SESSION_CONFLICT",
        message: "Kamera sedang dipakai oleh client lain",
      };
    }
    if (!res.ok) {
      return readFailure(res, "REQUEST_FAILED", "Gagal memulai session kamera");
    }
    return { ok: true, session: (await res.json()) as CameraSession };
  });

export const releaseSession = createServerFn({ method: "POST" })
  .validator(sessionRefSchema)
  .handler(async ({ data }) => {
    try {
      await fetch(`${baseUrl()}/v1/sessions/${data.sessionId}`, {
        method: "DELETE",
        headers: edgeHeaders({ "X-Session-Token": data.leaseToken }),
      });
    } catch {
      // Best-effort: the lease will simply expire on its own if this fails.
    }
  });

// Extend the lease on the current session. The edge API fixes a session's
// expiry at creation and never refreshes it on activity, so a station that
// previews/captures for longer than the lease must heartbeat this or the
// camera drops out mid-use. `ok: false` means the session is gone (expired or
// lost) and the caller should re-establish one.
export const renewSession = createServerFn({ method: "POST" })
  .validator(sessionRefSchema.extend({ leaseSeconds: z.number().optional() }))
  .handler(async ({ data }): Promise<{ ok: true } | ApiFailure> => {
    try {
      const res = await fetch(`${baseUrl()}/v1/sessions/${data.sessionId}/renew`, {
        method: "POST",
        headers: edgeHeaders({
          "content-type": "application/json",
          "X-Session-Token": data.leaseToken,
        }),
        body: JSON.stringify({ leaseSeconds: data.leaseSeconds ?? 120 }),
      });
      if (!res.ok) {
        return readFailure(res, "SESSION_LOST", "Session kamera tidak bisa diperpanjang");
      }
      return { ok: true };
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
  });

export const getPreviewFrame = createServerFn({ method: "GET" })
  .validator(sessionRefSchema)
  .handler(async ({ data }) => {
    const res = await fetch(`${baseUrl()}/v1/camera/preview`, {
      headers: edgeHeaders({ "X-Session-Token": data.leaseToken }),
    });
    if (!res.ok) {
      const failure = await readFailure(res, "PREVIEW_UNAVAILABLE", "Preview tidak tersedia");
      console.error(`[camera-api] preview failed: ${failure.code} ${failure.message}`);
      throw createApiError(failure.code, failure.message);
    }
    const bytes = await res.arrayBuffer();
    return new Response(bytes, {
      headers: { "content-type": res.headers.get("content-type") ?? "image/jpeg" },
    });
  });

export type CaptureJob = { jobId: string; status: string; type: string };

export const triggerCapture = createServerFn({ method: "POST" })
  .validator(sessionRefSchema)
  .handler(async ({ data }): Promise<ApiSuccess<{ job: CaptureJob }> | ApiFailure> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/v1/captures`, {
        method: "POST",
        headers: edgeHeaders({
          "content-type": "application/json",
          "X-Session-Token": data.leaseToken,
        }),
        // Do NOT set filenameTemplate: the edge API passes it straight to
        // gphoto2's own strftime-style expansion, not this app's {YYYY}-style
        // tokens — sending one produced a literal, unexpanded filename on the
        // edge node. This app names files itself via formatFilename() after
        // fetching the bytes, so the edge API's internal naming is irrelevant.
        body: JSON.stringify({
          captureTarget: "memoryCard",
          downloadToEdge: true,
          keepOnCamera: true,
        }),
      });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
    if (!res.ok) {
      return readFailure(res, "REQUEST_FAILED", "Gagal memicu capture");
    }
    return { ok: true, job: (await res.json()) as CaptureJob };
  });

// Ask the camera to autofocus. Returns a job to poll via getJob/pollJob, same
// shape as a capture; the job result is a plain { ok: true } with no asset.
export const triggerAutofocus = createServerFn({ method: "POST" })
  .validator(sessionRefSchema)
  .handler(async ({ data }): Promise<ApiSuccess<{ job: CaptureJob }> | ApiFailure> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/v1/camera/focus/autofocus`, {
        method: "POST",
        headers: edgeHeaders({
          "content-type": "application/json",
          "X-Session-Token": data.leaseToken,
        }),
      });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
    if (!res.ok) {
      return readFailure(res, "REQUEST_FAILED", "Gagal menjalankan autofocus");
    }
    return { ok: true, job: (await res.json()) as CaptureJob };
  });

export type JobResult = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: {
    asset?: { assetId: string };
    cameraPath?: string;
    profile?: CameraProfile;
    appliedKeys?: string[];
  };
  error?: { code: string; message: string };
};

export const getJob = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string() }))
  .handler(async ({ data }): Promise<ApiSuccess<{ job: JobResult }> | ApiFailure> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/v1/jobs/${data.jobId}`, { headers: edgeHeaders() });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
    if (!res.ok) {
      return readFailure(res, "REQUEST_FAILED", "Gagal mengecek status capture");
    }
    return { ok: true, job: (await res.json()) as JobResult };
  });

// Client-side loop around `getJob` — not a server function itself, just
// polls the RPC above until the capture job reaches a terminal state.
export async function pollJob(jobId: string, intervalMs = 500): Promise<JobResult> {
  for (;;) {
    const polled = await getJob({ data: { jobId } });
    if (!polled.ok) throw createApiError(polled.code, polled.message);
    if (polled.job.status === "succeeded" || polled.job.status === "failed") return polled.job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export type DeviceStatus = {
  online: boolean;
  deviceId: string | null;
  agentVersion: string | null;
  connectionState: "ready" | "disconnected" | "error" | null;
  capabilities: string[];
  camera: {
    connected: boolean;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    firmwareVersion: string | null;
  } | null;
};

const OFFLINE_STATUS: DeviceStatus = {
  online: false,
  deviceId: null,
  agentVersion: null,
  connectionState: null,
  capabilities: [],
  camera: null,
};

// No session required -- /v1/device is read-only status, unlike the
// capture/preview endpoints which need X-Session-Token.
export const getDeviceStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<DeviceStatus> => {
    try {
      const res = await fetch(`${baseUrl()}/v1/device`, { headers: edgeHeaders() });
      if (!res.ok) {
        console.error(`[camera-api] device status failed: ${res.status}`);
        return OFFLINE_STATUS;
      }
      const data = (await res.json()) as {
        deviceId: string;
        agentVersion: string;
        connectionState: DeviceStatus["connectionState"];
        capabilities: string[];
        camera: DeviceStatus["camera"];
      };
      return {
        online: true,
        deviceId: data.deviceId,
        agentVersion: data.agentVersion,
        connectionState: data.connectionState,
        capabilities: data.capabilities ?? [],
        camera: data.camera,
      };
    } catch (error) {
      console.error("[camera-api] device status error:", error);
      return OFFLINE_STATUS;
    }
  },
);

export const listCameraConfigs = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiSuccess<{ items: CameraConfig[] }> | ApiFailure> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/v1/camera/configs`, { headers: edgeHeaders() });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return {
        ok: false,
        code: (body as { code?: string })?.code ?? "REQUEST_FAILED",
        message:
          (body as { message?: string })?.message ??
          `Gagal memuat daftar konfigurasi kamera (${res.status})`,
      };
    }
    const body = (await res.json()) as { items?: CameraConfig[] };
    return { ok: true, items: body.items ?? [] };
  },
);

const applyEdgePresetProfileSchema = z.object({
  deviceCode: z.string(),
  deviceName: z.string(),
  plant: z.string(),
  bin: z.string(),
  templateId: z.string(),
  edgeProfileId: z.string().nullable().optional(),
  cameraSettings: z.object({
    iso: z.string(),
    shutter: z.string(),
    aperture: z.string(),
    whiteBalance: z.string(),
    pictureStyle: z.string(),
    focusMode: z.string(),
  }),
});

function buildEdgeProfileName(
  profile: Pick<DeviceProfile, "deviceCode" | "deviceName" | "plant" | "bin">,
) {
  const identity = profile.deviceName.trim() || profile.deviceCode.trim() || "Capture Device";
  return `${identity} - ${profile.plant} - ${profile.bin}`;
}

async function readFailure(
  res: Response,
  fallbackCode: string,
  fallbackMessage: string,
): Promise<ApiFailure> {
  const body = await res
    .clone()
    .json()
    .catch(() => null);
  const text = await res.text().catch(() => "");
  return {
    ok: false,
    code: (body as { code?: string })?.code ?? fallbackCode,
    message:
      ((body as { message?: string })?.message ?? text.trim()) ||
      `${fallbackMessage} (${res.status})`,
  };
}

async function listProfilesDirect(): Promise<ApiSuccess<{ items: CameraProfile[] }> | ApiFailure> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v1/profiles`, { headers: edgeHeaders() });
  } catch {
    return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
  }
  if (!res.ok) {
    return readFailure(res, "REQUEST_FAILED", "Gagal memuat profil kamera");
  }
  const body = (await res.json()) as { items?: CameraProfile[] };
  return { ok: true, items: body.items ?? [] };
}

async function createTemporarySession(
  ownerId: string,
): Promise<ApiSuccess<{ session: CameraSession }> | ApiFailure> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v1/sessions`, {
      method: "POST",
      headers: edgeHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        ownerType: "operator",
        ownerId,
        leaseSeconds: 120,
      }),
    });
  } catch {
    return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
  }
  if (res.status === 409) {
    return {
      ok: false,
      code: "SESSION_CONFLICT",
      message: "Kamera sedang dipakai oleh client lain",
    };
  }
  if (!res.ok) {
    return readFailure(res, "REQUEST_FAILED", "Gagal membuat session apply preset");
  }
  return { ok: true, session: (await res.json()) as CameraSession };
}

async function releaseTemporarySession(session: CameraSession): Promise<void> {
  try {
    await fetch(`${baseUrl()}/v1/sessions/${session.sessionId}`, {
      method: "DELETE",
      headers: edgeHeaders({ "X-Session-Token": session.leaseToken }),
    });
  } catch {
    // Best-effort only.
  }
}

async function pollEdgeJob(jobId: string, intervalMs = 500, maxAttempts = 60): Promise<JobResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(`${baseUrl()}/v1/jobs/${jobId}`, { headers: edgeHeaders() });
    if (!res.ok) {
      throw new Error(`Gagal mengecek status apply preset (${res.status})`);
    }
    const job = (await res.json()) as JobResult;
    if (job.status === "succeeded" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Waktu tunggu apply preset habis");
}

export const upsertAndApplyEdgePreset = createServerFn({ method: "POST" })
  .validator(applyEdgePresetProfileSchema)
  .handler(
    async ({
      data,
    }): Promise<
      | ApiSuccess<{
          edgeProfileId: string;
          edgeProfileName: string;
          edgeLastAppliedAt: number | null;
          appliedKeys: string[];
          skippedKeys: string[];
        }>
      | ApiFailure
    > => {
      const device = await getDeviceStatus();
      if (!device.online) {
        return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
      }
      if (!device.camera?.connected) {
        return {
          ok: false,
          code: "CAMERA_DISCONNECTED",
          message: "Kamera tidak terhubung lewat USB",
        };
      }
      if (!device.capabilities.includes("configWrite")) {
        return {
          ok: false,
          code: "CONFIG_WRITE_UNSUPPORTED",
          message: "Edge device ini tidak melaporkan kemampuan tulis konfigurasi",
        };
      }

      const configs = await listCameraConfigs();
      if (!configs.ok) return configs;

      const supportedWritableKeys = new Set(
        configs.items.filter((item) => item.supported && item.writable).map((item) => item.key),
      );
      const mapped = toEdgeProfileSettings(data.cameraSettings);
      const filteredSettings = Object.fromEntries(
        Object.entries(mapped.settings).filter(([key]) => supportedWritableKeys.has(key)),
      );
      const skippedKeys = [
        ...mapped.skippedKeys,
        ...Object.keys(mapped.settings)
          .filter((key) => !supportedWritableKeys.has(key))
          .map((key) =>
            key === "shutterSpeed"
              ? "shutter"
              : key === "whiteBalance"
                ? "whiteBalance"
                : key === "focusMode"
                  ? "focusMode"
                  : (key as keyof typeof data.cameraSettings),
          ),
      ];
      const uniqueSkippedKeys = [...new Set(skippedKeys)];

      if (Object.keys(filteredSettings).length === 0) {
        return {
          ok: false,
          code: "NO_SUPPORTED_SETTINGS",
          message: "Belum ada pengaturan preset yang bisa ditulis ke kamera ini",
        };
      }

      const desiredName = buildEdgeProfileName(data);
      const desiredDescription = `Managed by Capture App (${data.templateId})`;
      const listedProfiles = await listProfilesDirect();
      if (!listedProfiles.ok) return listedProfiles;

      const existingProfile =
        listedProfiles.items.find((item) => item.profileId === data.edgeProfileId) ??
        listedProfiles.items.find((item) => item.name === desiredName) ??
        null;

      let profileRes: Response;
      try {
        profileRes = await fetch(
          existingProfile
            ? `${baseUrl()}/v1/profiles/${existingProfile.profileId}`
            : `${baseUrl()}/v1/profiles`,
          {
            method: existingProfile ? "PATCH" : "POST",
            headers: edgeHeaders({ "content-type": "application/json" }),
            body: JSON.stringify({
              name: desiredName,
              description: desiredDescription,
              settings: filteredSettings,
            }),
          },
        );
      } catch {
        return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
      }
      if (!profileRes.ok) {
        return readFailure(
          profileRes,
          "REQUEST_FAILED",
          existingProfile ? "Gagal memperbarui profil edge" : "Gagal membuat profil edge",
        );
      }
      const edgeProfile = (await profileRes.json()) as CameraProfile;

      const session = await createTemporarySession(
        `preset:${data.deviceCode || data.deviceName || "capture-app"}`,
      );
      if (!session.ok) return session;

      try {
        const applyRes = await fetch(`${baseUrl()}/v1/profiles/${edgeProfile.profileId}/apply`, {
          method: "POST",
          headers: edgeHeaders({
            "X-Session-Token": session.session.leaseToken,
          }),
        });
        if (!applyRes.ok) {
          return readFailure(applyRes, "REQUEST_FAILED", "Gagal menerapkan preset");
        }

        const accepted = (await applyRes.json()) as CaptureJob;
        const job = await pollEdgeJob(accepted.jobId);
        if (job.status === "failed") {
          return {
            ok: false,
            code: job.error?.code ?? "APPLY_FAILED",
            message: job.error?.message ?? "Job apply preset gagal",
          };
        }

        const appliedProfile = job.result?.profile ?? edgeProfile;
        return {
          ok: true,
          edgeProfileId: edgeProfile.profileId,
          edgeProfileName: edgeProfile.name,
          edgeLastAppliedAt: appliedProfile.lastAppliedAt
            ? new Date(appliedProfile.lastAppliedAt).getTime()
            : null,
          appliedKeys: job.result?.appliedKeys ?? Object.keys(filteredSettings),
          skippedKeys: uniqueSkippedKeys,
        };
      } finally {
        await releaseTemporarySession(session.session);
      }
    },
  );

export const getMediaContent = createServerFn({ method: "GET" })
  .validator(z.object({ assetId: z.string() }))
  .handler(async ({ data }) => {
    const res = await fetch(`${baseUrl()}/v1/media/${data.assetId}/content`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Gagal mengunduh gambar hasil capture (${res.status})`);
    }
    const bytes = await res.arrayBuffer();
    return new Response(bytes, {
      headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream" },
    });
  });

// Has the edge device (a native process, not a browser) copy an
// already-captured asset straight to a network share -- zero-click, no File
// System Access picker involved. The destination folder is owned entirely by
// this app (NETWORK_SAVE_ROOT below), not the edge device: it's sent with
// every request, so pointing captures at a different share is a one-line env
// change here, with no edge-device redeploy needed. `ok:false` with code
// NETWORK_SAVE_NOT_CONFIGURED means this app itself has no NETWORK_SAVE_ROOT
// set; the caller should fall back to the browser-side save flow.
export const exportMediaToNetwork = createServerFn({ method: "POST" })
  .validator(sessionRefSchema.extend({ assetId: z.string(), relativePath: z.string() }))
  .handler(
    async ({ data }): Promise<ApiSuccess<{ savedTo: string; filename: string }> | ApiFailure> => {
      const targetRoot = getServerEnv().NETWORK_SAVE_ROOT;
      if (!targetRoot) {
        return {
          ok: false,
          code: "NETWORK_SAVE_NOT_CONFIGURED",
          message: "Belum ada folder network save yang dikonfigurasi untuk aplikasi ini",
        };
      }
      let res: Response;
      try {
        res = await fetch(`${baseUrl()}/v1/media/${data.assetId}/export`, {
          method: "POST",
          headers: edgeHeaders({
            "content-type": "application/json",
            "X-Session-Token": data.leaseToken,
          }),
          body: JSON.stringify({ relativePath: data.relativePath, targetRoot }),
        });
      } catch {
        return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return {
          ok: false,
          code: (body as { code?: string })?.code ?? "REQUEST_FAILED",
          message:
            (body as { message?: string })?.message ??
            `Gagal menyimpan ke folder jaringan (${res.status})`,
        };
      }
      const body = (await res.json()) as { assetId: string; savedTo: string; filename: string };
      return { ok: true, savedTo: body.savedTo, filename: body.filename };
    },
  );
