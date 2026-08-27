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
