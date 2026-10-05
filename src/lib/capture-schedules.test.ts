import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), save: vi.fn(), read: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator() {
      return this;
    },
    handler(fn: unknown) {
      return fn;
    },
  }),
}));
vi.mock("./server/session", () => ({ getAppSession: mock.session }));
vi.mock("./server/users", () => ({ findUserById: mock.user }));
vi.mock("./server/capture-schedules", () => ({
  saveScheduleVersion: mock.save,
  readScheduleSnapshot: mock.read,
}));
import { fetchCaptureSchedules, updateCaptureSchedule } from "./capture-schedules";
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue({ data: { user: { id: 42, role: "admin" } } });
  mock.user.mockResolvedValue({ id: 42, isActive: true, role: "admin" });
  mock.save.mockResolvedValue({ revision: 1 });
  mock.read.mockResolvedValue({ revision: 0 });
});
const input = {
  plant: "Acid Plant",
  startHour: 2,
  intervalHours: 6,
  windowMinutes: 120,
  timezone: "Asia/Makassar",
  effectiveDate: "2026-10-06",
  expectedRevision: 0,
};
it("rechecks current DB role rather than trusting admin cookie claims", async () => {
  mock.user.mockResolvedValue({ id: 42, isActive: true, role: "operator" });
  await expect(updateCaptureSchedule({ data: input })).rejects.toThrow("Super Admin");
  expect(mock.save).not.toHaveBeenCalled();
});
it("blocks disabled and missing sessions on reads/writes", async () => {
  mock.user.mockResolvedValue({ id: 42, isActive: false, role: "admin" });
  await expect(fetchCaptureSchedules()).rejects.toThrow("berakhir");
  expect(mock.read).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ data: {} });
  await expect(updateCaptureSchedule({ data: input })).rejects.toThrow("berakhir");
  expect(mock.save).not.toHaveBeenCalled();
});
it("passes the authenticated actor and concurrency revision to persistence", async () => {
  await expect(updateCaptureSchedule({ data: input })).resolves.toEqual({ revision: 1 });
  expect(mock.save).toHaveBeenCalledWith(input, 42);
});
