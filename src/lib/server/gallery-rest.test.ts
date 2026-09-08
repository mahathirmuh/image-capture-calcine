import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  plants: vi.fn(),
  query: vi.fn(),
  inputs: [] as Array<[string, unknown]>,
}));
vi.mock("./api-auth", () => ({
  API_KEY_HEADER: "x-api-key",
  authenticateApiRequest: mock.auth,
  isApiEnabled: () => true,
}));
vi.mock("./users", () => ({ findUserById: mock.user }));
vi.mock("./media-record", () => ({ findRecordPlants: mock.plants }));
vi.mock("../carddb", () => ({
  isCardDbConfigured: () => true,
  getCardDbSchema: () => "dbo",
  getCardDbPool: async () => ({
    request: () => ({
      input(name: string, _t: unknown, value: unknown) {
        mock.inputs.push([name, value]);
        return this;
      },
      query: mock.query,
    }),
  }),
}));
vi.mock("../env", () => ({ getServerEnv: () => ({ API_CORS_ORIGINS: "" }) }));
import { handleApiRequest } from "./api-rest";
beforeEach(() => {
  vi.resetAllMocks();
  mock.inputs = [];
  mock.auth.mockResolvedValue({
    ok: true,
    principal: { kind: "user", claims: { userId: 9, role: "admin" } },
  });
  mock.user.mockResolvedValue({ id: 9, isActive: true, role: "operator", plant: "Acid Plant" });
  mock.plants.mockResolvedValue(
    new Map([
      [2, "Chloride Plant"],
      [3, null],
    ]),
  );
  mock.query.mockResolvedValue({ recordset: [] });
});
it("restricts list and count using fresh account plant despite stale token role", async () => {
  const res = await handleApiRequest(new Request("http://localhost/api/v1/captures"));
  expect(res.status).toBe(200);
  expect(mock.inputs.filter(([key]) => key === "plant")).toEqual([
    ["plant", "Acid Plant"],
    ["plant", "Acid Plant"],
  ]);
  expect(mock.query.mock.calls.every(([q]) => q.includes("@plant"))).toBe(true);
});
it.each([
  "captures/2",
  "captures/2/image",
  "captures/2/thumb",
  "captures/3/thumb",
  "captures?plant=Chloride+Plant",
  "sessions?plant=Chloride+Plant",
])("blocks cross-plant REST request %s", async (path) => {
  const res = await handleApiRequest(new Request(`http://localhost/api/v1/${path}`));
  expect(res.status).toBe(403);
  expect(mock.query).not.toHaveBeenCalled();
});
it("blocks HEAD image requests", async () => {
  expect(
    (
      await handleApiRequest(
        new Request("http://localhost/api/v1/captures/2/image", { method: "HEAD" }),
      )
    ).status,
  ).toBe(403);
});
it.each(["captures", "summary"])("denies disabled accounts on %s", async (path) => {
  mock.user.mockResolvedValue({ isActive: false, role: "admin", plant: "ALL" });
  expect((await handleApiRequest(new Request(`http://localhost/api/v1/${path}`))).status).toBe(401);
  expect(mock.query).not.toHaveBeenCalled();
});
it.each([
  { role: "admin", plant: "Acid Plant" },
  { role: "operator", plant: "ALL" },
])("allows all-plant view for %j", async (user) => {
  mock.user.mockResolvedValue({ ...user, isActive: true });
  expect((await handleApiRequest(new Request("http://localhost/api/v1/captures"))).status).toBe(
    200,
  );
  expect(mock.inputs.filter(([key]) => key === "plant")).toEqual([
    ["plant", null],
    ["plant", null],
  ]);
});
it("keeps machine API key read access across plants", async () => {
  mock.auth.mockResolvedValue({ ok: true, principal: { kind: "api-key" } });
  expect((await handleApiRequest(new Request("http://localhost/api/v1/captures"))).status).toBe(
    200,
  );
  expect(mock.user).not.toHaveBeenCalled();
});
it("scopes summary SQL before aggregating", async () => {
  expect((await handleApiRequest(new Request("http://localhost/api/v1/summary"))).status).toBe(200);
  expect(mock.inputs.filter(([key]) => key === "galleryPlant")).toEqual([
    ["galleryPlant", "Acid Plant"],
    ["galleryPlant", "Acid Plant"],
  ]);
  expect(mock.query.mock.calls.every(([q]) => q.includes("@galleryPlant"))).toBe(true);
});
it("does not serve orphan thumbnails for a missing record", async () => {
  expect(
    (await handleApiRequest(new Request("http://localhost/api/v1/captures/99/thumb"))).status,
  ).toBe(404);
});
it("scopes session coverage and its SQL to the account plant", async () => {
  const response = await handleApiRequest(
    new Request("http://localhost/api/v1/sessions?date=2026-09-09"),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.plants.map((p: { plant: string }) => p.plant)).toEqual(["Acid Plant"]);
  expect(mock.inputs).toContainEqual(["plant", "Acid Plant"]);
});
