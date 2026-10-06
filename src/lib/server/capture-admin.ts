// Penjaga untuk tindakan yang mengubah atau menghapus capture: ubah nama dan
// hapus. ("Sinkronkan folder" terbuka untuk semua peran dan memakai
// requireGalleryActor() di gallery-access.ts.)
//
// Modul khusus server. Pemanggilnya (capture-records.ts) ikut ter-bundle ke
// browser, jadi ia memuat modul ini dengan `await import()` dari DALAM handler
// serverFn -- bukan impor di kepala berkas.
import { guardCaptureManagementUser } from "../capture-records";
import { getAppSession, isSessionConfigured } from "./session";
import { findUserById } from "./users";

export type CaptureAdminGate =
  | { ok: true; actor: { id: number; username: string } }
  | { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN"; message: string };

/**
 * Pemanggilnya harus Super Admin yang masih aktif.
 *
 * Peran dibaca ulang dari database, bukan dari cookie sesi: sesi berumur 12
 * jam, dan akun yang baru diturunkan perannya masih membawa peran lamanya di
 * dalam cookie.
 */
export async function requireCaptureAdmin(): Promise<CaptureAdminGate> {
  if (!isSessionConfigured()) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sesi login belum aktif." };
  }

  let sessionUserId: number | undefined;
  try {
    sessionUserId = (await getAppSession()).data.user?.id;
  } catch {
    sessionUserId = undefined;
  }
  if (sessionUserId === undefined) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    };
  }

  const current = await findUserById(sessionUserId);
  const blocked = guardCaptureManagementUser(current);
  if (!current || blocked) {
    return {
      ok: false,
      code: current?.isActive ? "FORBIDDEN" : "UNAUTHENTICATED",
      message: blocked ?? "Akun Anda sudah tidak aktif.",
    };
  }

  return { ok: true, actor: { id: current.id, username: current.username } };
}
