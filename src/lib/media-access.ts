// Menerbitkan URL berumur pendek untuk satu gambar capture.
//
// SELURUH keputusan izin diambil di sini, bukan di penyaji berkasnya: di sini
// masih ada konteks permintaan TanStack, jadi cookie sesi terbaca dan plant
// operator bisa dicek ulang dari database. Yang keluar hanyalah URL bertanda
// tangan untuk SATU record, berlaku beberapa menit -- lihat
// src/lib/server/media-token.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { canViewGalleryPlant } from "./gallery-access";

const mediaUrlSchema = z.object({ recordId: z.number().int().positive() });

export type MediaUrlResult =
  { ok: true; url: string; expiresAt: number } | { ok: false; code: string; message: string };

export const createCaptureMediaUrl = createServerFn({ method: "POST" })
  .validator(mediaUrlSchema)
  .handler(async ({ data }): Promise<MediaUrlResult> => {
    const { requireGalleryAccess } = await import("./server/gallery-access");
    const access = await requireGalleryAccess();
    if (!access.ok) return access;

    const { findCaptureRecordForMedia } = await import("./server/media-record");
    const record = await findCaptureRecordForMedia(data.recordId);
    if (!record) {
      return { ok: false, code: "NOT_FOUND", message: "Record capture tidak ditemukan." };
    }

    if (!canViewGalleryPlant(access.scope, record.plant)) {
      return { ok: false, code: "FORBIDDEN", message: "Gambar ini di luar akses plant Anda." };
    }

    // Hanya berkas yang benar-benar ada di folder jaringan yang bisa dilayani.
    // Record `browser-download` menyimpan path semu ("browser-download/x.jpg")
    // yang menunjuk ke folder Unduhan PC operator -- tidak ada di server mana
    // pun, dan mencoba membukanya hanya menghasilkan ENOENT yang membingungkan.
    if (!record.servable) {
      return {
        ok: false,
        code: "NOT_ON_NETWORK",
        message: "Foto ini tidak pernah masuk folder jaringan, jadi tidak ada di server.",
      };
    }

    const { buildMediaPath, createMediaToken } = await import("./server/media-token");
    const token = await createMediaToken(data.recordId);
    return { ok: true, url: buildMediaPath(data.recordId, token), expiresAt: token.expiresAt };
  });

const saveThumbSchema = z.object({
  recordId: z.number().int().positive(),
  /** JPEG ter-base64, tanpa awalan data URL. */
  base64: z.string().min(1).max(2_000_000),
});

export type SaveThumbResult = { ok: true } | { ok: false; code: string; message: string };

/**
 * Titipkan thumbnail yang dibuat browser operator.
 *
 * Pengirim harus tetap aktif dan berhak melihat record tujuan.
 * Batas ukuran JPEG tetap ditegakkan oleh penyimpanan thumbnail.
 */
export const saveCaptureThumbnail = createServerFn({ method: "POST" })
  .validator(saveThumbSchema)
  .handler(async ({ data }): Promise<SaveThumbResult> => {
    const { requireGalleryAccess } = await import("./server/gallery-access");
    const access = await requireGalleryAccess();
    if (!access.ok) return access;
    const { findRecordPlants } = await import("./server/media-record");
    const plants = await findRecordPlants([data.recordId]);
    if (
      !plants.has(data.recordId) ||
      !canViewGalleryPlant(access.scope, plants.get(data.recordId))
    ) {
      return { ok: false, code: "FORBIDDEN", message: "Thumbnail di luar akses plant Anda." };
    }

    const { saveThumbnail } = await import("./server/thumb-store");
    return saveThumbnail(data.recordId, Buffer.from(data.base64, "base64"));
  });

const thumbUrlsSchema = z.object({
  // Sebesar satu halaman grid dengan kelonggaran. Batas ini yang menahan satu
  // permintaan menanyakan seluruh tabel sekaligus.
  recordIds: z.array(z.number().int().positive()).max(200),
});

export type ThumbUrlsResult =
  { ok: true; urls: Record<number, string> } | { ok: false; code: string; message: string };

/**
 * URL bertanda tangan untuk sekumpulan thumbnail, satu kali jalan.
 *
 * Grid memuat 24 kartu sekaligus; meminta URL satu per satu berarti 24
 * perjalanan bolak-balik sebelum gambar pertama muncul.
 *
 * Yang TIDAK punya thumbnail sengaja tidak muncul di hasil, bukan dikembalikan
 * sebagai URL yang nanti menghasilkan 404: kartunya lalu bisa menampilkan
 * placeholder yang benar, bukan gambar rusak.
 */
export const createCaptureThumbUrls = createServerFn({ method: "POST" })
  .validator(thumbUrlsSchema)
  .handler(async ({ data }): Promise<ThumbUrlsResult> => {
    if (data.recordIds.length === 0) return { ok: true, urls: {} };

    const { requireGalleryAccess } = await import("./server/gallery-access");
    const access = await requireGalleryAccess();
    if (!access.ok) return access;

    const [{ findRecordPlants }, thumbs, { buildThumbPath, createMediaToken }] = await Promise.all([
      import("./server/media-record"),
      import("./server/thumb-store"),
      import("./server/media-token"),
    ]);

    if (!thumbs.isThumbStoreConfigured()) return { ok: true, urls: {} };

    const plants = await findRecordPlants(data.recordIds);

    const urls: Record<number, string> = {};
    for (const recordId of data.recordIds) {
      const plant = plants.get(recordId);
      // Record yang tidak dikenal registry tidak diberi URL sama sekali.
      if (plant === undefined) continue;
      if (!canViewGalleryPlant(access.scope, plant)) continue;
      if (!(await thumbs.thumbnailExists(recordId))) continue;
      urls[recordId] = buildThumbPath(recordId, await createMediaToken(recordId));
    }
    return { ok: true, urls };
  });
