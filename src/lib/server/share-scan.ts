// Pemindai folder jaringan untuk "Sinkronkan folder".
//
// Tiga langkah yang sengaja dipisah supaya dua yang pertama bisa diuji tanpa
// SQL Server:
//
//   1. listShareFiles()   -- membaca folder, tidak tahu apa-apa soal registry
//   2. diffShareListing() -- murni: mana yang baru, mana yang sudah tercatat,
//                            mana baris yang berkasnya hilang
//   3. runShareSync()     -- menggabungkan keduanya dengan registry
//
// Pemindaian HANYA membaca share. Satu-satunya yang ditulis adalah baris
// registry, dan itu pun hanya kalau `apply` diminta.
import sql from "mssql";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";
import { getServerEnv } from "../env";
import { isPlatformMismatchedRoot, joinNetworkPath } from "../network-path";
import {
  SHARE_SYNC_MAX_NEW_FILES,
  SHARE_SYNC_REPORT_ROWS,
  classifyShareFile,
  isShareImageFile,
  isShareNoiseFile,
  resolveImportedCapturedAt,
  sharePlantFolders,
  type ShareFileInfo,
  type ShareSkipReason,
  type ShareSyncItem,
  type ShareSyncReport,
  type ShareSyncResult,
} from "../share-import";
import type { CaptureTrack } from "../capture-schedule";

/** Panjang kolom `file_path` dan `file_name` di dbo.capture_records. */
const FILE_PATH_MAX = 500;
const FILE_NAME_MAX = 255;

export type ShareListing = {
  folders: { folder: string; plant: string; track: CaptureTrack; found: boolean }[];
  /** Berkas gambar, sebagai segmen relatif terhadap root (nama asli di disk). */
  files: string[][];
  /** Berkas yang bukan gambar dan bukan sampah sistem. */
  unsupported: string[][];
  /** Subfolder yang bukan folder tanggal; isinya tidak dibaca. */
  otherFolders: string[];
  /** Folder yang berhasil dibaca, dalam bentuk kunci pembanding. */
  listedDirs: Set<string>;
};

/**
 * Bentuk pembanding sebuah path: pemisah diseragamkan dan huruf dikecilkan.
 *
 * Share-nya CIFS, yang tidak membedakan huruf besar-kecil, dan path lama di
 * registry bisa berpemisah `\` sementara yang baru `/`. Tanpa penyeragaman,
 * berkas yang sama akan terdaftar dua kali hanya karena ejaannya berbeda.
 */
export function sharePathKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

type Entry = { name: string; isFile: boolean; isDirectory: boolean };

async function readEntries(directory: string): Promise<Entry[] | null> {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    // Folder yang tidak ada atau tidak terbaca diperlakukan kosong: satu
    // folder tanggal yang bermasalah tidak boleh menggagalkan seluruh pindai.
    return null;
  }
}

/**
 * Daftar berkas di folder plant untuk rentang tanggal `from`..`to`.
 *
 * Yang dibaca: folder tanggal `<Plant>/YYYY/MM/DD` di dalam rentang, ditambah
 * berkas lepas yang ditaruh langsung di folder plant, folder tahun, atau
 * folder bulan. Berkas lepas itu tidak punya tanggal untuk disaring, dan
 * justru itulah bentuk paling umum dari "saya taruh saja di foldernya".
 *
 * Subfolder lain TIDAK ditelusuri. Share ini juga dipakai untuk keperluan
 * lain, dan menelusuri apa pun yang ada di dalamnya bisa menyeret ribuan
 * berkas yang tidak dimaksudkan masuk galeri.
 */
