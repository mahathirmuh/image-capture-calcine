import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn() }));
vi.mock("../carddb", () => ({ isCardDbConfigured: () => true }));
vi.mock("./session", () => ({ isSessionConfigured: () => true, getAppSession: mock.session }));
vi.mock("./users", () => ({ findUserById: mock.user }));
import { requireGalleryAccess } from "./gallery-access";
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue({ data: { user: { id: 9, role: "admin" } } });
  mock.user.mockResolvedValue({ id: 9, isActive: true, role: "operator", plant: "Acid Plant" });
});
it("uses fresh database role and plant instead of stale admin cookie", async () => {
  expect(await requireGalleryAccess()).toEqual({
    ok: true,
    scope: { allPlants: false, plant: "Acid Plant" },
  });
  mock.user.mockResolvedValue({ id: 9, isActive: true, role: "operator", plant: "Chloride Plant" });
  expect(await requireGalleryAccess()).toEqual({
    ok: true,
    scope: { allPlants: false, plant: "Chloride Plant" },
  });
});
it.each([null, { isActive: false, role: "admin", plant: "ALL" }])(
  "rejects deleted or disabled accounts %j",
  async (user) => {
    mock.user.mockResolvedValue(user);
    expect((await requireGalleryAccess()).ok).toBe(false);
  },
);
it("rejects missing session and missing plant", async () => {
  mock.session.mockRejectedValue(new Error("expired"));
  expect((await requireGalleryAccess()).ok).toBe(false);
  expect(mock.user).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ data: { user: { id: 9 } } });
  mock.user.mockResolvedValue({ isActive: true, role: "operator", plant: null });
  expect((await requireGalleryAccess()).ok).toBe(false);
});
