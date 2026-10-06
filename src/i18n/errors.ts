import { defineMessages, translateId, type Message, type Translator } from "@/lib/i18n";

// Pesan kegagalan dari server ditulis dalam bahasa Indonesia. Untuk bahasa lain
// kegagalan yang KODE-nya dikenal ditulis ulang dari tabel ini; yang kodenya
// tidak dikenal tetap menampilkan teks server apa adanya.
export const errorMessages = defineMessages({
  UNAUTHENTICATED: {
    id: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    en: "Your session has ended. Sign in again to continue.",
    zh: "您的登录已过期，请重新登录后继续。",
  },
  FORBIDDEN: {
    id: "Akun Anda tidak berhak melakukan tindakan ini.",
    en: "Your account is not allowed to do this.",
    zh: "您的账号无权执行此操作。",
  },
  INVALID_CREDENTIALS: {
    id: "Username atau password salah.",
    en: "Incorrect username or password.",
    zh: "用户名或密码错误。",
  },
  ACCOUNT_DISABLED: {
    id: "Akun ini dinonaktifkan. Hubungi Super Admin untuk mengaktifkannya kembali.",
    en: "This account is disabled. Contact a Super Admin to reactivate it.",
    zh: "该账号已停用，请联系超级管理员重新启用。",
  },
  SESSION_SECRET_MISSING: {
    id: "SESSION_SECRET belum diisi di server aplikasi, jadi sesi login belum bisa dibuat.",
    en: "SESSION_SECRET is not set on the app server, so sign-in sessions cannot be created.",
    zh: "应用服务器未设置 SESSION_SECRET，无法创建登录会话。",
  },
  SERVER_NOT_CONFIGURED: {
    id: "Konfigurasi server aplikasi belum lengkap.",
    en: "The app server configuration is incomplete.",
    zh: "应用服务器配置不完整。",
  },
  NOT_CONFIGURED: {
    id: "Konfigurasi server aplikasi belum lengkap.",
    en: "The app server configuration is incomplete.",
    zh: "应用服务器配置不完整。",
  },
  CARDDB_NOT_CONFIGURED: {
    id: "Konfigurasi CARDDB belum lengkap di server aplikasi.",
    en: "The CARDDB configuration is incomplete on the app server.",
    zh: "应用服务器上的 CARDDB 配置不完整。",
  },
  DATABASE_UNREACHABLE: {
    id: "Database Capture-Calcine tidak bisa dihubungi.",
    en: "The Capture-Calcine database cannot be reached.",
    zh: "无法连接 Capture-Calcine 数据库。",
  },
  UNREACHABLE: {
    id: "Tidak bisa menjangkau service kamera",
    en: "The camera service cannot be reached",
    zh: "无法连接相机服务",
  },
  TIMEOUT: {
    id: "Service kamera tidak merespons tepat waktu.",
    en: "The camera service did not respond in time.",
    zh: "相机服务未在规定时间内响应。",
  },
  REQUEST_FAILED: {
    id: "Service kamera menolak permintaan.",
    en: "The camera service rejected the request.",
    zh: "相机服务拒绝了请求。",
  },
  SESSION_CONFLICT: {
    id: "Kamera sedang dipakai client lain.",
    en: "The camera is in use by another client.",
    zh: "相机正在被另一个客户端使用。",
  },
  INVALID_SESSION: {
    id: "Session kamera sudah tidak berlaku. Mulai ulang session.",
    en: "The camera session is no longer valid. Start the session again.",
    zh: "相机会话已失效，请重新启动会话。",
  },
  SESSION_LOST: {
    id: "Session kamera terputus. Mulai ulang session.",
    en: "The camera session was lost. Start the session again.",
    zh: "相机会话已丢失，请重新启动会话。",
  },
  PREVIEW_UNAVAILABLE: {
    id: "Preview kamera belum tersedia.",
    en: "Camera preview is not available right now.",
    zh: "暂时无法获取相机预览。",
  },
  DEVICE_NOT_FOUND: {
    id: "Device tidak ada di registry.",
    en: "The device is not in the registry.",
    zh: "登记表中没有该设备。",
  },
  DEVICE_FORBIDDEN: {
    id: "Akun Anda tidak boleh mengakses kamera ini.",
    en: "Your account is not allowed to use this camera.",
    zh: "您的账号无权使用此相机。",
  },
  DEVICE_INACTIVE: {
    id: "Device ini ditandai nonaktif di registry.",
    en: "This device is marked inactive in the registry.",
    zh: "该设备在登记表中已标记为停用。",
  },
  DEVICE_AMBIGUOUS: {
    id: "Ada lebih dari satu device aktif. Pilih device dulu sebelum memakai kamera.",
    en: "There is more than one active device. Choose a device before using the camera.",
    zh: "存在多台启用的设备，请先选择设备再使用相机。",
  },
  NO_DEVICE: {
    id: "Belum ada device aktif untuk plant ini.",
    en: "There is no active device for this plant yet.",
    zh: "该工厂尚无启用的设备。",
  },
  DEVICE_PLANT_MISMATCH: {
    id: "Kamera ini tidak lagi ditempatkan di plant tersebut. Pilih ulang lokasi pengambilan.",
    en: "This camera is no longer placed at that plant. Choose the capture location again.",
    zh: "该相机已不再分配给该工厂，请重新选择拍摄位置。",
  },
  DEVICE_URL_REQUIRED: {
    id: "Alamat API kamera plant ini belum diisi di Devices.",
    en: "The camera API address for this plant has not been set in Devices.",
    zh: "尚未在“设备”中填写该工厂相机的 API 地址。",
  },
  DEVICE_ASSIGNMENT_REQUIRED: {
    id: "Registry dan sesi pengguna diperlukan untuk memilih kamera berdasarkan plant.",
    en: "The registry and a signed-in user are required to choose a camera by plant.",
    zh: "按工厂选择相机需要登记表和已登录的用户。",
  },
  CAPTURE_SCHEDULE_REJECTED: {
    id: "Sesi ini tidak terbuka untuk capture.",
    en: "This session is not open for capture.",
    zh: "该场次当前不可拍摄。",
  },
  SESSION_CLOSED: {
    id: "Jendela capture telah berakhir.",
    en: "The capture window for this session has ended.",
    zh: "该场次的拍摄时间已结束。",
  },
  SESSION_UPCOMING: {
    id: "Sesi belum dimulai.",
    en: "This session has not started yet.",
    zh: "该场次尚未开始。",
  },
  SCHEDULE_INVALID_SESSION: {
    id: "Sesi tidak ada pada jadwal plant.",
    en: "This session is not part of the plant schedule.",
    zh: "该场次不在工厂排程内。",
  },
  NETWORK_SAVE_NOT_CONFIGURED: {
    id: "Belum ada folder network save yang dikonfigurasi untuk aplikasi ini",
    en: "No network save folder is configured for this application",
    zh: "此应用尚未配置网络保存文件夹",
  },
  TARGET_ROOT_MISSING: {
    id: "Folder jaringan tidak ditemukan di app server. Periksa mount share.",
    en: "The network folder was not found on the app server. Check the share mount.",
    zh: "应用服务器上找不到网络文件夹，请检查共享挂载。",
  },
  INVALID_RELATIVE_PATH: {
    id: "Path tujuan tidak layak dipakai.",
    en: "The destination path is not valid.",
    zh: "目标路径无效。",
  },
  MEDIA_FETCH_FAILED: {
    id: "Gagal mengambil gambar dari edge device.",
    en: "The image could not be fetched from the edge device.",
    zh: "无法从边缘设备获取图像。",
  },
  WRITE_FAILED: {
    id: "Gagal menulis berkas ke folder jaringan.",
    en: "The file could not be written to the network folder.",
    zh: "无法将文件写入网络文件夹。",
  },
  SPOOL_FULL: {
    id: "Antrean kirim penuh. Hubungi Super Admin sebelum mengambil foto lagi.",
    en: "The send queue is full. Contact a Super Admin before capturing again.",
    zh: "发送队列已满，请联系超级管理员后再拍摄。",
  },
  INVALID_RANGE: {
    id: "Rentang tanggal tidak valid.",
    en: "The date range is not valid.",
    zh: "日期范围无效。",
  },
  PLATFORM_MISMATCH: {
    id: "Alamat folder jaringan di server berbentuk Windows, padahal servernya bukan Windows.",
    en: "The network folder address on the server is in Windows form, but the server is not Windows.",
    zh: "服务器上的网络文件夹地址为 Windows 形式，但服务器并非 Windows。",
  },
  SHARE_SYNC_FAILED: {
    id: "Gagal memindai folder jaringan.",
    en: "The network folder could not be scanned.",
    zh: "无法扫描网络文件夹。",
  },
  CAPTURE_RECORD_FAILED: {
    id: "Gagal menyimpan metadata capture ke registry.",
    en: "The capture metadata could not be saved to the registry.",
    zh: "无法将拍摄信息保存到登记表。",
  },
});

