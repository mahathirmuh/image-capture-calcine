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

function baseUrl() {
  return process.env.CAMERA_API_URL || "http://localhost:3000";
}

function edgeHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = process.env.CAMERA_API_TOKEN;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

type ApiFailure = { ok: false; code: string; message: string };
type ApiSuccess<T> = { ok: true } & T;

export type CameraSession = {
  sessionId: string;
  leaseToken: string;
  expiresAt: string;
};

const sessionRefSchema = z.object({ sessionId: z.string(), leaseToken: z.string() });

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
      return { ok: false, code: "UNREACHABLE", message: "Can't reach the camera service" };
    }
    if (res.status === 409) {
      return { ok: false, code: "SESSION_CONFLICT", message: "Camera is in use by another client" };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "REQUEST_FAILED",
        message: `Failed to start camera session (${res.status})`,
      };
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
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const res = await fetch(`${baseUrl()}/v1/sessions/${data.sessionId}/renew`, {
        method: "POST",
        headers: edgeHeaders({
          "content-type": "application/json",
          "X-Session-Token": data.leaseToken,
        }),
        body: JSON.stringify({ leaseSeconds: data.leaseSeconds ?? 120 }),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  });

export const getPreviewFrame = createServerFn({ method: "GET" })
  .validator(sessionRefSchema)
  .handler(async ({ data }) => {
    const res = await fetch(`${baseUrl()}/v1/camera/preview`, {
      headers: edgeHeaders({ "X-Session-Token": data.leaseToken }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[camera-api] preview failed: ${res.status} ${body}`);
      throw new Error(`Preview unavailable (${res.status})`);
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
      return { ok: false, code: "UNREACHABLE", message: "Can't reach the camera service" };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "REQUEST_FAILED",
        message: `Failed to trigger capture (${res.status})`,
      };
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
      return { ok: false, code: "UNREACHABLE", message: "Can't reach the camera service" };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "REQUEST_FAILED",
        message: `Failed to autofocus (${res.status})`,
      };
    }
    return { ok: true, job: (await res.json()) as CaptureJob };
  });

export type JobResult = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: { asset: { assetId: string }; cameraPath?: string };
  error?: { code: string; message: string };
};

export const getJob = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string() }))
  .handler(async ({ data }): Promise<ApiSuccess<{ job: JobResult }> | ApiFailure> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/v1/jobs/${data.jobId}`, { headers: edgeHeaders() });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Can't reach the camera service" };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "REQUEST_FAILED",
        message: `Failed to check capture status (${res.status})`,
      };
    }
    return { ok: true, job: (await res.json()) as JobResult };
  });

// Client-side loop around `getJob` — not a server function itself, just
// polls the RPC above until the capture job reaches a terminal state.
export async function pollJob(jobId: string, intervalMs = 500): Promise<JobResult> {
  for (;;) {
    const polled = await getJob({ data: { jobId } });
    if (!polled.ok) throw new Error(polled.message);
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

export const getMediaContent = createServerFn({ method: "GET" })
  .validator(z.object({ assetId: z.string() }))
  .handler(async ({ data }) => {
    const res = await fetch(`${baseUrl()}/v1/media/${data.assetId}/content`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to download captured image (${res.status})`);
    }
    const bytes = await res.arrayBuffer();
    return new Response(bytes, {
      headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream" },
    });
  });

// Has the edge device (a native process, not a browser) copy an
// already-captured asset straight to its configured network share --
// zero-click, no File System Access picker involved. `ok:false` with code
// NETWORK_SAVE_NOT_CONFIGURED means that edge device has no NETWORK_SAVE_ROOT
// set; the caller should fall back to the browser-side save flow.
export const exportMediaToNetwork = createServerFn({ method: "POST" })
  .validator(sessionRefSchema.extend({ assetId: z.string(), relativePath: z.string() }))
  .handler(
    async ({ data }): Promise<ApiSuccess<{ savedTo: string; filename: string }> | ApiFailure> => {
      let res: Response;
      try {
        res = await fetch(`${baseUrl()}/v1/media/${data.assetId}/export`, {
          method: "POST",
          headers: edgeHeaders({
            "content-type": "application/json",
            "X-Session-Token": data.leaseToken,
          }),
          body: JSON.stringify({ relativePath: data.relativePath }),
        });
      } catch {
        return { ok: false, code: "UNREACHABLE", message: "Can't reach the camera service" };
      }
      if (res.status === 409) {
        return {
          ok: false,
          code: "NETWORK_SAVE_NOT_CONFIGURED",
          message: "This edge device has no network save folder configured",
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return {
          ok: false,
          code: (body as { code?: string })?.code ?? "REQUEST_FAILED",
          message:
            (body as { message?: string })?.message ??
            `Failed to save to the network folder (${res.status})`,
        };
      }
      const body = (await res.json()) as { assetId: string; savedTo: string; filename: string };
      return { ok: true, savedTo: body.savedTo, filename: body.filename };
    },
  );
