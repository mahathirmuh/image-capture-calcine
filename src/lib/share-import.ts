// Mendaftarkan berkas yang ditaruh LANGSUNG di folder jaringan.
//
// Gallery membaca registry, bukan isi folder: setiap barisnya dibuat aplikasi
// saat capture. Foto yang disalin orang ke share tanpa lewat aplikasi karena
// itu tidak pernah terlihat. Modul ini yang menjembataninya -- folder dipindai,
// dan berkas yang belum punya baris didaftarkan sehingga berlaku seperti foto
// lain (akses per plant, filter, unduh, thumbnail).
//
// Bagian di berkas ini murni dan aman ikut ter-bundle ke browser: aturan
// membaca path, bentuk laporan, dan serverFn-nya. Yang menyentuh disk dan
// database ada di src/lib/server/share-scan.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  defaultSchedule,
  hasTrialTrack,
  sessionContext,
  shiftDate,
  trackFolder,
  validDate,
  zonedClock,
  type CaptureTrack,
} from "./capture-schedule";
import { formatSessionLabel } from "./capture-session";
import { PLANTS, toBinLabel, type BinSlot } from "./locations";

/** Rentang tanggal terpanjang untuk satu kali pindai. */
export const SHARE_SYNC_MAX_RANGE_DAYS = 92;
/** Berkas baru terbanyak yang diproses sekali jalan; sisanya di putaran berikut. */
export const SHARE_SYNC_MAX_NEW_FILES = 300;
/** Baris terbanyak per daftar di laporan -- jumlah sebenarnya dikirim terpisah. */
export const SHARE_SYNC_REPORT_ROWS = 100;

/**
 * Jenis berkas yang didaftarkan. Hanya yang bisa ditampilkan browser: galeri
 * yang berisi kartu tanpa gambar lebih membingungkan daripada berkas yang
 * dilewati dengan alasan yang disebutkan.
 */
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function isShareImageFile(fileName: string): boolean {
  const ext = fileName.includes(".") ? (fileName.split(".").pop() ?? "").toLowerCase() : "";
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Berkas yang bukan foto dan bukan urusan siapa pun: berkas tersembunyi, sisa
 * Windows, dan berkas uji tulis milik halaman Storage. Tidak dilaporkan sama
 * sekali -- menyebut `Thumbs.db` sebagai "dilewati" hanya menambah keributan.
 */
export function isShareNoiseFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.startsWith(".") ||
    lower.startsWith("~") ||
    lower === "thumbs.db" ||
    lower === "desktop.ini" ||
    lower.endsWith(".tmp")
  );
}

export type SharePlantFolder = { folder: string; plant: string; track: CaptureTrack };

/** Folder tingkat pertama yang dikelola aplikasi, mis. "Acid Plant Trial". */
export function sharePlantFolders(): SharePlantFolder[] {
  return PLANTS.flatMap((plant): SharePlantFolder[] => [
    { folder: trackFolder(plant, "regular"), plant, track: "regular" },
    ...(hasTrialTrack(plant)
      ? [{ folder: trackFolder(plant, "trial"), plant, track: "trial" as const }]
      : []),
  ]);
}

export type ShareFileInfo = {
  plant: string;
  track: CaptureTrack;
  /** Dari folder YYYY/MM/DD; null kalau berkasnya tidak di dalam folder tanggal. */
  sessionDate: string | null;
  /** "02.00"; null kalau nama berkasnya tidak diawali jam sesi. */
  session: string | null;
  slot: BinSlot | null;
  /** "TRAIN 1" / "BIN 2" memakai istilah plant-nya; null kalau slot tidak terbaca. */
  captureBin: string | null;
};

