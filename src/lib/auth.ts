import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { LANGUAGE_COOKIE, parseLanguage, type Language } from "./i18n";

// Bentuk user yang aman dibawa ke client: identitas untuk ditampilkan di
// sidebar, tanpa hash password dan tanpa kolom internal tabel.
export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
};

// `code` dipakai halaman login untuk menulis kegagalan dalam bahasa antarmuka;
// `message` tetap teks Indonesia yang lengkap.
//
// `language` adalah bahasa default akunnya. Halaman login memasangnya begitu
// login berhasil, sehingga PC yang dipakai bergantian selalu mengikuti orang
// yang sedang masuk, bukan pilihan orang sebelumnya. `null` berarti kolomnya
// belum ada di database dan bahasa yang sedang tampil dibiarkan.
export type LoginResult =
  | { ok: true; user: SessionUser; language: Language | null }
  | { ok: false; code: string; message: string };

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
        code: "SESSION_SECRET_MISSING",
        message:
          "SESSION_SECRET belum diisi di server aplikasi, jadi sesi login belum bisa dibuat.",
      };
    }

    if (!isCardDbConfigured()) {
      return {
        ok: false,
        code: "CARDDB_NOT_CONFIGURED",
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
        code: "DATABASE_UNREACHABLE",
        message: `Database Capture-Calcine tidak bisa dihubungi: ${messageOf(error)}`,
      };
    }

    const { recordActivity } = await import("./server/activity");

    if (!record) {
      // Tetap jalankan satu verifikasi buangan supaya username yang tidak ada
      // memakan waktu yang sama dengan username yang ada -- tanpa ini, selisih
      // waktu respons sudah cukup untuk memetakan daftar akun.
      await verifyPassword(data.password, DUMMY_HASH);

      // Yang diketik SENGAJA tidak ikut dicatat saat akunnya tidak dikenal.
      // Operator yang salah menaruh kursor mengetik passwordnya di kolom
      // username, dan mencatat isian itu apa adanya berarti menyimpan password
      // dalam bentuk terbaca di jejak audit -- persis tempat yang paling sering
      // dibuka orang lain. Yang berguna untuk keamanan adalah percobaan
      // terhadap akun yang benar-benar ada, dan itu tetap tercatat di bawah.
      await recordActivity({
        action: "login.failed",
        severity: "warning",
        detail: "Username atau email tidak dikenal",
      });
      return { ok: false, code: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS };
    }

    const passwordMatches = await verifyPassword(data.password, record.passwordHash);
    if (!passwordMatches) {
      await recordActivity({
        action: "login.failed",
        severity: "warning",
        actorId: record.user.id,
        actorUsername: record.user.username,
        detail: "Password salah",
      });
      return { ok: false, code: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS };
    }

    if (!record.isActive) {
      await recordActivity({
        action: "login.blocked",
        severity: "warning",
        actorId: record.user.id,
        actorUsername: record.user.username,
        detail: "Akun dinonaktifkan",
      });
      return {
        ok: false,
        code: "ACCOUNT_DISABLED",
        message: "Akun ini dinonaktifkan. Hubungi Super Admin untuk mengaktifkannya kembali.",
      };
    }

    const session = await getAppSession();
    await session.update({ user: record.user });

    // Jam login hanya untuk audit; kalau UPDATE-nya gagal, operator tetap masuk.
    await markUserLogin(record.user.id).catch(() => undefined);
    await recordActivity({
      action: "login.success",
      actorId: record.user.id,
      actorUsername: record.user.username,
    });

    return { ok: true, user: record.user, language: record.defaultLanguage };
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

/**
 * Bahasa antarmuka dari cookie permintaan. Dipanggil saat SSR supaya HTML
 * pertama sudah dalam bahasa pilihan; di browser cookie-nya dibaca langsung.
 */
export const fetchUiLanguage = createServerFn({ method: "GET" }).handler(
  async (): Promise<Language> => {
    try {
      const { getCookie } = await import("@tanstack/react-start/server");
      return parseLanguage(getCookie(LANGUAGE_COOKIE));
    } catch {
      return parseLanguage(undefined);
    }
  },
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { getAppSession } = await import("./server/session");
    const session = await getAppSession();
    // Identitasnya dibaca sebelum sesi dikosongkan -- setelah clear() tidak ada
    // lagi yang bisa memberi tahu siapa yang barusan keluar.
    const user = session.data.user;
    await session.clear();

    if (user) {
      const { recordActivity } = await import("./server/activity");
      await recordActivity({ action: "logout", actorId: user.id, actorUsername: user.username });
    }
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