function messageForCode(code: string | null | undefined, serverText: string): Message | null {
  if (!code) return null;
  if (code === "CAPTURE_SCHEDULE_REJECTED") {
    const reason = /^([A-Z_]+):/.exec(serverText)?.[1];
    const key = reason === "INVALID_SESSION" ? "SCHEDULE_INVALID_SESSION" : reason;
    if (key && key in errorMessages) return errorMessages[key as keyof typeof errorMessages];
  }
  return code in errorMessages ? errorMessages[code as keyof typeof errorMessages] : null;
}

/**
 * Teks untuk sebuah kegagalan `{ code, message }` dari server function.
 *
 * Dalam bahasa Indonesia teks server dipakai apa adanya -- ia lebih rinci
 * (menyebut nama device, plant, sebab teknis). Dalam bahasa lain, kode yang
 * dikenal diterjemahkan; sisanya jatuh ke teks server, lalu ke `fallback`.
 */
export function failureText(
  t: Translator,
  failure: { code?: string | null; message?: string | null } | null | undefined,
  fallback?: Message,
): string {
  const serverText = failure?.message?.trim() ?? "";
  if (t === translateId && serverText) return serverText;
  const known = messageForCode(failure?.code, serverText);
  if (known) return t(known);
  return serverText || (fallback ? t(fallback) : "");
}
