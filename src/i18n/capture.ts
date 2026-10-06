import { defineMessages } from "@/lib/i18n";

// Teks halaman Capture (src/routes/capture.tsx).
//
// Catatan token nama berkas: pesan yang memuat `{MMMM}`, `{LOCATION}`, dan
// sejenisnya dengan HURUF BESAR sengaja dipanggil tanpa parameter, sehingga
// token itu tampil apa adanya di ketiga bahasa -- itu token pola nama berkas,
// bukan placeholder terjemahan.
export const captureMessages = defineMessages({
  // Jalur jadwal
  trackRegular: { id: "Sesi per 3 jam", en: "Session every 3 hours", zh: "每 3 小时一场" },
  trackTrial: {
    id: "Sesi per 2 jam (Trial)",
    en: "Session every 2 hours (Trial)",
    zh: "每 2 小时一场（试行）",
  },
  trackTabsLabel: { id: "Jalur sesi capture", en: "Capture session track", zh: "拍摄场次类别" },
  trialFolderNote: {
    id: "Foto jalur ini disimpan terpisah di folder {folder}.",
    en: "Photos on this track are saved separately in the {folder} folder.",
    zh: "此类别的照片单独保存在 {folder} 文件夹中。",
  },

  // Waktu relatif pada kartu runtime
  relativeNoData: { id: "Belum ada data", en: "No data yet", zh: "暂无数据" },
  relativeJustNow: { id: "Baru saja", en: "Just now", zh: "刚刚" },
  relativeMinutes: { id: "{count} menit lalu", en: "{count} min ago", zh: "{count} 分钟前" },
  relativeHours: { id: "{count} jam lalu", en: "{count} h ago", zh: "{count} 小时前" },
  relativeDays: { id: "{count} hari lalu", en: "{count} d ago", zh: "{count} 天前" },

  // Kegagalan dan status yang dibuat halaman ini
  scheduleLoadFailed: {
    id: "Gagal memuat jadwal capture. Muat ulang sebelum mengambil foto.",
    en: "The capture schedule could not be loaded. Reload before taking photos.",
    zh: "拍摄排程加载失败。请重新加载后再拍摄。",
  },
  operatorPlantLoadFailed: {
    id: "Gagal membaca penempatan akun. Muat ulang halaman sebelum memakai kamera.",
    en: "Your account placement could not be read. Reload the page before using the camera.",
    zh: "无法读取账号的工厂分配。请重新加载页面后再使用相机。",
  },
  captureFailed: { id: "Capture gagal", en: "Capture failed", zh: "拍摄失败" },
  captureNoImage: {
    id: "Capture berhasil, tetapi tidak ada gambar yang dikembalikan",
    en: "Capture succeeded, but no image was returned",
    zh: "拍摄成功，但未返回图像",
  },
  autofocusFailed: { id: "Autofocus gagal", en: "Autofocus failed", zh: "自动对焦失败" },
  focusDone: { id: "Fokus selesai", en: "Focus complete", zh: "对焦完成" },
  pickFolderFailed: {
    id: "Gagal memilih folder",
    en: "The folder could not be selected",
    zh: "选择文件夹失败",
  },
  folderReconnected: {
    id: "Folder {name} berhasil tersambung ulang",
    en: "Folder {name} reconnected",
    zh: "文件夹 {name} 已重新连接",
  },
  folderPermissionDenied: {
    id: "Izin folder ditolak, pilih ulang folder simpan",
    en: "Folder permission was denied, choose the save folder again",
    zh: "文件夹权限被拒绝，请重新选择保存文件夹",
  },
  folderPermissionNeeded: {
    id: "Izin folder diperlukan, klik Sambungkan ulang",
    en: "Folder permission is required, click Reconnect",
    zh: "需要文件夹权限，请点击“重新连接”",
  },
  networkSaveFailed: {
    id: "Network save dari app server gagal ({reason}) — mencoba jalur simpan fallback.",
    en: "Network save from the app server failed ({reason}) — trying the fallback save path.",
    zh: "应用服务器的网络保存失败（{reason}）——正在尝试备用保存方式。",
  },
  unknownError: { id: "error tidak diketahui", en: "unknown error", zh: "未知错误" },
  folderUnavailable: {
    id: "Folder jaringan tidak tersedia ({reason}) — hasil capture diunduh lokal sebagai gantinya. Pindahkan manual ke shared folder bila diperlukan.",
    en: "The network folder is not available ({reason}) — the capture was downloaded locally instead. Move it to the shared folder manually if needed.",
    zh: "网络文件夹不可用（{reason}）——拍摄结果已改为下载到本地。如有需要，请手动移动到共享文件夹。",
  },

  // Konfirmasi simpan (banner status dan toast)
  savedToNetwork: {
    id: "{slot} tersimpan ke folder jaringan",
    en: "{slot} saved to the network folder",
    zh: "{slot} 已保存到网络文件夹",
  },
  savedToNetworkStatus: {
    id: "{slot} tersimpan ke folder jaringan: {path}",
    en: "{slot} saved to the network folder: {path}",
    zh: "{slot} 已保存到网络文件夹：{path}",
  },
  savedOnServer: {
    id: "{slot} tersimpan di server, menunggu jaringan",
    en: "{slot} saved on the server, waiting for the network",
    zh: "{slot} 已保存在服务器，等待网络恢复",
  },
  savedOnServerStatus: {
    id: "{slot} tersimpan di server, menunggu jaringan ({count} foto dalam antrean)",
    en: "{slot} saved on the server, waiting for the network (photos in the send queue: {count})",
    zh: "{slot} 已保存在服务器，等待网络恢复（发送队列中有 {count} 张照片）",
  },
  savedOnServerDescription: {
    id: "Folder jaringan sedang tidak terjangkau. {count} foto menunggu dan akan terkirim sendiri begitu koneksinya pulih.",
    en: "The network folder cannot be reached right now. Photos waiting: {count}. They will be sent automatically once the connection is back.",
    zh: "网络文件夹暂时无法访问。有 {count} 张照片在等待，连接恢复后会自动发送。",
  },
  savedToBrowserFolder: {
    id: "{slot} tersimpan ke folder browser",
    en: "{slot} saved to the browser folder",
    zh: "{slot} 已保存到浏览器文件夹",
  },
  savedToBrowserFolderStatus: {
    id: "{slot} tersimpan ke folder browser: {path}",
    en: "{slot} saved to the browser folder: {path}",
    zh: "{slot} 已保存到浏览器文件夹：{path}",
  },
  notInNetworkFolderYet: {
    id: "{path} — belum masuk folder jaringan.",
    en: "{path} — not in the network folder yet.",
    zh: "{path}——尚未存入网络文件夹。",
  },
  downloadedLocally: {
    id: "{slot} diunduh lokal",
    en: "{slot} downloaded locally",
    zh: "{slot} 已下载到本地",
  },
  downloadedLocallyStatus: {
    id: "{slot} diunduh lokal: {filename} — belum masuk folder jaringan.",
    en: "{slot} downloaded locally: {filename} — not in the network folder yet.",
    zh: "{slot} 已下载到本地：{filename}——尚未存入网络文件夹。",
  },
  downloadedLocallyDescription: {
    id: "{filename} belum masuk folder jaringan. Pindahkan manual bila diperlukan.",
    en: "{filename} is not in the network folder yet. Move it manually if needed.",
    zh: "{filename} 尚未存入网络文件夹。如有需要，请手动移动。",
  },
  metadataNotRecorded: {
    id: "Metadata capture belum tercatat ke DB ({reason}).",
    en: "The capture metadata has not been recorded in the DB ({reason}).",
    zh: "拍摄信息尚未记录到数据库（{reason}）。",
  },
  metadataNotRecordedAfter: {
    id: "{previous}. Metadata capture belum tercatat ke DB ({reason}).",
    en: "{previous}. The capture metadata has not been recorded in the DB ({reason}).",
    zh: "{previous}。拍摄信息尚未记录到数据库（{reason}）。",
  },

  // Keterangan cadangan untuk describeCameraRuntimeIssue
  edgeUnreachableDetail: {
    id: "Aplikasi belum bisa menjangkau service kamera pada edge device.",
    en: "The application cannot reach the camera service on the edge device yet.",
    zh: "应用暂时无法连接边缘设备上的相机服务。",
  },
  cameraNotDetected: {
    id: "Kamera belum terdeteksi oleh edge node.",
    en: "The camera has not been detected by the edge node yet.",
    zh: "边缘节点尚未检测到相机。",
  },
  previewUnstableDetail: {
    id: "Kamera tersambung tetapi belum memberi preview yang stabil.",
    en: "The camera is connected but is not giving a stable preview yet.",
    zh: "相机已连接，但尚未提供稳定的预览。",
  },

  // Kartu runtime
  cardUsbCameraTitle: { id: "Camera USB", en: "USB camera", zh: "USB 相机" },
  cardSessionTitle: { id: "Session Lease", en: "Camera session", zh: "相机会话" },
  statusSyncing: { id: "Sinkronisasi", en: "Syncing", zh: "同步中" },
  statusConnected: { id: "Terhubung", en: "Connected", zh: "已连接" },
  statusOffline: { id: "Offline", en: "Offline", zh: "离线" },
  statusWaiting: { id: "Menunggu", en: "Waiting", zh: "等待中" },
  statusDisconnected: { id: "Terputus", en: "Disconnected", zh: "已断开" },
  statusConnecting: { id: "Menghubungkan", en: "Connecting", zh: "连接中" },
  statusActive: { id: "Aktif", en: "Active", zh: "活动中" },
  statusStopped: { id: "Berhenti", en: "Stopped", zh: "已停止" },
  edgeLoadingDetail: {
    id: "Status edge device sedang dimuat dari service kamera.",
    en: "The edge device status is being loaded from the camera service.",
    zh: "正在从相机服务加载边缘设备状态。",
  },
  connectionStatusDetail: {
    id: "Status koneksi: {state}.",
    en: "Connection status: {state}.",
    zh: "连接状态：{state}。",
  },
  edgeUnreachableShort: {
    id: "Aplikasi belum bisa menjangkau edge camera service.",
    en: "The application cannot reach the edge camera service yet.",
    zh: "应用暂时无法连接边缘相机服务。",
  },
  edgeLoadingHint: {
    id: "Tunggu sampai aplikasi selesai membaca status edge runtime.",
    en: "Wait until the application has finished reading the edge runtime status.",
    zh: "请等待应用读取完边缘设备的运行状态。",
  },
  edgeCheckHint: {
    id: "Periksa jaringan LAN dan status service edge device.",
    en: "Check the LAN and the edge device service status.",
    zh: "请检查局域网和边缘设备的服务状态。",
  },
  usbLoadingDetail: {
    id: "Deteksi kamera USB menunggu status edge pertama selesai dibaca.",
    en: "USB camera detection is waiting for the first edge status to be read.",
    zh: "USB 相机检测正在等待首次读取边缘状态。",
  },
  cameraFallbackName: { id: "Camera", en: "Camera", zh: "相机" },
  usbLoadingHint: {
    id: "Status kabel USB dan model kamera akan tampil setelah sinkronisasi awal.",
    en: "The USB cable status and camera model appear after the initial sync.",
    zh: "首次同步后将显示 USB 线缆状态和相机型号。",
  },
  serialHint: { id: "Serial: {serial}", en: "Serial: {serial}", zh: "序列号：{serial}" },
  notAvailable: { id: "tidak tersedia", en: "not available", zh: "不可用" },
  usbCheckHint: {
    id: "Pastikan kabel USB dan power kamera aktif.",
    en: "Make sure the USB cable is connected and the camera is powered on.",
    zh: "请确认 USB 线缆已接好且相机已开机。",
  },
  sessionSyncingDetail: {
    id: "Aplikasi sedang menyelaraskan status edge dan session awal.",
    en: "The application is syncing the edge status and the initial camera session.",
    zh: "应用正在同步边缘状态和初始相机会话。",
  },
  leaseRenewHint: {
    id: "Lease akan diperbarui otomatis selama tab aktif.",
    en: "The camera session is renewed automatically while this tab is active.",
    zh: "只要此标签页处于活动状态，相机会话就会自动续期。",
  },

  // Kepala halaman
  pageDescription: {
    id: "Ambil gambar dari kamera, lihat preview, lalu simpan ke folder pilihan dengan format nama file kustom.",
    en: "Capture images from the camera, check the preview, then save them to the chosen folder with a custom file name format.",
    zh: "从相机拍摄图像，查看预览，然后按自定义文件名格式保存到所选文件夹。",
  },
  location: { id: "Lokasi", en: "Location", zh: "位置" },
  plantLockedTitle: {
    id: "Akun Anda terpasang di plant ini",
    en: "Your account is assigned to this plant",
    zh: "您的账号已分配到该工厂",
  },
  session: { id: "Sesi", en: "Session", zh: "场次" },
  noOpenSession: { id: "Tidak ada sesi terbuka", en: "No open session", zh: "没有开放的场次" },

  // Banner
  browserFolderBanner: {
    id: "Folder simpan di browser belum dipilih. Ini cuma cadangan — dipakai kalau folder jaringan sedang tidak bisa diakses. Tanpa folder ini, capture yang gagal masuk jaringan akan diunduh ke folder `Downloads` dan harus dipindahkan manual.",
    en: "No browser save folder has been chosen. It is only a backup — used when the network folder cannot be accessed. Without it, captures that fail to reach the network are downloaded to the `Downloads` folder and must be moved manually.",
    zh: "尚未选择浏览器保存文件夹。它只是备用——在网络文件夹无法访问时使用。没有它，未能存入网络的拍摄结果会下载到 `Downloads` 文件夹，需要手动移动。",
  },
  chooseFolder: { id: "Pilih folder", en: "Choose folder", zh: "选择文件夹" },
  cameraAsleepWithState: {
    id: "Kamera tidak merespons ({state}). Kamera Canon kemungkinan sleep. Bangunkan kamera dengan half-press shutter atau power-cycle; capture dijeda sampai koneksi kembali stabil.",
    en: "The camera is not responding ({state}). The Canon camera is probably asleep. Wake it with a half-press of the shutter or a power cycle; capture is paused until the connection is stable again.",
    zh: "相机无响应（{state}）。Canon 相机可能已休眠。请半按快门或重新开关机唤醒相机；连接恢复稳定前暂停拍摄。",
  },
  // Spasi sebelum titik pertama pada teks Indonesia memang begitu di tampilan
  // aslinya (keterangan state-nya kosong); dipertahankan apa adanya.
  cameraAsleepNoState: {
    id: "Kamera tidak merespons . Kamera Canon kemungkinan sleep. Bangunkan kamera dengan half-press shutter atau power-cycle; capture dijeda sampai koneksi kembali stabil.",
    en: "The camera is not responding. The Canon camera is probably asleep. Wake it with a half-press of the shutter or a power cycle; capture is paused until the connection is stable again.",
    zh: "相机无响应。Canon 相机可能已休眠。请半按快门或重新开关机唤醒相机；连接恢复稳定前暂停拍摄。",
  },

  // Panel runtime
  runtimeHeading: { id: "Runtime Kamera", en: "Camera Runtime", zh: "相机运行状态" },
  runtimeSyncingTitle: {
    id: "Menyelaraskan status kamera",
    en: "Syncing camera status",
    zh: "正在同步相机状态",
  },
  runtimeDescription: {
    id: "Status ini membantu operator membedakan masalah edge API, koneksi kamera USB, dan lease session sebelum menjalankan capture.",
    en: "This status helps the operator tell apart Edge API problems, the USB camera connection and the camera session before capturing.",
    zh: "此状态帮助操作员在拍摄前区分 Edge API 问题、USB 相机连接问题和相机会话问题。",
  },
  actionHintLabel: { id: "Hint tindakan", en: "Action hint", zh: "操作提示" },
  nextActionsHeading: { id: "Tindakan Berikutnya", en: "Next Actions", zh: "后续操作" },
  runtimeLoadingNote: {
    id: "Aplikasi sedang memuat status edge device dan mencoba menyelaraskan session kamera.",
    en: "The application is loading the edge device status and trying to sync the camera session.",
    zh: "应用正在加载边缘设备状态并尝试同步相机会话。",
  },
  noBlockerNote: {
    id: "Session, edge API, dan kamera tidak menunjukkan blocker utama saat ini.",
    en: "The camera session, Edge API and camera show no major blocker right now.",
    zh: "相机会话、Edge API 和相机目前没有明显的阻碍。",
  },

  // Panel slot
  toneCaptured: { id: "Sudah dicapture", en: "Captured", zh: "已拍摄" },
  toneCameraOff: { id: "Kamera Off", en: "Camera off", zh: "相机关闭" },
  toneCameraSleep: { id: "Kamera sleep", en: "Camera asleep", zh: "相机休眠" },
  toneLive: { id: "Live", en: "Live", zh: "实时" },
  captureResultAlt: {
    id: "{slot} hasil capture",
    en: "{slot} capture result",
    zh: "{slot} 拍摄结果",
  },
  captureResultBadge: { id: "Hasil capture", en: "Capture result", zh: "拍摄结果" },
  livePreviewAlt: { id: "{slot} preview live", en: "{slot} live preview", zh: "{slot} 实时预览" },
  connectingToCamera: {
    id: "Menghubungkan ke kamera…",
    en: "Connecting to the camera…",
    zh: "正在连接相机…",
  },
  cameraNotResponding: {
    id: "Kamera tidak merespons…",
    en: "The camera is not responding…",
    zh: "相机无响应…",
  },
  cameraNotActive: { id: "Kamera belum aktif", en: "The camera is not on yet", zh: "相机尚未启动" },
  waitingForPreview: {
    id: "Menunggu preview…",
    en: "Waiting for the preview…",
    zh: "正在等待预览…",
  },
  livePreviewOffNote: {
    id: "Live preview mati — capture tetap bisa dijalankan",
    en: "Live preview is off — capture still works",
    zh: "实时预览已关闭——仍可拍摄",
  },
  frozenCapture: { id: "Capture dibekukan", en: "Capture frozen", zh: "拍摄画面已定格" },
  noSignal: { id: "Tidak ada sinyal", en: "No signal", zh: "无信号" },
  previewLive: { id: "Preview langsung", en: "Live preview", zh: "实时预览" },
  previewOff: { id: "Preview mati", en: "Preview off", zh: "预览已关闭" },
  savingToNetwork: {
    id: "Menyimpan ke folder jaringan…",
    en: "Saving to the network folder…",
    zh: "正在保存到网络文件夹…",
  },
  notInNetworkFolder: {
    id: "Belum masuk folder jaringan",
    en: "Not in the network folder yet",
    zh: "尚未存入网络文件夹",
  },
  saving: { id: "Menyimpan…", en: "Saving…", zh: "正在保存…" },
  capturing: { id: "Mengambil…", en: "Capturing…", zh: "正在拍摄…" },
  retakeSlot: { id: "Ambil ulang {slot}", en: "Retake {slot}", zh: "重拍 {slot}" },
  captureSlot: { id: "Capture {slot}", en: "Capture {slot}", zh: "拍摄 {slot}" },

  // Kontrol kamera
  waitingTurn: {
    id: "Kamera sedang dipakai station lain, menunggu giliran untuk terhubung…",
    en: "The camera is in use by another station, waiting for a turn to connect…",
    zh: "相机正被其他工位使用，正在等待连接…",
  },
  stopWaiting: { id: "Hentikan tunggu", en: "Stop waiting", zh: "停止等待" },
  connecting: { id: "Menghubungkan…", en: "Connecting…", zh: "正在连接…" },
  startCamera: { id: "Mulai kamera", en: "Start camera", zh: "启动相机" },
  stopSession: { id: "Hentikan session", en: "Stop camera session", zh: "停止相机会话" },
  livePreviewOffTitle: {
    id: "Matikan preview agar kamera tidak bekerja terus-menerus",
    en: "Turn the preview off so the camera does not keep working",
    zh: "关闭预览，避免相机持续工作",
  },
  livePreviewOnTitle: {
    id: "Nyalakan preview untuk melihat framing sebelum capture",
    en: "Turn the preview on to check the framing before capturing",
    zh: "开启预览，在拍摄前查看取景",
  },
  livePreviewTurnOff: {
    id: "Matikan Live Preview",
    en: "Turn Off Live Preview",
    zh: "关闭实时预览",
  },
  livePreview: { id: "Live Preview", en: "Live Preview", zh: "实时预览" },
  oneFrameTitle: {
    id: "Ambil satu frame preview tanpa menyalakan polling terus-menerus",
    en: "Fetch a single preview frame without turning on continuous polling",
    zh: "获取一帧预览，无需开启持续轮询",
  },
  fetchingFrame: { id: "Mengambil…", en: "Fetching…", zh: "正在获取…" },
  oneFrame: { id: "Ambil 1 frame", en: "Fetch 1 frame", zh: "获取 1 帧" },
  focusing: { id: "Memfokuskan…", en: "Focusing…", zh: "正在对焦…" },
  autofocus: { id: "Autofocus", en: "Autofocus", zh: "自动对焦" },

  // Pengaturan Simpan (hanya admin)
  saveSettingsHeading: { id: "Pengaturan Simpan", en: "Save Settings", zh: "保存设置" },
  saveFolderLabel: {
    id: "Folder simpan (Shared Folder)",
    en: "Save folder (Shared Folder)",
    zh: "保存文件夹（共享文件夹）",
  },
  changeFolder: { id: "Ganti folder", en: "Change folder", zh: "更换文件夹" },
  reconnect: { id: "Sambungkan ulang", en: "Reconnect", zh: "重新连接" },
  forget: { id: "Lupakan", en: "Forget", zh: "忘记" },
  folderPermissionRequired: {
    id: "{name} (izin diperlukan)",
    en: "{name} (permission required)",
    zh: "{name}（需要权限）",
  },
  folderRemembered: { id: "{name} · diingat", en: "{name} · remembered", zh: "{name} · 已记住" },
  fsUnsupported: {
    id: "Tidak didukung — akan diunduh",
    en: "Not supported — files will be downloaded",
    zh: "不支持——将改为下载",
  },
  noFolderChosen: {
    id: "Belum ada folder dipilih",
    en: "No folder chosen yet",
    zh: "尚未选择文件夹",
  },
  folderHelp: {
    id: "Jika aplikasi ini sudah punya folder simpan jaringan yang dikonfigurasi, setiap capture akan otomatis disimpan ke sana sehingga folder di sini tidak wajib dipilih. Picker ini adalah fallback saat path tersebut belum tersedia: pilih folder, misalnya network share seperti {path}, lalu gambar akan dikirim ke sana dengan subfolder Tahun/Bulan/Hari yang sama, misalnya `2026/07/18`. Browser hanya menampilkan nama folder, bukan path jaringan penuh. Jika semua jalur simpan gagal diakses, hasil capture akan diunduh lokal agar tidak hilang.",
    en: "If this application already has a configured network save folder, every capture is saved there automatically, so choosing a folder here is optional. This picker is the fallback for when that path is not available: choose a folder, for example a network share such as {path}, and images are sent there with the same Year/Month/Day subfolders, for example `2026/07/18`. The browser only shows the folder name, not the full network path. If every save path fails, the capture is downloaded locally so that it is not lost.",
    zh: "如果此应用已配置网络保存文件夹，每次拍摄都会自动保存到那里，因此这里的文件夹不是必选项。此选择器是该路径不可用时的备用方式：选择一个文件夹，例如 {path} 这样的网络共享，图像就会发送到那里，并使用相同的 年/月/日 子文件夹，例如 `2026/07/18`。浏览器只显示文件夹名称，不显示完整的网络路径。如果所有保存方式都无法访问，拍摄结果会下载到本地，以免丢失。",
  },
  plantLockedHelp: {
    id: "Akun Anda terpasang di {plant}, jadi lokasinya tidak bisa diubah dari sini.",
    en: "Your account is assigned to {plant}, so the location cannot be changed here.",
    zh: "您的账号已分配到 {plant}，因此无法在此更改位置。",
  },
  locationHelp: {
    id: "Menentukan capture ini berasal dari plant yang mana.",
    en: "Sets which plant this capture comes from.",
    zh: "指定本次拍摄来自哪个工厂。",
  },
  source: { id: "Sumber", en: "Source", zh: "来源" },
  sourceHelp: {
    id: "Ditentukan otomatis dari tombol Capture BIN yang dipakai.",
    en: "Set automatically from the Capture BIN button that is used.",
    zh: "根据所使用的“拍摄 BIN”按钮自动确定。",
  },
  fileFormat: { id: "Format file", en: "File format", zh: "文件格式" },
  fileFormatHelp: {
    id: "Disimpan langsung dari kamera sebagai JPEG (`.jpg`).",
    en: "Saved straight from the camera as JPEG (`.jpg`).",
    zh: "直接从相机保存为 JPEG（`.jpg`）。",
  },
  fileNameFormat: { id: "Format nama file", en: "File name format", zh: "文件名格式" },
  tokensLine: { id: "Tokens: {tokens}", en: "Tokens: {tokens}", zh: "可用标记：{tokens}" },
  tokensLegend: {
    id: "{MMMM} = nama bulan lengkap (July), {LOCATION} = kode plant (AP / CP)",
    en: "{MMMM} = full month name (July), {LOCATION} = plant code (AP / CP)",
    zh: "{MMMM} = 完整月份名称（July），{LOCATION} = 工厂代码（AP / CP）",
  },
  exampleLine: { id: "Contoh: {example}", en: "Example: {example}", zh: "示例：{example}" },
  imageIndex: { id: "Indeks gambar", en: "Image index", zh: "图像序号" },
  resetIndexTitle: { id: "Reset ke 001", en: "Reset to 001", zh: "重置为 001" },
  reset: { id: "Reset", en: "Reset", zh: "重置" },
  imageIndexHelp: {
    id: "Bertambah otomatis setelah setiap capture.",
    en: "Increases automatically after every capture.",
    zh: "每次拍摄后自动递增。",
  },
  nextFileLine: {
    id: "File berikutnya akan disimpan sebagai: {filename}",
    en: "The next file will be saved as: {filename}",
    zh: "下一个文件将保存为：{filename}",
  },
});

