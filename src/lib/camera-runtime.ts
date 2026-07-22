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

export function describeCameraRuntimeIssue(
  code: string | null | undefined,
  fallbackMessage?: string | null,
): CameraRuntimeIssueDescriptor {
  switch (code) {
    case "UNREACHABLE":
      return {
        code,
        title: "Edge API tidak terjangkau",
        detail:
          fallbackMessage || "Aplikasi tidak bisa menjangkau service kamera pada edge device.",
        nextAction: "Periksa koneksi jaringan, status Mini PC, dan service edge camera API.",
        tone: "danger",
      };
    case "SESSION_CONFLICT":
      return {
        code,
        title: "Kamera sedang dipakai station lain",
        detail: fallbackMessage || "Session kamera masih dikunci client lain.",
        nextAction: "Tunggu station lain selesai, lalu hubungkan ulang dari halaman Capture.",
        tone: "warning",
      };
    case "SESSION_LOST":
    case "INVALID_SESSION":
      return {
        code,
        title: "Session kamera terputus",
        detail:
          fallbackMessage || "Lease session hilang atau kedaluwarsa saat operator masih aktif.",
        nextAction:
          "Biarkan aplikasi mencoba reconnect otomatis, atau klik Start camera bila perlu.",
        tone: "warning",
      };
    case "CAMERA_DISCONNECTED":
      return {
        code,
        title: "Kamera USB tidak terdeteksi",
        detail: fallbackMessage || "Edge device online, tetapi kamera tidak terbaca.",
        nextAction: "Cek kabel USB, power kamera, lalu tunggu status kamera kembali ready.",
        tone: "danger",
      };
    case "PREVIEW_UNAVAILABLE":
      return {
        code,
        title: "Preview kamera belum tersedia",
        detail: fallbackMessage || "Frame preview tidak bisa diambil untuk sementara.",
        nextAction: "Tunggu beberapa detik atau restart sesi kamera bila preview tetap kosong.",
        tone: "warning",
      };
    case "REQUEST_FAILED":
      return {
        code,
        title: "Permintaan ke kamera gagal",
        detail:
          fallbackMessage || "Edge API merespons dengan kegagalan saat memproses operasi kamera.",
        nextAction:
          "Periksa detail error dari edge API dan ulangi operasi setelah status perangkat normal.",
        tone: "warning",
      };
    default:
      return {
        code: code ?? "UNKNOWN",
        title: "Status runtime perlu perhatian",
        detail:
          fallbackMessage ||
          "Terjadi kondisi runtime yang belum berhasil dipetakan secara spesifik.",
        nextAction:
          "Periksa status edge, koneksi kamera, dan ulangi operasi setelah kondisi stabil.",
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

export function getCaptureActionHint({
  sessionId,
  sessionStarting,
  waitingForCamera,
  cameraAsleep,
  deviceStatus,
  operationInProgress,
}: CaptureRuntimeHintArgs): string {
  if (operationInProgress) {
    return "Tunggu operasi kamera yang sedang berjalan selesai lebih dulu.";
  }
  if (sessionStarting) {
    return "Aplikasi sedang membuat session kamera ke edge device.";
  }
  if (!deviceStatus?.online) {
    return "Edge API belum terjangkau, jadi capture belum bisa dimulai.";
  }
  if (!deviceStatus.camera?.connected) {
    return "Hubungkan kamera USB ke edge device sebelum capture atau autofocus.";
  }
  if (waitingForCamera) {
    return "Kamera masih dipakai station lain; tunggu lease dilepas lalu coba lagi.";
  }
  if (!sessionId) {
    return "Klik Start camera untuk membuat session aktif terlebih dahulu.";
  }
  if (cameraAsleep || deviceStatus.connectionState !== "ready") {
    return "Bangunkan kamera atau stabilkan koneksi sampai status edge kembali siap.";
  }
  return "Kamera siap dipakai untuk capture dan autofocus.";
}

export function getCaptureRuntimeActions({
  sessionId,
  sessionStarting,
  waitingForCamera,
  cameraAsleep,
  deviceStatus,
  operationInProgress,
}: CaptureRuntimeHintArgs): string[] {
  const hasHardwareBlocker = !deviceStatus?.online || !deviceStatus.camera?.connected;
  const actions = [
    !deviceStatus?.online
      ? "Pastikan Mini PC edge menyala dan service camera API dapat dijangkau dari aplikasi."
      : null,
    deviceStatus?.online && !deviceStatus.camera?.connected
      ? "Periksa kabel USB, power kamera, dan enumerasi device pada edge node."
      : null,
    waitingForCamera && !hasHardwareBlocker
      ? "Tunggu station lain selesai memakai kamera, atau batalkan lalu coba lagi nanti."
      : null,
    sessionStarting ? "Biarkan proses connect selesai sebelum menjalankan operasi lain." : null,
    sessionId && cameraAsleep
      ? "Bangunkan kamera dengan half-press shutter atau power-cycle bila tetap sleep."
      : null,
    sessionId && deviceStatus?.connectionState === "error"
      ? "Koneksi edge berada pada status error; refresh session atau restart service edge camera."
      : null,
    !sessionId && deviceStatus?.online && deviceStatus.camera?.connected && !sessionStarting
      ? "Klik Start camera untuk membuka session baru sebelum mengambil gambar."
      : null,
    operationInProgress
      ? "Tunggu proses capture/autofocus aktif selesai agar state kamera kembali idle."
      : null,
  ].filter(Boolean);

  return actions.length > 0
    ? (actions as string[])
    : ["Runtime kamera terlihat stabil. Operator bisa lanjut capture atau autofocus."];
}

export function getCaptureSessionSummary({
  deviceStatus,
  sessionId,
  sessionStarting,
  waitingForCamera,
}: {
  deviceStatus: DeviceStatus | null;
  sessionId: string | null;
  sessionStarting: boolean;
  waitingForCamera: boolean;
}): { title: string; detail: string; tone: CameraRuntimeIssueTone } {
  if (waitingForCamera) {
    return {
      title: "Menunggu kamera tersedia",
      detail: "Kamera sedang dipakai station lain, jadi session baru belum bisa diambil.",
      tone: "warning",
    };
  }

  if (sessionStarting) {
    return {
      title: "Sedang menghubungkan session kamera",
      detail: "Aplikasi sedang membuat session baru ke edge device.",
      tone: "warning",
    };
  }

  if (!sessionId) {
    return {
      title: "Belum ada session aktif",
      detail: "Operator perlu memulai session sebelum capture atau autofocus bisa dijalankan.",
      tone: "warning",
    };
  }

  if (!deviceStatus?.online) {
    return {
      title: "Session aktif, edge belum stabil",
      detail: "Session sudah ada, tetapi edge API belum terbaca stabil oleh aplikasi.",
      tone: "warning",
    };
  }

  if (!deviceStatus.camera?.connected) {
    return {
      title: "Session aktif, kamera USB belum terdeteksi",
      detail: "Session sudah ada, tetapi kamera fisik belum terbaca oleh edge node.",
      tone: "danger",
    };
  }

  if (deviceStatus.connectionState !== "ready") {
    return {
      title: "Session aktif, kamera belum siap",
      detail: `Koneksi kamera masih berada pada state ${deviceStatus.connectionState ?? "unknown"}.`,
      tone: "warning",
    };
  }

  return {
    title: "Session aktif dan siap dipakai",
    detail: "Preview, autofocus, dan capture bisa dijalankan dari halaman ini.",
    tone: "success",
  };
}