/**
 * Baca plant, tanggal, sesi dan slot dari path relatif sebuah berkas.
 *
 * Aplikasi menyimpan sebagai `<Plant>[ Trial]/YYYY/MM/DD/<HH.00> <Train|Bin> <n>.jpg`.
 * Berkas yang mengikuti pola itu terbaca lengkap; yang namanya bebas tetap
 * dikenali plant-nya (dan tanggalnya kalau ada di folder tanggal), dengan sesi
 * dan slot kosong. Null hanya kalau berkasnya tidak berada di folder plant.
 */
export function classifyShareFile(segments: readonly string[]): ShareFileInfo | null {
  if (segments.length < 2) return null;
  const top = segments[0].trim().toLowerCase();
  const home = sharePlantFolders().find((entry) => entry.folder.toLowerCase() === top);
  if (!home) return null;

  const fileName = segments[segments.length - 1];
  const between = segments.slice(1, -1);

  let sessionDate: string | null = null;
  if (
    between.length === 3 &&
    /^\d{4}$/.test(between[0]) &&
    /^\d{2}$/.test(between[1]) &&
    /^\d{2}$/.test(between[2])
  ) {
    const candidate = `${between[0]}-${between[1]}-${between[2]}`;
    if (validDate(candidate)) sessionDate = candidate;
  }

  const base = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;

  // Jam sesi di awal nama: "02.00", "2.00", "02:00", atau empat digit "0200".
  // Tanpa pemisah harus tepat empat digit, supaya "100 foto.jpg" tidak terbaca
  // sebagai sesi 01.00. Menit selain 00
  // bukan label sesi -- itu jam dinding, dan menebaknya ke sesi terdekat akan
  // mengisi cakupan sesi dengan foto yang belum tentu milik sesi itu.
  let session: string | null = null;
  const time = /^\s*(?:(\d{1,2})[.:](\d{2})|(\d{2})(\d{2}))(?!\d)/.exec(base);
  if (time && (time[2] ?? time[4]) === "00") {
    const hour = Number(time[1] ?? time[3]);
    if (hour >= 0 && hour <= 23) session = formatSessionLabel(hour);
  }

  let slot: BinSlot | null = null;
  const slotMatch = /(?:^|[^a-z])(?:train|bin)[\s_-]*([12])(?!\d)/i.exec(base);
  if (slotMatch) slot = Number(slotMatch[1]) as BinSlot;

  return {
    plant: home.plant,
    track: home.track,
    sessionDate,
    session,
    slot,
    captureBin: slot ? toBinLabel(home.plant, slot) : null,
  };
}

/**
 * Waktu yang dicatat sebagai `captured_at` untuk berkas yang didaftarkan.
 *
 * Waktu capture sebenarnya tidak diketahui -- tidak ada yang menekan tombol.
 * Yang dipakai adalah apa yang DINYATAKAN orang lewat tempat ia menaruh
 * berkasnya: awal sesi kalau tanggal dan sesinya terbaca. Tanpa sesi, waktu
 * modifikasi berkas dipakai selama tanggalnya cocok dengan foldernya; kalau
 * tidak cocok (berkas lama yang disalin ke folder hari lain), foldernya yang
 * menang supaya filter tanggal galeri menemukannya di tempat ia ditaruh.
 */
export function resolveImportedCapturedAt(info: ShareFileInfo, modifiedAt: number): number {
  const schedule = defaultSchedule(info.plant);
  if (info.sessionDate && info.session) {
    return sessionContext(schedule, info.sessionDate, Number(info.session.slice(0, 2))).startsAt;
  }
  if (info.sessionDate) {
    if (zonedClock(modifiedAt, schedule.timezone).date === info.sessionDate) return modifiedAt;
    return sessionContext(schedule, info.sessionDate, 0).startsAt;
  }
  return modifiedAt;
}

/** Rentang yang layak dipindai, atau pesan kenapa tidak. */
export function validateShareSyncRange(from: string, to: string): string | null {
  if (!validDate(from) || !validDate(to)) return "Tanggal rentang tidak valid.";
  if (from > to) return "Tanggal awal harus sebelum atau sama dengan tanggal akhir.";
  if (shiftDate(from, SHARE_SYNC_MAX_RANGE_DAYS - 1) < to) {
    return `Rentang paling panjang ${SHARE_SYNC_MAX_RANGE_DAYS} hari sekali pindai.`;
  }
  return null;
}

