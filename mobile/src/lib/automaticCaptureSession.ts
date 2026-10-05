import {
  activeScheduledContext,
  hasTrialTrack,
  versionsForTrack,
  type CaptureTrack,
  type ScheduleSnapshot,
} from "../../../src/lib/capture-schedule";
import { localDateKey, type TodaySessionItem } from "./sessionCoverage";

const SESSION_HOURS = [2, 5, 8, 11, 14, 17, 20, 23] as const;

/** Open session for a track. The no-snapshot branch is a legacy device-clock fallback. */
export function resolveAutomaticCaptureSession(
  plant: string | null | undefined,
  now = new Date(),
  snapshot?: ScheduleSnapshot | null,
  track: CaptureTrack = "regular",
): TodaySessionItem | null {
  if (!plant || plant === "ALL") return null;
  if (track === "trial" && !hasTrialTrack(plant)) return null;
  if (snapshot) {
    const context = activeScheduledContext(
      versionsForTrack(snapshot.versions, plant, track),
      plant,
      now.getTime(),
    );
    if (!context) return null;
    return {
      key: `auto-${track}-${plant}-${context.date}-${context.hour}-${context.scheduleId}`,
      track,
      plant,
      session: context.label,
      hour: context.hour,
      slot: 1,
      location: `${plant === "Acid Plant" ? "Train" : "Bin"} 1`,
      displayTime: context.label.replace(".", ":"),
      status: "open",
      trailing: null,
      recordId: null,
      sessionDate: context.date,
      startsAt: context.startsAt,
      endsAt: context.endsAt,
      scheduleId: context.scheduleId,
    };
  }
  const minutes = now.getHours() * 60 + now.getMinutes();
  const hour = SESSION_HOURS.find((start) => (minutes - start * 60 + 1440) % 1440 < 180);
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
