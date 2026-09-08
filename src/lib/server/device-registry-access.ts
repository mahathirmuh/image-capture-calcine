import { isCardDbConfigured } from "../carddb";
import { getAppSession, isSessionConfigured } from "./session";
import { findUserById } from "./users";

export async function requireDeviceRegistryAccess(write = false) {
  if (!isCardDbConfigured() || !isSessionConfigured()) {
    return { ok: false as const, message: "Konfigurasi server aplikasi belum lengkap." };
  }
  let id: number | undefined;
  try {
    id = (await getAppSession()).data.user?.id;
  } catch {
    /* fail closed */
  }
  const user = id === undefined ? null : await findUserById(id);
  if (!user?.isActive)
    return {
      ok: false as const,
      message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    };
  if (write && user.role !== "admin")
    return {
      ok: false as const,
      message: "Hanya Super Admin yang boleh mengubah registry device.",
    };
  return { ok: true as const, user };
}
