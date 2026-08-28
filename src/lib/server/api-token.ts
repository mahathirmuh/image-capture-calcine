// Token bearer untuk REST API.
//
// Ada karena dua hal yang tidak bisa dipertemukan: aplikasi memakai cookie
// sesi tersegel (src/lib/server/session.ts), sedangkan klien REST tidak punya
// cookie jar dan tidak berjalan di dalam konteks permintaan TanStack tempat
// `useSession` punya sesuatu untuk dibuka.
//
// KENAPA BUKAN KUNCI API SAJA. Kunci API adalah rahasia bersama tanpa orang di
// belakangnya. Endpoint tulis di API ini memicu rana kamera sungguhan dan
// menulis berkas ke folder jaringan, dan setiap capture harus bisa dijawab
// pertanyaannya: SIAPA. `capturedBy` distempel server dari identitas ini,
// tidak pernah dari payload klien -- persis seperti di halaman capture.
//
// Isinya ditandatangani, bukan dienkripsi: siapa pun boleh membaca klaimnya,
// tapi tidak ada yang bisa mengubahnya tanpa SESSION_SECRET. Mengganti secret
// itu membatalkan seluruh token yang beredar, dan itu memang yang diinginkan.
import { getServerEnv } from "../env";

/**
 * Dua belas jam -- satu shift penuh dengan sisa.
 *
 * Lebih pendek berarti operator terlempar di tengah shift; lebih panjang
 * berarti token yang tersalin ke log atau riwayat terminal tetap berguna
 * berhari-hari. Pencabutan segera tetap ada lewat `revokeApiToken`.
 */
export const API_TOKEN_TTL_MS = 12 * 60 * 60_000;

export type ApiTokenClaims = {
  /** id user di dbo.app_users. */
  userId: number;
  username: string;
  role: string;
  /** Pengenal token ini sendiri, supaya satu token bisa dicabut sendirian. */
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
};

export type ApiTokenCheck =
  | { ok: true; claims: ApiTokenClaims }
  | { ok: false; code: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" | "REVOKED" | "NOT_CONFIGURED" };

/**
 * Token yang dicabut sebelum kedaluwarsa, DI DALAM PROSES INI SAJA.
 *
 * Batasnya nyata dan sengaja tidak disembunyikan: daftar ini hilang saat
 * container di-restart, dan tidak dibagi antar replika. Deployment ini satu
 * service `web` tunggal, jadi dalam praktiknya ia bekerja -- dan token yang
 * "hidup lagi" setelah restart tetap mati sendiri dalam 12 jam.
 *
 * Menyimpannya di database menuntut tabel baru pada MSSQL bersama; itu harga
 * yang belum sepadan sampai ada klien yang benar-benar memakainya. Pencabutan
 * yang PASTI dan lintas-restart sudah tersedia lewat jalur lain: menonaktifkan
 * akunnya, yang diperiksa ulang dari database pada setiap /auth/me.
 */
const revoked = new Map<string, number>();

/** Buang catatan pencabutan yang tokennya toh sudah kedaluwarsa. */
function pruneRevoked(now: number): void {
  for (const [tokenId, expiresAt] of revoked) {
    if (expiresAt <= now) revoked.delete(tokenId);
  }
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function sign(body: string): Promise<string | null> {
  const secret = getServerEnv().SESSION_SECRET;
  if (!secret) return null;
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function isApiTokenConfigured(): boolean {
  return Boolean(getServerEnv().SESSION_SECRET);
}

export async function createApiToken(
  user: { id: number; username: string; role: string },
  now: number = Date.now(),
): Promise<{ token: string; claims: ApiTokenClaims } | null> {
  const { randomUUID } = await import("node:crypto");
  const claims: ApiTokenClaims = {
    userId: user.id,
    username: user.username,
    role: user.role,
    tokenId: randomUUID(),
    issuedAt: now,
    expiresAt: now + API_TOKEN_TTL_MS,
  };

  const body = encode(JSON.stringify(claims));
  const signature = await sign(body);
  if (!signature) return null;
  return { token: `${body}.${signature}`, claims };
}

export async function verifyApiToken(
  token: string,
  now: number = Date.now(),
): Promise<ApiTokenCheck> {
  if (!isApiTokenConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, code: "MALFORMED" };

  const body = token.slice(0, dot);
  const presented = token.slice(dot + 1);

  // Tanda tangan diperiksa SEBELUM isinya diurai. Mengurai lebih dulu berarti
  // parser JSON memproses byte yang belum terbukti berasal dari server ini.
  const expected = await sign(body);
  if (!expected) return { ok: false, code: "NOT_CONFIGURED" };

  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  // Panjang berbeda tidak boleh masuk timingSafeEqual -- ia melempar.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, code: "BAD_SIGNATURE" };
  }

  let claims: ApiTokenClaims;
  try {
    claims = JSON.parse(decode(body)) as ApiTokenClaims;
  } catch {
    return { ok: false, code: "MALFORMED" };
  }
  if (
    typeof claims?.userId !== "number" ||
    typeof claims?.username !== "string" ||
    typeof claims?.tokenId !== "string" ||
    typeof claims?.expiresAt !== "number"
  ) {
    return { ok: false, code: "MALFORMED" };
  }

  // Kedaluwarsa dibedakan dari tanda tangan salah: yang satu diperbaiki klien
  // dengan login ulang, yang lain berarti tokennya palsu.
  if (now > claims.expiresAt) return { ok: false, code: "EXPIRED" };

  pruneRevoked(now);
  if (revoked.has(claims.tokenId)) return { ok: false, code: "REVOKED" };

  return { ok: true, claims };
}

export function revokeApiToken(claims: ApiTokenClaims): void {
  revoked.set(claims.tokenId, claims.expiresAt);
}

/** Hanya untuk pengujian: kosongkan daftar pencabutan. */
export function clearRevokedApiTokens(): void {
  revoked.clear();
}