export async function listShareFiles(
  root: string,
  from: string,
  to: string,
): Promise<ShareListing> {
  const listing: ShareListing = {
    folders: [],
    files: [],
    unsupported: [],
    otherFolders: [],
    listedDirs: new Set(),
  };

  const rootEntries = (await readEntries(root)) ?? [];

  const collect = (segments: string[], entries: Entry[]) => {
    listing.listedDirs.add(sharePathKey(joinNetworkPath(root, segments)));
    for (const entry of entries) {
      if (!entry.isFile || isShareNoiseFile(entry.name)) continue;
      const target = isShareImageFile(entry.name) ? listing.files : listing.unsupported;
      target.push([...segments, entry.name]);
    }
  };

  for (const home of sharePlantFolders()) {
    // Nama di disk dipakai apa adanya; pencocokannya saja yang longgar.
    const onDisk = rootEntries.find(
      (entry) => entry.isDirectory && entry.name.toLowerCase() === home.folder.toLowerCase(),
    );
    listing.folders.push({ ...home, found: !!onDisk });
    if (!onDisk) continue;

    const plantSegments = [onDisk.name];
    const plantEntries = await readEntries(joinNetworkPath(root, plantSegments));
    if (!plantEntries) continue;
    collect(plantSegments, plantEntries);

    for (const year of plantEntries.filter((entry) => entry.isDirectory)) {
      const yearSegments = [...plantSegments, year.name];
      if (!/^\d{4}$/.test(year.name)) {
        listing.otherFolders.push(yearSegments.join("/"));
        continue;
      }
      if (year.name < from.slice(0, 4) || year.name > to.slice(0, 4)) continue;
      const yearEntries = await readEntries(joinNetworkPath(root, yearSegments));
      if (!yearEntries) continue;
      collect(yearSegments, yearEntries);

      for (const month of yearEntries.filter((entry) => entry.isDirectory)) {
        const monthSegments = [...yearSegments, month.name];
        if (!/^\d{2}$/.test(month.name)) {
          listing.otherFolders.push(monthSegments.join("/"));
          continue;
        }
        const monthKey = `${year.name}-${month.name}`;
        if (monthKey < from.slice(0, 7) || monthKey > to.slice(0, 7)) continue;
        const monthEntries = await readEntries(joinNetworkPath(root, monthSegments));
        if (!monthEntries) continue;
        collect(monthSegments, monthEntries);

        for (const day of monthEntries.filter((entry) => entry.isDirectory)) {
          const daySegments = [...monthSegments, day.name];
          if (!/^\d{2}$/.test(day.name)) {
            listing.otherFolders.push(daySegments.join("/"));
            continue;
          }
          const dayKey = `${monthKey}-${day.name}`;
          if (dayKey < from || dayKey > to) continue;
          const dayEntries = await readEntries(joinNetworkPath(root, daySegments));
          if (!dayEntries) continue;
          collect(daySegments, dayEntries);
          for (const nested of dayEntries.filter((entry) => entry.isDirectory)) {
            listing.otherFolders.push([...daySegments, nested.name].join("/"));
          }
        }
      }
    }
  }

  return listing;
}

export type KnownShareRecord = { id: number; filePath: string; status: string };

export type ShareDiff = {
  /** Berkas di share yang belum punya baris registry. */
  newFiles: string[][];
  alreadyRegistered: number;
  /** Baris `saved` yang foldernya terbaca tetapi berkasnya tidak ada. */
  missing: { recordId: number; relativePath: string }[];
};

export function diffShareListing(
  root: string,
  listing: Pick<ShareListing, "files" | "unsupported" | "listedDirs">,
  known: readonly KnownShareRecord[],
): ShareDiff {
  const knownKeys = new Set(known.map((record) => sharePathKey(record.filePath)));
  const seenKeys = new Set<string>();
  const newFiles: string[][] = [];
  let alreadyRegistered = 0;

  for (const segments of listing.files) {
    const key = sharePathKey(joinNetworkPath(root, segments));
    seenKeys.add(key);
    if (knownKeys.has(key)) alreadyRegistered += 1;
    else newFiles.push(segments);
  }

  // Berkas yang jenisnya tidak didaftarkan tetap ADA di share; barisnya (kalau
  // ada) bukan baris yang berkasnya hilang.
  for (const segments of listing.unsupported) {
    seenKeys.add(sharePathKey(joinNetworkPath(root, segments)));
  }

  const rootKey = sharePathKey(root);
  const missing: ShareDiff["missing"] = [];
  for (const record of known) {
    // `pending` berarti berkasnya masih di antrean app server -- belum ada di
    // share itu keadaan yang sah, bukan berkas hilang.
    if (record.status !== "saved") continue;
    const key = sharePathKey(record.filePath);
    if (seenKeys.has(key)) continue;
    const directory = key.slice(0, key.lastIndexOf("/"));
    // Hanya folder yang benar-benar dibaca yang bisa dinilai. Folder di luar
    // rentang tidak dibaca, jadi berkas di sana tidak diketahui ada-tidaknya.
    if (!listing.listedDirs.has(directory)) continue;
    const relative = record.filePath.replace(/\\/g, "/");
    missing.push({
      recordId: record.id,
      relativePath: key.startsWith(`${rootKey}/`) ? relative.slice(rootKey.length + 1) : relative,
    });
  }

  return { newFiles, alreadyRegistered, missing };
}

