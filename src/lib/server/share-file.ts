// Hapus dan ubah nama berkas DI FOLDER JARINGAN.
//
// Sampai sebelum ini, "Hapus" hanya membuang baris registry dan salinan di
// browser -- JPEG-nya tetap memenuhi share, dan "Ubah nama" hanya mengubah
// `file_name` di MSSQL sehingga registry berbohong tentang nama berkas yang
// sebenarnya. Modul ini yang membuat kedua tombol itu berarti apa adanya.
//
// SEMUA operasi di sini menghapus atau memindahkan berkas produksi secara
// permanen -- tidak ada recycle bin di CIFS. Karena itu setiap path yang masuk
// diverifikasi berada di bawah NETWORK_SAVE_ROOT memakai pemeriksa yang sama
// persis dengan penyaji gambar, bukan pemeriksa kedua yang bisa menyimpang
// perilakunya.
import { getServerEnv } from "../env";
import { isInsideRoot } from "./media-serve";

export type ShareFileResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: string; message: string };

/** Path semu milik jalur cadangan browser; tidak pernah ada di share. */
const BROWSER_DOWNLOAD_PREFIX = "browser-download/";

/** Berkas ini memang tinggal di share, bukan hasil jalur cadangan browser. */
function livesOnShare(filePath: string): boolean {
  return filePath.trim() !== "" && !filePath.startsWith(BROWSER_DOWNLOAD_PREFIX);
}

/**
 * `proceed: false` tidak berarti gagal -- ia membawa jawaban akhirnya, yang
 * bisa saja "tidak ada yang perlu disentuh, silakan lanjut".
 */
type Guarded = { proceed: true } | { proceed: false; result: ShareFileResult };

async function guard(filePath: string): Promise<Guarded> {
  const root = getServerEnv().NETWORK_SAVE_ROOT;
  // Tanpa share yang dikonfigurasi tidak ada apa pun untuk disentuh. Itu bukan
  // kegagalan: penghapusan record di MSSQL tetap boleh berlanjut.
  if (!root) return { proceed: false, result: { ok: true, changed: false } };
  if (!livesOnShare(filePath)) return { proceed: false, result: { ok: true, changed: false } };
  if (!(await isInsideRoot(filePath, root))) {
    return {
      proceed: false,
      result: {
        ok: false,
        code: "OUTSIDE_ROOT",
        message: `Path ${filePath} berada di luar folder jaringan, jadi tidak disentuh.`,
      },
    };
  }
  return { proceed: true };
}

/**
 * Hapus berkas dari share.
 *
 * Berkas yang tidak ada dihitung BERHASIL, bukan gagal: record berstatus
 * `spooled` berkasnya memang belum mendarat di sana, dan menolak menghapus
 * record hanya karena berkasnya belum sampai akan meninggalkan baris yatim
 * yang tidak bisa dibersihkan siapa pun.
 */
export async function deleteShareFile(filePath: string): Promise<ShareFileResult> {
  const checked = await guard(filePath);
  if (!checked.proceed) return checked.result;

  try {
    const { rm } = await import("node:fs/promises");
    await rm(filePath, { force: true });
    return { ok: true, changed: true };
  } catch (error: unknown) {
    return {
      ok: false,
      code: "SHARE_DELETE_FAILED",
      message:
        error instanceof Error ? error.message : "Gagal menghapus berkas di folder jaringan.",
    };
  }
}

/**
 * Ubah nama berkas di share.
 *
 * Menolak menimpa berkas yang sudah ada: nama tujuan yang sudah terpakai
 * hampir selalu berarti ada capture lain di sana, dan menimpanya diam-diam
 * menghapus foto yang tidak diminta siapa pun.
 */
export async function renameShareFile(fromPath: string, toPath: string): Promise<ShareFileResult> {
  const fromChecked = await guard(fromPath);
  if (!fromChecked.proceed) return fromChecked.result;
  const toChecked = await guard(toPath);
  if (!toChecked.proceed) return toChecked.result;

  try {
    const { rename, stat } = await import("node:fs/promises");

    try {
      await stat(fromPath);
    } catch {
      // Belum ada di share -- record `spooled`. Namanya di registry tetap boleh
      // berubah; berkasnya nanti mendarat dengan nama yang sudah benar.
      return { ok: true, changed: false };
    }

    try {
      await stat(toPath);
      return {
        ok: false,
        code: "SHARE_NAME_TAKEN",
        message: "Nama itu sudah dipakai berkas lain di folder yang sama.",
      };
    } catch {
      // Belum ada -- justru itu yang diharapkan.
    }

    await rename(fromPath, toPath);
    return { ok: true, changed: true };
  } catch (error: unknown) {
    return {
      ok: false,
      code: "SHARE_RENAME_FAILED",
      message:
        error instanceof Error ? error.message : "Gagal mengubah nama berkas di folder jaringan.",
    };
  }
}
