import { isCardDbConfigured } from "../carddb";
import { resolveGalleryScope } from "../gallery-access";
import { getAppSession, isSessionConfigured } from "./session";
import { findUserById } from "./users";

export async function requireGalleryUserAccess(id: number | undefined) {
  const user = id === undefined ? null : await findUserById(id);
  if (!user?.isActive)
    return {
      ok: false as const,
      code: "UNAUTHENTICATED",
      message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    };
  const scope = resolveGalleryScope(user);
  if (!scope.allPlants && !scope.plant)
    return {
      ok: false as const,
      code: "FORBIDDEN",
      message: "Akun Anda belum memiliki akses plant.",
    };
  return { ok: true as const, scope };
}

export async function requireGalleryAccess() {
  if (!isCardDbConfigured() || !isSessionConfigured())
    return {
      ok: false as const,
      code: "NOT_CONFIGURED",
      message: "Konfigurasi server aplikasi belum lengkap.",
    };
  let id: number | undefined;
  try {
    id = (await getAppSession()).data.user?.id;
  } catch {
    /* fail closed */
  }
  return requireGalleryUserAccess(id);
}

// Metadata is the capture-time plant; device relocation must not move old images.
// Invalid legacy JSON is treated like absent metadata, consistently with the row mapper.
export const CAPTURE_PLANT_SQL = `COALESCE(JSON_VALUE(CASE WHEN ISJSON(cr.metadata_json) = 1 THEN cr.metadata_json ELSE N'{}' END, '$.plant'), l.plant)`;