export type ShareSkipReason =
  /** Bukan JPG/PNG/WebP. */
  | "UNSUPPORTED_TYPE"
  /** Plant-nya belum punya device di registry, padahal baris capture wajib menunjuk satu. */
  | "NO_DEVICE"
  /** Path atau nama berkas melebihi panjang kolom registry. */
  | "PATH_TOO_LONG";

export type ShareSyncItem = {
  /** Relatif terhadap folder jaringan, selalu dengan "/". */
  relativePath: string;
  plant: string;
  track: CaptureTrack;
  sessionDate: string | null;
  session: string | null;
  captureBin: string | null;
  sizeBytes: number;
  /** Epoch ms yang akan dicatat sebagai waktu capture. */
  capturedAt: number;
};

export type ShareSyncReport = {
  ok: true;
  /** false = baru pratinjau, belum ada yang ditulis ke registry. */
  applied: boolean;
  range: { from: string; to: string };
  folders: { folder: string; plant: string; track: CaptureTrack; found: boolean }[];
  /** Berkas gambar yang ditemukan di folder yang dipindai. */
  filesSeen: number;
  alreadyRegistered: number;
  /** Berkas baru yang bisa didaftarkan (seluruhnya, bukan hanya yang tampil). */
  candidateCount: number;
  candidates: ShareSyncItem[];
  /** Ada berkas baru melebihi batas sekali jalan -- jalankan lagi untuk sisanya. */
  truncated: boolean;
  imported: number;
  failed: { relativePath: string; message: string }[];
  skippedCount: number;
  skipped: { relativePath: string; reason: ShareSkipReason }[];
  /** Subfolder yang bukan folder tanggal; isinya tidak dipindai. */
  otherFolders: string[];
  /** Baris registry yang berkasnya sudah tidak ada di folder yang dipindai. */
  missingCount: number;
  missing: { recordId: number; relativePath: string }[];
};

export type ShareSyncResult = ShareSyncReport | { ok: false; code: string; message: string };

const shareSyncSchema = z.object({
  from: z.string().trim(),
  to: z.string().trim(),
  /** false = hanya periksa; true = daftarkan berkas baru ke registry. */
  apply: z.boolean().default(false),
});

/**
 * Pindai folder jaringan dan, kalau diminta, daftarkan berkas barunya.
 *
 * Khusus Super Admin: tindakan ini menulis baris ke registry atas nama orang
 * yang tidak pernah menekan Capture, dan sesudahnya tombol Hapus/Ubah nama di
 * Gallery berlaku pada berkas aslinya di share.
 */
export const syncShareFolder = createServerFn({ method: "POST" })
  .validator(shareSyncSchema)
  .handler(async ({ data }): Promise<ShareSyncResult> => {
    const invalid = validateShareSyncRange(data.from, data.to);
    if (invalid) return { ok: false, code: "INVALID_RANGE", message: invalid };

    const { requireCaptureAdmin } = await import("./server/capture-admin");
    let gate: Awaited<ReturnType<typeof requireCaptureAdmin>>;
    try {
      gate = await requireCaptureAdmin();
    } catch {
      // Penjaganya membaca akun dari database; kalau itu yang gagal, sebabnya
      // disebut apa adanya alih-alih muncul sebagai "permintaan gagal".
      return {
        ok: false,
        code: "DATABASE_UNREACHABLE",
        message: "Database Capture-Calcine tidak bisa dihubungi.",
      };
    }
    if (!gate.ok) return { ok: false, code: gate.code, message: gate.message };

    const { runShareSync } = await import("./server/share-scan");
    return runShareSync({ from: data.from, to: data.to, apply: data.apply, actor: gate.actor });
  });
