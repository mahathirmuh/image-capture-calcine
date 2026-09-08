import { createRequire } from "node:module";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { create, act } = createRequire(import.meta.url)("react-test-renderer");
const api = vi.hoisted(() => ({ getDeviceTelemetry: vi.fn() }));
vi.mock("./camera-api", () => api);
import { useDeviceTelemetry } from "../hooks/use-device-telemetry";
let current: ReturnType<typeof useDeviceTelemetry>;
let renderer: ReturnType<typeof create>;
function Harness({ id, active = true }: { id: number; active?: boolean }) {
  current = useDeviceTelemetry(id, active);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  api.getDeviceTelemetry.mockImplementation(async ({ data }) => ({
    ok: true,
    telemetry: { deviceId: String(data.deviceId) },
  }));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("polls telemetry alone every 30 seconds, pauses hidden tabs and refreshes on return", async () => {
  await act(async () => {
    renderer = create(createElement(Harness, { id: 1 }));
  });
  expect(current.telemetry?.deviceId).toBe("1");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(api.getDeviceTelemetry).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(api.getDeviceTelemetry).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(api.getDeviceTelemetry).toHaveBeenCalledTimes(3);
});
it("ignores a late response for the previous device", async () => {
  let finish!: (value: unknown) => void;
  api.getDeviceTelemetry.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    renderer = create(createElement(Harness, { id: 1 }));
  });
  await act(async () => {
    renderer.update(createElement(Harness, { id: 2 }));
  });
  expect(current.telemetry?.deviceId).toBe("2");
  await act(async () => {
    finish({ ok: true, telemetry: { deviceId: "1" } });
  });
  expect(current.telemetry?.deviceId).toBe("2");
});
it("does not poll inactive devices and shows old-agent errors without fabricated data", async () => {
  await act(async () => {
    renderer = create(createElement(Harness, { id: 1, active: false }));
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(api.getDeviceTelemetry).not.toHaveBeenCalled();
  api.getDeviceTelemetry.mockResolvedValue({ ok: false, message: "Upgrade agent" });
  await act(async () => {
    renderer.update(createElement(Harness, { id: 1, active: true }));
  });
  expect(current.telemetry).toBeNull();
  expect(current.error).toBe("Upgrade agent");
});
it("coalesces refreshes while a telemetry request is pending", async () => {
  let finish!: (value: unknown) => void;
  api.getDeviceTelemetry.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    renderer = create(createElement(Harness, { id: 1 }));
  });
  await act(async () => {
    void current.refresh();
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(api.getDeviceTelemetry).toHaveBeenCalledTimes(1);
  await act(async () => finish({ ok: true, telemetry: { deviceId: "1" } }));
  expect(current.loading).toBe(false);
});
