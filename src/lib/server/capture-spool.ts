// Antrean kirim di app server.
//
// SETIAP capture ditulis ke sini lebih dulu, lalu diteruskan ke folder
// jaringan -- bukan hanya saat share mati. Itu keputusan yang disengaja, dan
// yang membuatnya lebih aman daripada "coba share dulu, spool kalau gagal":
// karena tidak ada jalur langsung, tidak ada capture yang bisa mendahului
// entri yang lebih tua. Urutan terjaga sendiri.
//
// Dengan pola "spool kalau gagal", urutan itu bisa terbalik: foto sesi 14.00
// masuk antrean saat share mati, operator capture ulang 15 menit kemudian saat
// share sudah pulih (langsung mendarat), lalu antrean menyusul dan MENIMPA
// yang baru dengan yang lama. Semua-lewat-antrean menghapus kelas bug itu.
//
// Modul ini server-only: ia menyentuh filesystem dan hanya dipanggil dari
// dalam handler serverFn.
import { getServerEnv } from "../env";
import { isPlatformMismatchedRoot } from "../network-path";
import { joinNetworkPath, normalizeRelativeSegments } from "../network-path";

export type SpoolEntryMeta = {
  /** Path relatif di bawah NETWORK_SAVE_ROOT, mis. "Acid Plant/2026/08/26/14.00 Train 1.jpg". */
  relativePath: string;
  /** Waktu capture sebenarnya, epoch ms. Dipakai untuk mencocokkan record saat flush. */
  capturedAt: number;
  /** Nama berkas final, dipakai mencocokkan record capture di registry. */
  fileName: string;
};

export type SpoolEnqueueResult =
  | { ok: true; entryId: string }
  | { ok: false; code: string; message: string };

export type SpoolFlushResult = {
  forwarded: number;
  pending: number;
  /** Alasan berhenti, kalau flush terhenti sebelum antrean habis. */
  stoppedBecause: string | null;
};

export type SpoolStatus = {
  configured: boolean;
  /**
   * Apakah proses ini benar-benar boleh menulis di sana.
   *
   * Diperiksa terpisah karena keberadaan folder TIDAK menjamin izinnya:
   * named volume Docker yang dipasang ke path yang belum ada di image dibuat
   * milik root, sementara container jalan sebagai `node`. `mkdir -p` pada
   * folder semacam itu tetap berhasil, dan kegagalannya baru muncul saat
   * capture pertama -- terlalu terlambat untuk dilihat siapa pun.
   */
  writable: boolean;
  pending: number;
  bytes: number;
  capBytes: number;
  oldestQueuedAt: number | null;
};

const META_SUFFIX = ".json";
const DATA_SUFFIX = ".bin";

/**
 * Nama entri diawali waktu antre supaya urutan menurut nama SAMA DENGAN urutan
 * antre. Itu yang membuat flush cukup menyortir nama berkas, tanpa perlu
 * membaca setiap metadata dulu hanya untuk tahu mana yang duluan.
 *
 * Epoch di-pad supaya perbandingan teksnya tetap benar sampai tahun 5138;
 * tanpa itu "9999999999999" akan berurutan sebelum "10000000000000".
 */
export function buildSpoolEntryId(queuedAt: number, random: string): string {
  return `${String(queuedAt).padStart(14, "0")}-${random}`;
}

/** Urutan antre: paling lama duluan. */
export function compareSpoolEntryIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function spoolDir(): string | null {
  return getServerEnv().CAPTURE_SPOOL_DIR ?? null;
}

function capBytes(): number {
  return getServerEnv().CAPTURE_SPOOL_MAX_MB * 1024 * 1024;
}

async function fs() {
  return import("node:fs/promises");
}

async function listEntryIds(dir: string): Promise<string[]> {
  const { readdir } = await fs();
  const names = await readdir(dir);
  return names
    .filter((name) => name.endsWith(META_SUFFIX))
    .map((name) => name.slice(0, -META_SUFFIX.length))
    .sort(compareSpoolEntryIds);
}

