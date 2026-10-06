import { errorMessages } from "@/i18n/errors";
import { defineMessages, translateId, type Message, type Translator } from "@/lib/i18n";

// Keterangan status edge/kamera yang disusun server (getDeviceStatus) dalam
// bahasa Indonesia. Server ikut mengirim kode dan parameternya (statusInfo),
// jadi dalam bahasa lain kalimatnya disusun ulang dari tabel ini.
export const deviceStatusMessages = defineMessages({
  EDGE_TIMEOUT: {
    id: "Service edge kamera di {host} tidak merespons tepat waktu. Periksa power Mini PC, jaringan LAN, atau service edge API.",
    en: "The camera edge service at {host} did not respond in time. Check the Mini PC power, the LAN, or the edge API service.",
    zh: "{host} 上的相机边缘服务未及时响应。请检查迷你电脑电源、局域网或 Edge API 服务。",
  },
  EDGE_REFUSED: {
    id: "Service edge kamera di {host} menolak koneksi. Service kemungkinan belum berjalan.",
    en: "The camera edge service at {host} refused the connection. The service is probably not running.",
    zh: "{host} 上的相机边缘服务拒绝连接，服务可能尚未运行。",
  },
  EDGE_HOST_UNREACHABLE: {
    id: "Host edge kamera {host} tidak bisa dijangkau dari app server. Periksa LAN, VPN, atau routing jaringan.",
    en: "The camera edge host {host} cannot be reached from the app server. Check the LAN, VPN, or network routing.",
    zh: "应用服务器无法访问相机边缘主机 {host}。请检查局域网、VPN 或网络路由。",
  },
  EDGE_UNREADABLE: {
    id: "Status edge kamera di {host} belum bisa dibaca. Periksa service edge API dan konektivitas jaringan.",
    en: "The camera edge status at {host} could not be read. Check the edge API service and network connectivity.",
    zh: "无法读取 {host} 上的相机边缘状态。请检查 Edge API 服务和网络连接。",
  },
  CAMERA_COMMAND_FAILED: {
    id: "Perintah ke kamera gagal di {host}. Service edge sendiri normal — periksa kabel USB, power, dan kondisi kamera.",
    en: "A camera command failed at {host}. The edge service itself is fine — check the USB cable, power, and the camera.",
    zh: "{host} 上的相机指令执行失败。边缘服务本身正常——请检查 USB 线、电源和相机状态。",
  },
  CAMERA_COMMAND_FAILED_DETAIL: {
    id: "Perintah ke kamera gagal di {host}: {detail} Service edge sendiri normal — periksa kabel USB, power, dan kondisi kamera.",
    en: "A camera command failed at {host}: {detail} The edge service itself is fine — check the USB cable, power, and the camera.",
    zh: "{host} 上的相机指令执行失败：{detail} 边缘服务本身正常——请检查 USB 线、电源和相机状态。",
  },
  EDGE_HTTP_ERROR: {
    id: "Service edge kamera di {host} merespons {status}. Periksa service edge API pada Mini PC.",
    en: "The camera edge service at {host} answered {status}. Check the edge API service on the Mini PC.",
    zh: "{host} 上的相机边缘服务返回 {status}。请检查迷你电脑上的 Edge API 服务。",
  },
  EDGE_HTTP_ERROR_DETAIL: {
    id: "Service edge kamera di {host} merespons {status} ({detail}). Periksa service edge API pada Mini PC.",
    en: "The camera edge service at {host} answered {status} ({detail}). Check the edge API service on the Mini PC.",
    zh: "{host} 上的相机边缘服务返回 {status}（{detail}）。请检查迷你电脑上的 Edge API 服务。",
  },
  ONLINE_NO_CAMERA: {
    id: "Edge device terhubung, tetapi kamera USB belum terdeteksi atau belum siap.",
    en: "The edge device is connected, but the USB camera is not detected or not ready yet.",
    zh: "边缘设备已连接，但尚未检测到 USB 相机或相机未就绪。",
  },
  ONLINE_NO_CAMERA_NAMED: {
    id: "Edge device {deviceId} terhubung, tetapi kamera USB belum terdeteksi atau belum siap.",
    en: "Edge device {deviceId} is connected, but the USB camera is not detected or not ready yet.",
    zh: "边缘设备 {deviceId} 已连接，但尚未检测到 USB 相机或相机未就绪。",
  },
  ONLINE_READY: {
    id: "{camera} siap dipakai untuk capture.",
    en: "{camera} is ready for capture.",
    zh: "{camera} 已就绪，可以拍摄。",
  },
  ONLINE_NOT_READY: {
    id: "{camera} terdeteksi, tetapi state koneksi masih {state}.",
    en: "{camera} is detected, but the connection state is still {state}.",
    zh: "已检测到 {camera}，但连接状态仍为 {state}。",
  },
  activeCamera: { id: "kamera aktif", en: "The active camera", zh: "当前相机" },
});

type StatusLike = {
  statusMessage?: string | null;
  statusInfo?: { code: string; params?: Record<string, string | number> } | null;
};

/**
 * Keterangan status untuk ditampilkan. Bahasa Indonesia memakai kalimat server
 * apa adanya; bahasa lain menyusunnya dari kode. Null kalau tidak ada keterangan.
 */
export function deviceStatusText(
  t: Translator,
  status: StatusLike | null | undefined,
): string | null {
  const serverText = status?.statusMessage?.trim() || null;
  if (t === translateId || !status?.statusInfo) return serverText;

  const { code, params = {} } = status.statusInfo;
  const known = (deviceStatusMessages as Record<string, Message>)[code];
  if (known) {
    // `camera` kosong berarti server memakai sebutan umum "kamera aktif".
    const camera = params.camera || t(deviceStatusMessages.activeCamera);
    return t(known, { ...params, camera });
  }
  // Selain itu kodenya milik resolver target (DEVICE_AMBIGUOUS, NO_DEVICE, ...).
  const failure = (errorMessages as Record<string, Message>)[code];
  return failure ? t(failure) : serverText;
}
