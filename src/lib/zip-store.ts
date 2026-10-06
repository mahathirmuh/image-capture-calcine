// Penulis arsip ZIP tanpa kompresi ("stored"), dan aturan penamaan isi arsip
// untuk unduhan massal galeri.
//
// Tanpa kompresi karena isinya JPEG: mengompresnya lagi hanya membakar CPU app
// server tanpa memperkecil apa pun. Tanpa pustaka karena format "stored" cukup
// sederhana untuk ditulis langsung, dan satu-satunya bagian yang rawan --
// arsip di atas 4 GB -- justru perlu dikendalikan sendiri (ZIP64 di bawah).
//
// Modul ini murni: tidak menyentuh disk maupun jaringan, jadi bisa diuji apa
// adanya dan aman ikut ter-bundle ke browser (dialog unduh memakai aturan
// penamaannya untuk menghitung jumlah folder).
import { defaultSchedule, trackFolder, zonedClock, type CaptureTrack } from "./capture-schedule";

const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

// --- CRC-32 -------------------------------------------------------------------

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  const built = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    built[index] = value >>> 0;
  }
  crcTable = built;
  return built;
}

/** CRC-32 (IEEE) seperti yang diminta format ZIP. */
export function crc32(bytes: Uint8Array): number {
  const lookup = table();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    crc = lookup[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Penulis ZIP ----------------------------------------------------------------

/** Tanggal dan jam yang tertulis pada entri. Format ZIP tidak mengenal zona waktu. */
export type ZipTimestamp = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function dosTime(at: ZipTimestamp): { time: number; date: number } {
  // Format DOS tidak bisa menyimpan tahun sebelum 1980.
  const year = Math.min(Math.max(at.year, 1980), 2107);
  return {
    time: (at.hour << 11) | (at.minute << 5) | (at.second >> 1),
    date: ((year - 1980) << 9) | (at.month << 5) | at.day,
  };
}

function writeUint64(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value % 0x100000000, true);
  view.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
}

type WrittenEntry = {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

// Bit 11: nama entri ber-UTF-8. Tanpa ini, nama berkas beraksara non-Latin
// terbaca sebagai sampah di Windows Explorer.
const FLAG_UTF8 = 0x0800;
const VERSION_DEFAULT = 20;
const VERSION_ZIP64 = 45;

/**
 * Menyusun arsip ZIP potong demi potong, sehingga pemanggil bisa
 * mengalirkannya tanpa pernah memegang seluruh arsip di memori.
 *
 * ZIP64 dipakai HANYA untuk bagian yang memerlukannya (offset di atas 4 GB,
 * atau lebih dari 65.535 entri). Arsip kecil tetap berbentuk ZIP biasa yang
 * dibuka alat apa pun; arsip besar tetap sah alih-alih rusak diam-diam.
 */
export class ZipStoreWriter {
  private offset = 0;
  private readonly entries: WrittenEntry[] = [];

  /** Jumlah byte yang sudah dihasilkan sejauh ini. */
  get bytesWritten(): number {
    return this.offset;
  }

  /** Potongan untuk satu berkas: kepala lokal, lalu isinya. */
  file(name: string, data: Uint8Array, at: ZipTimestamp, crc: number = crc32(data)): Uint8Array[] {
    if (data.length >= UINT32_MAX) {
      throw new Error(`Berkas ${name} terlalu besar untuk dimasukkan ke arsip.`);
    }
    const nameBytes = new TextEncoder().encode(name);
    if (nameBytes.length > UINT16_MAX) throw new Error("Nama entri arsip terlalu panjang.");
    const { time, date } = dosTime(at);

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, VERSION_DEFAULT, true);
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, 0, true); // stored
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    this.entries.push({
      name: nameBytes,
      crc,
      size: data.length,
      offset: this.offset,
      time,
      date,
    });
    this.offset += header.length + data.length;
    return [header, data];
  }

  /** Direktori pusat dan penutup arsip. Dipanggil sekali, setelah semua berkas. */
  finish(): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    const directoryOffset = this.offset;
    let directorySize = 0;

    for (const entry of this.entries) {
      const needsZip64 = entry.offset >= UINT32_MAX;
      const extraLength = needsZip64 ? 12 : 0;
      const header = new Uint8Array(46 + entry.name.length + extraLength);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, needsZip64 ? VERSION_ZIP64 : VERSION_DEFAULT, true);
      view.setUint16(6, needsZip64 ? VERSION_ZIP64 : VERSION_DEFAULT, true);
      view.setUint16(8, FLAG_UTF8, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, entry.time, true);
      view.setUint16(14, entry.date, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.size, true);
      view.setUint32(24, entry.size, true);
      view.setUint16(28, entry.name.length, true);
      view.setUint16(30, extraLength, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, needsZip64 ? UINT32_MAX : entry.offset, true);
      header.set(entry.name, 46);
      if (needsZip64) {
        // Medan tambahan ZIP64 hanya memuat nilai yang di kepala ditandai
        // 0xFFFFFFFF -- di sini cuma offset kepala lokalnya.
        const extra = 46 + entry.name.length;
        view.setUint16(extra, 0x0001, true);
        view.setUint16(extra + 2, 8, true);
        writeUint64(view, extra + 4, entry.offset);
      }
      chunks.push(header);
      directorySize += header.length;
    }

    const count = this.entries.length;
    const zip64 =
      count >= UINT16_MAX || directoryOffset >= UINT32_MAX || directorySize >= UINT32_MAX;

    if (zip64) {
      const record = new Uint8Array(56);
      const view = new DataView(record.buffer);
      view.setUint32(0, 0x06064b50, true);
      writeUint64(view, 4, 44); // ukuran sisa record ini
      view.setUint16(12, VERSION_ZIP64, true);
      view.setUint16(14, VERSION_ZIP64, true);
      view.setUint32(16, 0, true);
      view.setUint32(20, 0, true);
      writeUint64(view, 24, count);
      writeUint64(view, 32, count);
      writeUint64(view, 40, directorySize);
      writeUint64(view, 48, directoryOffset);
      chunks.push(record);

      const locator = new Uint8Array(20);
      const locatorView = new DataView(locator.buffer);
      locatorView.setUint32(0, 0x07064b50, true);
      locatorView.setUint32(4, 0, true);
      writeUint64(locatorView, 8, directoryOffset + directorySize);
      locatorView.setUint32(16, 1, true);
      chunks.push(locator);
    }

    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, Math.min(count, UINT16_MAX), true);
    view.setUint16(10, Math.min(count, UINT16_MAX), true);
    view.setUint32(12, Math.min(directorySize, UINT32_MAX), true);
    view.setUint32(16, Math.min(directoryOffset, UINT32_MAX), true);
    view.setUint16(20, 0, true);
    chunks.push(end);

    this.offset += chunks.reduce((total, chunk) => total + chunk.length, 0);
    return chunks;
  }
}

