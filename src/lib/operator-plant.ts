// Plant yang mengikat operator yang sedang login.
//
// Halaman Capture punya dropdown Lokasi sendiri, dan itu cukup untuk Super
// Admin yang memang berkeliling plant. Tapi operator yang terpasang di satu
// plant tidak boleh menyimpan capture atas nama plant lain -- dan yang lebih
// halus, ia tidak boleh melihat istilah plant lain: Chloride Plant menyebut
// slotnya TRAIN, dan menampilkan BIN di sana salah walau berkasnya tersimpan
// di folder yang benar.
//
// Plant dibaca ULANG DARI DATABASE, bukan dari cookie sesi. Cookie disegel
// saat login dan tidak berubah sampai login berikutnya, jadi operator yang
// baru dipindah plant masih membawa plant lamanya di sana. Alasan yang sama
// sudah dipakai `resolveEdgeTarget`; ini mengikutinya, bukan menambah sumber
// kebenaran kedua.
import { createServerFn } from "@tanstack/react-start";

import { USER_PLANT_ALL } from "./user-admin";

export type OperatorPlant = {
  /** Plant yang mengunci operator ini, atau null kalau ia bebas memilih. */
  plant: string | null;
  /** true kalau dropdown Lokasi harus mengikuti `plant` dan tidak bisa diubah. */
  locked: boolean;
};

const UNRESTRICTED: OperatorPlant = { plant: null, locked: false };

export const getOperatorPlant = createServerFn({ method: "GET" }).handler(
  async (): Promise<OperatorPlant> => {
    const [{ isCardDbConfigured }, { getAppSession, isSessionConfigured }] = await Promise.all([
      import("./carddb"),
      import("./server/session"),
    ]);

    // Tanpa database atau tanpa sesi tidak ada identitas untuk diperiksa.
    // Instalasi yang masih sepenuhnya dikendalikan .env tetap jalan seperti
    // sebelumnya: dropdown bebas, label mengikuti pilihan operator.
    if (!isCardDbConfigured() || !isSessionConfigured()) return UNRESTRICTED;

    let sessionUserId: number | undefined;
    try {
      const session = await getAppSession();
      sessionUserId = session.data.user?.id;
    } catch {
      sessionUserId = undefined;
    }
    if (sessionUserId === undefined) return UNRESTRICTED;

    const { findUserById } = await import("./server/users");
    const user = await findUserById(sessionUserId);
    if (!user || !user.isActive) return UNRESTRICTED;

    // Super Admin dan akun "Semua Plant" memang bertugas lintas plant, jadi
    // dropdown-nya tetap bebas dan istilah slot mengikuti apa yang ia pilih.
    if (user.role === "admin" || user.plant === USER_PLANT_ALL) return UNRESTRICTED;

    return { plant: user.plant, locked: true };
  },
);
