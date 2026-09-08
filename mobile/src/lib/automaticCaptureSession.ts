import { localDateKey, type TodaySessionItem } from "./sessionCoverage";

const SESSION_HOURS = [2, 5, 8, 11, 14, 17, 20, 23] as const;

/** Device-local two-hour windows; 23:00 continues until 00:59 the next day. */
export function resolveAutomaticCaptureSession(
  plant: string | null | undefined,
  now = new Date(),
): TodaySessionItem | null {
  if (!plant || plant === "ALL") return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const hour = SESSION_HOURS.find((start) => (minutes - start * 60 + 1440) % 1440 < 120);
  if (hour === undefined) return null;
  const startDate = new Date(now);
  if (minutes < hour * 60) startDate.setDate(startDate.getDate() - 1);
  const label = `${String(hour).padStart(2, "0")}.00`;
  return {
    key: `auto-${plant}-${localDateKey(startDate)}-${hour}`,
    plant,
    session: label,
    hour,
    slot: 1,
    location: `${plant === "Acid Plant" ? "Train" : "Bin"} 1`,
    displayTime: label.replace(".", ":"),
    status: "missing",
    trailing: null,
    recordId: null,
  };
}