/** Izin tulis sungguhan, bukan sekadar "foldernya ada". */
async function isWritable(dir: string): Promise<boolean> {
  try {
    const [{ access }, { constants }] = await Promise.all([fs(), import("node:fs")]);
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getSpoolStatus(): Promise<SpoolStatus> {
  const dir = spoolDir();
  if (!dir) {
    return {
      configured: false,
      writable: false,
      pending: 0,
      bytes: 0,
      capBytes: capBytes(),
      oldestQueuedAt: null,
    };
  }
  try {
    const { stat } = await fs();
    const ids = await listEntryIds(dir);
    let bytes = 0;
    for (const id of ids) {
      try {
        bytes += (await stat(`${dir}/${id}${DATA_SUFFIX}`)).size;
      } catch {
        // Entri yang datanya hilang tidak dihitung; flush akan membersihkannya.
      }
    }
    const oldest = ids[0] ? Number(ids[0].split("-")[0]) : null;
    return {
      configured: true,
      writable: await isWritable(dir),
      pending: ids.length,
      bytes,
      capBytes: capBytes(),
      oldestQueuedAt: Number.isFinite(oldest) ? oldest : null,
    };
  } catch {
    return {
      configured: true,
      writable: await isWritable(dir),
      pending: 0,
      bytes: 0,
      capBytes: capBytes(),
      oldestQueuedAt: null,
    };
  }
}

export async function enqueueCapture(
  bytes: Buffer,
  meta: SpoolEntryMeta,
): Promise<SpoolEnqueueResult> {
  const dir = spoolDir();
  if (!dir) {
    return {
      ok: false,
      code: "SPOOL_NOT_CONFIGURED",
      message: "CAPTURE_SPOOL_DIR belum diisi di app server",
    };
  }

  const { mkdir, writeFile, rm } = await fs();
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    return {
      ok: false,
      code: "SPOOL_UNWRITABLE",
      message: `Antrean tidak bisa disiapkan di ${dir}: ${error instanceof Error ? error.message : "error tidak diketahui"}`,
    };
  }

  // Batas diperiksa SEBELUM menulis. Melampauinya berarti capture ditolak --
  // operator melihat pesannya dan bisa memanggil bantuan. Membuang entri
  // terlama justru menghilangkan foto tanpa ada yang tahu.
  const status = await getSpoolStatus();
  if (status.bytes + bytes.byteLength > status.capBytes) {
    const mb = Math.round(status.bytes / 1024 / 1024);
    const capMb = Math.round(status.capBytes / 1024 / 1024);
    return {
      ok: false,
      code: "SPOOL_FULL",
      message: `Antrean kirim penuh (${mb} MB dari ${capMb} MB, ${status.pending} foto menunggu). Folder jaringan kemungkinan sudah lama tidak terjangkau -- hubungi Super Admin sebelum melanjutkan capture.`,
    };
  }

  const entryId = buildSpoolEntryId(Date.now(), Math.random().toString(36).slice(2, 8));
  const dataPath = `${dir}/${entryId}${DATA_SUFFIX}`;
  const metaPath = `${dir}/${entryId}${META_SUFFIX}`;
  try {
    // Data ditulis LEBIH DULU, metadata belakangan. Flush hanya melihat entri
    // yang punya metadata, jadi crash di tengah proses meninggalkan berkas data
    // yatim -- bukan entri yang metadatanya menunjuk data yang belum lengkap.
    await writeFile(dataPath, bytes);
    await writeFile(metaPath, JSON.stringify(meta), "utf8");
    return { ok: true, entryId };
  } catch (error) {
    await rm(dataPath, { force: true }).catch(() => {});
    await rm(metaPath, { force: true }).catch(() => {});
    return {
      ok: false,
      code: "SPOOL_WRITE_FAILED",
      message: `Gagal menulis ke antrean: ${error instanceof Error ? error.message : "error tidak diketahui"}`,
    };
  }
}

/**
 * Kirim antrean ke folder jaringan, paling lama duluan.
 *
 * Berhenti pada kegagalan pertama, tidak melanjutkan ke entri berikutnya:
 * kegagalan hampir selalu berarti share-nya sedang tidak terjangkau, dan
 * mencoba 200 entri sisanya hanya menghabiskan waktu untuk gagal 200 kali.
 * Berhenti juga menjaga urutan -- entri yang gagal tetap di depan antrean.
 */
export async function flushSpool(): Promise<SpoolFlushResult> {
  const dir = spoolDir();
  const targetRoot = getServerEnv().NETWORK_SAVE_ROOT;
  if (!dir) return { forwarded: 0, pending: 0, stoppedBecause: "SPOOL_NOT_CONFIGURED" };
  if (!targetRoot)
    return { forwarded: 0, pending: 0, stoppedBecause: "NETWORK_SAVE_NOT_CONFIGURED" };

  const { readFile, mkdir, writeFile, rm, stat } = await fs();

  let ids: string[];
  try {
    ids = await listEntryIds(dir);
  } catch {
    return { forwarded: 0, pending: 0, stoppedBecause: null };
  }

  // Bentuk root yang mustahil di platform ini diperiksa LEBIH DULU, sebelum
  // stat. Tanpa ini jawabannya TARGET_ROOT_MISSING -- yang menyiratkan share
  // belum ter-mount dan mengirim orang memeriksa mount yang sebenarnya sehat,
  // sementara antrean menumpuk berjam-jam.
  if (isPlatformMismatchedRoot(targetRoot, process.platform)) {
    return { forwarded: 0, pending: ids.length, stoppedBecause: "TARGET_ROOT_PLATFORM_MISMATCH" };
  }

  // Root diperiksa sekali di awal, bukan per entri. Root yang hilang berarti
  // share belum ter-mount, dan tidak ada gunanya mencoba satu pun entri.
  try {
    const info = await stat(targetRoot);
    if (!info.isDirectory()) {
      return { forwarded: 0, pending: ids.length, stoppedBecause: "TARGET_ROOT_NOT_DIRECTORY" };
    }
  } catch {
    return { forwarded: 0, pending: ids.length, stoppedBecause: "TARGET_ROOT_MISSING" };
  }

  let forwarded = 0;
  for (const [index, id] of ids.entries()) {
    const dataPath = `${dir}/${id}${DATA_SUFFIX}`;
    const metaPath = `${dir}/${id}${META_SUFFIX}`;

    let meta: SpoolEntryMeta;
    let bytes: Buffer;
    try {
      meta = JSON.parse(await readFile(metaPath, "utf8")) as SpoolEntryMeta;
      bytes = await readFile(dataPath);
    } catch {
      // Entri rusak atau datanya hilang. Membuangnya lebih baik daripada
      // menyumbat antrean selamanya -- tidak ada yang bisa dikirim darinya.
      await rm(metaPath, { force: true }).catch(() => {});
      await rm(dataPath, { force: true }).catch(() => {});
      continue;
    }

    const segments = normalizeRelativeSegments(meta.relativePath);
    if (!segments) {
      await rm(metaPath, { force: true }).catch(() => {});
      await rm(dataPath, { force: true }).catch(() => {});
      continue;
    }

    const directory = joinNetworkPath(targetRoot, segments.slice(0, -1));
    const fullPath = joinNetworkPath(targetRoot, segments);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(fullPath, bytes);
    } catch {
      return { forwarded, pending: ids.length - index, stoppedBecause: "WRITE_FAILED" };
    }

    // Salinan lokal dihapus setelah benar-benar terkirim. Share adalah tempat
    // resmi; cadangan lokal yang tidak pernah dibersihkan cepat atau lambat
    // memenuhi disk server produksi.
    await rm(metaPath, { force: true }).catch(() => {});
    await rm(dataPath, { force: true }).catch(() => {});
    forwarded++;

    const { markCaptureForwarded } = await import("./capture-forward");
    await markCaptureForwarded(meta.fileName, meta.capturedAt, fullPath).catch(() => {});
  }

  return { forwarded, pending: 0, stoppedBecause: null };
}

// Pengirim ulang berkala untuk entri yang tertinggal.
//
// Dimulai malas (saat pemanggilan pertama), bukan di level modul: impor modul
// ikut dievaluasi saat build dan prerender, dan timer yang menyala di sana akan
// hidup di proses yang tidak pernah melayani permintaan.
let workerStarted = false;
const RETRY_INTERVAL_MS = 5 * 60_000;

export function ensureSpoolWorker(): void {
  if (workerStarted || typeof setInterval !== "function") return;
  workerStarted = true;
  const timer = setInterval(() => {
    void flushSpool().catch(() => {});
  }, RETRY_INTERVAL_MS);
  // Jangan menahan proses tetap hidup hanya demi timer ini.
  (timer as unknown as { unref?: () => void }).unref?.();
}
