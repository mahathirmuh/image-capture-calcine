import sql from "mssql";

import { getServerEnv } from "../env";

export type EdgeDevice = {
  id: number;
  code: string;
  name: string;
  plant: string | null;
  edgeApiUrl: string | null;
  isActive: boolean;
};

export type EdgeTarget = {
  ok: true;
  deviceId: number | null;
  deviceCode: string | null;
  deviceName: string | null;
  plant: string | null;
  baseUrl: string;
};

export type EdgeTargetFailure = { ok: false; code: string; message: string };
export type EdgeTargetResult = EdgeTarget | EdgeTargetFailure;

async function db() {
  const { getCardDbPool, getCardDbSchema } = await import("../carddb");
  return { pool: await getCardDbPool(), schema: `[${getCardDbSchema()}]` };
}

function mapDevice(row: Record<string, unknown>): EdgeDevice {
  const teks = (nilai: unknown) => (typeof nilai === "string" && nilai !== "" ? nilai : null);
  return {
    id: Number(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    plant: teks(row.plant),
    edgeApiUrl: teks(row.edge_api_url),
    isActive: Boolean(row.is_active),
  };
}

const DEVICE_QUERY = `
  SELECT d.id, d.code, d.name, d.edge_api_url, d.is_active, l.plant
  FROM {schema}.devices d
  LEFT JOIN {schema}.device_assignments da ON da.device_id = d.id AND da.is_current = 1
  LEFT JOIN {schema}.locations l ON l.id = da.location_id
  WHERE d.is_deleted = 0
`;

export async function listEdgeDevices(): Promise<EdgeDevice[]> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .query(`${DEVICE_QUERY.replaceAll("{schema}", schema)} ORDER BY d.is_active DESC, d.name ASC;`);
  return result.recordset.map((row: Record<string, unknown>) => mapDevice(row));
}

/**
 * Diekspor untuk REST API, yang perlu alamat edge sebuah device TANPA melewati
 * pemeriksaan plant milik pengguna -- kunci API baca-saja memang sudah boleh
 * membaca data seluruh plant, dan status kamera tidak lebih sensitif dari itu.
 *
 * Sengaja terpisah dari resolveEdgeTarget, bukan sebuah opsi di dalamnya:
 * pintasan yang hidup di dalam resolver akan cepat sekali dipakai jalur tulis
 * juga, dan di sanalah penguncian plant justru berarti.
 */
export async function findEdgeDevice(deviceId: number): Promise<EdgeDevice | null> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .input("id", sql.BigInt, deviceId)
    .query(`${DEVICE_QUERY.replaceAll("{schema}", schema)} AND d.id = @id;`);
  const row = result.recordset[0];
  return row ? mapDevice(row as Record<string, unknown>) : null;
}

/**
 * Menentukan edge API mana yang akan dihubungi, dan apakah pemanggil berhak.
 *
 * Satu-satunya tempat kedua pertanyaan itu dijawab. Kalau setiap serverFn
 * kamera menjawabnya sendiri-sendiri, cukup satu yang lupa memeriksa hak untuk
 * membuat sisanya sia-sia -- dan yang lupa itu tidak akan terlihat sampai
 * seseorang mengirim deviceId milik plant lain.
 *
 * Peran dan plant dibaca ulang dari database, bukan dari cookie sesi: sesi
 * disegel saat login dan tidak berubah sampai login berikutnya, jadi operator
 * yang baru dipindah plant masih membawa plant lamanya di dalam cookie.
 */
/**
 * @param actorUserId Identitas pemanggil kalau SUDAH diketahui di luar cookie
 *   sesi -- dipakai REST API, yang mengenali penggunanya lewat token bearer dan
 *   tidak punya cookie jar sama sekali. Dibiarkan kosong oleh halaman aplikasi,
 *   yang identitasnya memang dibaca dari sesi. Pengunciannya ke plant milik
 *   user berlaku sama untuk kedua jalur -- itulah gunanya lewat sini, bukan
 *   membuat resolver kedua yang lebih longgar.
 */
