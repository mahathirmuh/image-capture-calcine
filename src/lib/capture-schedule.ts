// Shared schedule arithmetic. No device/server timezone assumptions.
export const SCHEDULE_INTERVALS = [1, 2, 3, 4, 6, 8, 12, 24] as const;
export const SCHEDULE_TIMEZONES = ["Asia/Makassar", "Asia/Jakarta", "Asia/Jayapura"] as const;
export type ScheduleVersion = {
  id: string;
  plant: string;
  effectiveDate: string;
  startHour: number;
  intervalHours: number;
  windowMinutes: number;
  timezone: string;
  createdAt: string;
  createdBy: number | null;
};
export type ScheduleSnapshot = { revision: number; serverNow: number; versions: ScheduleVersion[] };
export type ScheduledContext = {
  date: string;
  label: string;
  hour: number;
  startsAt: number;
  endsAt: number;
  scheduleId: string;
};
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}
export function zonedClock(now: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}
export function defaultSchedule(plant: string): ScheduleVersion {
  return {
    id: `default-${plant}`,
    plant,
    effectiveDate: "1970-01-01",
    startHour: 2,
    intervalHours: 3,
    // Sesi dihitung sebagai RENTANG: 11.00 berlaku sampai 14.00 dimulai, jadi
    // jendelanya sepanjang interval dan tidak ada jam kosong di antara sesi.
    windowMinutes: 180,
    timezone: "Asia/Makassar",
    createdAt: "1970-01-01T00:00:00.000Z",
    createdBy: null,
  };
}
// Jalur capture, tersimpan sebagai `captureTrack` pada record. "regular" memakai
// jadwal plant. "trial" adalah sesi Acid Plant per 2 jam (00.00, 02.00, 04.00,
// ...) dengan folder simpannya sendiri; jalur ini DIHAPUS pada 13 Nov 2026 atas
// keputusan pemilik, jadi tidak ada lagi sesi trial yang ditawarkan atau
// diterima. Nilai "trial" tetap dikenal karena foto trial lama tetap ada -- di
// folder "<plant> Trial" dan di registry -- dan tetap dibaca Gallery, unduhan
// ZIP, dan Sinkronkan folder.
export const CAPTURE_TRACKS = ["regular", "trial"] as const;
export type CaptureTrack = (typeof CAPTURE_TRACKS)[number];
/** Plant yang punya arsip trial, yaitu folder "<plant> Trial". */
export const TRIAL_PLANTS: readonly string[] = ["Acid Plant"];
export function hasTrialTrack(plant: string): boolean {
  return TRIAL_PLANTS.includes(plant);
}
/**
 * Sejak tanggal ini Acid Plant memakai jadwal TETAP per 3 jam dengan jendela
 * 180 menit, yang tidak diatur dari Settings. Jamnya berubah menurut
 * FIXED_SCHEDULE_CHANGES di bawah.
 *
 * Alasannya: jadwal yang diubah dari Settings menjadi per 2 jam (pernah
 * terjadi, berlaku 6 Okt) menggandakan sesi trial yang waktu itu masih
 * berjalan. Versi per 2 jam itu masih tersimpan di versions.json sebagai
 * riwayat; tanpa jadwal tetap ini ia akan berlaku lagi.
 *
 * Riwayat SEBELUM tiap tanggal dibiarkan apa adanya: foto yang sudah diambil
 * menurut jadwal lama tetap dinilai dengan jadwal lama.
 */
export const FIXED_REGULAR_SINCE = "2026-10-07";
const FIXED_SCHEDULE_PLANTS: readonly string[] = ["Acid Plant"];

/**
 * Perubahan jam jadwal tetap, urut tanggal; tiap baris berlaku sampai baris
 * berikutnya.
 * - 7 Okt 2026: 02.00, 05.00, 08.00, 11.00, 14.00, 17.00, 20.00, 23.00
 *   (keputusan pemilik; tetap berlaku setelah jalur trial dihapus 13 Nov).
 * - 16 Nov 2026: 00.00, 03.00, 06.00, 09.00, 12.00, 15.00, 18.00, 21.00
 *   (slide "Interval 3 Hours Sampling" tertanggal 11 Nov 2026). Slide itu
 *   menyebut masa trial 16 Nov-31 Des 2026; pemilik memutuskan jam ini tetap
 *   berlaku sesudahnya sampai diubah lagi.
 * Baris yang sudah lewat jangan diubah atau dihapus: riwayat sesi dihitung
 * ulang dari baris ini.
 */
const FIXED_SCHEDULE_CHANGES: readonly { effectiveDate: string; startHour: number }[] = [
  { effectiveDate: FIXED_REGULAR_SINCE, startHour: 2 },
  { effectiveDate: "2026-11-16", startHour: 0 },
];

export function hasFixedRegularSchedule(plant: string): boolean {
  return FIXED_SCHEDULE_PLANTS.includes(plant);
}

/**
 * Versi jadwal tetap sebuah plant, satu per baris FIXED_SCHEDULE_CHANGES.
 * Versi pertama tetap ber-id "fixed-<plant>" seperti sebelum ada perubahan jam.
 */
export function fixedRegularSchedules(plant: string): ScheduleVersion[] {
  return FIXED_SCHEDULE_CHANGES.map(({ effectiveDate, startHour }, index) => ({
    ...defaultSchedule(plant),
    id: index === 0 ? `fixed-${plant}` : `fixed-${plant}-${effectiveDate}`,
    effectiveDate,
    startHour,
    createdAt: `${effectiveDate}T00:00:00.000Z`,
  }));
}

