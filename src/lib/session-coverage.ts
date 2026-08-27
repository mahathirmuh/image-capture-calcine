// Menjawab satu pertanyaan: sesi mana yang sudah ada fotonya, dan mana yang
// terlewat.
//
// Sengaja murni -- tidak menyentuh database maupun filesystem -- supaya
// aturannya bisa diuji tanpa SQL Server. Handler REST di
// src/lib/server/api-rest.ts yang mengambil barisnya; modul ini yang berpikir.
import { CAPTURE_SESSION_HOURS, formatSessionLabel } from "./capture-session";
import { BIN_SLOTS, toBinSlot, toBinTitle, type BinSlot } from "./locations";

/** Bentuk minimum satu record yang dibutuhkan untuk menghitung cakupan. */
export type CoverageRecord = {
  id: number;
  fileName: string;
  filePath: string;
  /** ISO 8601, waktu capture sebenarnya. */
  capturedAt: string;
  captureSession: string | null;
  captureBin: string | null;
  plant: string | null;
  status: string;
  capturedBy: string | null;
};

export type CoverageSlot = {
  slot: BinSlot;
  label: string;
  captured: boolean;
  record: CoverageRecord | null;
};

export type CoverageSession = {
  session: string;
  hour: number;
  slots: CoverageSlot[];
};

export type CoverageSummary = {
  expected: number;
  captured: number;
  missing: number;
};

export type CoveragePlant = {
  plant: string;
  sessions: CoverageSession[];
  summary: CoverageSummary;
};

/** "YYYY-MM-DD" dari komponen tanggal LOKAL, bukan `toISOString()` yang
 * menggeser ke UTC dan bisa memundurkan tanggalnya sehari. */
export function toLocalDateKey(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Tanggal sesi dari path berkas, kalau ada.
 *
 * Ini sumber yang PALING DIPERCAYA, dan alasannya bukan kerapian: segmen
 * YYYY/MM/DD ditulis saat berkas dinamai, jadi ia sudah memuat keputusan "sesi
 * 23.00 masuk folder kemarin" tanpa membawa zona waktu apa pun. Menghitung
 * ulang di server berisiko memakai TZ container (UTC) dan menggeser sesi 23.00
 * maupun 02.00 ke tanggal yang salah.
 *
 * Dicocokkan dari BELAKANG karena root-nya sendiri bisa mengandung angka.
 */
export function sessionDateFromPath(filePath: string): string | null {
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
 * Cadangan untuk record lama yang path-nya tidak memuat YYYY/MM/DD: pilih
 * tanggal yang membuat sesi ini PALING DEKAT dengan waktu capture.
 *
 * Itu yang menempatkan capture pukul 00.30 pada sesi 23.00 tanggal kemarin,
 * dan tetap benar untuk sesi mana pun tanpa aturan khusus per jam.
 */
export function sessionDateFromCapturedAt(capturedAt: Date, sessionHour: number): string {
  let best = capturedAt;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const dayOffset of [-1, 0, 1]) {
    const candidate = new Date(capturedAt);
    candidate.setDate(candidate.getDate() + dayOffset);
    candidate.setHours(sessionHour, 0, 0, 0);
    const distance = Math.abs(candidate.getTime() - capturedAt.getTime());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return toLocalDateKey(best);
}

/** Jam sesi dari label "02.00"/"23.00". Null kalau bukan jam sesi yang dikenal. */
export function parseSessionLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.trim().match(/^(\d{1,2})[.:]00$/);
  if (!match) return null;
  const hour = Number(match[1]);
  return (CAPTURE_SESSION_HOURS as readonly number[]).includes(hour) ? hour : null;
}

/** Tanggal sesi sebuah record: path dulu, waktu capture sebagai cadangan. */
export function resolveRecordSessionDate(record: CoverageRecord): string | null {
  const fromPath = sessionDateFromPath(record.filePath);
  if (fromPath) return fromPath;

  const hour = parseSessionLabel(record.captureSession);
  if (hour === null) return null;

  const capturedAt = new Date(record.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) return null;
  return sessionDateFromCapturedAt(capturedAt, hour);
}

function sumSummaries(summaries: readonly CoverageSummary[]): CoverageSummary {
  return summaries.reduce<CoverageSummary>(
    (total, one) => ({
      expected: total.expected + one.expected,
      captured: total.captured + one.captured,
      missing: total.missing + one.missing,
    }),
    { expected: 0, captured: 0, missing: 0 },
  );
}

/**
 * Susun cakupan 8 sesi x 2 slot untuk satu tanggal.
 *
 * Kalau satu slot punya lebih dari satu record -- capture ulang di sesi yang
 * sama menimpa berkasnya di share, tapi setiap percobaan tetap meninggalkan
 * barisnya sendiri di registry -- YANG DIAMBIL YANG TERBARU. Berkas yang
 * benar-benar ada di share adalah hasil tulisan terakhir, jadi record terakhir
 * itulah yang menggambarkannya.
 */
export function buildSessionCoverage(input: {
  date: string;
  plants: readonly string[];
  records: readonly CoverageRecord[];
}): { plants: CoveragePlant[]; summary: CoverageSummary } {
  const plants = input.plants.map((plant): CoveragePlant => {
    const forPlant = input.records.filter(
      (record) => record.plant === plant && resolveRecordSessionDate(record) === input.date,
    );

    const sessions = CAPTURE_SESSION_HOURS.map((hour): CoverageSession => {
      const slots = BIN_SLOTS.map((slot): CoverageSlot => {
        const matching = forPlant.filter(
          (record) =>
            parseSessionLabel(record.captureSession) === hour &&
            toBinSlot(record.captureBin) === slot,
        );
        const latest = matching.reduce<CoverageRecord | null>((newest, record) => {
          if (!newest) return record;
          return Date.parse(record.capturedAt) >= Date.parse(newest.capturedAt) ? record : newest;
        }, null);

        return { slot, label: toBinTitle(plant, slot), captured: latest !== null, record: latest };
      });

      return { session: formatSessionLabel(hour), hour, slots };
    });

    const expected = sessions.length * BIN_SLOTS.length;
    const captured = sessions.reduce(
      (count, session) => count + session.slots.filter((slot) => slot.captured).length,
      0,
    );

    return { plant, sessions, summary: { expected, captured, missing: expected - captured } };
  });

  return { plants, summary: sumSummaries(plants.map((plant) => plant.summary)) };
}
