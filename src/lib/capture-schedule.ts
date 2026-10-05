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
    windowMinutes: 120,
    timezone: "Asia/Makassar",
    createdAt: "1970-01-01T00:00:00.000Z",
    createdBy: null,
  };
}
// Jalur capture. "regular" memakai jadwal plant yang diatur admin; "trial"
// berjalan berdampingan di plant yang sama dengan jadwal tetap per 2 jam
// (00.00, 02.00, 04.00, ...) dan folder simpannya sendiri. Kamera, operator
// dan slot Train/Bin tetap milik plant asalnya -- yang berbeda hanya jadwal
// dan tujuan berkas.
export const CAPTURE_TRACKS = ["regular", "trial"] as const;
export type CaptureTrack = (typeof CAPTURE_TRACKS)[number];
export const TRIAL_PLANTS: readonly string[] = ["Acid Plant"];
export function hasTrialTrack(plant: string): boolean {
  return TRIAL_PLANTS.includes(plant);
}
export function trialSchedule(plant: string): ScheduleVersion {
  return {
    ...defaultSchedule(plant),
    id: `trial-${plant}`,
    startHour: 0,
    intervalHours: 2,
    windowMinutes: 120,
  };
}
/** Versi jadwal yang berlaku untuk sebuah jalur. Trial tidak ikut versi admin. */
export function versionsForTrack(
  versions: ScheduleVersion[],
  plant: string,
  track: CaptureTrack,
): ScheduleVersion[] {
  return track === "trial" ? [trialSchedule(plant)] : versions;
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
