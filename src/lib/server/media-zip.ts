// Unduhan massal galeri: satu arsip ZIP berisi folder per tanggal.
//
// Alurnya sama dengan gambar tunggal (lihat media-token.ts), hanya untuk banyak
// record sekaligus:
//
//   1. serverFn createCaptureZipRequest -- yang punya sesi -- memeriksa plant
//      setiap record, lalu menandatangani DAFTAR id-nya.
//   2. Browser mengirim daftar dan tanda tangan itu sebagai form POST ke
//      /media/zip. Form, bukan URL: seribu id tidak muat di baris permintaan.
//   3. Yang melayani (di luar konteks TanStack, tanpa sesi) cukup memverifikasi
//      tanda tangannya, lalu mengalirkan arsipnya.
//
// Arsipnya DIALIRKAN: satu foto (~11 MB) dibaca, ditulis ke respons, lalu
// dilepas sebelum foto berikutnya dibaca. Seribu foto tidak pernah berada di
// memori app server bersamaan.
import sql from "mssql";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";
import type { CaptureTrack } from "../capture-schedule";
import { getServerEnv } from "../env";
import {
  ZipStoreWriter,
  crc32,
  zipArchiveName,
  zipDateFolder,
  zipEntryPath,
  zipTimestamp,
} from "../zip-store";
import { isInsideRoot } from "./media-serve";

export const MEDIA_ZIP_PATH = "/media/zip";

/** Paling banyak record dalam satu arsip -- sama dengan batas muat galeri. */
export const ZIP_MAX_RECORDS = 1000;

/**
 * Sepuluh menit untuk MEMULAI unduhan setelah dialognya dikonfirmasi. Unduhan
 * yang sudah berjalan tidak terpengaruh; arsip besar boleh mengalir lebih lama.
 */
export const ZIP_TOKEN_TTL_MS = 10 * 60_000;

/** Bentuk baku daftar id: unik, menaik, dipisah koma. Itu yang ditandatangani. */
export function canonicalIds(ids: readonly number[]): string {
  return [...new Set(ids)].sort((a, b) => a - b).join(",");
}

export function parseIds(raw: string | null | undefined): number[] | null {
  if (!raw || !/^\d+(,\d+)*$/.test(raw)) return null;
  const ids = raw.split(",").map(Number);
  if (ids.length > ZIP_MAX_RECORDS || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    return null;
  }
  // Hanya bentuk baku yang diterima, supaya satu tanda tangan berarti tepat
  // satu daftar.
  return canonicalIds(ids) === raw ? ids : null;
}

async function sign(ids: string, expiresAt: number): Promise<string> {
  const secret = getServerEnv().SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET belum diisi, jadi unduhan tidak bisa ditandatangani.");
  }
  const { createHash, createHmac } = await import("node:crypto");
  // Awalan "zip" memisahkan tanda tangan ini dari tanda tangan gambar tunggal:
  // keduanya memakai kunci yang sama dan tidak boleh bisa saling dipakai.
  const digest = createHash("sha256").update(ids).digest("hex");
  return createHmac("sha256", secret).update(`zip.${digest}.${expiresAt}`).digest("base64url");
}

export async function createZipToken(
  ids: readonly number[],
  now: number = Date.now(),
): Promise<{ ids: string; expiresAt: number; signature: string }> {
  const canonical = canonicalIds(ids);
  const expiresAt = now + ZIP_TOKEN_TTL_MS;
  return { ids: canonical, expiresAt, signature: await sign(canonical, expiresAt) };
}

export type ZipTokenCheck =
  { ok: true; ids: number[] } | { ok: false; code: "EXPIRED" | "BAD_SIGNATURE" | "MALFORMED" };