function escapeLike(value: string): string {
  return value.replace(/[[\]%_]/g, "[$&]");
}

async function loadKnownRecords(root: string): Promise<KnownShareRecord[]> {
  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool
    .request()
    .input("prefix", sql.NVarChar(600), `${escapeLike(root.replace(/[\\/]+$/, ""))}%`).query(`
      SELECT id, file_path, status
      FROM ${schema}.capture_records
      WHERE file_path LIKE @prefix;
    `);
  return (result.recordset as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    filePath: String(row.file_path ?? ""),
    status: String(row.status ?? ""),
  }));
}

/**
 * Device yang ditunjuk baris impor, per plant.
 *
 * `capture_records.device_id` wajib terisi, padahal foto ini tidak diambil
 * device mana pun. Yang dipakai adalah device yang sedang ditempatkan di plant
 * itu -- sekadar memenuhi kolomnya. Metadata barisnya sengaja TIDAK memuat
 * kode device, supaya galeri tidak mengaku foto ini hasil kamera tersebut.
 */
async function loadPlantDevices(): Promise<Map<string, number>> {
  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool.request().query(`
    SELECT d.id, l.plant
    FROM ${schema}.devices d
    INNER JOIN ${schema}.device_assignments da ON da.device_id = d.id AND da.is_current = 1
    INNER JOIN ${schema}.locations l ON l.id = da.location_id
    WHERE d.is_deleted = 0
    ORDER BY d.is_active DESC, d.id ASC;
  `);
  const byPlant = new Map<string, number>();
  for (const row of result.recordset as Record<string, unknown>[]) {
    const plant = typeof row.plant === "string" ? row.plant : null;
    if (plant && !byPlant.has(plant)) byPlant.set(plant, Number(row.id));
  }
  return byPlant;
}

async function resolveLocationId(
  deviceId: number,
  plant: string,
  slot: number | null,
): Promise<number | null> {
  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool
    .request()
    .input("deviceId", sql.BigInt, deviceId)
    .input("plant", sql.NVarChar(100), plant)
    .input("preferredBin", sql.NVarChar(100), slot ? `Bin ${slot}` : null).query(`
      SELECT TOP 1 l.id
      FROM ${schema}.locations l
      LEFT JOIN ${schema}.device_assignments da
        ON da.location_id = l.id
        AND da.device_id = @deviceId
        AND da.is_current = 1
      WHERE l.plant = @plant
        AND (@preferredBin IS NULL OR l.bin = @preferredBin OR l.bin = N'Bin 1 / Bin 2')
      ORDER BY
        CASE WHEN da.id IS NOT NULL THEN 0 ELSE 1 END,
        CASE
          WHEN @preferredBin IS NOT NULL AND l.bin = @preferredBin THEN 0
          WHEN l.bin = N'Bin 1 / Bin 2' THEN 1
          ELSE 2
        END,
        l.id;
    `);
  return result.recordset[0] ? Number(result.recordset[0].id) : null;
}

type Candidate = ShareSyncItem & {
  fullPath: string;
  fileName: string;
  info: ShareFileInfo;
  modifiedAt: number;
  deviceId: number;
};

/** Isi `metadata_json` sebuah baris impor. Diekspor supaya bentuknya teruji. */
export function buildImportedMetadata(
  info: ShareFileInfo,
  actor: { id: number; username: string },
  modifiedAt: number,
  importedAt: number,
) {
  return {
    // Penanda yang dibaca mapCaptureRecordRow() sebagai origin "share-import".
    source: "share-import",
    deviceCode: null,
    deviceName: null,
    plant: info.plant,
    captureBin: info.captureBin,
    captureSession: info.session,
    captureTrack: info.track,
    // Tidak ada yang menekan Capture. Yang mendaftarkan dicatat terpisah --
    // mengisinya sebagai operator akan membuat galeri mengaku ia yang memotret.
    capturedByUserId: null,
    capturedBy: null,
    station: null,
    // Berkasnya memang ada di folder jaringan, jadi ia dilayani dan ditampilkan
    // seperti foto jaringan lainnya.
    saveMethod: "app-network",
    assetId: null,
    importedByUserId: actor.id,
    importedBy: actor.username,
    importedAt: new Date(importedAt).toISOString(),
    fileModifiedAt: new Date(modifiedAt).toISOString(),
  };
}