// Teks dari src/lib/camera-runtime.ts: judul, keterangan, dan saran tindakan
// untuk keadaan runtime kamera.
export const cameraRuntimeMessages = defineMessages({
  unreachableTitle: {
    id: "Edge API tidak terhubung",
    en: "Edge API not connected",
    zh: "Edge API 未连接",
  },
  unreachableDetail: {
    id: "Aplikasi tidak bisa menjangkau service kamera pada edge device.",
    en: "The application cannot reach the camera service on the edge device.",
    zh: "应用无法连接边缘设备上的相机服务。",
  },
  unreachableAction: {
    id: "Periksa koneksi jaringan, status Mini PC, dan service edge camera API.",
    en: "Check the network connection, the Mini PC status and the edge camera API service.",
    zh: "请检查网络连接、迷你电脑状态和边缘相机 API 服务。",
  },
  conflictTitle: {
    id: "Kamera sedang dipakai station lain",
    en: "The camera is in use by another station",
    zh: "相机正被其他工位使用",
  },
  conflictDetail: {
    id: "Session kamera masih dikunci client lain.",
    en: "The camera session is still locked by another client.",
    zh: "相机会话仍被另一个客户端锁定。",
  },
  conflictAction: {
    id: "Tunggu station lain selesai, lalu hubungkan ulang dari halaman Capture.",
    en: "Wait for the other station to finish, then reconnect from the Capture page.",
    zh: "请等待其他工位使用完毕，然后在“拍摄”页面重新连接。",
  },
  sessionLostTitle: {
    id: "Session kamera terputus",
    en: "Camera session disconnected",
    zh: "相机会话已断开",
  },
  sessionLostDetail: {
    id: "Lease session hilang atau kedaluwarsa saat operator masih aktif.",
    en: "The camera session was lost or expired while the operator was still active.",
    zh: "操作员仍在使用时，相机会话已丢失或过期。",
  },
  sessionLostAction: {
    id: "Biarkan aplikasi mencoba reconnect otomatis, atau klik Start camera bila perlu.",
    en: "Let the application reconnect automatically, or click Start camera if needed.",
    zh: "请等待应用自动重新连接，必要时点击“启动相机”。",
  },
  cameraDisconnectedTitle: {
    id: "Kamera USB tidak terdeteksi",
    en: "USB camera not detected",
    zh: "未检测到 USB 相机",
  },
  cameraDisconnectedDetail: {
    id: "Edge device online, tetapi kamera tidak terbaca.",
    en: "The edge device is online, but the camera cannot be read.",
    zh: "边缘设备在线，但读取不到相机。",
  },
  cameraDisconnectedAction: {
    id: "Cek kabel USB, power kamera, lalu tunggu status kamera kembali ready.",
    en: "Check the USB cable and the camera power, then wait for the camera status to return to ready.",
    zh: "请检查 USB 线缆和相机电源，然后等待相机状态恢复为 ready。",
  },
  previewUnavailableTitle: {
    id: "Preview kamera belum tersedia",
    en: "Camera preview not available yet",
    zh: "相机预览暂不可用",
  },
  previewUnavailableDetail: {
    id: "Frame preview tidak bisa diambil untuk sementara.",
    en: "A preview frame cannot be fetched for the moment.",
    zh: "暂时无法获取预览帧。",
  },
  previewUnavailableAction: {
    id: "Tunggu beberapa detik atau restart sesi kamera bila preview tetap kosong.",
    en: "Wait a few seconds, or restart the camera session if the preview stays empty.",
    zh: "请等待几秒；如果预览仍为空，请重新启动相机会话。",
  },
  requestFailedTitle: {
    id: "Permintaan ke kamera gagal",
    en: "Camera request failed",
    zh: "相机请求失败",
  },
  requestFailedDetail: {
    id: "Edge API merespons dengan kegagalan saat memproses operasi kamera.",
    en: "The Edge API responded with a failure while processing the camera operation.",
    zh: "Edge API 在处理相机操作时返回了失败。",
  },
  requestFailedAction: {
    id: "Periksa detail error dari edge API dan ulangi operasi setelah status perangkat normal.",
    en: "Check the error details from the Edge API and repeat the operation once the device status is normal.",
    zh: "请查看 Edge API 返回的错误详情，待设备状态正常后重试。",
  },
  unknownTitle: {
    id: "Status runtime perlu perhatian",
    en: "Runtime status needs attention",
    zh: "运行状态需要关注",
  },
  unknownDetail: {
    id: "Terjadi kondisi runtime yang belum berhasil dipetakan secara spesifik.",
    en: "A runtime condition occurred that could not be identified specifically.",
    zh: "出现了尚无法具体识别的运行状况。",
  },
  unknownAction: {
    id: "Periksa status edge, koneksi kamera, dan ulangi operasi setelah kondisi stabil.",
    en: "Check the edge status and the camera connection, then repeat the operation once things are stable.",
    zh: "请检查边缘状态和相机连接，待情况稳定后重试。",
  },

  hintOperationRunning: {
    id: "Tunggu operasi kamera yang sedang berjalan selesai lebih dulu.",
    en: "Wait for the camera operation in progress to finish first.",
    zh: "请先等待正在进行的相机操作完成。",
  },
  hintSessionStarting: {
    id: "Aplikasi sedang membuat session kamera ke edge device.",
    en: "The application is creating a camera session with the edge device.",
    zh: "应用正在与边缘设备建立相机会话。",
  },
  hintEdgeOffline: {
    id: "Edge API belum terhubung, jadi capture belum bisa dimulai.",
    en: "The Edge API is not connected yet, so capture cannot start.",
    zh: "Edge API 尚未连接，暂时无法拍摄。",
  },
  hintCameraUnplugged: {
    id: "Hubungkan kamera USB ke edge device sebelum capture atau autofocus.",
    en: "Connect the USB camera to the edge device before capturing or using autofocus.",
    zh: "拍摄或自动对焦前，请先将 USB 相机连接到边缘设备。",
  },
  hintWaiting: {
    id: "Kamera masih dipakai station lain; tunggu lease dilepas lalu coba lagi.",
    en: "The camera is still in use by another station; wait for its camera session to be released, then try again.",
    zh: "相机仍被其他工位使用；请等待其相机会话释放后再试。",
  },
  hintStartSession: {
    id: "Klik Start camera untuk membuat session aktif terlebih dahulu.",
    en: "Click Start camera to create an active camera session first.",
    zh: "请先点击“启动相机”建立相机会话。",
  },
  hintWakeCamera: {
    id: "Bangunkan kamera atau stabilkan koneksi sampai status edge kembali siap.",
    en: "Wake the camera or stabilise the connection until the edge status is ready again.",
    zh: "请唤醒相机或稳定连接，直到边缘状态恢复就绪。",
  },
  hintReady: {
    id: "Kamera siap dipakai untuk capture dan autofocus.",
    en: "The camera is ready for capture and autofocus.",
    zh: "相机已就绪，可以拍摄和自动对焦。",
  },

  actionEdgeOffline: {
    id: "Pastikan Mini PC edge menyala dan service camera API dapat dijangkau dari aplikasi.",
    en: "Make sure the edge Mini PC is on and the camera API service can be reached from the application.",
    zh: "请确认边缘迷你电脑已开机，且应用可以访问相机 API 服务。",
  },
  actionCheckUsb: {
    id: "Periksa kabel USB, power kamera, dan enumerasi device pada edge node.",
    en: "Check the USB cable, the camera power and device enumeration on the edge node.",
    zh: "请检查 USB 线缆、相机电源以及边缘节点上的设备枚举。",
  },
  actionWaitStation: {
    id: "Tunggu station lain selesai memakai kamera, atau batalkan lalu coba lagi nanti.",
    en: "Wait for the other station to finish using the camera, or cancel and try again later.",
    zh: "请等待其他工位用完相机，或取消后稍后再试。",
  },
  actionLetConnect: {
    id: "Biarkan proses connect selesai sebelum menjalankan operasi lain.",
    en: "Let the connection finish before running another operation.",
    zh: "请等待连接完成后再执行其他操作。",
  },
  actionWakeCamera: {
    id: "Bangunkan kamera dengan half-press shutter atau power-cycle bila tetap sleep.",
    en: "Wake the camera with a half-press of the shutter, or power-cycle it if it stays asleep.",
    zh: "请半按快门唤醒相机；如果仍在休眠，请重新开关机。",
  },
  actionEdgeError: {
    id: "Koneksi edge berada pada status error; refresh session atau restart service edge camera.",
    en: "The edge connection is in an error state; refresh the camera session or restart the edge camera service.",
    zh: "边缘连接处于错误状态；请刷新相机会话或重启边缘相机服务。",
  },
  actionStartCamera: {
    id: "Klik Start camera untuk membuka session baru sebelum mengambil gambar.",
    en: "Click Start camera to open a new camera session before taking a picture.",
    zh: "拍摄前请点击“启动相机”建立新的相机会话。",
  },
  actionWaitOperation: {
    id: "Tunggu proses capture/autofocus aktif selesai agar state kamera kembali idle.",
    en: "Wait for the running capture/autofocus to finish so the camera returns to idle.",
    zh: "请等待当前的拍摄/自动对焦完成，使相机恢复空闲。",
  },
  actionStable: {
    id: "Runtime kamera terlihat stabil. Operator bisa lanjut capture atau autofocus.",
    en: "The camera runtime looks stable. The operator can go on to capture or autofocus.",
    zh: "相机运行稳定。操作员可以继续拍摄或自动对焦。",
  },

  summaryWaitingTitle: {
    id: "Menunggu kamera tersedia",
    en: "Waiting for the camera to be available",
    zh: "正在等待相机可用",
  },
  summaryWaitingDetail: {
    id: "Kamera sedang dipakai station lain, jadi session baru belum bisa diambil.",
    en: "The camera is in use by another station, so a new camera session cannot be obtained yet.",
    zh: "相机正被其他工位使用，暂时无法建立新的相机会话。",
  },
  summaryStartingTitle: {
    id: "Sedang menghubungkan session kamera",
    en: "Connecting the camera session",
    zh: "正在连接相机会话",
  },
  summaryStartingDetail: {
    id: "Aplikasi sedang membuat session baru ke edge device.",
    en: "The application is creating a new camera session with the edge device.",
    zh: "应用正在与边缘设备建立新的相机会话。",
  },
  summaryNoSessionTitle: {
    id: "Belum ada session aktif",
    en: "No active camera session yet",
    zh: "尚无活动的相机会话",
  },
  summaryNoSessionDetail: {
    id: "Operator perlu memulai session sebelum capture atau autofocus bisa dijalankan.",
    en: "The operator needs to start a camera session before capture or autofocus can run.",
    zh: "操作员需要先启动相机会话，才能拍摄或自动对焦。",
  },
  summaryEdgeUnstableTitle: {
    id: "Session aktif, edge belum stabil",
    en: "Camera session active, edge not stable yet",
    zh: "相机会话已建立，边缘尚不稳定",
  },
  summaryEdgeUnstableDetail: {
    id: "Session sudah ada, tetapi edge API belum terbaca stabil oleh aplikasi.",
    en: "The camera session exists, but the application cannot read the Edge API reliably yet.",
    zh: "相机会话已存在，但应用尚无法稳定读取 Edge API。",
  },
  summaryUsbMissingTitle: {
    id: "Session aktif, kamera USB belum terdeteksi",
    en: "Camera session active, USB camera not detected yet",
    zh: "相机会话已建立，尚未检测到 USB 相机",
  },
  summaryUsbMissingDetail: {
    id: "Session sudah ada, tetapi kamera fisik belum terbaca oleh edge node.",
    en: "The camera session exists, but the edge node cannot read the physical camera yet.",
    zh: "相机会话已存在，但边缘节点尚未读取到实体相机。",
  },
  summaryNotReadyTitle: {
    id: "Session aktif, kamera belum siap",
    en: "Camera session active, camera not ready yet",
    zh: "相机会话已建立，相机尚未就绪",
  },
  summaryNotReadyDetail: {
    id: "Koneksi kamera masih berada pada state {state}.",
    en: "The camera connection is still in the {state} state.",
    zh: "相机连接仍处于 {state} 状态。",
  },
  summaryReadyTitle: {
    id: "Session aktif dan siap dipakai",
    en: "Camera session active and ready to use",
    zh: "相机会话已建立，可以使用",
  },
  summaryReadyDetail: {
    id: "Preview, autofocus, dan capture bisa dijalankan dari halaman ini.",
    en: "Preview, autofocus and capture can be run from this page.",
    zh: "可在此页面进行预览、自动对焦和拍摄。",
  },
});

