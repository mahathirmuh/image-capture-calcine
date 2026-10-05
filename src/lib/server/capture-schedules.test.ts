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
  plant: "Acid Plant",
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
  expect(loaded.versions.at(-1)).toMatchObject({ createdBy: 42, intervalHours: 6 });
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
