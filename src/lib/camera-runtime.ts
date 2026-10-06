import { cameraRuntimeMessages as m } from "@/i18n/capture";
import { failureText } from "@/i18n/errors";
import { translateId, type Translator } from "@/lib/i18n";

import type { DeviceStatus } from "./camera-api";

export type CameraRuntimeIssueTone = "danger" | "warning" | "info";

export type CameraRuntimeIssueDescriptor = {
  code: string;
  title: string;
  detail: string;
  nextAction: string;
  tone: CameraRuntimeIssueTone;
};

type CaptureRuntimeHintArgs = {
  sessionId: string | null;
  sessionStarting: boolean;
  waitingForCamera: boolean;
  cameraAsleep: boolean;
  deviceStatus: DeviceStatus | null;
  operationInProgress: boolean;
};

export function getRuntimeErrorCode(error: unknown): string | null {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

/**
 * Teks tampilan untuk error yang DILEMPAR (bukan dikembalikan) server function.
 * Dalam bahasa Indonesia hasilnya pesan error itu sendiri; di bahasa lain kode
 * yang dikenal diterjemahkan. Pesan mentah untuk log tetap diambil terpisah.
 */
export function getRuntimeErrorText(
  error: unknown,
  fallback: string,
  t: Translator = translateId,
): string {
  if (!(error instanceof Error)) return fallback;
  if (!error.message) return error.message;
  return failureText(t, { code: getRuntimeErrorCode(error), message: error.message });
}

export function describeCameraRuntimeIssue(
  code: string | null | undefined,
  fallbackMessage?: string | null,
  t: Translator = translateId,
): CameraRuntimeIssueDescriptor {
  switch (code) {
    case "UNREACHABLE":
      return {
        code,
        title: t(m.unreachableTitle),
        detail: fallbackMessage || t(m.unreachableDetail),
        nextAction: t(m.unreachableAction),
        tone: "danger",
      };
    case "SESSION_CONFLICT":
      return {
        code,
        title: t(m.conflictTitle),
        detail: fallbackMessage || t(m.conflictDetail),
        nextAction: t(m.conflictAction),
        tone: "warning",
      };
    case "SESSION_LOST":
    case "INVALID_SESSION":
      return {
        code,
        title: t(m.sessionLostTitle),
        detail: fallbackMessage || t(m.sessionLostDetail),
        nextAction: t(m.sessionLostAction),
        tone: "warning",
      };
    case "CAMERA_DISCONNECTED":
      return {
        code,
        title: t(m.cameraDisconnectedTitle),
        detail: fallbackMessage || t(m.cameraDisconnectedDetail),
        nextAction: t(m.cameraDisconnectedAction),
        tone: "danger",
      };
    case "PREVIEW_UNAVAILABLE":
      return {
        code,
        title: t(m.previewUnavailableTitle),
        detail: fallbackMessage || t(m.previewUnavailableDetail),
        nextAction: t(m.previewUnavailableAction),
        tone: "warning",
      };
    case "REQUEST_FAILED":
      return {
        code,
        title: t(m.requestFailedTitle),
        detail: fallbackMessage || t(m.requestFailedDetail),
        nextAction: t(m.requestFailedAction),
        tone: "warning",
      };
    default:
      return {
        code: code ?? "UNKNOWN",
        title: t(m.unknownTitle),
        detail: fallbackMessage || t(m.unknownDetail),
        nextAction: t(m.unknownAction),
        tone: "warning",
      };
  }
}

export function isIgnorableSessionFetchError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /failed to fetch|load failed|abort|err_aborted/i.test(error.message);
}

export function isCameraReadyForLiveOps(deviceStatus: DeviceStatus | null): boolean {
  if (deviceStatus === null) return true;
  return !!(
    deviceStatus.online &&
    deviceStatus.camera?.connected &&
    deviceStatus.connectionState === "ready"
  );
}

export function getDeviceStatusPollInterval(deviceStatus: DeviceStatus | null): number {
  return isCameraReadyForLiveOps(deviceStatus) ? 6000 : 12000;
}

export function getSessionHeartbeatInterval(deviceStatus: DeviceStatus | null): number {
  if (deviceStatus === null) return 60000;
  if (isCameraReadyForLiveOps(deviceStatus)) return 60000;
  return deviceStatus.online ? 105000 : 120000;
}