export async function verifyZipToken(
  rawIds: string | null,
  rawExpiresAt: string | null,
  signature: string | null,
  now: number = Date.now(),
): Promise<ZipTokenCheck> {
  const ids = parseIds(rawIds);
  if (!ids || !rawIds || !rawExpiresAt || !signature) return { ok: false, code: "MALFORMED" };
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isFinite(expiresAt)) return { ok: false, code: "MALFORMED" };
  if (now > expiresAt) return { ok: false, code: "EXPIRED" };

  const expected = await sign(rawIds, expiresAt);
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: "BAD_SIGNATURE" };
  return { ok: true, ids };
}

export type ZipRecord = {
  id: number;
  fileName: string;
  filePath: string;
  capturedAt: string;
  plant: string | null;
  track: CaptureTrack;
  fileSizeBytes: number | null;
  /** Berkasnya memang di folder jaringan, bukan di PC operator. */
  servable: boolean;
};

const BROWSER_DOWNLOAD_PREFIX = "browser-download/";

function mapZipRow(row: Record<string, unknown>): ZipRecord {
  const filePath = String(row.file_path ?? "");
  const saveMethod = typeof row.save_method === "string" ? row.save_method : null;
  const capturedAt = new Date(String(row.captured_at ?? ""));
  return {
    id: Number(row.id),
    fileName: String(row.file_name ?? ""),
    filePath,
    capturedAt: Number.isNaN(capturedAt.getTime())
      ? new Date(0).toISOString()
      : capturedAt.toISOString(),
    plant:
      (typeof row.meta_plant === "string" ? row.meta_plant : null) ??
      (typeof row.location_plant === "string" ? row.location_plant : null),
    track: row.capture_track === "trial" ? "trial" : "regular",
    fileSizeBytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    servable:
      filePath !== "" &&
      !filePath.startsWith(BROWSER_DOWNLOAD_PREFIX) &&
      saveMethod !== "browser-download" &&
      saveMethod !== "browser-folder",
  };
}

const METADATA = "CASE WHEN ISJSON(cr.metadata_json) = 1 THEN cr.metadata_json ELSE N'{}' END";

export async function findRecordsForZip(ids: readonly number[]): Promise<ZipRecord[]> {
  if (!isCardDbConfigured() || ids.length === 0) return [];
  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const records: ZipRecord[] = [];

  // SQL Server menerima paling banyak ~2100 parameter per permintaan.
  for (let start = 0; start < ids.length; start += 500) {
    const chunk = ids.slice(start, start + 500);
    const request = pool.request();
    const placeholders = chunk.map((id, index) => {
      request.input(`id${index}`, sql.BigInt, id);
      return `@id${index}`;
    });
    const result = await request.query(`
      SELECT
        cr.id,
        cr.file_name,
        cr.file_path,
        cr.captured_at,
        cr.file_size_bytes,
        JSON_VALUE(${METADATA}, '$.plant') AS meta_plant,
        JSON_VALUE(${METADATA}, '$.saveMethod') AS save_method,
        JSON_VALUE(${METADATA}, '$.captureTrack') AS capture_track,
        l.plant AS location_plant
      FROM ${schema}.capture_records cr
      LEFT JOIN ${schema}.locations l ON l.id = cr.location_id
      WHERE cr.id IN (${placeholders.join(", ")});`);
    for (const row of result.recordset as Record<string, unknown>[]) {
      records.push(mapZipRow(row));
    }
  }
  return records;
}

export type ZipPlanItem = { record: ZipRecord; path: string };

/** Isi arsip, urut tanggal lalu folder lalu nama -- juga urutan pembacaannya. */
export function planZip(records: readonly ZipRecord[]): { items: ZipPlanItem[]; name: string } {
  const used = new Set<string>();
  const items = [...records]
    // Urutan id membuat akhiran " (2)" jatuh ke record yang sama setiap kali.
    .sort((a, b) => a.id - b.id)
    .map((record) => ({ record, path: zipEntryPath(record, used) }))
    // Perbandingan kode karakter, bukan localeCompare: urutannya harus sama
    // di server mana pun arsipnya dibuat.
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { items, name: zipArchiveName(records.map((record) => zipDateFolder(record))) };
}