// --- Penamaan isi arsip unduhan galeri --------------------------------------------

export type ZipPhoto = {
  id: number;
  fileName: string;
  filePath: string;
  /** ISO 8601 atau epoch ms. */
  capturedAt: string | number;
  plant: string | null;
  track: CaptureTrack;
};

// Karakter kontrol memang yang dicari di sini: nama yang memuatnya ditolak
// Windows saat arsipnya diekstrak.
// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

function safeSegment(value: string, fallback: string): string {
  // Titik di ujung dan spasi di tepi ditolak Windows saat diekstrak.
  const cleaned = value.replace(UNSAFE_NAME_CHARS, "_").trim().replace(/\.+$/, "");
  return cleaned === "" || cleaned === "." || cleaned === ".." ? fallback : cleaned;
}

function sessionDateFromPath(filePath: string): string | null {
  const matches = [...filePath.matchAll(/[\\/](\d{4})[\\/](\d{2})[\\/](\d{2})(?=[\\/])/g)];
  const last = matches.at(-1);
  if (!last) return null;
  const [, yyyy, mm, dd] = last;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Folder tanggal sebuah foto, "YYYY-MM-DD".
 *
 * Folder tanggal di path simpannya yang dipercaya lebih dulu: itu tanggal
 * SESI, jadi foto sesi 23.00 yang diambil lewat tengah malam tetap berkumpul
 * dengan sesinya. Tanpa itu, dipakai tanggal capture menurut jam plant --
 * bukan jam app server, yang berjalan di UTC.
 */
export function zipDateFolder(photo: Pick<ZipPhoto, "filePath" | "capturedAt" | "plant">): string {
  const fromPath = sessionDateFromPath(photo.filePath);
  if (fromPath) return fromPath;
  const at = typeof photo.capturedAt === "number" ? photo.capturedAt : Date.parse(photo.capturedAt);
  if (!Number.isFinite(at)) return "tanpa-tanggal";
  return zonedClock(at, defaultSchedule(photo.plant ?? "").timezone).date;
}

/** Jam plant sebagai stempel waktu entri arsip. */
export function zipTimestamp(photo: Pick<ZipPhoto, "capturedAt" | "plant">): ZipTimestamp {
  const at = typeof photo.capturedAt === "number" ? photo.capturedAt : Date.parse(photo.capturedAt);
  const clock = zonedClock(
    Number.isFinite(at) ? at : 0,
    defaultSchedule(photo.plant ?? "").timezone,
  );
  const [year, month, day] = clock.date.split("-").map(Number);
  return { year, month, day, hour: clock.hour, minute: clock.minute, second: clock.second };
}

/**
 * Path sebuah foto di dalam arsip: `<tanggal>/<folder plant>/<nama berkas>`.
 *
 * Folder plant diperlukan di bawah tanggal karena nama berkasnya TIDAK unik
 * dalam satu hari: jalur reguler dan trial sama-sama punya "02.00 Train 1.jpg",
 * dan tiga plant memakai "02.00 Bin 1.jpg". Tanpa folder itu, sebagian foto
 * saling menimpa saat diekstrak.
 *
 * `used` mencatat path yang sudah dipakai; tabrakan yang tersisa (berkas lepas
 * bernama sama) diberi akhiran " (2)", " (3)", ...
 */
export function zipEntryPath(photo: ZipPhoto, used: Set<string>): string {
  const date = zipDateFolder(photo);
  const folder = safeSegment(
    photo.plant ? trackFolder(photo.plant, photo.track) : "",
    "Tanpa plant",
  );
  const fileName = safeSegment(photo.fileName, `capture-${photo.id}.jpg`);
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";

  let candidate = `${date}/${folder}/${fileName}`;
  for (let copy = 2; used.has(candidate.toLowerCase()); copy++) {
    candidate = `${date}/${folder}/${base} (${copy})${extension}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Nama berkas arsip dari rentang tanggal isinya. */
export function zipArchiveName(dates: readonly string[]): string {
  const sorted = [...new Set(dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (sorted.length === 0) return "foto-calcine.zip";
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last ? `foto-calcine-${first}.zip` : `foto-calcine-${first}_sd_${last}.zip`;
}
