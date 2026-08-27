// Penyimpan thumbnail di app server.
//
// Filesystem, bukan kolom di MSSQL: berkasnya dilayani mentah ke `<img>`, dan
// menariknya lewat driver database hanya menambah satu lapisan tanpa manfaat.
// Ia juga tidak membebani `capture_records`, yang dibaca utuh oleh galeri,
// dasbor, dan REST API.
//
// Named volume terpisah dari antrean kirim: keduanya punya umur yang berbeda.
// Antrean kosong berarti semuanya sudah terkirim; thumbnail justru harus tetap
// ada selama record-nya ada.
import { getServerEnv } from "../env";

/** Sekitar 20x lebih besar dari thumbnail 640 px yang wajar. Batas ini menahan
 * klien mengirim foto ukuran penuh ke sini -- entah karena bug atau sengaja. */
export const MAX_THUMBNAIL_BYTES = 1_000_000;

function thumbsDir(): string | null {
  return getServerEnv().CAPTURE_THUMBS_DIR ?? null;
}

/** Nama berkas diturunkan HANYA dari id numerik, tidak pernah dari nama berkas
 * capture -- nama yang datang dari data tidak boleh ikut menentukan path. */
function thumbPath(dir: string, recordId: number): string {
  return `${dir}/${recordId}.jpg`;
}

export function isThumbStoreConfigured(): boolean {
  return thumbsDir() !== null;
}

export async function saveThumbnail(
  recordId: number,
  bytes: Buffer,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const dir = thumbsDir();
  if (!dir) {
    return {
      ok: false,
      code: "THUMBS_NOT_CONFIGURED",
      message: "CAPTURE_THUMBS_DIR belum diisi di app server.",
    };
  }
  if (bytes.byteLength > MAX_THUMBNAIL_BYTES) {
    return {
      ok: false,
      code: "THUMBNAIL_TOO_LARGE",
      message: `Thumbnail ${bytes.byteLength} byte melebihi batas ${MAX_THUMBNAIL_BYTES}.`,
    };
  }

  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    await writeFile(thumbPath(dir, recordId), bytes);
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      code: "THUMBNAIL_WRITE_FAILED",
      message: error instanceof Error ? error.message : "Gagal menulis thumbnail.",
    };
  }
}

export async function thumbnailExists(recordId: number): Promise<boolean> {
  const dir = thumbsDir();
  if (!dir) return false;
  try {
    const { stat } = await import("node:fs/promises");
    return (await stat(thumbPath(dir, recordId))).isFile();
  } catch {
    return false;
  }
}

/** Berkas thumbnail beserta ukurannya, atau null kalau belum ada. */
export async function readThumbnail(
  recordId: number,
): Promise<{ bytes: Buffer; size: number } | null> {
  const dir = thumbsDir();
  if (!dir) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(thumbPath(dir, recordId));
    return { bytes, size: bytes.byteLength };
  } catch {
    return null;
  }
}

export async function deleteThumbnail(recordId: number): Promise<void> {
  const dir = thumbsDir();
  if (!dir) return;
  try {
    const { rm } = await import("node:fs/promises");
    await rm(thumbPath(dir, recordId), { force: true });
  } catch {
    // Thumbnail yang tertinggal tidak merusak apa pun; kegagalan menghapusnya
    // tidak boleh menggagalkan penghapusan record yang memanggilnya.
  }
}