/** Catatan di dalam arsip tentang foto yang tidak berhasil diambil. */
export const ZIP_FAILURE_NOTE = "_tidak-terunduh.txt";

type ReadFile = (path: string) => Promise<Uint8Array>;

/**
 * Potongan arsip, satu foto setiap kali.
 *
 * Foto yang gagal dibaca TIDAK menggagalkan arsipnya: kepala respons sudah
 * terkirim sejak foto pertama, jadi satu-satunya cara jujur memberi tahu
 * adalah mencatatnya di dalam arsip itu sendiri.
 */
export async function* streamZip(
  items: readonly ZipPlanItem[],
  root: string,
  readFile: ReadFile,
  checksum: (bytes: Uint8Array) => number = crc32,
): AsyncGenerator<Uint8Array> {
  const writer = new ZipStoreWriter();
  const failures: string[] = [];

  for (const { record, path } of items) {
    let bytes: Uint8Array;
    try {
      if (!record.servable) throw new Error("tidak pernah masuk folder jaringan");
      if (!(await isInsideRoot(record.filePath, root))) {
        throw new Error("path berada di luar folder jaringan");
      }
      bytes = await readFile(record.filePath);
    } catch (error: unknown) {
      const reason =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : error instanceof Error
            ? error.message
            : "tidak bisa dibaca";
      failures.push(`${path} -- ${reason === "ENOENT" ? "berkasnya tidak ada" : reason}`);
      continue;
    }
    for (const chunk of writer.file(path, bytes, zipTimestamp(record), checksum(bytes))) {
      yield chunk;
    }
  }

  if (failures.length > 0) {
    const now = new Date();
    const text = [
      "Foto berikut dipilih tetapi tidak bisa diambil dari folder jaringan:",
      "",
      ...failures,
      "",
    ].join("\r\n");
    for (const chunk of writer.file(ZIP_FAILURE_NOTE, new TextEncoder().encode(text), {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      second: now.getUTCSeconds(),
    })) {
      yield chunk;
    }
  }

  for (const chunk of writer.finish()) yield chunk;
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export function isMediaZipPath(pathname: string): boolean {
  return pathname === MEDIA_ZIP_PATH;
}

export async function handleMediaZipRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") return plain(405, "Hanya POST.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return plain(400, "Isi permintaan tidak bisa dibaca.");
  }
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };

  const check = await verifyZipToken(field("ids"), field("e"), field("s"));
  if (!check.ok) {
    return check.code === "EXPIRED"
      ? plain(410, "Permintaan unduhan sudah kedaluwarsa. Ulangi dari halaman Gallery.")
      : plain(403, "Tanda tangan unduhan tidak sah.");
  }

  const root = getServerEnv().NETWORK_SAVE_ROOT;
  if (!root) return plain(503, "NETWORK_SAVE_ROOT belum dikonfigurasi di app server.");

  const records = await findRecordsForZip(check.ids);
  if (records.length === 0) return plain(404, "Tidak ada foto yang cocok.");

  const { items, name } = planZip(records);
  const [{ readFile }, zlib] = await Promise.all([import("node:fs/promises"), import("node:zlib")]);
  // CRC bawaan Node jauh lebih cepat; yang ditulis sendiri dipakai kalau
  // runtime-nya belum punya.
  const nativeCrc = (zlib as { crc32?: (data: Uint8Array) => number }).crc32;
  const iterator = streamZip(
    items,
    root,
    (path) => readFile(path),
    nativeCrc ? (bytes) => nativeCrc(bytes) >>> 0 : crc32,
  );

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      // Unduhan dibatalkan di browser: berhenti membaca share saat itu juga.
      await iterator.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
      // Proxy yang menampung respons dulu akan menahan arsip berukuran GB di
      // memorinya dan baru mengirimnya setelah selesai -- di browser terlihat
      // seperti unduhan yang tidak pernah mulai.
      "x-accel-buffering": "no",
    },
  });
}
