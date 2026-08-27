// Penyaji berkas gambar untuk /media/:recordId.
//
// Berjalan DI LUAR konteks permintaan TanStack (dipanggil langsung dari
// src/server.ts), jadi tidak ada cookie sesi yang bisa dibaca di sini. Izinnya
// sudah diputuskan lebih dulu oleh createCaptureMediaUrl dan dititipkan sebagai
// tanda tangan pada URL; yang tersisa di sini murni verifikasi.
import { verifyMediaToken } from "./media-token";

const MEDIA_PREFIX = "/media/";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export function isMediaPath(pathname: string): boolean {
  return pathname.startsWith(MEDIA_PREFIX);
}

function contentTypeFor(fileName: string): string {
  const ext = fileName.includes(".") ? (fileName.split(".").pop() ?? "").toLowerCase() : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Berkasnya benar-benar berada di bawah NETWORK_SAVE_ROOT.
 *
 * Path-nya datang dari database, bukan dari pemakai, jadi ini bukan penjaga
 * utama -- tapi ia yang menahan akibatnya kalau suatu saat ada baris registry
 * yang path-nya keliru atau disusupi lewat jalur lain. Sebuah penyaji berkas
 * yang mau membuka path apa pun dari database adalah pembacaan berkas
 * sewenang-wenang yang menunggu sebabnya.
 */
export async function isInsideRoot(filePath: string, root: string): Promise<boolean> {
  const pathModule = await import("node:path");
  const platform = root.startsWith("\\\\") ? pathModule.win32 : pathModule;
  const resolvedRoot = platform.resolve(root);
  const resolvedFile = platform.resolve(filePath);
  const withSeparator = resolvedRoot.endsWith(platform.sep)
    ? resolvedRoot
    : resolvedRoot + platform.sep;
  return resolvedFile.startsWith(withSeparator);
}

export async function handleMediaRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") return plain(405, "Hanya GET.");

  const rawId = url.pathname.slice(MEDIA_PREFIX.length).split("/")[0];
  const recordId = Number(rawId);
  if (!Number.isInteger(recordId) || recordId < 1) return plain(400, "Id capture tidak sah.");

  const check = await verifyMediaToken(
    recordId,
    url.searchParams.get("e"),
    url.searchParams.get("s"),
  );
  if (!check.ok) {
    // Kedaluwarsa dijawab 410, bukan 403: klien tahu ia hanya perlu meminta URL
    // baru, bukan menyerah karena tidak berhak.
    return check.code === "EXPIRED"
      ? plain(410, "URL gambar sudah kedaluwarsa. Muat ulang halamannya.")
      : plain(403, "Tanda tangan URL tidak sah.");
  }

  const { getServerEnv } = await import("../env");
  const root = getServerEnv().NETWORK_SAVE_ROOT;
  if (!root) return plain(503, "NETWORK_SAVE_ROOT belum dikonfigurasi di app server.");

  const { findCaptureRecordForMedia } = await import("./media-record");
  const record = await findCaptureRecordForMedia(recordId);
  if (!record || !record.servable) return plain(404, "Gambar tidak tersedia di server.");

  if (!(await isInsideRoot(record.filePath, root))) {
    return plain(403, "Path berkas berada di luar folder jaringan.");
  }

  const { createReadStream } = await import("node:fs");
  const { stat } = await import("node:fs/promises");
  const { Readable } = await import("node:stream");

  let size: number;
  try {
    const info = await stat(record.filePath);
    if (!info.isFile()) return plain(404, "Path capture bukan berkas.");
    size = info.size;
  } catch {
    // Paling sering: record `spooled` yang berkasnya masih mengantre di app
    // server dan belum mendarat di share. Itu keadaan sah, bukan kesalahan.
    return plain(404, "Berkasnya belum ada di folder jaringan.");
  }

  const stream = Readable.toWeb(createReadStream(record.filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": contentTypeFor(record.fileName),
      "content-length": String(size),
      // Boleh disimpan browser selama URL-nya masih berlaku, tidak lebih.
      // `private` supaya proxy bersama tidak ikut menyimpannya.
      "cache-control": "private, max-age=300",
      "content-disposition": `inline; filename="${encodeURIComponent(record.fileName)}"`,
    },
  });
}
