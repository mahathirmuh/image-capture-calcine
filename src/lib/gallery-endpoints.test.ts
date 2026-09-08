import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  access: vi.fn(),
  plants: vi.fn(),
  record: vi.fn(),
  exists: vi.fn(),
  token: vi.fn(),
  save: vi.fn(),
  query: vi.fn(),
  inputs: {} as Record<string, unknown>,
}));
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
vi.mock("./server/gallery-access", () => ({
  requireGalleryAccess: mock.access,
  CAPTURE_PLANT_SQL: "COALESCE(meta_plant, l.plant)",
}));
vi.mock("./server/media-record", () => ({
  findRecordPlants: mock.plants,
  findCaptureRecordForMedia: mock.record,
}));
vi.mock("./server/thumb-store", () => ({
  isThumbStoreConfigured: () => true,
  thumbnailExists: mock.exists,
  saveThumbnail: mock.save,
}));
vi.mock("./server/media-token", () => ({
  createMediaToken: mock.token,
  buildThumbPath: (id: number) => `/thumb/${id}`,
  buildMediaPath: (id: number) => `/media/${id}`,
}));
vi.mock("mssql", () => ({ default: { Int: 0, NVarChar: () => 0 } }));
vi.mock("./carddb", () => ({
  isCardDbConfigured: () => true,
  getCardDbSchema: () => "dbo",
  getCardDbPool: async () => ({
    request: () => ({
      input(name: string, _type: unknown, value: unknown) {
        mock.inputs[name] = value;
        return this;
      },
      query: mock.query,
    }),
  }),
}));
import {
  createCaptureMediaUrl,
  createCaptureThumbUrls,
  saveCaptureThumbnail,
} from "./media-access";
import { listCaptureRecords, getCaptureDashboardSummary } from "./capture-records";
beforeEach(() => {
  vi.resetAllMocks();
  mock.inputs = {};
  mock.access.mockResolvedValue({ ok: true, scope: { allPlants: false, plant: "Acid Plant" } });
  mock.plants.mockResolvedValue(
    new Map([
      [1, "Acid Plant"],
      [2, "Chloride Plant"],
      [3, null],
    ]),
  );
  mock.record.mockResolvedValue({ id: 2, plant: "Chloride Plant", servable: true });
  mock.exists.mockResolvedValue(true);
  mock.token.mockResolvedValue({ expiresAt: 123 });
  mock.query.mockResolvedValue({ recordset: [] });
  mock.save.mockResolvedValue({ ok: true });
});
it("applies bound plant before TOP ordering and returns scope with the list", async () => {
  const result = await listCaptureRecords({ data: { limit: 200 } });
  expect(result).toEqual({
    ok: true,
    records: [],
    scope: { allPlants: false, plant: "Acid Plant" },
  });
  expect(mock.inputs).toEqual({ limit: 200, galleryPlant: "Acid Plant" });
  expect(mock.query.mock.calls[0][0]).toMatch(
    /WHERE \(@galleryPlant IS NULL OR .* = @galleryPlant\)\s+ORDER BY/s,
  );
});
it("does not read records when authorization fails", async () => {
  mock.access.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "expired" });
  expect((await listCaptureRecords({ data: { limit: 200 } })).ok).toBe(false);
  expect(mock.query).not.toHaveBeenCalled();
});
it.each(["Chloride Plant", null, ""])(
  "does not sign full images outside scope: %s",
  async (plant) => {
    mock.record.mockResolvedValue({ id: 2, plant, servable: true });
    expect((await createCaptureMediaUrl({ data: { recordId: 2 } })).ok).toBe(false);
    expect(mock.token).not.toHaveBeenCalled();
  },
);
it("batch signing excludes foreign, unknown-plant and missing records", async () => {
  expect(await createCaptureThumbUrls({ data: { recordIds: [1, 2, 3, 4] } })).toEqual({
    ok: true,
    urls: { 1: "/thumb/1" },
  });
  expect(mock.token).toHaveBeenCalledTimes(1);
});
it("ALL account can view unassigned records but cannot sign nonexistent IDs", async () => {
  mock.access.mockResolvedValue({ ok: true, scope: { allPlants: true, plant: null } });
  expect(await createCaptureThumbUrls({ data: { recordIds: [1, 2, 3, 4] } })).toEqual({
    ok: true,
    urls: { 1: "/thumb/1", 2: "/thumb/2", 3: "/thumb/3" },
  });
});
it("rejects cross-plant thumbnail writes before touching storage", async () => {
  expect((await saveCaptureThumbnail({ data: { recordId: 2, base64: "abc" } })).ok).toBe(false);
  expect(mock.save).not.toHaveBeenCalled();
  expect((await saveCaptureThumbnail({ data: { recordId: 1, base64: "abc" } })).ok).toBe(true);
});
it("signs an authorized full image", async () => {
  mock.record.mockResolvedValue({ id: 1, plant: "Acid Plant", servable: true });
  expect(await createCaptureMediaUrl({ data: { recordId: 1 } })).toEqual({
    ok: true,
    url: "/media/1",
    expiresAt: 123,
  });
});
it("never signs or writes thumbnails for an expired account", async () => {
  mock.access.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "expired" });
  expect((await createCaptureMediaUrl({ data: { recordId: 1 } })).ok).toBe(false);
  expect((await createCaptureThumbUrls({ data: { recordIds: [1] } })).ok).toBe(false);
  expect((await saveCaptureThumbnail({ data: { recordId: 1, base64: "abc" } })).ok).toBe(false);
  expect(mock.token).not.toHaveBeenCalled();
  expect(mock.save).not.toHaveBeenCalled();
});

it("scopes every dashboard query including recent records and breakdowns", async () => {
  mock.query.mockResolvedValue({ recordset: [], recordsets: [[], [], []] });
  const result = await getCaptureDashboardSummary({
    data: { dayStart: 1000, dayEnd: 2000, weekStart: 1, recentLimit: 6 },
  });
  expect(result.ok).toBe(true);
  expect(mock.query).toHaveBeenCalledTimes(3);
  for (const [query] of mock.query.mock.calls) expect(query).toContain("@galleryPlant");
  expect(mock.inputs.galleryPlant).toBe("Acid Plant");
});