// Teks dari src/hooks/use-capture-camera-session.ts: daur hidup session kamera.
export const cameraSessionMessages = defineMessages({
  deviceLookupFailed: {
    id: "Gagal membaca penempatan kamera. Muat ulang halaman untuk mencoba lagi.",
    en: "The camera placement could not be read. Reload the page to try again.",
    zh: "无法读取相机的分配信息。请重新加载页面后重试。",
  },
  sessionInvalid: {
    id: "Session kamera tidak lagi valid.",
    en: "The camera session is no longer valid.",
    zh: "相机会话已失效。",
  },
  sessionLostReconnecting: {
    id: "Session kamera terputus, mencoba menyambung ulang…",
    en: "The camera session was disconnected, trying to reconnect…",
    zh: "相机会话已断开，正在尝试重新连接…",
  },
  sessionEndedReconnecting: {
    id: "Session kamera berakhir, mencoba menyambung ulang…",
    en: "The camera session ended, trying to reconnect…",
    zh: "相机会话已结束，正在尝试重新连接…",
  },
  serviceUnreachable: {
    id: "Gagal menjangkau service kamera",
    en: "The camera service could not be reached",
    zh: "无法连接相机服务",
  },
  sessionConnected: {
    id: "Session kamera terhubung",
    en: "Camera session connected",
    zh: "相机会话已连接",
  },
  sessionAcquiredWaiting: {
    id: "Session kamera didapatkan, menunggu kamera siap",
    en: "Camera session obtained, waiting for the camera to be ready",
    zh: "已获得相机会话，正在等待相机就绪",
  },
  sessionStopped: {
    id: "Session kamera dihentikan",
    en: "Camera session stopped",
    zh: "相机会话已停止",
  },
  sessionInvalidRestart: {
    id: "Session kamera tidak lagi valid. Mulai ulang kamera.",
    en: "The camera session is no longer valid. Start the camera again.",
    zh: "相机会话已失效。请重新启动相机。",
  },
  previewFrameFailed: {
    id: "Gagal mengambil frame preview",
    en: "The preview frame could not be fetched",
    zh: "获取预览帧失败",
  },
});

