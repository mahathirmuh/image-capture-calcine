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

// "Sinkronkan folder" terbuka untuk semua peran, tapi tetap terkunci ke plant akunnya.
it.each(["admin", "operator", "viewer"])(
  "lets an active %s act within the gallery scope of the account",
  async (role) => {
    const { requireGalleryActor } = await import("./gallery-access");
    mock.user.mockResolvedValue({
      id: 9,
      username: "budi",
      isActive: true,
      role,
      plant: "Acid Plant",
    });
    expect(await requireGalleryActor()).toEqual({
      ok: true,
      scope:
        role === "admin"
          ? { allPlants: true, plant: null }
          : { allPlants: false, plant: "Acid Plant" },
      actor: { id: 9, username: "budi" },
    });
  },
);
it("refuses the actor gate for disabled accounts, missing sessions and accounts without a plant", async () => {
  const { requireGalleryActor } = await import("./gallery-access");
  mock.user.mockResolvedValue({
    id: 9,
    username: "budi",
    isActive: false,
    role: "viewer",
    plant: "ALL",
  });
  expect((await requireGalleryActor()).ok).toBe(false);
  mock.user.mockResolvedValue({
    id: 9,
    username: "budi",
    isActive: true,
    role: "viewer",
    plant: null,
  });
  expect((await requireGalleryActor()).ok).toBe(false);
  mock.session.mockRejectedValue(new Error("expired"));
  expect((await requireGalleryActor()).ok).toBe(false);
});
