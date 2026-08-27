// Tanda tangan untuk URL gambar.
//
// Persoalannya: `<img src>` tidak bisa membawa header apa pun. Jadi endpoint
// gambar tidak bisa dilindungi kunci API, dan cookie sesi pun tidak terbaca di
// sana -- berkas itu dilayani dari luar konteks permintaan TanStack, tempat
// `useSession` tidak punya apa-apa untuk dibuka.
//
// Jalan keluarnya: keputusan izin diambil DI TEMPAT YANG PUNYA KONTEKS (sebuah
// serverFn, yang membaca cookie sesi dan plant si operator), lalu hasilnya
// dititipkan ke URL sebagai tanda tangan berumur pendek. Yang melayani berkas
// cukup memverifikasi tanda tangan itu -- kriptografi murni, tanpa perlu sesi.
//
// Kuncinya SESSION_SECRET yang sudah ada. Mengganti nilai itu otomatis
// membatalkan seluruh URL yang beredar, dan itu memang yang diinginkan.
import { getServerEnv } from "../env";

/**
 * Lima menit. Cukup untuk membuka gambar dan memuat ulang halaman sekali dua
 * kali, terlalu pendek untuk berguna kalau URL-nya tersalin ke mana-mana.
 */
export const MEDIA_TOKEN_TTL_MS = 5 * 60_000;

export type MediaTokenParts = { recordId: number; expiresAt: number };

function payload(parts: MediaTokenParts): string {
  return `${parts.recordId}.${parts.expiresAt}`;
}

async function sign(parts: MediaTokenParts): Promise<string> {
  const secret = getServerEnv().SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET belum diisi, jadi URL gambar tidak bisa ditandatangani.");
  }
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(payload(parts)).digest("base64url");
}

export async function createMediaToken(
  recordId: number,
  now: number = Date.now(),
): Promise<{ expiresAt: number; signature: string }> {
  const expiresAt = now + MEDIA_TOKEN_TTL_MS;
  return { expiresAt, signature: await sign({ recordId, expiresAt }) };
}

export type MediaTokenCheck =
  | { ok: true }
  | { ok: false; code: "EXPIRED" | "BAD_SIGNATURE" | "MALFORMED" };

export async function verifyMediaToken(
  recordId: number,
  rawExpiresAt: string | null,
  signature: string | null,
  now: number = Date.now(),
): Promise<MediaTokenCheck> {
  if (!rawExpiresAt || !signature) return { ok: false, code: "MALFORMED" };
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isFinite(expiresAt)) return { ok: false, code: "MALFORMED" };

  // Kedaluwarsa diperiksa LEBIH DULU, sebelum tanda tangan. Keduanya menolak,
  // tapi hanya yang ini yang bisa diperbaiki klien dengan meminta URL baru --
  // dan membedakannya membuat pesan errornya menuntun, bukan membingungkan.
  if (now > expiresAt) return { ok: false, code: "EXPIRED" };

  const expected = await sign({ recordId, expiresAt });
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // Panjang yang berbeda tidak boleh masuk timingSafeEqual -- ia melempar,
  // bukan mengembalikan false.
  if (a.length !== b.length) return { ok: false, code: "BAD_SIGNATURE" };
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, code: "BAD_SIGNATURE" };
}

function query(token: { expiresAt: number; signature: string }): string {
  return `e=${token.expiresAt}&s=${encodeURIComponent(token.signature)}`;
}

/** Path relatif foto ukuran penuh, dipakai `<img src>`. */
export function buildMediaPath(
  recordId: number,
  token: { expiresAt: number; signature: string },
): string {
  return `/media/${recordId}?${query(token)}`;
}

/**
 * Path relatif thumbnail.
 *
 * Tanda tangannya SAMA dengan foto ukuran penuh, dan itu tidak melonggarkan
 * apa pun: keduanya gambar yang sama, hanya berbeda ukuran. Menandatanganinya
 * terpisah hanya akan menggandakan token tanpa menambah satu pun batasan.
 */
export function buildThumbPath(
  recordId: number,
  token: { expiresAt: number; signature: string },
): string {
  return `/media/${recordId}/thumb?${query(token)}`;
}
