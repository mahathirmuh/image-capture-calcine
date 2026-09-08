import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  findUserById: vi.fn(),
  getAppSession: vi.fn(),
}));

vi.mock("../env", () => ({
  getServerEnv: () => ({ CAMERA_API_URL: "http://fallback:3000" }),
}));
vi.mock("../carddb", () => ({
  isCardDbConfigured: () => true,
  getCardDbSchema: () => "dbo",
  getCardDbPool: async () => ({
    request: () => ({
      query: mocks.query,
      input() {
        return this;
      },
    }),
  }),
}));
vi.mock("./session", () => ({
  isSessionConfigured: () => true,
  getAppSession: mocks.getAppSession,
}));
vi.mock("./users", () => ({ findUserById: mocks.findUserById }));
vi.mock("../operator-plant", () => ({
  resolveUserPlantScope: (user: { plant?: string }) => ({
    locked: !!user.plant && user.plant !== "ALL",
    plant: user.plant ?? null,
  }),
}));

import { resolveEdgeTarget } from "./edge-target";

describe("edge target selection with multiple registered devices", () => {
  beforeEach(() => {
    mocks.query.mockResolvedValue({
      recordset: [
        {
          id: 1,
          code: "edge-camera-01",
          plant: "Acid Plant",
          station: "Acid station",
          is_active: true,
          edge_api_url: "http://edge-1:3000",
        },
        {
          id: 2,
          code: "edge-camera-02",
          plant: "Chloride Plant",
          is_active: true,
          edge_api_url: "http://edge-2:3000",
        },
      ],
    });
    mocks.findUserById.mockResolvedValue({ id: 7, isActive: true });
    mocks.getAppSession.mockResolvedValue({ data: { user: { id: 7 } } });
  });

  it("routes the saved device code to its own edge URL", async () => {
    expect(await resolveEdgeTarget(undefined, undefined, "edge-camera-02")).toMatchObject({
      ok: true,
      deviceId: 2,
      deviceCode: "edge-camera-02",
      baseUrl: "http://edge-2:3000",
    });
  });

  it("keeps requiring a selection when no device is specified", async () => {
    expect(await resolveEdgeTarget()).toMatchObject({ ok: false, code: "DEVICE_AMBIGUOUS" });
  });

  it("does not silently choose another camera when the saved code is missing", async () => {
    expect(await resolveEdgeTarget(undefined, undefined, "removed-camera")).toMatchObject({
      ok: false,
      code: "DEVICE_NOT_FOUND",
    });
  });

  it("preserves the REST caller's user ID as the second argument", async () => {
    await resolveEdgeTarget(null, 42);
    expect(mocks.findUserById).toHaveBeenCalledWith(42);
    expect(mocks.getAppSession).not.toHaveBeenCalled();
  });

  it("selects Acid placement for an unrestricted admin despite another plant's active camera", async () => {
    expect(await resolveEdgeTarget(undefined, undefined, undefined, "Acid Plant")).toMatchObject({
      ok: true,
      deviceId: 1,
      plant: "Acid Plant",
      station: "Acid station",
    });
  });

  it("selects Chloride when the admin changes the capture location", async () => {
    expect(
      await resolveEdgeTarget(undefined, undefined, undefined, "Chloride Plant"),
    ).toMatchObject({ ok: true, deviceId: 2 });
  });

  it("rejects an Acid operator's attempt to select Chloride", async () => {
    mocks.findUserById.mockResolvedValue({ id: 7, isActive: true, plant: "Acid Plant" });
    expect(
      await resolveEdgeTarget(undefined, undefined, undefined, "Chloride Plant"),
    ).toMatchObject({ ok: false, code: "DEVICE_FORBIDDEN" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("does not let a forged code bypass operator plant access", async () => {
    mocks.findUserById.mockResolvedValue({ id: 7, isActive: true, plant: "Acid Plant" });
    expect(
      await resolveEdgeTarget(undefined, undefined, "edge-camera-02", "Acid Plant"),
    ).toMatchObject({ ok: false, code: "DEVICE_FORBIDDEN" });
  });

  it("rejects an admin's device ID if its placement changed since session acquisition", async () => {
    mocks.query.mockResolvedValue({
      recordset: [
        {
          id: 1,
          code: "edge-camera-01",
          plant: "Chloride Plant",
          is_active: true,
          edge_api_url: "http://edge-1:3000",
        },
      ],
    });
    expect(await resolveEdgeTarget(1, undefined, undefined, "Acid Plant")).toMatchObject({
      ok: false,
      code: "DEVICE_PLANT_MISMATCH",
    });
  });

  it("never falls back to another plant when the selected plant has no camera", async () => {
    expect(await resolveEdgeTarget(undefined, undefined, undefined, "Pyrite Plant")).toMatchObject({
      ok: false,
      code: "NO_DEVICE",
    });
  });

  it("requires unambiguous placement within the selected plant", async () => {
    mocks.query.mockResolvedValue({
      recordset: [1, 2].map((id) => ({
        id,
        code: `acid-${id}`,
        plant: "Acid Plant",
        is_active: true,
        edge_api_url: `http://acid-${id}:3000`,
      })),
    });
    expect(await resolveEdgeTarget(undefined, undefined, undefined, "Acid Plant")).toMatchObject({
      ok: false,
      code: "DEVICE_AMBIGUOUS",
    });
  });

  it("does not use the global camera URL when the placement URL is missing", async () => {
    mocks.query.mockResolvedValue({
      recordset: [
        { id: 1, code: "acid", plant: "Acid Plant", is_active: true, edge_api_url: null },
      ],
    });
    expect(await resolveEdgeTarget(undefined, undefined, undefined, "Acid Plant")).toMatchObject({
      ok: false,
      code: "DEVICE_URL_REQUIRED",
    });
  });
});
