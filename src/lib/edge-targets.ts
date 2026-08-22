import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type EdgeTargetRow = {
  id: number;
  code: string;
  name: string;
  plant: string | null;
  edgeApiUrl: string | null;
  isActive: boolean;
  /** Alamat yang benar-benar dipakai: milik device, atau cadangan dari .env. */
  effectiveUrl: string;
  usesFallback: boolean;
};

export type EdgeTargetsResult =
  | { ok: true; devices: EdgeTargetRow[]; fallbackUrl: string; tokenSet: boolean }
  | { ok: false; message: string };

export type EdgeProbeResult =
  | {
      ok: true;
      reachable: boolean;
      url: string;
      status: number | null;
      latencyMs: number;
      detail: string;
    }
  | { ok: false; message: string };

const urlSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (value) => {
      if (value === "") return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    // Port beda per device sudah tercakup: URL utuh menyimpan portnya sendiri,
    // jadi http://10.60.21.10:3100 dan http://10.60.20.155:3000 sama-sama sah.
    { message: "Harus URL http:// atau https:// yang utuh, misalnya http://10.60.20.155:3000" },
  );

const saveSchema = z.object({ deviceId: z.number().int().positive(), url: urlSchema });
// Boleh menguji lewat deviceId (device yang sudah terdaftar) atau lewat url
// mentah (alamat yang baru diketik di wizard pendaftaran, sebelum devicenya ada).
const probeSchema = z.object({
  deviceId: z.number().int().positive().optional(),
  url: urlSchema.optional(),
});

async function requireAdmin() {
  const [{ isCardDbConfigured }, { isSessionConfigured, getAppSession }] = await Promise.all([
    import("./carddb"),
    import("./server/session"),
  ]);

  if (!isSessionConfigured() || !isCardDbConfigured()) {
    return { ok: false as const, message: "Konfigurasi server aplikasi belum lengkap." };
  }

  let userId: number | undefined;
  try {
    userId = (await getAppSession()).data.user?.id;
  } catch {
    userId = undefined;
  }
  if (userId === undefined) {
    return {
      ok: false as const,
      message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    };
  }

  const { findUserById } = await import("./server/users");
  const current = await findUserById(userId);
  if (!current || !current.isActive || current.role !== "admin") {
    return {
      ok: false as const,
      message: "Hanya Super Admin yang boleh mengatur alamat Edge API.",
    };
  }
  return { ok: true as const, userId };
}

export const listEdgeTargets = createServerFn({ method: "GET" }).handler(
  async (): Promise<EdgeTargetsResult> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const [{ listEdgeDevices }, { getServerEnv }] = await Promise.all([
        import("./server/edge-target"),
        import("./env"),
      ]);
      const env = getServerEnv();
      const devices = await listEdgeDevices();

      return {
        ok: true,
        fallbackUrl: env.CAMERA_API_URL,
        tokenSet: Boolean(env.CAMERA_API_TOKEN),
        devices: devices.map((device) => ({
          id: device.id,
          code: device.code,
          name: device.name,
          plant: device.plant,
          edgeApiUrl: device.edgeApiUrl,
          isActive: device.isActive,
          effectiveUrl: device.edgeApiUrl ?? env.CAMERA_API_URL,
          usesFallback: device.edgeApiUrl === null,
        })),
      };
    } catch (error) {
      return {
        ok: false,
        message: `Registry device tidak bisa dibaca: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
);

export const saveEdgeApiUrl = createServerFn({ method: "POST" })
  .validator(saveSchema)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; message: string }> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const { updateDeviceEdgeUrl } = await import("./server/edge-target");
      // Kosong berarti "pakai cadangan dari .env", bukan "alamat kosong" --
      // disimpan NULL supaya bedanya jelas di database.
      const changed = await updateDeviceEdgeUrl(data.deviceId, data.url === "" ? null : data.url);
      if (!changed) return { ok: false, message: "Device tidak ditemukan di registry." };
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: `Alamat gagal disimpan: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

/**
 * Menembak /v1/device pada sebuah edge dan melaporkan apa yang terjadi.
 *
 * Dipisah dari getDeviceStatus yang dipakai sidebar: yang ini menguji SATU
 * alamat yang disebut, termasuk device yang bukan milik plant si penguji,
 * karena tugas Super Admin memang memeriksa semuanya. Batas waktunya pendek --
 * halaman pengaturan tidak boleh menggantung setengah menit hanya untuk
 * memberi tahu bahwa sebuah alamat salah ketik.
 */
export const testEdgeConnection = createServerFn({ method: "POST" })
  .validator(probeSchema)
  .handler(async ({ data }): Promise<EdgeProbeResult> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    const [{ listEdgeDevices }, { getServerEnv }] = await Promise.all([
      import("./server/edge-target"),
      import("./env"),
    ]);
    const env = getServerEnv();

    let url = env.CAMERA_API_URL;
    if (data.url) {
      url = data.url;
    } else if (data.deviceId != null) {
      const device = (await listEdgeDevices()).find((item) => item.id === data.deviceId);
      if (!device) return { ok: false, message: "Device tidak ditemukan di registry." };
      url = device.edgeApiUrl ?? env.CAMERA_API_URL;
    }

    const headers = new Headers();
    if (env.CAMERA_API_TOKEN) headers.set("Authorization", `Bearer ${env.CAMERA_API_TOKEN}`);

    const mulai = Date.now();
    try {
      const res = await fetch(`${url}/v1/device`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Date.now() - mulai;

      if (!res.ok) {
        return {
          ok: true,
          reachable: false,
          url,
          status: res.status,
          latencyMs,
          detail: `Alamatnya menjawab, tetapi dengan status ${res.status}. Cek apakah itu benar service kamera dan bukan aplikasi lain di port yang sama.`,
        };
      }

      const body = (await res.json()) as { deviceId?: string; agentVersion?: string };
      return {
        ok: true,
        reachable: true,
        url,
        status: res.status,
        latencyMs,
        detail: `Terhubung ke ${body.deviceId ?? "device tanpa id"}${body.agentVersion ? ` (agent ${body.agentVersion})` : ""}.`,
      };
    } catch (error) {
      const latencyMs = Date.now() - mulai;
      const timeout = error instanceof Error && error.name === "TimeoutError";
      return {
        ok: true,
        reachable: false,
        url,
        status: null,
        latencyMs,
        detail: timeout
          ? "Tidak ada jawaban dalam 6 detik. Mesinnya mati, service-nya belum jalan, atau portnya diblokir firewall."
          : `Tidak bisa menjangkau alamatnya: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });
