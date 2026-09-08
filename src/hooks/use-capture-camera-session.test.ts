import { createRequire } from "node:module";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaptureCameraSession } from "./use-capture-camera-session";

// Renderer runs effects without a browser or a physical camera.
const { create, act } = createRequire(import.meta.url)("react-test-renderer") as {
  create: (element: ReturnType<typeof createElement>) => {
    update(element: ReturnType<typeof createElement>): void;
    unmount(): void;
  };
  act: (work: () => void | Promise<void>) => Promise<void>;
};
const api = vi.hoisted(() => ({
  resolveCaptureDevice: vi.fn(),
  createSession: vi.fn(),
  getDeviceStatus: vi.fn(),
  getPreviewFrame: vi.fn(),
  releaseSession: vi.fn(),
  renewSession: vi.fn(),
}));
vi.mock("../lib/camera-api", () => api);
vi.mock("../lib/selected-edge-device", () => ({ saveSelectedEdgeDevice: vi.fn() }));

type Props = { plant: string; enabled?: boolean };
let current: ReturnType<typeof useCaptureCameraSession>;
let renderer: ReturnType<typeof create> | undefined;
function Harness({ plant, enabled = true }: Props) {
  const [, setError] = useState<string | null>(null);
  const [, setStatus] = useState<string | null>(null);
  current = useCaptureCameraSession({ plant, enabled, previewEnabled: false, setError, setStatus });
  return null;
}
async function mount(props: Props) {
  await act(async () => {
    renderer = create(createElement(Harness, props));
  });
}
async function switchPlant(plant: string) {
  await act(async () => {
    renderer!.update(createElement(Harness, { plant }));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  api.resolveCaptureDevice.mockImplementation(async ({ data }: { data: Props }) => ({
    ok: true,
    deviceId: data.plant === "Acid Plant" ? 1 : 2,
    deviceCode: data.plant === "Acid Plant" ? "acid-camera" : "chloride-camera",
    deviceName: data.plant,
    station: "station",
    plant: data.plant,
  }));
  api.createSession.mockImplementation(async ({ data }: { data: { deviceId: number } }) => ({
    ok: true,
    session: {
      sessionId: `session-${data.deviceId}`,
      leaseToken: `lease-${data.deviceId}`,
      expiresAt: "later",
    },
  }));
  api.getDeviceStatus.mockResolvedValue({
    online: true,
    connectionState: "ready",
    camera: { connected: true },
  });
  api.renewSession.mockResolvedValue({ ok: true });
  api.releaseSession.mockResolvedValue(undefined);
  api.getPreviewFrame.mockResolvedValue({ blob: async () => new Blob(["preview"]) });
});
afterEach(async () => {
  if (renderer)
    await act(async () => {
      renderer!.unmount();
    });
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("capture camera follows plant placement", () => {
  it("waits for operator plant initialization before any session request", async () => {
    await mount({ plant: "Acid Plant", enabled: false });
    expect(api.resolveCaptureDevice).not.toHaveBeenCalled();
    expect(api.createSession).not.toHaveBeenCalled();
  });

  it("pins status, session heartbeat and preview to the resolved camera", async () => {
    await mount({ plant: "Acid Plant" });
    expect(api.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: 1, plant: "Acid Plant" }),
      }),
    );
    expect(api.getDeviceStatus).toHaveBeenCalledWith({
      data: { deviceId: 1, plant: "Acid Plant" },
    });
    expect(api.renewSession).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: 1, plant: "Acid Plant", sessionId: "session-1" }),
    });
    await act(async () => {
      await current.fetchPreviewOnce();
    });
    expect(api.getPreviewFrame).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: 1, plant: "Acid Plant", leaseToken: "lease-1" }),
    });
  });

  it("releases the Acid session before connecting Chloride and clears the old frame", async () => {
    await mount({ plant: "Acid Plant" });
    await act(async () => {
      await current.fetchPreviewOnce();
    });
    expect(current.cameraFrame).not.toBeNull();
    const release = deferred<void>();
    api.releaseSession.mockReturnValueOnce(release.promise);
    await switchPlant("Chloride Plant");
    expect(current.cameraFrame).toBeNull();
    expect(current.cameraUsable).toBe(false);
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(api.releaseSession).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: 1, plant: "Acid Plant", sessionId: "session-1" }),
      }),
    );
    await act(async () => {
      release.resolve();
    });
    expect(current.captureDevice?.deviceId).toBe(2);
    expect(api.createSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: 2, plant: "Chloride Plant" }),
      }),
    );
  });

  it("releases a late Acid lease without replacing the active Chloride session", async () => {
    const late = deferred<unknown>();
    api.createSession.mockReturnValueOnce(late.promise);
    await mount({ plant: "Acid Plant" });
    await switchPlant("Chloride Plant");
    await act(async () => {
      late.resolve({ ok: true, session: { sessionId: "late-acid", leaseToken: "old-token" } });
    });
    expect(current.sessionId).toBe("session-2");
    expect(api.releaseSession).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: 1, plant: "Acid Plant", sessionId: "late-acid" }),
      }),
    );
  });

  it("discards a late preview from the previous plant", async () => {
    await mount({ plant: "Acid Plant" });
    const late = deferred<unknown>();
    api.getPreviewFrame.mockReturnValueOnce(late.promise);
    let preview!: Promise<void>;
    await act(async () => {
      preview = current.fetchPreviewOnce();
    });
    await switchPlant("Chloride Plant");
    await act(async () => {
      late.resolve({ blob: async () => new Blob(["old-acid-frame"]) });
      await preview;
    });
    expect(current.cameraFrame).toBeNull();
    expect(current.captureDevice?.plant).toBe("Chloride Plant");
  });

  it("does not acquire a session when the plant has no valid assignment", async () => {
    api.resolveCaptureDevice.mockResolvedValue({
      ok: false,
      code: "NO_DEVICE",
      message: "No assigned camera",
    });
    await mount({ plant: "Acid Plant" });
    expect(api.createSession).not.toHaveBeenCalled();
    expect(current.sessionIssue?.code).toBe("NO_DEVICE");
  });

  it("does not show an old plant's delayed session error on the new plant", async () => {
    let reject!: (reason: Error) => void;
    api.createSession.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    await mount({ plant: "Acid Plant" });
    await switchPlant("Chloride Plant");
    await act(async () => {
      reject(new Error("Acid unavailable"));
    });
    expect(current.sessionId).toBe("session-2");
    expect(current.sessionIssue).toBeNull();
  });

  it("releases the pinned device on unmount", async () => {
    await mount({ plant: "Acid Plant" });
    await act(async () => {
      renderer!.unmount();
    });
    renderer = undefined;
    expect(api.releaseSession).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: 1, plant: "Acid Plant", sessionId: "session-1" }),
      }),
    );
  });
});
