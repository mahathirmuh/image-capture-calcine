import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  root: "",
  auth: vi.fn(),
  resolve: vi.fn(),
  fetch: vi.fn(),
  record: vi.fn(),
}));
vi.mock("./api-auth", () => ({
  API_KEY_HEADER: "x-api-key",
  isApiEnabled: () => true,
  authenticateApiRequest: mock.auth,
}));
vi.mock("../env", () => ({
  getServerEnv: () => ({
    NETWORK_SAVE_ROOT: mock.root,
    SESSION_SECRET: "schedule-integration-secret-over-thirty-two",
    API_CORS_ORIGINS: "",
  }),
}));
vi.mock("../carddb", () => ({
  isCardDbConfigured: () => true,
  getCardDbSchema: () => "dbo",
  getCardDbPool: vi.fn(),
}));
vi.mock("./edge-target", () => ({ resolveEdgeTarget: mock.resolve, findEdgeDevice: vi.fn() }));
vi.mock("./users", () => ({
  findUserById: async () => ({
    id: 42,
    fullName: "Synthetic Operator",
    username: "fixture",
    isActive: true,
    plant: "Acid Plant",
  }),
}));
vi.mock("./capture-record-write", () => ({ upsertCaptureRecordResult: mock.record }));
vi.mock("./capture-spool", () => ({
  ensureSpoolWorker: () => {},
  getSpoolStatus: async () => ({ configured: false }),
  flushSpool: vi.fn(),
  enqueueCapture: vi.fn(),
}));
import { handleApiRequest } from "./api-rest";
beforeEach(async () => {
  vi.resetAllMocks();
  mock.root = await mkdtemp(join(tmpdir(), "calcine-rest-"));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-05T07:59:59Z"));
  mock.auth.mockResolvedValue({
    ok: true,
    principal: { kind: "user", claims: { userId: 42, username: "fixture" } },
  });
  mock.resolve.mockResolvedValue({
    ok: true,
    deviceId: 7,
    deviceCode: "fixture",
    deviceName: "Fixture",
    plant: "Acid Plant",
    baseUrl: "http://synthetic-edge",
  });
  mock.record.mockResolvedValue({ ok: true, recordId: 1 });
  mock.fetch.mockImplementation(async (url: string) =>
    url.endsWith("/v1/captures")
      ? Response.json({ jobId: "synthetic-job", status: "queued" })
      : url.includes("/v1/jobs/")
        ? Response.json({ status: "succeeded", result: { asset: { assetId: "synthetic-asset" } } })
        : new Response("synthetic-jpeg", { headers: { "content-type": "image/jpeg" } }),
  );
  vi.stubGlobal("fetch", mock.fetch);
});
afterEach(async () => {
  await rm(mock.root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function post(path: string, body: unknown) {
  return (await handleApiRequest(
    new Request("http://localhost/api/v1" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  ))!;
}
const command = {
  leaseToken: "fixture-token",
  deviceId: 7,
  plant: "Acid Plant",
  sessionDate: "2026-10-05",
  captureSession: "14.00",
};
it("rejects upcoming and expired normal sessions before touching the camera", async () => {
  expect(
    (await post("/camera/capture", { ...command, captureSession: "17.00", recovery: true })).status,
  ).toBe(409);
  expect((await post("/camera/capture", { ...command, captureSession: "11.00" })).status).toBe(409);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("saves after window expiry using signed command time despite a forged client timestamp", async () => {
  const start = Date.now();
  const accepted = await post("/camera/capture", command);
  expect(accepted.status).toBe(202);
  const data = await accepted.json();
  vi.spyOn(Date, "now").mockReturnValue(start + 5000);
  const finalized = await post("/captures/finalize", {
    assetId: "synthetic-asset",
    capturedAt: 0,
    plant: "Acid Plant",
    captureSession: "14.00",
    slot: 1,
    deviceId: 7,
    receipt: data.receipt,
  });
  expect(finalized.status).toBe(201);
  expect(
    await readFile(join(mock.root, "Acid Plant", "2026", "10", "05", "14.00 Train 1.jpg"), "utf8"),
  ).toBe("synthetic-jpeg");
  expect(mock.record.mock.calls[0][0].capturedAt).toBe(start);
});
it("rejects wrong session or unrelated assets before storing a photo", async () => {
  const data = await (await post("/camera/capture", command)).json();
  const base = {
    assetId: "synthetic-asset",
    capturedAt: Date.now(),
    plant: "Acid Plant",
    captureSession: "14.00",
    slot: 1,
    deviceId: 7,
    receipt: data.receipt,
  };
  expect((await post("/captures/finalize", { ...base, captureSession: "17.00" })).status).toBe(409);
  expect((await post("/captures/finalize", { ...base, assetId: "other-asset" })).status).toBe(409);
  expect(mock.record).not.toHaveBeenCalled();
});
it("keeps API key access read-only while exposing schedule snapshots", async () => {
  mock.auth.mockResolvedValue({ ok: true, principal: { kind: "api-key" } });
  expect((await post("/camera/capture", command)).status).toBe(403);
  const read = await handleApiRequest(new Request("http://localhost/api/v1/schedules"));
  expect(read!.status).toBe(200);
  expect((await read!.json()).versions.length).toBeGreaterThan(0);
  expect(mock.fetch).not.toHaveBeenCalled();
});
