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
import { joinNetworkPath, normalizeRelativeSegments } from "./network-path";

type SaveFailure = { ok: false; code: string; message: string };
type SaveSuccess = {
  ok: true;
  savedTo: string;
  filename: string;
  /** true kalau berkasnya sudah benar-benar sampai di folder jaringan. */
  forwarded: boolean;
  /** Jumlah capture yang masih menunggu dikirim, termasuk yang ini. */
  pending: number;
};
export type NetworkSaveResult = SaveSuccess | SaveFailure;

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
      // Dipakai saat flush untuk mencocokkan record capture di registry.
      capturedAt: z.number().int().positive(),
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

    // Semua capture lewat antrean lokal dulu, lalu diteruskan ke share --
    // bukan "coba share dulu, spool kalau gagal". Lihat capture-spool.ts untuk
    // alasannya: tanpa jalur langsung, tidak ada capture baru yang bisa
    // ditimpa oleh entri antrean yang lebih tua.
    const { enqueueCapture, ensureSpoolWorker, flushSpool, getSpoolStatus } =
      await import("./server/capture-spool");
    ensureSpoolWorker();

    // Antrean boleh dimatikan dengan mengosongkan CAPTURE_SPOOL_DIR -- dipakai
    // di mesin dev, dan menjadi jalan mundur kalau antreannya bermasalah di
    // produksi. Tanpa cabang ini, deployment yang belum menyetel env baru itu
    // akan gagal menyimpan sama sekali, bukan sekadar kehilangan antreannya.
    const { getSpoolStatus: probeSpool } = await import("./server/capture-spool");
    if (!(await probeSpool()).configured) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const directory = joinNetworkPath(targetRoot, segments.slice(0, -1));
      const fullPath = joinNetworkPath(targetRoot, segments);
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(fullPath, bytes);
      } catch (error: unknown) {
        return {
          ok: false,
          code: errorCode(error) ?? "WRITE_FAILED",
          message: `Gagal menulis ke ${fullPath}: ${errorMessage(error, "error tidak diketahui")}`,
        };
      }
      return { ok: true, savedTo: fullPath, filename: requestedName, forwarded: true, pending: 0 };
    }

    const queued = await enqueueCapture(bytes, {
      relativePath: data.relativePath,
      capturedAt: data.capturedAt,
      fileName: requestedName,
    });
    if (!queued.ok) return queued;

    // Diteruskan segera, tidak menunggu timer. Saat share sehat, berkasnya
    // sampai dalam hitungan detik dan operator melihat kepastian yang sama
    // seperti sebelum antrean ini ada. Timer hanya mengurus yang tertinggal.
    const flushed = await flushSpool();
    const fullPath = joinNetworkPath(targetRoot, segments);

    if (flushed.forwarded > 0 && flushed.pending === 0) {
      return { ok: true, savedTo: fullPath, filename: requestedName, forwarded: true, pending: 0 };
    }

    // Sampai di app server tapi belum di share. Ini BUKAN kegagalan: fotonya
    // aman dan akan menyusul sendiri. Tapi juga bukan "tersimpan ke folder
    // jaringan" -- pemanggil harus menyebutnya apa adanya.
    const status = await getSpoolStatus();
    return {
      ok: true,
      savedTo: fullPath,
      filename: requestedName,
      forwarded: false,
      pending: status.pending,
    };
  });
