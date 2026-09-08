import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ resolve: vi.fn(), fetch: vi.fn() }));
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
vi.mock("./server/edge-target", () => ({ resolveEdgeTarget: mock.resolve }));
vi.mock("./env", () => ({ getServerEnv: () => ({ CAMERA_API_TOKEN: "fixture-token" }) }));
import { getCameraDetails, listCameraConfigs, getDeviceTelemetry } from "./camera-api";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mock.fetch);
  mock.resolve.mockResolvedValue({ ok: true, baseUrl: "http://fixture-edge:3000" });
});
afterEach(() => vi.unstubAllGlobals());
it("reads details from the selected authorized device and preserves missing battery", async () => {
  mock.fetch.mockResolvedValue(Response.json({ connectionState: "ready", batteryLevel: null }));
  const result = await getCameraDetails({ data: { deviceId: 7 } });
  expect(mock.resolve).toHaveBeenCalledWith(7, undefined, undefined, undefined);
  expect(mock.fetch.mock.calls[0][0]).toBe("http://fixture-edge:3000/v1/camera/status");
  expect(result).toMatchObject({
    ok: true,
    details: { batteryLevel: null, storage: [], settings: [] },
  });
});
it("does not contact an edge when target authorization fails", async () => {
  mock.resolve.mockResolvedValue({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
  expect(await getCameraDetails({ data: { deviceId: 9 } })).toMatchObject({ ok: false });
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("distinguishes edge read failure from missing optional camera fields", async () => {
  mock.fetch.mockResolvedValue(Response.json({ connectionState: "error" }));
  expect(await getCameraDetails({ data: { deviceId: 7 } })).toMatchObject({
    ok: false,
    code: "DETAILS_UNAVAILABLE",
  });
  mock.fetch.mockRejectedValue(new Error("timeout"));
  expect(await getCameraDetails({ data: { deviceId: 7 } })).toMatchObject({
    ok: false,
    code: "DETAILS_UNAVAILABLE",
  });
});
it("loads settings for the selected device instead of the implicit default", async () => {
  mock.fetch.mockResolvedValue(Response.json({ items: [] }));
  await listCameraConfigs({ data: { deviceId: 8 } });
  expect(mock.resolve).toHaveBeenCalledWith(8, undefined, undefined, undefined);
  expect(mock.fetch.mock.calls[0][0]).toBe("http://fixture-edge:3000/v1/camera/configs");
});

it("telemetry uses the selected target and supports older agents without failing camera operations", async () => {
  mock.fetch.mockResolvedValue(new Response("not found", { status: 404 }));
  expect(await getDeviceTelemetry({ data: { deviceId: 8 } })).toMatchObject({
    ok: false,
    code: "TELEMETRY_UNSUPPORTED",
  });
  expect(mock.resolve).toHaveBeenCalledWith(8, undefined, undefined, undefined);
  expect(mock.fetch.mock.calls[0][0]).toBe("http://fixture-edge:3000/v1/device/telemetry");
  mock.fetch.mockResolvedValue(Response.json({ cpu: 99 }));
  expect(await getDeviceTelemetry({ data: { deviceId: 8 } })).toMatchObject({
    ok: false,
    code: "TELEMETRY_INVALID",
  });
});
