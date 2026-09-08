import sql from "mssql";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";

export async function deleteCaptureRecordById(input: {
  recordId: number;
  actor?: { id: number; username: string } | null;
}): Promise<
  | { ok: true; recordId: number; fileLeftOnShare: string | null }
  | { ok: false; code: string; message: string }
> {
  if (!isCardDbConfigured()) {
    return {
      ok: false,
      code: "CARDDB_NOT_CONFIGURED",
      message: "Konfigurasi CARDDB belum lengkap di server aplikasi.",
    };
  }

  try {
    const schema = `[${getCardDbSchema()}]`;
    const pool = await getCardDbPool();
    const recordId = input.recordId;

    // Path-nya dibaca SEBELUM barisnya dihapus -- setelah DELETE tidak ada
    // lagi yang tahu berkas mana yang dimaksud, dan JPEG-nya akan tinggal di
    // share selamanya tanpa apa pun yang menyebutnya.
    const existing = await pool.request().input("recordId", sql.BigInt, recordId).query(`
      SELECT TOP 1 file_path
      FROM ${schema}.capture_records
      WHERE id = @recordId;
    `);
    const existingFilePath =
      typeof existing.recordset[0]?.file_path === "string" ? existing.recordset[0].file_path : "";

    if (existing.recordset.length === 0) {
      return {
        ok: false,
        code: "CAPTURE_RECORD_NOT_FOUND",
        message: "Record capture yang cocok tidak ditemukan di MSSQL.",
      };
    }

    // Berkasnya TIDAK dibuang kalau masih ada record lain yang menunjuk path
    // yang sama.
    //
    // Keadaan itu nyata: sebelum recordCaptureResult jadi upsert, capture
    // ulang dalam satu sesi menghasilkan beberapa record untuk satu berkas.
    // Tanpa pemeriksaan ini, menghapus salah satu kartu duplikat akan
    // membuang JPEG yang masih diklaim kartu lainnya -- dan kartu yang
    // tersisa berubah jadi penunjuk berkas yang sudah tidak ada.
    const others = await pool
      .request()
      .input("recordId", sql.BigInt, recordId)
      .input("filePath", sql.NVarChar(500), existingFilePath).query(`
        SELECT COUNT(*) AS jumlah FROM ${schema}.capture_records
        WHERE file_path = @filePath AND id <> @recordId;
      `);
    const stillReferenced = Number(others.recordset[0]?.jumlah ?? 0) > 0;

    // Berkas lebih dulu, baris registry belakangan. Kalau share-nya sedang
    // tidak bisa ditulis, penghapusannya BATAL seluruhnya: record yang sudah
    // hilang duluan akan meninggalkan berkas yatim yang tidak bisa ditemukan
    // siapa pun lagi. Sebaliknya, gagal yang dilaporkan masih bisa diulang.
    const { deleteShareFile } = await import("./share-file");
    const removed = stillReferenced
      ? ({ ok: true, changed: false } as const)
      : await deleteShareFile(existingFilePath);

    // OUTSIDE_ROOT TIDAK boleh ikut menahan penghapusan record.
    //
    // Capture lama -- dari masa NETWORK_SAVE_ROOT masih menunjuk folder lain
    // (/mnt/mti/ML/MTI/YYYY/MM/DD, sebelum "Calcine Project/.../Foto
    // Sampling") -- path-nya berada di luar root yang dikelola sekarang, dan
    // app memang tidak berhak menyentuh berkasnya. Tapi baris registry-nya
    // jelas milik app ini. Menolak menghapusnya berarti kartu itu tidak akan
    // pernah bisa dibuang siapa pun, selamanya.
    //
    // Kegagalan lain (izin ditolak, mount lepas) TETAP menahan: di sana
    // berkasnya ada dan sebenarnya bisa dihapus, jadi meninggalkannya yatim
    // adalah pilihan yang buruk, bukan keharusan.
    let fileLeftOnShare: string | null = null;
    if (!removed.ok) {
      if (removed.code !== "OUTSIDE_ROOT") {
        return {
          ok: false,
          code: removed.code,
          message: `Record tidak dihapus karena berkasnya gagal dibuang: ${removed.message}`,
        };
      }
      fileLeftOnShare = existingFilePath;
    }

    await pool.request().input("recordId", sql.BigInt, recordId).query(`
      DELETE FROM ${schema}.capture_records
      WHERE id = @recordId;
    `);

    // Thumbnail-nya ikut dibuang. Tanpa ini, berkas kecil itu menumpuk di
    // volume app server untuk record yang sudah tidak ada -- tidak ada lagi
    // yang menyebutnya, jadi tidak ada lagi yang akan membersihkannya.
    //
    // Kegagalannya sengaja tidak membatalkan penghapusan: record-nya sudah
    // hilang, dan thumbnail yatim jauh lebih ringan akibatnya daripada
    // penghapusan yang dilaporkan gagal padahal sudah terjadi.
    const { deleteThumbnail } = await import("./thumb-store");
    await deleteThumbnail(recordId).catch(() => {});

    // Dicatat SETELAH penghapusan benar-benar terjadi, bukan sebelum: jejak
    // yang mencatat niat, bukan hasil, akan berbohong setiap kali aksinya
    // gagal di tengah jalan.
    const { recordActivity } = await import("./activity");
    await recordActivity({
      action: "capture.deleted",
      severity: "warning",
      actorId: input.actor?.id ?? null,
      actorUsername: input.actor?.username ?? null,
      targetId: recordId,
      targetUsername: existingFilePath ? existingFilePath.split(/[\\/]/).pop() ?? null : null,
      detail: fileLeftOnShare
        ? `Record dihapus. Berkas DIBIARKAN di ${fileLeftOnShare} (di luar folder yang dikelola app).`
        : stillReferenced
          ? `Record dihapus. Berkasnya DIPERTAHANKAN karena masih dipakai record lain: ${existingFilePath}`
          : `Record dan berkasnya dihapus permanen dari folder jaringan: ${existingFilePath || "—"}`,
    });

    return {
      ok: true,
      recordId,
      fileLeftOnShare,
    };
  } catch (error) {
    return {
      ok: false,
      code: "CAPTURE_RECORD_DELETE_FAILED",
      message:
        error instanceof Error ? error.message : "Gagal menyinkronkan hapus capture ke MSSQL.",
    };
  }
}
