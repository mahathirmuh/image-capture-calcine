// Satu baris capture, secukupnya untuk melayani gambarnya.
//
// Terpisah dari capture-records.ts supaya penyaji berkas di src/server.ts --
// yang berjalan di luar konteks TanStack -- tidak ikut menarik seluruh modul
// serverFn beserta skema validasinya.
import sql from "mssql";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";

export type MediaRecord = {
  id: number;
  fileName: string;
  filePath: string;
  plant: string | null;
  /** Apakah berkasnya memang ada di folder jaringan yang dilihat app server. */
  servable: boolean;
};

/**
 * Path semu milik jalur cadangan browser. Bukan lokasi di server mana pun --
 * berkasnya ada di folder Unduhan PC operator.
 */
const BROWSER_DOWNLOAD_PREFIX = "browser-download/";

export async function findCaptureRecordForMedia(id: number): Promise<MediaRecord | null> {
  if (!isCardDbConfigured()) return null;

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool.request().input("id", sql.BigInt, id).query(`
    SELECT
      cr.id,
      cr.file_name,
      cr.file_path,
      cr.status,
      JSON_VALUE(cr.metadata_json, '$.plant') AS meta_plant,
      JSON_VALUE(cr.metadata_json, '$.saveMethod') AS save_method,
      l.plant AS location_plant
    FROM ${schema}.capture_records cr
    LEFT JOIN ${schema}.locations l ON l.id = cr.location_id
    WHERE cr.id = @id;`);

  const row = result.recordset[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const filePath = String(row.file_path ?? "");
  const saveMethod = typeof row.save_method === "string" ? row.save_method : null;

  return {
    id: Number(row.id),
    fileName: String(row.file_name ?? ""),
    filePath,
    plant:
      (typeof row.meta_plant === "string" ? row.meta_plant : null) ??
      (typeof row.location_plant === "string" ? row.location_plant : null),
    // `spooled` sengaja ikut: berkasnya memang belum di share, tapi salinannya
    // ada di antrean app server. Penyaji berkas menanganinya sendiri -- kalau
    // belum sampai, ia menjawab 404 yang jujur, bukan menolak sejak awal.
    servable:
      filePath !== "" &&
      !filePath.startsWith(BROWSER_DOWNLOAD_PREFIX) &&
      saveMethod !== "browser-download" &&
      saveMethod !== "browser-folder",
  };
}
