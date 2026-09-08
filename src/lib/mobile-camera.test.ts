import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ requestWithSession: vi.fn(), requestResponseWithSession: vi.fn() }));
vi.mock("../../mobile/src/lib/auth", () => api);
import { ensureCameraSession, getJob, getPreviewFrame, triggerCapture, triggerAutofocus, renewCameraSession, releaseCameraSession, queueCameraSessionOperation, canAccessCapturePlant } from "../../mobile/src/lib/camera";
import { pickPrimaryDevice, type DeviceListItem } from "../../mobile/src/lib/devices";
import type { AuthSession } from "../../mobile/src/lib/auth";

const session = { user: { id: 1, username: "acid", plant: "Acid Plant" } } as AuthSession;
const lease = { deviceId: 7, deviceCode: "acid-camera", plant: "Acid Plant", ownerId: "acid", session: { sessionId: "lease", leaseToken: "token", expiresAt: new Date(Date.now() + 120_000).toISOString() } };
beforeEach(() => {
  api.requestWithSession.mockResolvedValue({ session, data: lease });
  api.requestResponseWithSession.mockResolvedValue({ session, response: new Response("frame") });
});

describe("mobile camera assignment", () => {
  it("creates only in the account plant and rejects mismatching contexts before any request", async () => {
    await expect(ensureCameraSession(session, null, "Chloride Plant")).rejects.toThrow("account can access");
    await expect(ensureCameraSession(session, null, "")).rejects.toThrow("account can access");
    expect(api.requestWithSession).not.toHaveBeenCalled();
    await ensureCameraSession(session, null, "Acid Plant");
    expect(JSON.parse(api.requestWithSession.mock.calls[0][2].body)).toEqual({ plant: "Acid Plant" });
  });
  it("does not reuse another operator's lease", async () => {
    await expect(ensureCameraSession(session, { ...lease, ownerId: "someone-else" }, "Acid Plant")).rejects.toThrow("assignment changed");
    expect(api.requestWithSession).not.toHaveBeenCalled();
  });
  it("releases an unexpected session response instead of displaying its camera", async () => {
    api.requestWithSession.mockResolvedValueOnce({ session, data: { ...lease, plant: "Chloride Plant" } });
    await expect(ensureCameraSession(session, null, "Acid Plant")).rejects.toThrow("does not match");
    expect(api.requestWithSession.mock.calls[1][2].method).toBe("DELETE");
  });
  it("pins preview, job, commands, heartbeat and release to the lease", async () => {
    await getPreviewFrame(session, lease);
    await getJob(session, "job/one", lease);
    expect(api.requestResponseWithSession.mock.calls[0][1]).toBe("/camera/preview?deviceId=7&plant=Acid+Plant");
    expect(api.requestWithSession.mock.calls[0][1]).toBe("/jobs/job%2Fone?deviceId=7&plant=Acid+Plant");
    await triggerCapture(session, lease);
    await triggerAutofocus(session, lease);
    await renewCameraSession(session, lease);
    await releaseCameraSession(session, lease);
    for (const call of api.requestWithSession.mock.calls.slice(1)) {
      expect(JSON.parse(call[2].body)).toMatchObject({ deviceId: 7, plant: "Acid Plant", leaseToken: "token" });
    }
  });
  it("waits for old lease work before starting a new screen's lease", async () => {
    let finish!: () => void;
    const events: string[] = [];
    const old = queueCameraSessionOperation(async () => {
      await new Promise<void>((resolve) => { finish = resolve; });
      events.push("released");
    });
    const next = queueCameraSessionOperation(async () => { events.push("started"); });
    await Promise.resolve(); await Promise.resolve();
    expect(events).toEqual([]);
    finish();
    await Promise.all([old, next]);
    expect(events).toEqual(["released", "started"]);
  });
  it("My Device ignores other plants and inactive devices and rejects ambiguity", () => {
    const device = (code: string, plant: string, isActive = true) => ({ code, plant, isActive }) as DeviceListItem;
    const acid = device("acid", "Acid Plant");
    expect(pickPrimaryDevice([device("chloride", "Chloride Plant"), acid], "Acid Plant")).toBe(acid);
    expect(pickPrimaryDevice([device("old", "Acid Plant", false)], "Acid Plant")).toBeNull();
    expect(() => pickPrimaryDevice([acid, device("duplicate", "Acid Plant")], "Acid Plant")).toThrow("More than one");
    expect(() => pickPrimaryDevice([acid], null)).toThrow("assigned plant");
  });
});

it.each(["Acid Plant", "Chloride Plant"])("ALL account creates a lease in selected %s", async (plant) => {
  const allSession = { ...session, user: { ...session.user, plant: "ALL" } };
  api.requestWithSession.mockResolvedValueOnce({ session: allSession, data: { ...lease, plant } });
  await ensureCameraSession(allSession, null, plant);
  expect(JSON.parse(api.requestWithSession.mock.calls[0][2].body)).toEqual({ plant });
});
it("ALL is permission scope, never a camera destination; unassigned accounts remain blocked", () => {
  expect(canAccessCapturePlant("ALL", "ALL")).toBe(false);
  expect(canAccessCapturePlant("ALL", null)).toBe(false);
  expect(canAccessCapturePlant(null, "Acid Plant")).toBe(false);
  expect(canAccessCapturePlant("Acid Plant", "Chloride Plant")).toBe(false);
});