/**
 * Versi jadwal setelah aturan jadwal tetap diterapkan: versi tersimpan untuk
 * plant berjadwal tetap yang berlaku mulai FIXED_REGULAR_SINCE diabaikan, lalu
 * jadwal tetapnya ditambahkan di ujung (yang di ujung menang bila tanggalnya
 * sama -- lihat scheduleForDate).
 */
export function applyFixedRegularSchedules(
  versions: ScheduleVersion[],
  plants: readonly string[],
): ScheduleVersion[] {
  const fixedPlants = plants.filter(hasFixedRegularSchedule);
  return [
    ...versions.filter(
      (version) =>
        !(
          hasFixedRegularSchedule(version.plant) &&
          (version.effectiveDate >= FIXED_REGULAR_SINCE ||
            fixedRegularSchedules(version.plant).some((fixed) => fixed.id === version.id))
        ),
    ),
    ...fixedPlants.flatMap(fixedRegularSchedules),
  ];
}

/** Folder pertama di bawah NETWORK_SAVE_ROOT: "Acid Plant" atau "Acid Plant Trial". */
export function trackFolder(plant: string, track: CaptureTrack): string {
  return track === "trial" ? `${plant} Trial` : plant;
}
export function scheduleForDate(versions: ScheduleVersion[], plant: string, date: string) {
  return versions.reduce(
    (best, v) =>
      v.plant === plant && v.effectiveDate <= date && v.effectiveDate >= best.effectiveDate
        ? v
        : best,
    defaultSchedule(plant),
  );
}
export function scheduleHours(
  schedule: Pick<ScheduleVersion, "startHour" | "intervalHours">,
): number[] {
  return Array.from(
    { length: 24 / schedule.intervalHours },
    (_, i) => (schedule.startHour + i * schedule.intervalHours) % 24,
  ).sort((a, b) => a - b);
}
export function scheduleLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}.00`;
}
export function scheduleValidation(value: Partial<ScheduleVersion>): string | null {
  if (!Number.isInteger(value.startHour) || value.startHour! < 0 || value.startHour! > 23)
    return "Jam mulai harus antara 00 dan 23.";
  if (!(SCHEDULE_INTERVALS as readonly number[]).includes(value.intervalHours!))
    return "Interval harus 1, 2, 3, 4, 6, 8, 12, atau 24 jam.";
  if (
    !Number.isInteger(value.windowMinutes) ||
    value.windowMinutes! < 1 ||
    value.windowMinutes! > value.intervalHours! * 60
  )
    return "Jendela capture harus 1 menit hingga panjang interval sesi.";
  if (!(SCHEDULE_TIMEZONES as readonly string[]).includes(value.timezone!))
    return "Timezone tidak valid.";
  if (!value.effectiveDate || !validDate(value.effectiveDate))
    return "Tanggal berlaku tidak valid.";
  return null;
}
// Supported Indonesian zones have fixed offsets; derive them through Intl rather than host TZ.
export function sessionContext(
  schedule: ScheduleVersion,
  date: string,
  hour: number,
): ScheduledContext {
  const utc = Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  const clock = zonedClock(utc, schedule.timezone);
  const represented = Date.parse(
    `${clock.date}T${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}:00Z`,
  );
  const startsAt = utc - (represented - utc);
  return {
    date,
    hour,
    label: scheduleLabel(hour),
    startsAt,
    endsAt: startsAt + schedule.windowMinutes * 60000,
    scheduleId: schedule.id,
  };
}
export function plantToday(versions: ScheduleVersion[], plant: string, now: number): string {
  // Iteration handles a future version changing timezone at its effective local date.
  let date = zonedClock(now, defaultSchedule(plant).timezone).date;
  for (let i = 0; i < 3; i++)
    date = zonedClock(now, scheduleForDate(versions, plant, date).timezone).date;
  return date;
}
export function activeScheduledContext(
  versions: ScheduleVersion[],
  plant: string,
  now: number,
): ScheduledContext | null {
  const today = plantToday(versions, plant, now);
  const contexts = [-1, 0].flatMap((offset) => {
    const date = shiftDate(today, offset);
    const schedule = scheduleForDate(versions, plant, date);
    return scheduleHours(schedule).map((hour) => sessionContext(schedule, date, hour));
  });
  return (
    contexts
      .filter((s) => s.startsAt <= now && now < s.endsAt)
      .sort((a, b) => b.startsAt - a.startsAt)[0] ?? null
  );
}
export function validateCaptureContext(
  versions: ScheduleVersion[],
  plant: string,
  now: number,
  input?: { sessionDate?: string; captureSession?: string; recovery?: boolean },
) {
  if (!input?.sessionDate && !input?.captureSession) {
    const active = activeScheduledContext(versions, plant, now);
    if (!active) throw new Error("SESSION_CLOSED: Tidak ada sesi capture yang terbuka.");
    return active;
  }
  const date = input.sessionDate ?? "";
  if (!validDate(date)) throw new Error("INVALID_SESSION: Tanggal sesi tidak valid.");
  const schedule = scheduleForDate(versions, plant, date);
  const hour = scheduleHours(schedule).find((h) => scheduleLabel(h) === input.captureSession);
  if (hour === undefined) throw new Error("INVALID_SESSION: Sesi tidak ada pada jadwal plant.");
  const context = sessionContext(schedule, date, hour);
  if (now < context.startsAt) throw new Error("SESSION_UPCOMING: Sesi belum dimulai.");
  if (now >= context.endsAt) {
    const today = plantToday(versions, plant, now);
    if (!input.recovery || date < shiftDate(today, -1) || date > today)
      throw new Error("SESSION_CLOSED: Jendela capture telah berakhir.");
  }
  return context;
}
