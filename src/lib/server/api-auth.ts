// Otentikasi REST API /api/v1.
//
// Terpisah dari sesi login browser (src/lib/server/session.ts) dan sengaja
// tidak memakainya: cookie sesi milik manusia yang menekan tombol, kunci API
// milik sistem lain. Menyatukan keduanya berarti sistem integrasi harus
// menyimpan password operator, dan mencabut aksesnya berarti mematikan akun
// orang.
//
// DUA JENIS PEMANGGIL, DENGAN HAK YANG BERBEDA:
//
//   - kunci API (x-api-key)      -> BACA-SAJA, selamanya. Rahasia bersama tanpa
//                                   orang di belakangnya; kunci yang bocor
//                                   tidak boleh bisa menghapus capture,
//                                   memicu rana, atau menulis ke share.
//   - token bearer (/auth/login) -> orang sungguhan, dengan id, peran, dan
//                                   plant-nya. Hanya ini yang boleh menulis,
//                                   supaya `capturedBy` tetap bisa menjawab
//                                   pertanyaan "siapa".
//
// Pemisahan itu ditegakkan di daftar route (`requiresUser`), bukan di dalam
// masing-masing handler: penjagaan yang tersebar akan terlewat pada endpoint
// berikutnya yang ditambahkan orang.
import { getServerEnv } from "../env";
import { verifyApiToken, type ApiTokenClaims } from "./api-token";

export type ApiPrincipal = { kind: "api-key" } | { kind: "user"; claims: ApiTokenClaims };

export type ApiAuthResult =
  | { ok: true; principal: ApiPrincipal }
  | { ok: false; status: 401 | 503; code: string; message: string };

/** Header token pengguna. Bearer, karena ini memang berumur pendek. */
export const API_BEARER_PREFIX = "Bearer ";

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

const TOKEN_REJECTIONS: Record<string, string> = {
  EXPIRED: "Token sudah kedaluwarsa. Login lagi lewat POST /auth/login.",
  REVOKED: "Token sudah dicabut lewat logout.",
  BAD_SIGNATURE: "Tanda tangan token tidak sah.",
  MALFORMED: "Bentuk token tidak dikenali.",
  NOT_CONFIGURED: "SESSION_SECRET belum diisi, jadi token tidak bisa diverifikasi.",
};

export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const keys = parseApiKeys(getServerEnv().API_KEYS);
  // API_KEYS tetap SATU SAKELAR untuk seluruh API, termasuk jalur token. Nilai
  // kosong berarti mati sepenuhnya -- API yang menyala diam-diam karena satu
  // variabel terlupa adalah kegagalan yang tidak terlihat sampai ada yang
  // menemukannya.
  if (keys.length === 0) {
    return {
      ok: false,
      status: 503,
      code: "API_DISABLED",
      message:
        "REST API belum diaktifkan di app server ini. Isi API_KEYS di environment untuk menyalakannya.",
    };
  }

  // Token diperiksa lebih dulu: pemanggil yang mengirim keduanya jelas
  // bermaksud bertindak sebagai orang, dan hak itu yang lebih sempit.
  const authorization = request.headers.get("authorization");
  if (authorization && authorization.startsWith(API_BEARER_PREFIX)) {
    const check = await verifyApiToken(authorization.slice(API_BEARER_PREFIX.length).trim());
    if (!check.ok) {
      return {
        ok: false,
        status: 401,
        code: `TOKEN_${check.code}`,
        message: TOKEN_REJECTIONS[check.code] ?? "Token tidak sah.",
      };
    }
    return { ok: true, principal: { kind: "user", claims: check.claims } };
  }

  const presented = request.headers.get(API_KEY_HEADER);
  if (!presented || !matchesAnyApiKey(presented, keys)) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: `Kunci API tidak dikenali. Kirim header ${API_KEY_HEADER}, atau Authorization: Bearer <token> untuk bertindak sebagai pengguna.`,
    };
  }

  return { ok: true, principal: { kind: "api-key" } };
}
