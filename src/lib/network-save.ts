// Penyimpanan hasil capture ke share jaringan, DIKERJAKAN OLEH APP SERVER.
//
// Sebelumnya tugas ini didelegasikan ke edge (`exportMediaToNetwork` di
// `camera-api.ts`): app hanya mengirim `targetRoot` dan edge yang menyalin
// dengan fs-nya sendiri. Konsekuensinya `NETWORK_SAVE_ROOT` harus valid di
// mesin edge, bukan di mesin yang menjalankan app -- dan mount CIFS-nya pun
// harus dipasang di sana.
//
// Di sini alurnya dibalik: app server menarik byte-nya dari edge lalu menulis
// sendiri ke `NETWORK_SAVE_ROOT` miliknya.
//
//   edge  ──GET /v1/media/:id/content──►  app server  ──fs.writeFile──►  share
//
// Artinya `NETWORK_SAVE_ROOT` sekarang dibaca relatif terhadap filesystem app
// server (di produksi: di dalam container di 10.60.10.59), yang juga membuat
// halaman Storage akhirnya menguji mesin yang benar.
//
// Tidak ada sesi kamera yang dibutuhkan: endpoint `/content` di edge tidak
// meminta `X-Session-Token`. Jadi simpan tetap berhasil walau lease kamera
// sudah kedaluwarsa antara capture dan klik simpan.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getServerEnv } from "./env";
import { joinNetworkPath, normalizeRelativeSegments, splitFilename } from "./network-path";

type SaveFailure = { ok: false; code: string; message: string };
type SaveSuccess = { ok: true; savedTo: string; filename: string };
export type NetworkSaveResult = SaveSuccess | SaveFailure;

// Batas percobaan penamaan " (2)", " (3)", ... sebelum menyerah. Tabrakan
// muncul kalau dua capture menit yang sama memperebutkan nama polos yang sama;
// puluhan sudah jauh melebihi yang mungkin terjadi dalam satu menit.
const MAX_NAME_ATTEMPTS = 25;

function errorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const saveMediaToNetwork = createServerFn({ method: "POST" })
  .validator(
    z.object({
      deviceId: z.number().int().positive().optional(),
      assetId: z.string().min(1),
      relativePath: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<NetworkSaveResult> => {
    const targetRoot = getServerEnv().NETWORK_SAVE_ROOT;
    if (!targetRoot) {
      return {
        ok: false,
        code: "NETWORK_SAVE_NOT_CONFIGURED",
        message: "Belum ada folder network save yang dikonfigurasi untuk aplikasi ini",
      };
    }

    // Divalidasi sebelum menyentuh jaringan: percuma menarik beberapa MB byte
    // kalau tujuannya sudah pasti ditolak.
    const segments = normalizeRelativeSegments(data.relativePath);
    if (!segments) {
      return {
        ok: false,
        code: "INVALID_RELATIVE_PATH",
        message: `Path relatif tidak layak dipakai: ${data.relativePath}`,
      };
    }
    const directorySegments = segments.slice(0, -1);
    const requestedName = segments[segments.length - 1];

    const { resolveEdgeTarget } = await import("./server/edge-target");
    const target = await resolveEdgeTarget(data.deviceId);
    if (!target.ok) return target;

    // Cermin dari `edgeHeaders()` di camera-api.ts. Sengaja tidak diimpor dari
    // sana: modul itu ikut ter-bundle ke klien, dan token edge tidak boleh
    // punya jalan sekecil apa pun ke sisi browser.
    const headers = new Headers();
    const token = getServerEnv().CAMERA_API_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetch(`${target.baseUrl}/v1/media/${encodeURIComponent(data.assetId)}/content`, {
        headers,
      });
    } catch {
      return { ok: false, code: "UNREACHABLE", message: "Tidak bisa menjangkau service kamera" };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "MEDIA_FETCH_FAILED",
        message: `Gagal mengambil gambar dari edge device (${res.status})`,
      };
    }
    const bytes = Buffer.from(await res.arrayBuffer());

    const { mkdir, stat, writeFile } = await import("node:fs/promises");

    // Root-nya diperiksa ada lebih dulu, dan TIDAK pernah dibuat sendiri.
    // Ini yang membedakan "share ter-mount" dari "share hilang": mount CIFS
    // dipasang dengan `nofail` supaya host tetap bisa boot saat 10.1.1.44
    // tidak terjangkau, dan begitu itu terjadi /mnt/mti hanyalah direktori
    // kosong di disk lokal. Tanpa pemeriksaan ini `mkdir -p` akan dengan
    // senang hati membuat ulang seluruh pohon di sana, menjawab "tersimpan",
    // dan diam-diam menimbun berkas di dalam container sampai disknya penuh.
    // Lebih baik gagal terang-terangan dan jatuh ke unduhan browser.
    try {
      const rootInfo = await stat(targetRoot);
      if (!rootInfo.isDirectory()) {
        return {
          ok: false,
          code: "TARGET_ROOT_NOT_DIRECTORY",
          message: `NETWORK_SAVE_ROOT ${targetRoot} ada tetapi bukan direktori`,
        };
      }
    } catch {
      return {
        ok: false,
        code: "TARGET_ROOT_MISSING",
        message: `NETWORK_SAVE_ROOT ${targetRoot} tidak ada dari app server -- share kemungkinan belum ter-mount`,
      };
    }

    const directory = joinNetworkPath(targetRoot, directorySegments);
    try {
      // Sub-folder YYYY/MM/DD dibuat sesuai kebutuhan, sama seperti jalur
      // simpan lewat browser -- tidak ada penyiapan folder tahunan manual.
      // Aman memakai recursive di sini: root-nya sudah dipastikan ada di atas,
      // jadi yang bisa terbentuk hanyalah bagian tanggalnya.
      await mkdir(directory, { recursive: true });
    } catch (error: unknown) {
      return {
        ok: false,
        code: errorCode(error) ?? "MKDIR_FAILED",
        message: `Gagal menyiapkan folder ${directory}: ${errorMessage(error, "error tidak diketahui")}`,
      };
    }

    const { base, ext } = splitFilename(requestedName);
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
      const filename = attempt === 0 ? requestedName : `${base} (${attempt + 1})${ext}`;
      const fullPath = joinNetworkPath(targetRoot, [...directorySegments, filename]);
      try {
        // Flag "wx" gagal kalau berkasnya sudah ada. Itu memang yang
        // diinginkan: memeriksa dulu lalu menulis meninggalkan celah untuk
        // capture berbarengan saling menimpa, sedangkan di sini penolakannya
        // atomik dan tinggal dicoba dengan nama berikutnya.
        await writeFile(fullPath, bytes, { flag: "wx" });
        return { ok: true, savedTo: fullPath, filename };
      } catch (error: unknown) {
        if (errorCode(error) === "EEXIST") continue;
        return {
          ok: false,
          code: errorCode(error) ?? "WRITE_FAILED",
          message: `Gagal menulis ke ${fullPath}: ${errorMessage(error, "error tidak diketahui")}`,
        };
      }
    }

    return {
      ok: false,
      code: "NAME_COLLISION",
      message: `Nama ${requestedName} dan ${MAX_NAME_ATTEMPTS - 1} varian bernomor sudah terpakai di ${directory}`,
    };
  });