async function insertImportedRecord(
  candidate: Candidate,
  actor: { id: number; username: string },
  locationId: number | null,
): Promise<"inserted" | "exists"> {
  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const metadata = buildImportedMetadata(candidate.info, actor, candidate.modifiedAt, Date.now());
  // NOT EXISTS di dalam pernyataan yang sama: dua Super Admin yang menekan
  // tombolnya bersamaan tidak boleh menghasilkan dua baris untuk satu berkas.
  const result = await pool
    .request()
    .input("deviceId", sql.BigInt, candidate.deviceId)
    .input("locationId", sql.BigInt, locationId)
    .input("capturedAt", sql.DateTime2, new Date(candidate.capturedAt))
    .input("fileName", sql.NVarChar(FILE_NAME_MAX), candidate.fileName)
    .input("filePath", sql.NVarChar(FILE_PATH_MAX), candidate.fullPath)
    .input("fileSizeBytes", sql.BigInt, candidate.sizeBytes)
    .input("metadataJson", sql.NVarChar(sql.MAX), JSON.stringify(metadata)).query(`
      INSERT INTO ${schema}.capture_records (
        device_id, location_id, captured_at, file_name, file_path,
        status, file_size_bytes, checksum_sha256, metadata_json
      )
      OUTPUT INSERTED.id
      SELECT
        @deviceId, @locationId, @capturedAt, @fileName, @filePath,
        N'saved', @fileSizeBytes, NULL, @metadataJson
      WHERE NOT EXISTS (
        SELECT 1 FROM ${schema}.capture_records WHERE file_path = @filePath
      );
    `);
  return result.recordset.length > 0 ? "inserted" : "exists";
}

function failure(code: string, message: string): ShareSyncResult {
  return { ok: false, code, message };
}