export async function resolveEdgeTarget(
  deviceId?: number | null,
  actorUserId?: number,
): Promise<EdgeTargetResult> {
  const fallback = getServerEnv().CAMERA_API_URL;

  const [{ isCardDbConfigured }, { getAppSession, isSessionConfigured }] = await Promise.all([
    import("../carddb"),
    import("./session"),
  ]);

  // Tanpa database atau tanpa sesi, tidak ada registry device dan tidak ada
  // identitas untuk diperiksa. Instalasi satu-device yang masih sepenuhnya
  // dikendalikan .env tetap jalan lewat jalur ini.
  if (!isCardDbConfigured() || !isSessionConfigured()) {
    return {
      ok: true,
      deviceId: null,
      deviceCode: null,
      deviceName: null,
      plant: null,
      baseUrl: fallback,
    };
  }

  let sessionUserId: number | undefined = actorUserId;
  if (sessionUserId === undefined) {
    try {
      const session = await getAppSession();
      sessionUserId = session.data.user?.id;
    } catch {
      sessionUserId = undefined;
    }
  }

  if (sessionUserId === undefined) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    };
  }

  const { findUserById } = await import("./users");
  const user = await findUserById(sessionUserId);

  if (!user || !user.isActive) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Akun Anda sudah tidak aktif." };
  }

  const { resolveUserPlantScope } = await import("../operator-plant");
  const plantScope = resolveUserPlantScope(user);
  const bebas = !plantScope.locked;
  const devices = await listEdgeDevices();

  let device: EdgeDevice | null = null;

  if (deviceId != null) {
    device = await findEdgeDevice(deviceId);
    if (!device) {
      return { ok: false, code: "DEVICE_NOT_FOUND", message: "Device tidak ada di registry." };
    }
  } else {
    // Tanpa device yang disebut, dipilihkan -- tapi hanya kalau pilihannya
    // tidak ambigu. Menebak saat ada dua kandidat berarti operator bisa
    // memotret lewat kamera di area yang salah tanpa pernah tahu.
    const kandidat = devices.filter(
      (item) => item.isActive && (bebas || item.plant === plantScope.plant),
    );
    if (kandidat.length === 1) {
      device = kandidat[0];
    } else if (kandidat.length === 0) {
      return {
        ok: false,
        code: "NO_DEVICE",
        message: bebas
          ? "Belum ada device aktif di registry. Daftarkan dulu di halaman Devices."
          : `Belum ada device aktif untuk ${plantScope.plant}. Hubungi Super Admin.`,
      };
    } else {
      return {
        ok: false,
        code: "DEVICE_AMBIGUOUS",
        message: "Ada lebih dari satu device aktif. Pilih device dulu sebelum memakai kamera.",
      };
    }
  }

  if (!bebas && device.plant !== plantScope.plant) {
    return {
      ok: false,
      code: "DEVICE_FORBIDDEN",
      message: `Akun Anda terpasang di ${plantScope.plant}, sedangkan "${device.name}" ada di ${device.plant ?? "plant yang belum ditentukan"}.`,
    };
  }

  if (!device.isActive) {
    return {
      ok: false,
      code: "DEVICE_INACTIVE",
      message: `"${device.name}" ditandai nonaktif di registry.`,
    };
  }

  return {
    ok: true,
    deviceId: device.id,
    deviceCode: device.code,
    deviceName: device.name,
    plant: device.plant,
    // Alamat di registry yang berlaku. CAMERA_API_URL tinggal jadi cadangan
    // untuk device yang alamatnya belum diisi -- bukan lagi sumber utama.
    baseUrl: device.edgeApiUrl ?? fallback,
  };
}

export async function updateDeviceEdgeUrl(deviceId: number, url: string | null): Promise<boolean> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .input("id", sql.BigInt, deviceId)
    .input("url", sql.NVarChar(300), url).query(`
      UPDATE ${schema}.devices
      SET edge_api_url = @url, updated_at = SYSUTCDATETIME()
      WHERE id = @id;
    `);
  return (result.rowsAffected[0] ?? 0) > 0;
}
