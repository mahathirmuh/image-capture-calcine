import { createRequire } from "node:module";
import { createElement, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AuthSession } from "../../mobile/src/lib/auth";
import type { TodaySessionItem } from "../../mobile/src/lib/sessionCoverage";
const { create, act } = createRequire(import.meta.url)("react-test-renderer");
const api = vi.hoisted(() => ({
  requestWithSession: vi.fn(),
  requestResponseWithSession: vi.fn(),
}));
vi.mock("../../mobile/src/lib/auth", () => ({ ...api, MobileAuthError: class extends Error {} }));
vi.mock("../../mobile/src/lib/captures", () => ({
  listCaptures: async (session: unknown) => ({ session, data: { items: [] } }),
  mapCaptureRecordToHistoryItem: vi.fn(),
}));
import { MyDeviceScreen } from "../../mobile/src/screens/MyDeviceScreen";
import { CaptureScreen } from "../../mobile/src/screens/CaptureScreen";

const session = { user: { id: 1, username: "acid", plant: "Acid Plant" } } as AuthSession;
const selectedSession = {
  key: "acid-14",
  plant: "Acid Plant",
  session: "14.00",
  slot: 1,
} as TodaySessionItem;
const lease = {
  deviceId: 7,
  deviceCode: "acid-camera",
  plant: "Acid Plant",
  ownerId: "acid",
  session: {
    sessionId: "lease",
    leaseToken: "token",
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  },
};
let renderer: ReturnType<typeof create> | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  api.requestWithSession.mockResolvedValue({ session, data: lease });
  api.requestResponseWithSession.mockResolvedValue({
    session,
    response: new Response("image", { headers: { "content-type": "image/jpeg" } }),
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount(strict = false) {
  await act(async () => {
    const element = createElement(CaptureScreen, {
      session,
      selectedSession,
      operatorName: "acid",
      onSessionUpdate: () => undefined,
    });
    renderer = create(strict ? createElement(StrictMode, null, element) : element);
  });
}
it("automatically starts the plant session and enables capture after preview", async () => {
  await mount();
  expect(
    api.requestWithSession.mock.calls.filter((call) => call[1] === "/camera/session"),
  ).toHaveLength(1);
  const capture = renderer.root.findByProps({ "aria-label": "Capture image" });
  expect(capture.props.disabled).toBe(false);
  expect(api.requestResponseWithSession.mock.calls[0][1]).toContain("deviceId=7");
});
it("keeps capture disabled when the camera preview fails", async () => {
  api.requestResponseWithSession.mockRejectedValue(new Error("USB unavailable"));
  await mount();
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(true);
});
it("releases a late created lease after navigating away", async () => {
  let finish!: (value: unknown) => void;
  api.requestWithSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await act(async () => renderer.unmount());
  renderer = undefined;
  await act(async () => {
    finish({ session, data: lease });
  });
  expect(api.requestWithSession.mock.calls.some((call) => call[2]?.method === "DELETE")).toBe(true);
  expect(api.requestResponseWithSession).not.toHaveBeenCalled();
});
it("does not duplicate session creation under StrictMode effect replay", async () => {
  await mount(true);
  expect(
    api.requestWithSession.mock.calls.filter((call) => call[1] === "/camera/session"),
  ).toHaveLength(1);
});

it("ALL account stays idle without selection and switches cameras with the selected session plant", async () => {
  const allSession = { ...session, user: { ...session.user, plant: "ALL" } };
  const props = { session: allSession, operatorName: "acid", onSessionUpdate: () => undefined };
  api.requestWithSession.mockImplementation(async (_session, _path, options) => {
    const plant = JSON.parse(options.body).plant;
    return {
      session: allSession,
      data: { ...lease, plant, deviceId: plant === "Acid Plant" ? 7 : 8 },
    };
  });
  await act(async () => {
    renderer = create(createElement(CaptureScreen, { ...props, selectedSession: null }));
  });
  expect(api.requestWithSession).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(true);
  await act(async () => {
    renderer.update(createElement(CaptureScreen, { ...props, selectedSession }));
  });
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(false);
  await act(async () => {
    renderer.update(
      createElement(CaptureScreen, {
        ...props,
        selectedSession: { ...selectedSession, key: "chloride-14", plant: "Chloride Plant" },
      }),
    );
  });
  const calls = api.requestWithSession.mock.calls;
  expect(calls.map((call) => call[2].method)).toEqual(["POST", "DELETE", "POST"]);
  expect(JSON.parse(calls[2][2].body).plant).toBe("Chloride Plant");
  expect(api.requestResponseWithSession.mock.calls.at(-1)?.[1]).toContain(
    "deviceId=8&plant=Chloride+Plant",
  );
});

it("ALL My Device requests selection without guessing a camera", async () => {
  const user = { ...session.user, plant: "ALL" };
  await act(async () => {
    renderer = create(
      createElement(MyDeviceScreen, {
        session: { ...session, user },
        user,
        onSessionUpdate: () => undefined,
        onSignOut: () => undefined,
        onOpenSessions: () => undefined,
      }),
    );
  });
  expect(api.requestWithSession).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ "aria-label": "Select device plant" })).toBeTruthy();
});
it("ALL My Device reads only the selected plant camera", async () => {
  const user = { ...session.user, plant: "ALL" };
  api.requestWithSession.mockImplementation(async () => ({
    session: { ...session, user },
    data: {
      devices: [
        { code: "acid", plant: "Acid Plant", isActive: true },
        { code: "chloride", plant: "Chloride Plant", isActive: true },
      ],
      edge: { connected: true },
    },
  }));
  await act(async () => {
    renderer = create(
      createElement(MyDeviceScreen, {
        session: { ...session, user },
        user,
        selectedPlant: "Chloride Plant",
        onSessionUpdate: () => undefined,
        onSignOut: () => undefined,
      }),
    );
  });
  expect(api.requestWithSession.mock.calls.map((call) => call[1])).toEqual([
    "/devices",
    "/devices/chloride/status",
  ]);
});

async function mountDirect(hour = 14, minute = 0, second = 0) {
  vi.setSystemTime(new Date(2026, 8, 8, hour, minute, second));
  api.requestWithSession.mockImplementation(async (_session, path) => ({
    session,
    data:
      path === "/camera/session"
        ? {
            ...lease,
            session: { ...lease.session, expiresAt: new Date(Date.now() + 120_000).toISOString() },
          }
        : { released: true },
  }));
  await act(async () => {
    renderer = create(
      createElement(CaptureScreen, {
        session,
        selectedSession: null,
        operatorName: "acid",
        onSessionUpdate: () => undefined,
      }),
    );
  });
}

it("direct capture connects the assigned plant and waits for preview", async () => {
  await mountDirect();
  expect(JSON.parse(api.requestWithSession.mock.calls[0][2].body).plant).toBe("Acid Plant");
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(false);
  expect(api.requestResponseWithSession.mock.calls[0][1]).toContain("deviceId=7");
});

it("direct capture outside its window never acquires a camera", async () => {
  await mountDirect(16);
  expect(api.requestWithSession).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(true);
});

it("direct capture releases its lease when the window ends", async () => {
  await mountDirect(15, 59, 59);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(api.requestWithSession.mock.calls.some((call) => call[2]?.method === "DELETE")).toBe(true);
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(true);
});

it("direct capture finishes saving before releasing at a window boundary", async () => {
  await mountDirect(15, 59, 59);
  let finish!: (value: unknown) => void;
  api.requestWithSession.mockImplementation(async (_session, path) => {
    if (path === "/camera/capture")
      return { session, data: { job: { jobId: "job", status: "queued" } } };
    if (path.startsWith("/jobs/"))
      return new Promise((resolve) => {
        finish = resolve;
      });
    if (path === "/captures/finalize") return { session, data: { forwarded: true } };
    return { session, data: { released: true } };
  });
  await act(async () => {
    renderer.root.findByProps({ "aria-label": "Capture image" }).props.onClick();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(api.requestWithSession.mock.calls.some((call) => call[2]?.method === "DELETE")).toBe(
    false,
  );
  await act(async () => {
    finish({
      session,
      data: { jobId: "job", status: "succeeded", result: { asset: { assetId: "asset" } } },
    });
  });
  const finalize = api.requestWithSession.mock.calls.find(
    (call) => call[1] === "/captures/finalize",
  );
  expect(JSON.parse(finalize[2].body)).toMatchObject({
    deviceId: 7,
    plant: "Acid Plant",
    captureSession: "14.00",
    capturedAt: new Date(2026, 8, 8, 15, 59, 59).getTime(),
  });
  expect(api.requestWithSession.mock.calls.some((call) => call[2]?.method === "DELETE")).toBe(true);
  expect(renderer.root.findByProps({ "aria-label": "Capture image" }).props.disabled).toBe(true);
});
