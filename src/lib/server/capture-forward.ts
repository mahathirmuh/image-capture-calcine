// Menandai record capture sebagai sudah sampai di folder jaringan.
//
// Dipanggil oleh flushSpool() setelah satu entri benar-benar tertulis di
// share. Sebelum itu record-nya bertanda `spooled`, dan itu memang jujur --
// berkasnya saat itu baru ada di app server.
//
// Terpisah dari capture-spool.ts supaya modul antrean tetap murni urusan
// filesystem dan tidak menarik mssql ke dalamnya. Antrean harus tetap bisa
// dikirim walau registry sedang bermasalah; kegagalan di sini sengaja tidak
// membatalkan pengiriman -- berkasnya sudah sampai, dan record yang tertinggal
// di status `spooled` jauh lebih ringan akibatnya daripada berkas yang dikirim
// berulang kali.
import sql from "mssql";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";

export async function markCaptureForwarded(
  fileName: string,
  capturedAt: number,
  finalPath: string,
): Promise<void> {
  if (!isCardDbConfigured()) return;

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();

  // Dicocokkan lewat nama berkas + waktu capture, pola yang sama dengan rename
  // dan hapus. Jendela 120 detik menyerap selisih antara jam app server dan
  // nilai capturedAt yang berasal dari browser.
  const found = await pool
    .request()
    .input("fileName", sql.NVarChar(255), fileName)
    .input("capturedAt", sql.DateTime2, new Date(capturedAt)).query(`
      SELECT TOP 1 id, metadata_json
      FROM ${schema}.capture_records
      WHERE file_name = @fileName
        AND ABS(DATEDIFF(second, captured_at, @capturedAt)) <= 120
      ORDER BY ABS(DATEDIFF(second, captured_at, @capturedAt)), id DESC;
    `);

  const row = found.recordset[0];
  if (!row) return;

  // metadata_json ditulis ulang dengan saveMethod yang diperbarui, bukan
  // diganti seluruhnya: kunci lain di dalamnya (operator, sesi, plant) tidak
  // tersedia di sini dan tidak boleh ikut hilang.
  let metadata: Record<string, unknown> = {};
  try {
    const raw = row.metadata_json;
    if (typeof raw === "string" && raw.trim() !== "") {
      metadata = JSON.parse(raw) as Record<string, unknown>;
    }
  } catch {
    metadata = {};
  }
  metadata.saveMethod = "app-network";

  await pool
    .request()
    .input("id", sql.BigInt, Number(row.id))
    .input("filePath", sql.NVarChar(1000), finalPath)
    .input("metadataJson", sql.NVarChar(sql.MAX), JSON.stringify(metadata)).query(`
      UPDATE ${schema}.capture_records
      SET file_path = @filePath,
          status = N'saved',
          metadata_json = @metadataJson
      WHERE id = @id;
    `);
}