export async function runShareSync(input: {
  from: string;
  to: string;
  apply: boolean;
  actor: { id: number; username: string };
}): Promise<ShareSyncResult> {
  if (!isCardDbConfigured()) {
    return failure("CARDDB_NOT_CONFIGURED", "Konfigurasi CARDDB belum lengkap di server aplikasi.");
  }
  const root = getServerEnv().NETWORK_SAVE_ROOT;
  if (!root) {
    return failure(
      "NETWORK_SAVE_NOT_CONFIGURED",
      "Belum ada folder network save yang dikonfigurasi untuk aplikasi ini",
    );
  }
  if (isPlatformMismatchedRoot(root, process.platform)) {
    return failure(
      "PLATFORM_MISMATCH",
      `NETWORK_SAVE_ROOT berbentuk UNC/Windows (${root}) padahal app ini berjalan di ${process.platform}.`,
    );
  }

  try {
    const { stat } = await import("node:fs/promises");
    try {
      if (!(await stat(root)).isDirectory()) throw new Error("bukan folder");
    } catch {
      return failure(
        "TARGET_ROOT_MISSING",
        "Folder jaringan tidak ditemukan di app server. Periksa mount share.",
      );
    }

    const listing = await listShareFiles(root, input.from, input.to);
    const known = await loadKnownRecords(root);
    const diff = diffShareListing(root, listing, known);

    const skipped: { relativePath: string; reason: ShareSkipReason }[] = listing.unsupported.map(
      (segments) => ({ relativePath: segments.join("/"), reason: "UNSUPPORTED_TYPE" as const }),
    );
    const failed: { relativePath: string; message: string }[] = [];

    const devices = await loadPlantDevices();
    const truncated = diff.newFiles.length > SHARE_SYNC_MAX_NEW_FILES;
    const candidates: Candidate[] = [];

    for (const segments of diff.newFiles.slice(0, SHARE_SYNC_MAX_NEW_FILES)) {
      const relativePath = segments.join("/");
      const info = classifyShareFile(segments);
      // Tidak mungkin terjadi -- listShareFiles hanya membaca folder plant --
      // tetapi berkas tanpa plant tidak boleh lolos ke registry.
      if (!info) continue;

      const fullPath = joinNetworkPath(root, segments);
      const fileName = segments[segments.length - 1];
      if (fullPath.length > FILE_PATH_MAX || fileName.length > FILE_NAME_MAX) {
        skipped.push({ relativePath, reason: "PATH_TOO_LONG" });
        continue;
      }
      const deviceId = devices.get(info.plant);
      if (deviceId === undefined) {
        skipped.push({ relativePath, reason: "NO_DEVICE" });
        continue;
      }

      let sizeBytes: number;
      let modifiedAt: number;
      try {
        const details = await stat(fullPath);
        if (!details.isFile()) continue;
        sizeBytes = details.size;
        modifiedAt = Math.round(details.mtimeMs);
      } catch (error: unknown) {
        failed.push({
          relativePath,
          message: error instanceof Error ? error.message : "Berkas tidak bisa dibaca.",
        });
        continue;
      }

      candidates.push({
        relativePath,
        plant: info.plant,
        track: info.track,
        sessionDate: info.sessionDate,
        session: info.session,
        captureBin: info.captureBin,
        sizeBytes,
        capturedAt: resolveImportedCapturedAt(info, modifiedAt),
        fullPath,
        fileName,
        info,
        modifiedAt,
        deviceId,
      });
    }

    let imported = 0;
    let alreadyRegistered = diff.alreadyRegistered;

    if (input.apply) {
      const locations = new Map<string, number | null>();
      for (const candidate of candidates) {
        try {
          const locationKey = `${candidate.deviceId}|${candidate.plant}|${candidate.info.slot ?? ""}`;
          if (!locations.has(locationKey)) {
            locations.set(
              locationKey,
              await resolveLocationId(candidate.deviceId, candidate.plant, candidate.info.slot),
            );
          }
          const outcome = await insertImportedRecord(
            candidate,
            input.actor,
            locations.get(locationKey) ?? null,
          );
          if (outcome === "inserted") imported += 1;
          else alreadyRegistered += 1;
        } catch (error: unknown) {
          failed.push({
            relativePath: candidate.relativePath,
            message: error instanceof Error ? error.message : "Gagal menulis baris registry.",
          });
        }
      }

      if (imported > 0 || failed.length > 0) {
        const { recordActivity } = await import("./activity");
        await recordActivity({
          action: "capture.imported",
          severity: failed.length > 0 ? "warning" : "info",
          actorId: input.actor.id,
          actorUsername: input.actor.username,
          detail:
            `${imported} berkas didaftarkan dari folder jaringan (${input.from} s.d. ${input.to})` +
            `${failed.length > 0 ? `; ${failed.length} gagal` : ""}` +
            `${truncated ? "; masih ada sisa" : ""}`,
        });
      }
    }

    const report: ShareSyncReport = {
      ok: true,
      applied: input.apply,
      range: { from: input.from, to: input.to },
      folders: listing.folders,
      filesSeen: listing.files.length,
      alreadyRegistered,
      candidateCount: candidates.length,
      candidates: candidates.slice(0, SHARE_SYNC_REPORT_ROWS).map((candidate): ShareSyncItem => ({
        relativePath: candidate.relativePath,
        plant: candidate.plant,
        track: candidate.track,
        sessionDate: candidate.sessionDate,
        session: candidate.session,
        captureBin: candidate.captureBin,
        sizeBytes: candidate.sizeBytes,
        capturedAt: candidate.capturedAt,
      })),
      truncated,
      imported,
      failed: failed.slice(0, SHARE_SYNC_REPORT_ROWS),
      skippedCount: skipped.length,
      skipped: skipped.slice(0, SHARE_SYNC_REPORT_ROWS),
      otherFolders: listing.otherFolders.slice(0, SHARE_SYNC_REPORT_ROWS),
      missingCount: diff.missing.length,
      missing: diff.missing.slice(0, SHARE_SYNC_REPORT_ROWS),
    };
    return report;
  } catch (error: unknown) {
    return failure(
      "SHARE_SYNC_FAILED",
      error instanceof Error ? error.message : "Gagal memindai folder jaringan.",
    );
  }
}
