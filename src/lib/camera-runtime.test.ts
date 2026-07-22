import { describe, expect, it } from "vitest";

import {
  describeCameraRuntimeIssue,
  getDeviceStatusPollInterval,
  getCaptureActionHint,
  getCaptureRuntimeActions,
  getCaptureSessionSummary,
  getRuntimeErrorCode,
  getSessionHeartbeatInterval,
  isCameraReadyForLiveOps,
  isIgnorableSessionFetchError,
  shouldRenewSession,
} from "./camera-runtime";

describe("describeCameraRuntimeIssue", () => {
  it("maps unreachable edge API failures into operator-friendly guidance", () => {
    const issue = describeCameraRuntimeIssue("UNREACHABLE", "Can't reach the camera service");

    expect(issue.title).toMatch(/edge api/i);
    expect(issue.tone).toBe("danger");
    expect(issue.nextAction).toMatch(/service edge/i);
  });

  it("maps session conflicts into waiting guidance", () => {
    const issue = describeCameraRuntimeIssue(
      "SESSION_CONFLICT",
      "Camera is in use by another client",
    );

    expect(issue.title).toMatch(/dipakai/i);
    expect(issue.tone).toBe("warning");
    expect(issue.nextAction).toMatch(/station lain/i);
  });
});

describe("getRuntimeErrorCode", () => {
  it("extracts coded errors from thrown objects", () => {
    const error = Object.assign(new Error("failed"), { code: "SESSION_LOST" });

    expect(getRuntimeErrorCode(error)).toBe("SESSION_LOST");
  });

  it("returns null for uncoded errors", () => {
    expect(getRuntimeErrorCode(new Error("plain"))).toBeNull();
  });
});

describe("isIgnorableSessionFetchError", () => {
  it("treats aborted fetch errors as ignorable", () => {
    expect(isIgnorableSessionFetchError(new Error("Failed to fetch"))).toBe(true);
    expect(isIgnorableSessionFetchError(new Error("net::ERR_ABORTED"))).toBe(true);
  });

  it("keeps real runtime errors visible", () => {
    expect(isIgnorableSessionFetchError(new Error("Camera is in use by another client"))).toBe(
      false,
    );
  });
});

describe("capture runtime guidance", () => {
  it("tells the operator to start the session when edge and camera are ready", () => {
    const hint = getCaptureActionHint({
      sessionId: null,
      sessionStarting: false,
      waitingForCamera: false,
      cameraAsleep: false,
      operationInProgress: false,
      deviceStatus: {
        online: true,
        deviceId: "edge-01",
        agentVersion: "1.0.0",
        connectionState: "ready",
        capabilities: [],
        camera: {
          connected: true,
          manufacturer: "Canon",
          model: "EOS",
          serialNumber: "123",
          firmwareVersion: "1.0",
        },
      },
    });

    expect(hint).toMatch(/start camera/i);
  });

  it("recommends USB checks when the camera is disconnected", () => {
    const actions = getCaptureRuntimeActions({
      sessionId: "session-1",
      sessionStarting: false,
      waitingForCamera: false,
      cameraAsleep: false,
      operationInProgress: false,
      deviceStatus: {
        online: true,
        deviceId: "edge-01",
        agentVersion: "1.0.0",
        connectionState: "disconnected",
        capabilities: [],
        camera: {
          connected: false,
          manufacturer: null,
          model: null,
          serialNumber: null,
          firmwareVersion: null,
        },
      },
    });

    expect(actions[0]).toMatch(/usb|kabel/i);
  });
});

describe("runtime polling helpers", () => {
  const readyDevice = {
    online: true,
    deviceId: "edge-01",
    agentVersion: "1.0.0",
    connectionState: "ready" as const,
    capabilities: [],
    camera: {
      connected: true,
      manufacturer: "Canon",
      model: "EOS",
      serialNumber: "123",
      firmwareVersion: "1.0",
    },
  };

  it("treats a ready online camera as live-ops capable", () => {
    expect(isCameraReadyForLiveOps(readyDevice)).toBe(true);
    expect(getDeviceStatusPollInterval(readyDevice)).toBe(6000);
    expect(getSessionHeartbeatInterval(readyDevice)).toBe(60000);
    expect(shouldRenewSession(readyDevice)).toBe(true);
  });

  it("backs off polling when the camera is disconnected", () => {
    const disconnectedDevice = {
      ...readyDevice,
      connectionState: "disconnected" as const,
      camera: { ...readyDevice.camera, connected: false },
    };

    expect(isCameraReadyForLiveOps(disconnectedDevice)).toBe(false);
    expect(getDeviceStatusPollInterval(disconnectedDevice)).toBe(12000);
    expect(getSessionHeartbeatInterval(disconnectedDevice)).toBe(105000);
    expect(shouldRenewSession(disconnectedDevice)).toBe(true);
  });

  it("stops renewing session when the edge is fully offline", () => {
    const offlineDevice = {
      ...readyDevice,
      online: false,
      connectionState: null,
      camera: null,
    };

    expect(isCameraReadyForLiveOps(offlineDevice)).toBe(false);
    expect(getSessionHeartbeatInterval(offlineDevice)).toBe(120000);
    expect(shouldRenewSession(offlineDevice)).toBe(false);
  });
});

describe("getCaptureSessionSummary", () => {
  const baseDevice = {
    online: true,
    deviceId: "edge-01",
    agentVersion: "1.0.0",
    connectionState: "ready" as const,
    capabilities: [],
    camera: {
      connected: true,
      manufacturer: "Canon",
      model: "EOS",
      serialNumber: "123",
      firmwareVersion: "1.0",
    },
  };

  it("prioritizes waiting state over generic disconnected wording", () => {
    const summary = getCaptureSessionSummary({
      deviceStatus: {
        ...baseDevice,
        connectionState: "disconnected",
        camera: { ...baseDevice.camera, connected: false },
      },
      sessionId: null,
      sessionStarting: false,
      waitingForCamera: true,
    });

    expect(summary.title).toMatch(/menunggu kamera/i);
  });

  it("explains active session with disconnected camera clearly", () => {
    const summary = getCaptureSessionSummary({
      deviceStatus: {
        ...baseDevice,
        connectionState: "disconnected",
        camera: { ...baseDevice.camera, connected: false },
      },
      sessionId: "session-1",
      sessionStarting: false,
      waitingForCamera: false,
    });

    expect(summary.title).toMatch(/kamera usb belum terdeteksi/i);
    expect(summary.tone).toBe("danger");
  });
});
