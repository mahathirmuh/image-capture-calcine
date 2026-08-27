// Otentikasi REST API /api/v1.
//
// Terpisah dari sesi login browser (src/lib/server/session.ts) dan sengaja
// tidak memakainya: cookie sesi milik manusia yang menekan tombol, kunci API
// milik sistem lain. Menyatukan keduanya berarti sistem integrasi harus
// menyimpan password operator, dan mencabut aksesnya berarti mematikan akun
// orang.
//
// API ini BACA-SAJA. Tidak ada satu pun endpoint yang mengubah data, jadi kunci
// yang bocor tidak bisa dipakai menghapus capture atau menulis ke share.
import { getServerEnv } from "../env";

export type ApiAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: string; message: string };

/** Header tempat kunci dikirim. Bukan `Authorization`, supaya tidak tertukar
 * dengan skema Bearer yang menyiratkan token berumur pendek -- ini kunci statis. */
export const API_KEY_HEADER = "x-api-key";

/**
 * Daftar kunci dari satu nilai env berisi koma.
 *
 * Nilai kosong dibuang: `API_KEYS=abc,,` menghasilkan satu kunci, bukan tiga --
 * tanpa itu, string kosong akan cocok dengan permintaan tanpa header sama
 * sekali dan membuka API untuk semua orang.
 */
export function parseApiKeys(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key !== "");
}

/**
 * Perbandingan waktu-tetap.
 *
 * `a === b` berhenti di karakter pertama yang berbeda, jadi lamanya menjawab
 * ikut membocorkan berapa banyak karakter awal yang sudah benar -- cukup untuk
 * menebak kunci karakter demi karakter. Di sini setiap karakter selalu
 * dibandingkan, dan panjang yang berbeda pun tidak memotong loop-nya.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  // Panjang ikut masuk ke akumulator, bukan jadi early-return: `return
  // a.length === b.length && ...` akan menjawab lebih cepat untuk panjang yang
  // salah dan mengembalikan kebocoran yang baru saja ditutup.
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index++) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}

/** Apakah ada kunci yang cocok. Selalu memeriksa SELURUH daftar, tidak berhenti
 * di kunci pertama yang cocok, supaya lamanya menjawab tidak menyiratkan kunci
 * ke berapa yang dipakai. */
export function matchesAnyApiKey(presented: string, keys: readonly string[]): boolean {
  let matched = false;
  for (const key of keys) {
    if (timingSafeEqualString(presented, key)) matched = true;
  }
  return matched;
}

export function isApiEnabled(): boolean {
  return parseApiKeys(getServerEnv().API_KEYS).length > 0;
}

export function authenticateApiRequest(request: Request): ApiAuthResult {
  const keys = parseApiKeys(getServerEnv().API_KEYS);
  if (keys.length === 0) {
    return {
      ok: false,
      status: 503,
      code: "API_DISABLED",
      message:
        "REST API belum diaktifkan di app server ini. Isi API_KEYS di environment untuk menyalakannya.",
    };
  }

  const presented = request.headers.get(API_KEY_HEADER);
  if (!presented || !matchesAnyApiKey(presented, keys)) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: `Kunci API tidak dikenali. Kirim header ${API_KEY_HEADER}.`,
    };
  }

  return { ok: true };
}