// Teks dari analyzeFilenamePattern() di src/lib/capture-prefs.ts. Token pola
// (`{LOCATION}`, `{SLOT}`, ...) ditulis apa adanya; lihat catatan di atas.
export const capturePrefsMessages = defineMessages({
  patternEmpty: {
    id: "Filename pattern tidak boleh kosong.",
    en: "The file name pattern cannot be empty.",
    zh: "文件名格式不能为空。",
  },
  unknownTokens: {
    id: "Token tidak dikenal: {tokens}.",
    en: "Unknown tokens: {tokens}.",
    zh: "无法识别的标记：{tokens}。",
  },
  noDynamicToken: {
    id: "Pattern ini tidak memakai token dinamis; semua file akan mulai dari nama dasar yang sama.",
    en: "This pattern uses no dynamic token; every file will start from the same base name.",
    zh: "此格式未使用动态标记；所有文件都将以相同的基本名称开头。",
  },
  suggestLocation: {
    id: "Tambahkan `{LOCATION}` agar file mudah diaudit per plant.",
    en: "Add `{LOCATION}` so files are easy to audit per plant.",
    zh: "添加 `{LOCATION}`，便于按工厂审计文件。",
  },
  suggestSlot: {
    id: "Tambahkan `{SLOT}` agar operator bisa membedakan kedua slot capture dari nama file.",
    en: "Add `{SLOT}` so the operator can tell the two capture slots apart by file name.",
    zh: "添加 `{SLOT}`，让操作员能从文件名区分两个拍摄槽位。",
  },
  overwriteWarning: {
    id: "Capture ulang pada sesi dan slot yang sama akan MENIMPA berkas sebelumnya di folder tujuan. Waktu capture setiap percobaan tetap tercatat di registry.",
    en: "Capturing again for the same session and slot will OVERWRITE the previous file in the destination folder. The capture time of every attempt is still recorded in the registry.",
    zh: "同一场次、同一槽位再次拍摄会覆盖目标文件夹中的上一个文件。每次拍摄的时间仍会记录在登记表中。",
  },
  duplicateWarning: {
    id: "Pattern ini berisiko menghasilkan nama ganda untuk capture yang berdekatan; aplikasi akan menambahkan suffix seperti `(2)` bila perlu.",
    en: "This pattern risks producing duplicate names for captures taken close together; the application adds a suffix such as `(2)` when needed.",
    zh: "此格式可能使相邻的拍摄产生重名；必要时应用会添加 `(2)` 之类的后缀。",
  },
  suggestUnique: {
    id: "Tambahkan `{INDEX}`, `{ss}`, atau `{TS}` jika ingin nama file lebih unik tanpa suffix tambahan.",
    en: "Add `{INDEX}`, `{ss}` or `{TS}` if you want more unique file names without an extra suffix.",
    zh: "如果希望文件名更唯一且不带额外后缀，请添加 `{INDEX}`、`{ss}` 或 `{TS}`。",
  },
});
