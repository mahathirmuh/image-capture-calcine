import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({ root: "" }));
vi.mock("../env", () => ({
  getServerEnv: () => ({
    CAPTURE_SPOOL_DIR: config.root,
    SESSION_SECRET: "schedule-test-secret-at-least-thirty-two-characters",
  }),
}));
import {
  readScheduleSnapshot,
  saveScheduleVersion,
  issueCaptureReceipt,
  verifyCaptureReceipt,
} from "./capture-schedules";
beforeEach(async () => {
  config.root = await mkdtemp(join(tmpdir(), "calcine-schedule-"));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-05T06:00:00Z"));
});
afterEach(async () => {
  await rm(config.root, { recursive: true, force: true });
  vi.restoreAllMocks();
});
const input = {
  // Acid Plant berjadwal tetap; plant lain yang dipakai untuk menguji
  // penyimpanan jadwal yang bisa diatur.
  plant: "Chloride Plant",
  effectiveDate: "2026-10-06",
  startHour: 6,
  intervalHours: 6,
  windowMinutes: 60,
  timezone: "Asia/Makassar",
  expectedRevision: 0,
};
it("persists versions atomically and reads them independently of memory", async () => {
  const saved = await saveScheduleVersion(input, 42);
  const loaded = await readScheduleSnapshot();
  expect(loaded.revision).toBe(1);
  expect(loaded.versions).toEqual(saved.versions);
  expect(loaded.versions.find((v) => v.createdBy === 42)).toMatchObject({ intervalHours: 6 });
});
it("rejects stale writes and historical changes", async () => {
  await saveScheduleVersion(input, 42);
  await expect(saveScheduleVersion(input, 42)).rejects.toThrow("Jadwal telah berubah");
  await expect(
    saveScheduleVersion({ ...input, expectedRevision: 1, effectiveDate: "2026-10-05" }, 42),
  ).rejects.toThrow("mulai besok");
  expect((await readScheduleSnapshot()).revision).toBe(1);
});
it("serializes concurrent writers without losing a version", async () => {
  const results = await Promise.allSettled([
    saveScheduleVersion(input, 1),
    saveScheduleVersion(input, 2),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await readScheduleSnapshot()).revision).toBe(1);
});
it("fails closed on corrupt storage instead of reverting to default", async () => {
  await mkdir(join(config.root, "schedules"));
  await writeFile(join(config.root, "schedules", "versions.json"), '{"revision":1,"versions":[]}');
  await expect(readScheduleSnapshot()).rejects.toThrow("SCHEDULE_STORAGE_INVALID");
});
it("binds finalization to server command time and user; rejects tampering and expiry", () => {
  const value = {
    userId: 42,
    deviceId: 7,
    plant: "Acid Plant",
    sessionDate: "2026-10-05",
    captureSession: "14.00",
    capturedAt: Date.now(),
    jobId: "job",
  };
  const ticket = issueCaptureReceipt(value);
  expect(verifyCaptureReceipt(ticket, 42)).toEqual(value);
  expect(() => verifyCaptureReceipt(ticket, 43)).toThrow("INVALID_CAPTURE_RECEIPT");
  expect(() => verifyCaptureReceipt(ticket + "a", 42)).toThrow("INVALID_CAPTURE_RECEIPT");
  vi.spyOn(Date, "now").mockReturnValue(value.capturedAt + 3600001);
  expect(() => verifyCaptureReceipt(ticket, 42)).toThrow("INVALID_CAPTURE_RECEIPT");
});
it("never writes the fixed schedule into the stored file", async () => {
  await saveScheduleVersion(input, 42);
  const { readFile } = await import("node:fs/promises");
  const stored = JSON.parse(
    await readFile(join(config.root, "schedules", "versions.json"), "utf8"),
  ) as { versions: { id: string }[] };
  expect(stored.versions.map((v) => v.id)).not.toContain("fixed-Acid Plant");
  expect((await readScheduleSnapshot()).versions.map((v) => v.id)).toContain("fixed-Acid Plant");
});
it("refuses to change a plant whose regular schedule is fixed", async () => {
  await expect(saveScheduleVersion({ ...input, plant: "Acid Plant" }, 42)).rejects.toThrow(
    "Jadwal plant ini tetap",
  );
  expect((await readScheduleSnapshot()).revision).toBe(0);
});
it("keeps old Acid Plant history but applies the fixed 3-hour schedule from 7 Oct", async () => {
  await mkdir(join(config.root, "schedules"), { recursive: true });
  const twoHourly = {
    id: "dua-jam",
    plant: "Acid Plant",
    effectiveDate: "2026-10-06",
    startHour: 2,
    intervalHours: 2,
    windowMinutes: 120,
    timezone: "Asia/Makassar",
    createdAt: "2026-10-05T04:04:09.249Z",
    createdBy: 19,
  };
  const later = { ...twoHourly, id: "nanti", effectiveDate: "2026-10-09" };
  await writeFile(
    join(config.root, "schedules", "versions.json"),
    JSON.stringify({ revision: 2, versions: [twoHourly, later] }),
  );
  const { scheduleForDate, scheduleHours } = await import("../capture-schedule");
  const { versions } = await readScheduleSnapshot();
  expect(versions.map((v) => v.id)).toEqual(["dua-jam", "fixed-Acid Plant"]);
  expect(scheduleHours(scheduleForDate(versions, "Acid Plant", "2026-10-06"))).toEqual([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22,
  ]);
  for (const date of ["2026-10-07", "2026-10-09", "2027-01-01"]) {
    const schedule = scheduleForDate(versions, "Acid Plant", date);
    expect(scheduleHours(schedule)).toEqual([2, 5, 8, 11, 14, 17, 20, 23]);
    expect(schedule.windowMinutes).toBe(180);
  }
});
it("adds the fixed schedule even before any schedule was ever saved", async () => {
  const { versions } = await readScheduleSnapshot();
  expect(versions.filter((v) => v.plant === "Acid Plant").map((v) => v.id)).toEqual([
    "default-Acid Plant",
    "fixed-Acid Plant",
  ]);
  expect(versions.filter((v) => v.plant === "Chloride Plant").map((v) => v.id)).toEqual([
    "default-Chloride Plant",
  ]);
});
it("replaces stored default rows with the current built-in default", async () => {
  await mkdir(join(config.root, "schedules"), { recursive: true });
  const saved = { ...input, id: "saved-1", createdAt: "2026-10-05T00:00:00.000Z", createdBy: 1 };
  const { expectedRevision: _unused, ...savedVersion } = saved;
  await writeFile(
    join(config.root, "schedules", "versions.json"),
    JSON.stringify({
      revision: 1,
      versions: [
        {
          id: "default-Acid Plant",
          plant: "Acid Plant",
          effectiveDate: "1970-01-01",
          startHour: 2,
          intervalHours: 3,
          windowMinutes: 120,
          timezone: "Asia/Makassar",
          createdAt: "1970-01-01T00:00:00.000Z",
          createdBy: null,
        },
        savedVersion,
      ],
    }),
  );
  const loaded = await readScheduleSnapshot();
  expect(loaded.versions[0]).toMatchObject({ id: "default-Acid Plant", windowMinutes: 180 });
  expect(loaded.versions[1]).toMatchObject({ id: "saved-1", windowMinutes: 60 });
});
