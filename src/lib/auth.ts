import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Bentuk user yang aman dibawa ke client: identitas untuk ditampilkan di
// sidebar, tanpa hash password dan tanpa kolom internal tabel.
export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
};

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; message: string };

export const loginInputSchema = z.object({
  identifier: z.string().trim().min(1, "Username atau email wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Satu kalimat untuk username salah maupun password salah. Membedakan keduanya
// akan memberi tahu penebak bahwa sebuah akun memang ada.
const INVALID_CREDENTIALS = "Username atau password salah.";

export const loginWithPassword = createServerFn({ method: "POST" })
  .validator(loginInputSchema)
  .handler(async ({ data }): Promise<LoginResult> => {
    const [{ isCardDbConfigured }, { isSessionConfigured, getAppSession }] = await Promise.all([
      import("./carddb"),
      import("./server/session"),
    ]);

    if (!isSessionConfigured()) {
      return {
        ok: false,
        message:
          "SESSION_SECRET belum diisi di server aplikasi, jadi sesi login belum bisa dibuat.",
      };
    }

    if (!isCardDbConfigured()) {
      return {
        ok: false,
        message: "Konfigurasi CARDDB belum lengkap di server aplikasi.",
      };
    }

    const [{ findUserForLogin, markUserLogin }, { verifyPassword }] = await Promise.all([
      import("./server/users"),
      import("./server/password"),
    ]);

    let record: Awaited<ReturnType<typeof findUserForLogin>>;
    try {
      record = await findUserForLogin(data.identifier);
    } catch (error) {
      return {
        ok: false,
        message: `Database Capture-Calcine tidak bisa dihubungi: ${messageOf(error)}`,
      };
    }

    if (!record) {
      // Tetap jalankan satu verifikasi buangan supaya username yang tidak ada
      // memakan waktu yang sama dengan username yang ada -- tanpa ini, selisih
      // waktu respons sudah cukup untuk memetakan daftar akun.
      await verifyPassword(data.password, DUMMY_HASH);
      return { ok: false, message: INVALID_CREDENTIALS };
    }

    const passwordMatches = await verifyPassword(data.password, record.passwordHash);
    if (!passwordMatches) {
      return { ok: false, message: INVALID_CREDENTIALS };
    }

    if (!record.isActive) {
      return {
        ok: false,
        message: "Akun ini dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.",
      };
    }

    const session = await getAppSession();
    await session.update({ user: record.user });

    // Jam login hanya untuk audit; kalau UPDATE-nya gagal, operator tetap masuk.
    await markUserLogin(record.user.id).catch(() => undefined);

    return { ok: true, user: record.user };
  });

export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    try {
      const { getAppSession } = await import("./server/session");
      const session = await getAppSession();
      return session.data.user ?? null;
    } catch {
      // SESSION_SECRET hilang atau cookie tidak bisa dibuka segelnya. Perlakukan
      // sebagai belum login: app terkunci, bukan terbuka.
      return null;
    }
  },
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { getAppSession } = await import("./server/session");
    const session = await getAppSession();
    await session.clear();
  } catch {
    // Tidak ada sesi yang bisa dibersihkan berarti tujuannya sudah tercapai.
  }
  return { ok: true as const };
});

/**
 * Hanya menerima path internal. Tanpa ini, `?redirect=https://situs-lain`
 * akan memantulkan operator ke domain asing tepat setelah mereka mengetik
 * password -- dan `//host` dibaca browser sebagai URL protocol-relative,
 * jadi ikut ditolak.
 */
export function toSafeRedirect(target: string | undefined, fallback = "/dashboard") {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  if (target.startsWith("/login")) return fallback;
  return target;
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// Hash scrypt yang valid tetapi tidak akan pernah cocok dengan password apa pun
// yang diketik, dipakai semata untuk menyamakan waktu respons di atas.
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
