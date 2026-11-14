import { describe, expect, it } from "vitest";
import {
  defaultSchedule,
  scheduleHours,
  scheduleForDate,
  sessionContext,
  activeScheduledContext,
  validateCaptureContext,
  scheduleValidation,
  plantToday,
  applyFixedRegularSchedules,
  hasFixedRegularSchedule,
  hasTrialTrack,
  trackFolder,
  aiSchedule,
  hasAiTrack,
  parseCaptureTrack,
  trackHasSessions,
  versionsForTrack,
  type ScheduleVersion,
} from "./capture-schedule";
import { buildSessionCoverage } from "./session-coverage";
const plant = "Acid Plant";
const legacy = defaultSchedule(plant);
const version: ScheduleVersion = {
  ...legacy,
  id: "v2",
  effectiveDate: "2026-10-06",
  startHour: 2,
  intervalHours: 4,
  windowMinutes: 60,
};
describe("versioned plant schedules", () => {
  it.each([1, 2, 3, 4, 6, 8, 12, 24])(
    "generates distinct daily sessions every %i hours",
    (intervalHours) => {
      const hours = scheduleHours({ startHour: 2, intervalHours });
      expect(hours).toHaveLength(24 / intervalHours);
      expect(new Set(hours).size).toBe(hours.length);
      expect(hours.every((h) => h >= 0 && h <= 23)).toBe(true);
    },
  );
  it("preserves historical schedules and isolates plants", () => {
    expect(scheduleForDate([legacy, version], plant, "2026-10-05").id).toBe(legacy.id);
    expect(scheduleForDate([legacy, version], plant, "2026-10-06").id).toBe("v2");
    expect(scheduleForDate([version], "Chloride Plant", "2026-10-06").intervalHours).toBe(3);
  });
  it("uses the last version for a revised future date", () => {
    expect(scheduleForDate([version, { ...version, id: "v3" }], plant, "2026-10-06").id).toBe("v3");
  });
  it.each(["Asia/Makassar", "Asia/Jakarta", "Asia/Jayapura"])(
    "uses plant zone %s independently of host zone",
    (timezone) => {
      const schedule = { ...version, timezone };
      const context = sessionContext(schedule, "2026-10-06", 6);
      expect(plantToday([schedule], plant, context.startsAt)).toBe("2026-10-06");
      expect(activeScheduledContext([schedule], plant, context.startsAt)?.label).toBe("06.00");
      expect(activeScheduledContext([schedule], plant, context.endsAt)).toBeNull();
    },
  );
  it("carries a previous-day session across a schedule change at midnight", () => {
    const context = activeScheduledContext(
      [legacy, version],
      plant,
      Date.parse("2026-10-05T16:30:00Z"),
    );
    expect(context).toMatchObject({ date: "2026-10-05", label: "23.00", scheduleId: legacy.id });
  });
  it("rejects invalid intervals, overlap and nonexistent dates", () => {
    expect(scheduleValidation({ ...version, intervalHours: 5 })).toBeTruthy();
    expect(scheduleValidation({ ...version, windowMinutes: 241 })).toBeTruthy();
    expect(scheduleValidation({ ...version, effectiveDate: "2026-02-30" })).toBeTruthy();
  });
  it("rejects closed/upcoming/unknown sessions, permits explicit recent recovery", () => {
    const now = Date.parse("2026-10-06T01:00:00Z"); // 09:00 plant-local
    expect(() => validateCaptureContext([version], plant, now)).toThrow("SESSION_CLOSED");
    expect(() =>
      validateCaptureContext([version], plant, now, {
        sessionDate: "2026-10-06",
        captureSession: "10.00",
        recovery: true,
      }),
    ).toThrow("SESSION_UPCOMING");
    expect(() =>
      validateCaptureContext([version], plant, now, {
        sessionDate: "2026-10-06",
        captureSession: "05.00",
        recovery: true,
      }),
    ).toThrow("INVALID_SESSION");
    expect(
      validateCaptureContext([version], plant, now, {
        sessionDate: "2026-10-06",
        captureSession: "06.00",
        recovery: true,
      }).label,
    ).toBe("06.00");
    expect(() =>
      validateCaptureContext([version], plant, now, {
        sessionDate: "2026-10-03",
        captureSession: "05.00",
        recovery: true,
      }),
    ).toThrow("SESSION_CLOSED");
  });
  it("coverage changes expectations without reinterpreting historical records", () => {
    const record = {
      id: 1,
      fileName: "06.00 Train 1.jpg",
      filePath: "/share/Acid Plant/2026/10/06/06.00 Train 1.jpg",
      capturedAt: "2026-10-05T22:10:00Z",
      captureSession: "06.00",
      captureBin: "TRAIN 1",
      plant,
      status: "saved",
      capturedBy: "Test",
    };
    const coverage = buildSessionCoverage({
      date: "2026-10-06",
      plants: [plant],
      versions: [version],
      records: [record],
    });
    expect(coverage.summary).toEqual({ expected: 12, captured: 1, missing: 11 });
    expect(
      buildSessionCoverage({
        date: "2026-10-05",
        plants: [plant],
        versions: [version],
        records: [],
      }).summary.expected,
    ).toBe(16);
  });
});
describe("after the 2-hour trial sessions were removed (13 Nov 2026)", () => {
  const at = (iso: string) => Date.parse(iso);
  it("still names the trial folder that holds the old trial photos", () => {
    expect(hasTrialTrack("Acid Plant")).toBe(true);
    expect(hasTrialTrack("Chloride Plant")).toBe(false);
    expect(trackFolder(plant, "trial")).toBe("Acid Plant Trial");
    expect(trackFolder(plant, "regular")).toBe("Acid Plant");
  });
  it("keeps Acid Plant on the fixed 3-hour schedule on its own", () => {
    expect(hasFixedRegularSchedule("Acid Plant")).toBe(true);
    expect(hasFixedRegularSchedule("Chloride Plant")).toBe(false);
    // The 2-hourly version an admin saved for 6 Oct must not come back.
    const twoHourly = { ...version, intervalHours: 2, windowMinutes: 120 };
    const versions = applyFixedRegularSchedules([legacy, twoHourly], [plant]);
    expect(scheduleHours(scheduleForDate(versions, plant, "2026-11-13"))).toEqual([
      2, 5, 8, 11, 14, 17, 20, 23,
    ]);
    // 04:30 WITA belongs to the 02.00 session: there is no 04.00 session any more.
    expect(activeScheduledContext(versions, plant, at("2026-11-13T04:30:00+08:00"))?.label).toBe(
      "02.00",
    );
    expect(() =>
      validateCaptureContext(versions, plant, at("2026-11-13T04:30:00+08:00"), {
        sessionDate: "2026-11-13",
        captureSession: "04.00",
      }),
    ).toThrow(/INVALID_SESSION/);
  });
});
describe("two Acid Plant schedules from 14 Nov 2026: Sampling Rutin and Sampling AI", () => {
  const at = (iso: string) => Date.parse(iso);
  const versions = applyFixedRegularSchedules([legacy], [plant]);
  const label = (track: "regular" | "ai", iso: string) => {
    const context = activeScheduledContext(
      versionsForTrack(versions, plant, track),
      plant,
      at(iso),
    );
    return context && `${context.date} ${context.label}`;
  };
  it("keeps routine sampling on 02.00 ... 23.00 and runs AI sampling on 00.00 ... 21.00", () => {
    for (const date of ["2026-11-13", "2026-11-14", "2026-12-31", "2027-01-01"])
      expect(scheduleHours(scheduleForDate(versions, plant, date))).toEqual([
        2, 5, 8, 11, 14, 17, 20, 23,
      ]);
    const ai = versionsForTrack(versions, plant, "ai");
    for (const date of ["2026-11-14", "2026-12-31", "2027-01-01"]) {
      const schedule = scheduleForDate(ai, plant, date);
      expect(scheduleHours(schedule)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
      expect(schedule.windowMinutes).toBe(180);
      expect(schedule.timezone).toBe("Asia/Makassar");
    }
    expect(aiSchedule(plant).effectiveDate).toBe("2026-11-14");
  });
  it("offers AI sampling only at Acid Plant, from 14 Nov on, in its own folder", () => {
    expect(hasAiTrack("Acid Plant")).toBe(true);
    expect(hasAiTrack("Chloride Plant")).toBe(false);
    expect(trackHasSessions("Acid Plant", "ai", "2026-11-13")).toBe(false);
    expect(trackHasSessions("Acid Plant", "ai", "2026-11-14")).toBe(true);
    expect(trackHasSessions("Chloride Plant", "ai", "2026-11-14")).toBe(false);
    expect(trackHasSessions("Chloride Plant", "regular", "2026-11-14")).toBe(true);
    expect(trackHasSessions("Acid Plant", "trial", "2026-11-14")).toBe(false);
    expect(trackFolder(plant, "ai")).toBe("Acid Plant AI");
    expect(trackFolder(plant, "regular")).toBe("Acid Plant");
    expect(parseCaptureTrack("ai")).toBe("ai");
    expect(parseCaptureTrack("trial")).toBe("trial");
    expect(parseCaptureTrack(undefined)).toBe("regular");
    expect(parseCaptureTrack("something")).toBe("regular");
  });
  it("opens one session per track at the same moment", () => {
    expect(label("regular", "2026-11-14T17:20:00+08:00")).toBe("2026-11-14 17.00");
    expect(label("ai", "2026-11-14T17:20:00+08:00")).toBe("2026-11-14 15.00");
    expect(label("regular", "2026-11-15T00:30:00+08:00")).toBe("2026-11-14 23.00");
    expect(label("ai", "2026-11-15T00:30:00+08:00")).toBe("2026-11-15 00.00");
    expect(label("ai", "2026-11-15T23:59:00+08:00")).toBe("2026-11-15 21.00");
    expect(() =>
      validateCaptureContext(
        versionsForTrack(versions, plant, "ai"),
        plant,
        at("2026-11-14T17:20:00+08:00"),
        { sessionDate: "2026-11-14", captureSession: "17.00" },
      ),
    ).toThrow(/INVALID_SESSION/);
    expect(() =>
      validateCaptureContext(versions, plant, at("2026-11-14T17:20:00+08:00"), {
        sessionDate: "2026-11-14",
        captureSession: "15.00",
      }),
    ).toThrow(/INVALID_SESSION/);
  });
  it("counts 8 sessions x 2 slots on each track", () => {
    const routine = buildSessionCoverage({
      date: "2026-11-14",
      plants: [plant],
      versions,
      records: [],
    });
    const ai = buildSessionCoverage({
      date: "2026-11-14",
      plants: [plant],
      versions: [aiSchedule(plant)],
      records: [],
    });
    expect(routine.summary.expected).toBe(16);
    expect(ai.summary.expected).toBe(16);
    expect(routine.plants[0].sessions.map((s) => s.session)).toEqual([
      "02.00",
      "05.00",
      "08.00",
      "11.00",
      "14.00",
      "17.00",
      "20.00",
      "23.00",
    ]);
    expect(ai.plants[0].sessions.map((s) => s.session)).toEqual([
      "00.00",
      "03.00",
      "06.00",
      "09.00",
      "12.00",
      "15.00",
      "18.00",
      "21.00",
    ]);
  });
});
