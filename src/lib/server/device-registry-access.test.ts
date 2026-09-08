import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn() }));
vi.mock("../carddb", () => ({ isCardDbConfigured: () => true }));
vi.mock("./session", () => ({ isSessionConfigured: () => true, getAppSession: mock.session }));
vi.mock("./users", () => ({ findUserById: mock.user }));
import { requireDeviceRegistryAccess } from "./device-registry-access";
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue({ data: { user: { id: 9, role: "admin" } } });
  mock.user.mockResolvedValue({ id: 9, isActive: true, role: "admin" });
});
describe("device registry authorization", () => {
  it("accepts a current active admin", async () => {
    expect((await requireDeviceRegistryAccess(true)).ok).toBe(true);
    expect(mock.user).toHaveBeenCalledWith(9);
  });
  it("checks current database role instead of trusting stale cookie permissions", async () => {
    mock.user.mockResolvedValue({ id: 9, isActive: true, role: "operator" });
    expect((await requireDeviceRegistryAccess(true)).ok).toBe(false);
    expect((await requireDeviceRegistryAccess()).ok).toBe(true);
  });
  it("rejects disabled users and unreadable sessions", async () => {
    mock.user.mockResolvedValue({ id: 9, isActive: false, role: "admin" });
    expect((await requireDeviceRegistryAccess()).ok).toBe(false);
    mock.session.mockRejectedValue(new Error("Invalid session"));
    expect((await requireDeviceRegistryAccess(true)).ok).toBe(false);
  });
});
