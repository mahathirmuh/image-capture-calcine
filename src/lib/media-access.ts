// Menerbitkan URL berumur pendek untuk satu gambar capture.
//
// SELURUH keputusan izin diambil di sini, bukan di penyaji berkasnya: di sini
// masih ada konteks permintaan TanStack, jadi cookie sesi terbaca dan plant
// operator bisa dicek ulang dari database. Yang keluar hanyalah URL bertanda
// tangan untuk SATU record, berlaku beberapa menit -- lihat
// src/lib/server/media-token.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mediaUrlSchema = z.object({ recordId: z.number().int().positive() });

export type MediaUrlResult =
  | { ok: true; url: string; expiresAt: number }
  | { ok: false; code: string; message: string };

export const createCaptureMediaUrl = createServerFn({ method: "POST" })
  .validator(mediaUrlSchema)
  .handler(async ({ data }): Promise<MediaUrlResult> => {
    const [{ isCardDbConfigured }, { getAppSession, isSessionConfigured }] = await Promise.all([
      import("./carddb"),
      import("./server/session"),
    ]);

    if (!isCardDbConfigured()) {
      return { ok: false, code: "CARDDB_NOT_CONFIGURED", message: "Registry MSSQL belum siap." };
    }
    if (!isSessionConfigured()) {
      return { ok: false, code: "SESSION_NOT_CONFIGURED", message: "Sesi login belum aktif." };
    }

    // Harus ada yang login. Ini satu-satunya penjaga pintu -- setelah URL
    // terbit, yang melayani berkas hanya memeriksa tanda tangannya.
    let sessionUserId: number | undefined;
    try {
      sessionUserId = (await getAppSession()).data.user?.id;
    } catch {
      sessionUserId = undefined;
    }
    if (sessionUserId === undefined) {
      return { ok: false, code: "UNAUTHENTICATED", message: "Sesi login tidak terbaca." };
    }

    const { findCaptureRecordForMedia } = await import("./server/media-record");
    const record = await findCaptureRecordForMedia(data.recordId);
    if (!record) {
      return { ok: false, code: "NOT_FOUND", message: "Record capture tidak ditemukan." };
    }

    // Operator yang terikat satu plant tidak boleh menarik gambar plant lain.
    // Plant dibaca ulang dari database lewat jalur yang sama dengan halaman
    // Capture, jadi operator yang baru dipindah langsung ikut aturan barunya.
    const { getOperatorPlant } = await import("./operator-plant");
    const operator = await getOperatorPlant();
    if (operator.locked && operator.plant && record.plant && record.plant !== operator.plant) {
      return { ok: false, code: "FORBIDDEN", message: "Gambar ini milik plant lain." };
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
 * Tidak ada pemeriksaan plant di sini, dan itu disengaja: yang mengirim adalah
 * orang yang BARU SAJA melakukan capture itu, dan record-nya baru dibuat atas
 * namanya beberapa milidetik sebelumnya. Yang dijaga justru ukurannya -- lihat
 * MAX_THUMBNAIL_BYTES -- supaya endpoint ini tidak bisa dipakai menitipkan
 * berkas besar ke disk app server.
 */
export const saveCaptureThumbnail = createServerFn({ method: "POST" })
  .validator(saveThumbSchema)
  .handler(async ({ data }): Promise<SaveThumbResult> => {
    const { getAppSession, isSessionConfigured } = await import("./server/session");
    if (!isSessionConfigured()) {
      return { ok: false, code: "SESSION_NOT_CONFIGURED", message: "Sesi login belum aktif." };
    }
    try {
      if ((await getAppSession()).data.user?.id === undefined) {
        return { ok: false, code: "UNAUTHENTICATED", message: "Sesi login tidak terbaca." };
      }
    } catch {
      return { ok: false, code: "UNAUTHENTICATED", message: "Sesi login tidak terbaca." };
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
  | { ok: true; urls: Record<number, string> }
  | { ok: false; code: string; message: string };

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

    const { getAppSession, isSessionConfigured } = await import("./server/session");
    if (!isSessionConfigured()) {
      return { ok: false, code: "SESSION_NOT_CONFIGURED", message: "Sesi login belum aktif." };
    }
    try {
      if ((await getAppSession()).data.user?.id === undefined) {
        return { ok: false, code: "UNAUTHENTICATED", message: "Sesi login tidak terbaca." };
      }
    } catch {
      return { ok: false, code: "UNAUTHENTICATED", message: "Sesi login tidak terbaca." };
    }

    const [
      { getOperatorPlant },
      { findRecordPlants },
      thumbs,
      { buildThumbPath, createMediaToken },
    ] = await Promise.all([
      import("./operator-plant"),
      import("./server/media-record"),
      import("./server/thumb-store"),
      import("./server/media-token"),
    ]);

    if (!thumbs.isThumbStoreConfigured()) return { ok: true, urls: {} };

    const operator = await getOperatorPlant();
    const plants = await findRecordPlants(data.recordIds);

    const urls: Record<number, string> = {};
    for (const recordId of data.recordIds) {
      const plant = plants.get(recordId);
      // Record yang tidak dikenal registry tidak diberi URL sama sekali.
      if (plant === undefined) continue;
      if (operator.locked && operator.plant && plant && plant !== operator.plant) continue;
      if (!(await thumbs.thumbnailExists(recordId))) continue;
      urls[recordId] = buildThumbPath(recordId, await createMediaToken(recordId));
    }
    return { ok: true, urls };
  });