export function shouldRenewSession(deviceStatus: DeviceStatus | null): boolean {
  return deviceStatus === null || deviceStatus.online;
}

export function getCaptureActionHint(
  {
    sessionId,
    sessionStarting,
    waitingForCamera,
    cameraAsleep,
    deviceStatus,
    operationInProgress,
  }: CaptureRuntimeHintArgs,
  t: Translator = translateId,
): string {
  if (operationInProgress) {
    return t(m.hintOperationRunning);
  }
  if (sessionStarting) {
    return t(m.hintSessionStarting);
  }
  if (!deviceStatus?.online) {
    return t(m.hintEdgeOffline);
  }
  if (!deviceStatus.camera?.connected) {
    return t(m.hintCameraUnplugged);
  }
  if (waitingForCamera) {
    return t(m.hintWaiting);
  }
  if (!sessionId) {
    return t(m.hintStartSession);
  }
  if (cameraAsleep || deviceStatus.connectionState !== "ready") {
    return t(m.hintWakeCamera);
  }
  return t(m.hintReady);
}

export function getCaptureRuntimeActions(
  {
    sessionId,
    sessionStarting,
    waitingForCamera,
    cameraAsleep,
    deviceStatus,
    operationInProgress,
  }: CaptureRuntimeHintArgs,
  t: Translator = translateId,
): string[] {
  const hasHardwareBlocker = !deviceStatus?.online || !deviceStatus.camera?.connected;
  const actions = [
    !deviceStatus?.online ? t(m.actionEdgeOffline) : null,
    deviceStatus?.online && !deviceStatus.camera?.connected ? t(m.actionCheckUsb) : null,
    waitingForCamera && !hasHardwareBlocker ? t(m.actionWaitStation) : null,
    sessionStarting ? t(m.actionLetConnect) : null,
    sessionId && cameraAsleep ? t(m.actionWakeCamera) : null,
    sessionId && deviceStatus?.connectionState === "error" ? t(m.actionEdgeError) : null,
    !sessionId && deviceStatus?.online && deviceStatus.camera?.connected && !sessionStarting
      ? t(m.actionStartCamera)
      : null,
    operationInProgress ? t(m.actionWaitOperation) : null,
  ].filter(Boolean);

  return actions.length > 0 ? (actions as string[]) : [t(m.actionStable)];
}

export function getCaptureSessionSummary(
  {
    deviceStatus,
    sessionId,
    sessionStarting,
    waitingForCamera,
  }: {
    deviceStatus: DeviceStatus | null;
    sessionId: string | null;
    sessionStarting: boolean;
    waitingForCamera: boolean;
  },
  t: Translator = translateId,
): { title: string; detail: string; tone: CameraRuntimeIssueTone } {
  if (waitingForCamera) {
    return {
      title: t(m.summaryWaitingTitle),
      detail: t(m.summaryWaitingDetail),
      tone: "warning",
    };
  }

  if (sessionStarting) {
    return {
      title: t(m.summaryStartingTitle),
      detail: t(m.summaryStartingDetail),
      tone: "warning",
    };
  }

  if (!sessionId) {
    return {
      title: t(m.summaryNoSessionTitle),
      detail: t(m.summaryNoSessionDetail),
      tone: "warning",
    };
  }

  if (!deviceStatus?.online) {
    return {
      title: t(m.summaryEdgeUnstableTitle),
      detail: t(m.summaryEdgeUnstableDetail),
      tone: "warning",
    };
  }

  if (!deviceStatus.camera?.connected) {
    return {
      title: t(m.summaryUsbMissingTitle),
      detail: t(m.summaryUsbMissingDetail),
      tone: "danger",
    };
  }

  if (deviceStatus.connectionState !== "ready") {
    return {
      title: t(m.summaryNotReadyTitle),
      detail: t(m.summaryNotReadyDetail, { state: deviceStatus.connectionState ?? "unknown" }),
      tone: "warning",
    };
  }

  return {
    title: t(m.summaryReadyTitle),
    detail: t(m.summaryReadyDetail),
    tone: "success",
  };
}
