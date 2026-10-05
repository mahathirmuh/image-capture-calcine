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
