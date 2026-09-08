import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ resolve: vi.fn(), auth: vi.fn(), fetch: vi.fn() }));
vi.mock("./edge-target", () => ({ resolveEdgeTarget: mock.resolve, findEdgeDevice: vi.fn() }));
vi.mock("./api-auth", () => ({ API_KEY_HEADER: "x-api-key", authenticateApiRequest: mock.auth, isApiEnabled: () => true }));
vi.mock("../carddb", () => ({ isCardDbConfigured: () => true, getCardDbSchema: () => "dbo", getCardDbPool: vi.fn() }));
vi.mock("../env", () => ({ getServerEnv: () => ({ CAMERA_API_URL: "http://fallback", API_CORS_ORIGINS: "" }) }));
vi.mock("../capture-records", () => ({ guardCaptureManagementUser: vi.fn(), mapCaptureRecordRow: vi.fn() }));
import { handleApiRequest } from "./api-rest";

beforeEach(() => {
  mock.auth.mockResolvedValue({ ok: true, principal: { kind: "user", claims: { userId: 12, username: "acid" } } });
  mock.resolve.mockResolvedValue({ ok: true, deviceId: 7, deviceCode: "acid", plant: "Acid Plant", baseUrl: "http://acid:3000" });
  mock.fetch.mockImplementation(async () => Response.json({ status: "succeeded" }));
  vi.stubGlobal("fetch", mock.fetch);
});

describe("REST camera target propagation", () => {
  it("polls the original device with authoritative actor and expected plant", async () => {
    const response = await handleApiRequest(new Request("http://localhost/api/v1/jobs/job-1?deviceId=7&plant=Acid+Plant"));
    expect(response.status).toBe(200);
    expect(mock.resolve).toHaveBeenCalledWith(7, 12, undefined, "Acid Plant");
    expect(mock.fetch.mock.calls[0][0]).toBe("http://acid:3000/v1/jobs/job-1");
  });
  it.each(["0", "abc", "1.5", ""])("rejects invalid job deviceId %s before edge access", async (id) => {
    const response = await handleApiRequest(new Request(`http://localhost/api/v1/jobs/job-1?deviceId=${id}`));
    expect(response.status).toBe(400);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("does not poll when the device placement changed", async () => {
    mock.resolve.mockResolvedValue({ ok: false, code: "DEVICE_PLANT_MISMATCH", message: "changed" });
    const response = await handleApiRequest(new Request("http://localhost/api/v1/jobs/job-1?deviceId=7&plant=Acid+Plant"));
    expect(response.status).toBe(409);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it.each(["session", "session/renew", "capture", "autofocus"])("passes expected plant for %s", async (path) => {
    const response = await handleApiRequest(new Request(`http://localhost/api/v1/camera/${path}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: 7, plant: "Acid Plant", sessionId: "lease", leaseToken: "token" }),
    }));
    expect(response.status).toBeLessThan(300);
    expect(mock.resolve).toHaveBeenCalledWith(7, 12, undefined, "Acid Plant");
  });
  it("keeps API keys read-only", async () => {
    mock.auth.mockResolvedValue({ ok: true, principal: { kind: "api-key" } });
    const response = await handleApiRequest(new Request("http://localhost/api/v1/camera/capture", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
});
