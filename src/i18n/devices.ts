import { defineMessages } from "@/lib/i18n";

// Halaman Devices adalah halaman terbesar di aplikasi, jadi kamusnya dipecah
// per bagian: kerangka halaman + tab Ringkasan, tab Log, tab Pengaturan Kamera
// (beserta Konfigurasi), komponen preset, dan telemetri host.

/** Kerangka halaman Devices, kartu device, tab Ringkasan, dialog, dan toast umum. */
export const devicesMessages = defineMessages({
  // Tab
  tabOverview: { id: "Ringkasan", en: "Overview", zh: "概览" },
  tabCameraSettings: { id: "Pengaturan Kamera", en: "Camera Settings", zh: "相机设置" },
  tabHealth: { id: "Kesehatan & Status", en: "Health & Status", zh: "健康与状态" },
  tabLogs: { id: "Log", en: "Log", zh: "日志" },
  tabConfiguration: { id: "Konfigurasi", en: "Configuration", zh: "配置" },
  tabFallback: { id: "Koneksi Cadangan", en: "Backup Connection", zh: "备用连接" },

  // Waktu relatif
  relNoData: { id: "Belum ada data", en: "No data yet", zh: "暂无数据" },
  relJustNow: { id: "Baru saja", en: "just now", zh: "刚刚" },
  relMinutesAgo: { id: "{count} menit lalu", en: "{count} min ago", zh: "{count} 分钟前" },
  relHoursAgo: { id: "{count} jam lalu", en: "{count} h ago", zh: "{count} 小时前" },
  relDaysAgo: { id: "{count} hari lalu", en: "{count} d ago", zh: "{count} 天前" },
  justNowLower: { id: "baru saja", en: "just now", zh: "刚刚" },

  // Umum
  notAvailableYet: { id: "Belum tersedia", en: "Not available yet", zh: "暂不可用" },
  notAvailable: { id: "Tidak tersedia", en: "Not available", zh: "不可用" },
  loadingEllipsis: { id: "Memuat...", en: "Loading...", zh: "加载中…" },
  loadFailedShort: { id: "Gagal dimuat", en: "Failed to load", zh: "加载失败" },
  tryAgainShort: { id: "Coba lagi.", en: "Try again.", zh: "请重试。" },
  cancel: { id: "Batal", en: "Cancel", zh: "取消" },
  saving: { id: "Menyimpan...", en: "Saving...", zh: "正在保存…" },
  confirm: { id: "Konfirmasi", en: "Confirm", zh: "确认" },
  registerDevice: { id: "Daftarkan Device", en: "Register Device", zh: "登记设备" },

  // Status koneksi
  statusConnected: { id: "Terhubung", en: "Connected", zh: "已连接" },
  statusNotConnected: { id: "Tidak terhubung", en: "Not connected", zh: "未连接" },
  statusDisconnected: { id: "Terputus", en: "Disconnected", zh: "已断开" },
  statusOffline: { id: "Offline", en: "Offline", zh: "离线" },
  statusNotChecked: { id: "Tidak diperiksa", en: "Not checked", zh: "未检查" },
  notConnectedYet: { id: "Belum terhubung", en: "Not connected yet", zh: "尚未连接" },
  usbConnected: { id: "USB terhubung", en: "USB connected", zh: "USB 已连接" },
  deviceNotConnected: {
    id: "Device tidak terhubung",
    en: "Device not connected",
    zh: "设备未连接",
  },
  cameraNotConnected: {
    id: "Kamera tidak terhubung",
    en: "Camera not connected",
    zh: "相机未连接",
  },
  notReportedByCamera: {
    id: "Tidak dilaporkan kamera",
    en: "Not reported by the camera",
    zh: "相机未提供",
  },
  unknownModel: { id: "Model tidak diketahui", en: "Unknown model", zh: "未知型号" },
  notDetectedYet: { id: "Belum terdeteksi", en: "Not detected yet", zh: "尚未检测到" },
  unknownDevice: { id: "Device tidak dikenal", en: "Unknown device", zh: "未知设备" },

  // Kegagalan memuat
  statusLoadFailed: {
    id: "Status gagal dimuat.",
    en: "The status failed to load.",
    zh: "状态加载失败。",
  },
  registryLoadFailed: {
    id: "Registry gagal dimuat.",
    en: "The registry failed to load.",
    zh: "登记表加载失败。",
  },

  // Toast registry / profil
  toastRegistryStateUpdated: {
    id: "Status registry device diperbarui",
    en: "Device registry status updated",
    zh: "设备登记状态已更新",
  },
  toastChangeFailed: { id: "Perubahan gagal", en: "Change failed", zh: "更改失败" },
  toastProfileSaved: {
    id: "Profil tersimpan di database",
    en: "Profile saved to the database",
    zh: "配置文件已保存到数据库",
  },
  toastProfileNotSaved: {
    id: "Profil belum tersimpan",
    en: "Profile not saved",
    zh: "配置文件未保存",
  },

  // Kesiapan device
  readinessInactive: {
    id: "Device nonaktif / belum dipilih",
    en: "Device inactive / not selected",
    zh: "设备已停用 / 未选择",
  },
  readinessAttention: { id: "Perlu perhatian", en: "Needs attention", zh: "需要关注" },
  readinessReady: { id: "Siap", en: "Ready", zh: "就绪" },
  readinessEdgeReadyCameraCheck: {
    id: "Edge siap, kamera perlu dicek",
    en: "Edge ready, camera needs checking",
    zh: "边缘设备就绪，相机需检查",
  },

  // Perhatian & tindakan berikutnya
  attentionRuntimeSkippedTitle: {
    id: "Pemeriksaan runtime tidak dijalankan",
    en: "Runtime check not run",
    zh: "未执行运行状态检查",
  },
  attentionRuntimeSkippedDetail: {
    id: "Pilih device aktif atau aktifkan device ini untuk memeriksa koneksi.",
    en: "Select an active device or activate this device to check the connection.",
    zh: "请选择已启用的设备，或启用此设备以检查连接。",
  },
  attentionEdgeOfflineTitle: {
    id: "Edge device sedang offline",
    en: "The edge device is offline",
    zh: "边缘设备已离线",
  },
  attentionEdgeOfflineDetail: {
    id: "Status Mini PC belum reachable. Refresh koneksi lalu cek tab Ringkasan untuk detail koneksi edge.",
    en: "The Mini PC status is not reachable yet. Refresh the connection, then check the Overview tab for edge connection details.",
    zh: "尚无法获取迷你电脑的状态。请刷新连接，然后在“概览”标签页查看边缘连接详情。",
  },
  attentionCameraDisconnectedTitle: {
    id: "Camera belum terhubung",
    en: "Camera not connected yet",
    zh: "相机尚未连接",
  },
  attentionCameraDisconnectedDetail: {
    id: "Preset belum bisa diterapkan sampai kamera USB kembali terhubung dan sesi siap.",
    en: "Presets cannot be applied until the USB camera is connected again and the session is ready.",
    zh: "在 USB 相机重新连接且会话就绪之前，无法应用预设。",
  },
  attentionProfileIncompleteTitle: {
    id: "Profil device belum lengkap",
    en: "Device profile is incomplete",
    zh: "设备配置文件不完整",
  },
  attentionProfileIncompleteDetail: {
    id: "Registrasi device di database diperlukan agar preset, plant, dan bin punya konteks operasional yang jelas.",
    en: "The device must be registered in the database so that the preset, plant and bin have a clear operational context.",
    zh: "需要在数据库中登记设备，预设、工厂和 Bin 才有明确的运行背景。",
  },
  actionOpenOverview: { id: "Buka Ringkasan", en: "Open Overview", zh: "打开概览" },
  actionOpenCameraSettings: {
    id: "Buka Pengaturan Kamera",
    en: "Open Camera Settings",
    zh: "打开相机设置",
  },

  // Kartu kesiapan
  edgeDetailInactive: {
    id: "Device nonaktif atau belum dipilih.",
    en: "The device is inactive or not selected.",
    zh: "设备已停用或尚未选择。",
  },
  edgeDetailSynced: {
    id: "Terakhir sinkron {when}.",
    en: "Last synced {when}.",
    zh: "上次同步：{when}。",
  },
  edgeDetailUnreachable: {
    id: "App belum bisa menjangkau edge API pada refresh terakhir.",
    en: "The app could not reach the edge API on the last refresh.",
    zh: "上次刷新时应用无法连接 Edge API。",
  },
  edgeHintInactive: {
    id: "Aktifkan device untuk memeriksa koneksi.",
    en: "Activate the device to check the connection.",
    zh: "启用设备以检查连接。",
  },
  edgeHintConnectionState: {
    id: "Status koneksi: {state}.",
    en: "Connection state: {state}.",
    zh: "连接状态：{state}。",
  },
  edgeHintCheckNetwork: {
    id: "Periksa jaringan LAN, service edge API, atau status Mini PC.",
    en: "Check the LAN, the edge API service or the Mini PC status.",
    zh: "请检查局域网、Edge API 服务或迷你电脑的状态。",
  },
  cameraConnectionTitle: { id: "Koneksi Kamera", en: "Camera Connection", zh: "相机连接" },
  cameraDetailReady: {
    id: "Kamera siap dipakai untuk capture dan apply preset.",
    en: "The camera is ready for capture and for applying presets.",
    zh: "相机已可用于拍摄和应用预设。",
  },
  cameraDetailNotReady: {
    id: "Koneksi kamera belum siap untuk operasi config write.",
    en: "The camera connection is not ready for config write operations.",
    zh: "相机连接尚未就绪，无法执行 config write 操作。",
  },
  cameraHintInactive: {
    id: "Aktifkan device untuk membaca kamera.",
    en: "Activate the device to read the camera.",
    zh: "启用设备以读取相机。",
  },
  cameraHintCheckCable: {
    id: "Cek kabel USB, power kamera, atau sesi edge device.",
    en: "Check the USB cable, the camera power or the edge device session.",
    zh: "请检查 USB 线、相机电源或边缘设备会话。",
  },
  freshnessTitle: {
    id: "Freshness Capture Lokal",
    en: "Local Capture Freshness",
    zh: "本地拍摄新鲜度",
  },
  freshnessHasData: { id: "Ada data terbaru", en: "Recent data available", zh: "有最新数据" },
  freshnessNoCapture: { id: "Belum ada capture", en: "No captures yet", zh: "暂无拍摄" },
  freshnessDetailLast: {
    id: "Capture terakhir {when}.",
    en: "Last capture {when}.",
    zh: "上次拍摄：{when}。",
  },
  freshnessDetailNone: {
    id: "Belum ada capture lokal yang bisa dipakai untuk audit device ini.",
    en: "There are no local captures yet that can be used to audit this device.",
    zh: "尚无可用于审计此设备的本地拍摄。",
  },
  freshnessHintTotal: {
    id: "Total capture hari ini: {count}.",
    en: "Total captures today: {count}.",
    zh: "今日拍摄总数：{count}。",
  },
  freshnessHintUseCapture: {
    id: "Gunakan halaman Capture untuk mengambil sample baru.",
    en: "Use the Capture page to take a new sample.",
    zh: "请在“拍摄”页面拍摄新的样品。",
  },

  // Kepala halaman
  pageDescription: {
    id: "Kelola dan pantau semua Mini PC serta kamera operasional.",
    en: "Manage and monitor all Mini PCs and operational cameras.",
    zh: "管理并监控所有迷你电脑和在用相机。",
  },
  lastSyncInline: { id: "Sinkron terakhir {when}", en: "Last sync {when}", zh: "上次同步 {when}" },
  lastSyncColon: {
    id: "Sinkron terakhir: {when}",
    en: "Last sync: {when}",
    zh: "上次同步：{when}",
  },
  refreshStatusTitle: { id: "Refresh status", en: "Refresh status", zh: "刷新状态" },
  readinessHeading: { id: "Kesiapan Device", en: "Device Readiness", zh: "设备就绪状态" },
  readinessIntro: {
    id: "Halaman ini merangkum status edge, koneksi kamera, dan freshness capture lokal untuk operator sebelum masuk ke detail tab.",
    en: "This page summarises the edge status, the camera connection and local capture freshness for operators before they go into the tab details.",
    zh: "此页面为操作员汇总边缘设备状态、相机连接和本地拍摄新鲜度，之后可进入各标签页查看详情。",
  },
  activeProfile: { id: "Profil aktif", en: "Active profile", zh: "当前配置文件" },
  noProfileYet: { id: "Belum ada profil", en: "No profile yet", zh: "暂无配置文件" },
  attentionHeading: {
    id: "Perhatian & Tindakan Berikutnya",
    en: "Attention & Next Actions",
    zh: "注意事项与后续操作",
  },
  attentionAllClear: {
    id: "Profil device tersimpan, edge device reachable, dan kamera tidak menunjukkan blocker utama saat ini.",
    en: "The device profile is saved, the edge device is reachable and the camera shows no major blocker right now.",
    zh: "设备配置文件已保存，边缘设备可访问，相机目前没有明显的阻碍。",
  },
  localDataNote: {
    id: "Data capture di sini tetap berbasis browser lokal operator. Jika operator berpindah browser/profile, freshness capture bisa berbeda walau device yang dipakai sama.",
    en: "Capture data here is still based on the operator's local browser. If the operator switches browser/profile, capture freshness may differ even though the same device is used.",
    zh: "此处的拍摄数据仍基于操作员的本地浏览器。如果操作员更换浏览器或浏览器配置文件，即使使用同一设备，拍摄新鲜度也可能不同。",
  },

  // Bilah filter & daftar device
  searchDevicePlaceholder: { id: "Cari device...", en: "Search devices...", zh: "搜索设备…" },
  filterLocationAll: { id: "Lokasi: Semua", en: "Location: All", zh: "位置：全部" },
  filterStatusAll: { id: "Status: Semua", en: "Status: All", zh: "状态：全部" },
  filterConnectionAll: { id: "Koneksi: Semua", en: "Connection: All", zh: "连接：全部" },
  registryLoadErrorBanner: {
    id: "Registry database belum bisa dimuat: {reason}",
    en: "The registry database could not be loaded: {reason}",
    zh: "无法加载登记表数据库：{reason}",
  },
  registrySourceNote: {
    id: "Registry device berasal dari MSSQL. Status runtime live di bawah mengikuti device yang sedang dipilih sebagai profil aktif.",
    en: "The device registry comes from MSSQL. The live runtime status below follows the device currently selected as the active profile.",
    zh: "设备登记表来自 MSSQL。下方的实时运行状态跟随被选为当前配置文件的设备。",
  },
  registryLoading: { id: "Memuat registry...", en: "Loading registry...", zh: "正在加载登记表…" },
  devicesRegisteredCount: {
    id: "{count} device terdaftar",
    en: "{count} devices registered",
    zh: "已登记 {count} 台设备",
  },
  cardInactive: { id: "Nonaktif", en: "Inactive", zh: "停用" },
  cardRegistered: { id: "Terdaftar", en: "Registered", zh: "已登记" },
  runtimeFollowsActive: {
    id: "Status runtime mengikuti device aktif",
    en: "Runtime status follows the active device",
    zh: "运行状态跟随当前设备",
  },
  cardTemplate: { id: "Template: {value}", en: "Template: {value}", zh: "模板：{value}" },
  cardDeviceCode: {
    id: "Device Code: {value}",
    en: "Device Code: {value}",
    zh: "设备代码：{value}",
  },
  cardStation: { id: "Station", en: "Station", zh: "工位" },
  cardCapturesToday: { id: "Capture Hari Ini", en: "Captures Today", zh: "今日拍摄" },
  cardCamera: { id: "Kamera", en: "Camera", zh: "相机" },
  emptyNoDevices: {
    id: "Belum ada device yang terdaftar di registry database.",
    en: "No devices are registered in the registry database yet.",
    zh: "登记表数据库中尚无已登记的设备。",
  },
  emptyNoMatch: {
    id: 'Tidak ada device yang cocok dengan "{query}".',
    en: 'No device matches "{query}".',
    zh: "没有与“{query}”匹配的设备。",
  },

  // Aksi device terpilih + dialog konfirmasi
  editDevice: { id: "Edit device", en: "Edit device", zh: "编辑设备" },
  deactivate: { id: "Nonaktifkan", en: "Deactivate", zh: "停用" },
  activate: { id: "Aktifkan", en: "Activate", zh: "启用" },
  deleteDevice: { id: "Hapus device", en: "Delete device", zh: "删除设备" },
  deleteTitleDeactivateFirst: {
    id: "Nonaktifkan device terlebih dahulu",
    en: "Deactivate the device first",
    zh: "请先停用设备",
  },
  deleteTitleRemove: {
    id: "Hapus dari registry aktif",
    en: "Remove from the active registry",
    zh: "从活动登记表中删除",
  },
  confirmDeleteTitle: {
    id: "Hapus device dari registry?",
    en: "Delete the device from the registry?",
    zh: "从登记表中删除设备？",
  },
  confirmActivateTitle: { id: "Aktifkan device?", en: "Activate the device?", zh: "启用设备？" },
  confirmDeactivateTitle: {
    id: "Nonaktifkan device?",
    en: "Deactivate the device?",
    zh: "停用设备？",
  },
  confirmDeleteBody: {
    id: "Device disembunyikan dari daftar dan assignment ditutup. Riwayat capture tetap tersimpan.",
    en: "The device is hidden from the list and its assignment is closed. The capture history is kept.",
    zh: "设备将从列表中隐藏，其分配将被关闭。拍摄历史仍会保留。",
  },
  confirmActivateBody: {
    id: "Device dapat digunakan kembali oleh operator pada plant ini. Pastikan tidak ada assignment kamera aktif yang ambigu.",
    en: "Operators at this plant can use the device again. Make sure there is no ambiguous active camera assignment.",
    zh: "该工厂的操作员可以再次使用此设备。请确保没有含糊不清的启用相机分配。",
  },
  confirmDeactivateBody: {
    id: "Device tidak dapat digunakan untuk capture. Pastikan seluruh sesi capture pada device ini sudah selesai.",
    en: "The device cannot be used for capture. Make sure every capture session on this device has finished.",
    zh: "该设备将无法用于拍摄。请确保此设备上的所有拍摄场次均已结束。",
  },
  selectOrRegisterDevice: {
    id: "Pilih atau daftarkan device.",
    en: "Select or register a device.",
    zh: "请选择或登记设备。",
  },
  deviceInactiveNoCheck: {
    id: "Device nonaktif; pemeriksaan kamera tidak dijalankan.",
    en: "The device is inactive; the camera check is not run.",
    zh: "设备已停用；未执行相机检查。",
  },

  // Tab Ringkasan: informasi device
  deviceInfoHeading: { id: "Informasi Device", en: "Device Information", zh: "设备信息" },
  deviceNameLabel: { id: "Nama Device", en: "Device Name", zh: "设备名称" },
  deviceCodeLabel: { id: "Kode Device", en: "Device Code", zh: "设备代码" },
  edgeApiIdLabel: { id: "ID dari Edge API", en: "ID from Edge API", zh: "来自 Edge API 的 ID" },
  agentVersionLabel: { id: "Agent Version", en: "Agent Version", zh: "Agent 版本" },
  plantLocationLabel: { id: "Plant / Lokasi", en: "Plant / Location", zh: "工厂 / 位置" },
  binSourceLabel: { id: "Sumber Bin", en: "Bin Source", zh: "Bin 来源" },
  scheduleLabel: { id: "Jadwal", en: "Schedule", zh: "排程" },
  endpointAddressLabel: {
    id: "Alamat endpoint (host/IP)",
    en: "Endpoint address (host/IP)",
    zh: "端点地址（host/IP）",
  },
  osLabel: { id: "OS ({scope})", en: "OS ({scope})", zh: "操作系统（{scope}）" },
  hostnameLabel: { id: "Hostname ({scope})", en: "Hostname ({scope})", zh: "主机名（{scope}）" },
  networkAddressLabel: {
    id: "Alamat jaringan ({scope})",
    en: "Network address ({scope})",
    zh: "网络地址（{scope}）",
  },

  // Tab Ringkasan: informasi kamera
  cameraInfoHeading: { id: "Informasi Kamera", en: "Camera Information", zh: "相机信息" },
  cameraModelLabel: { id: "Model Kamera", en: "Camera Model", zh: "相机型号" },
  serialNumberLabel: { id: "Nomor Serial", en: "Serial Number", zh: "序列号" },
  firmwareVersionLabel: { id: "Versi Firmware", en: "Firmware Version", zh: "固件版本" },
  batteryPowerLabel: { id: "Baterai / Daya", en: "Battery / Power", zh: "电池 / 电源" },
  lensLabel: { id: "Lensa", en: "Lens", zh: "镜头" },
  cameraStorageLabel: { id: "Penyimpanan kamera", en: "Camera storage", zh: "相机存储" },
  cameraStorageEntry: {
    id: "{name}: {free} / {total} GB kosong",
    en: "{name}: {free} / {total} GB free",
    zh: "{name}：剩余 {free} / {total} GB",
  },
  usbConnectionLabel: { id: "Koneksi USB", en: "USB Connection", zh: "USB 连接" },

  // Tab Ringkasan: status koneksi & aksi cepat
  connectionStatusHeading: { id: "Status Koneksi", en: "Connection Status", zh: "连接状态" },
  cameraUsbLabel: { id: "Kamera (USB)", en: "Camera (USB)", zh: "相机（USB）" },
  checking: { id: "Mengecek…", en: "Checking…", zh: "正在检查…" },
  testConnection: { id: "Tes Koneksi", en: "Test Connection", zh: "测试连接" },
  quickActionsHeading: { id: "Aksi Cepat", en: "Quick Actions", zh: "快捷操作" },
  quickRestartCamera: { id: "Restart Kamera", en: "Restart Camera", zh: "重启相机" },
  quickRestartApi: { id: "Restart API Service", en: "Restart API Service", zh: "重启 API 服务" },
  quickRestartMiniPc: { id: "Restart Mini PC", en: "Restart Mini PC", zh: "重启迷你电脑" },
  quickSyncSettings: { id: "Sinkronkan Pengaturan", en: "Sync Settings", zh: "同步设置" },
  remoteActionsNote: {
    id: "Aksi device jarak jauh belum tersedia saat ini.",
    en: "Remote device actions are not available yet.",
    zh: "目前尚不支持远程设备操作。",
  },

  // Tab Kesehatan & kolom samping
  deviceHealthHeading: { id: "Kesehatan Device", en: "Device Health", zh: "设备健康" },
  actualSettingsHeading: {
    id: "Setelan Kamera Aktual",
    en: "Actual Camera Settings",
    zh: "相机当前设置",
  },
  settingIso: { id: "ISO", en: "ISO", zh: "ISO" },
  settingShutter: { id: "Shutter", en: "Shutter", zh: "快门" },
  settingAperture: { id: "Aperture", en: "Aperture", zh: "光圈" },
  settingWhiteBalance: { id: "White balance", en: "White balance", zh: "白平衡" },
  settingFocusMode: { id: "Mode fokus", en: "Focus mode", zh: "对焦模式" },
  actualSettingsNote: {
    id: "Nilai konfigurasi dari kamera. Penilaian kondisi lensa dan kualitas gambar (QC) belum tersedia.",
    en: "Configuration values from the camera. Lens condition and image quality (QC) assessment is not available yet.",
    zh: "来自相机的配置值。镜头状况和图像质量（QC）评估尚不可用。",
  },

  // Tab Koneksi Cadangan
  fallbackPrimary: {
    id: "Utama: USB — belum ada metode cadangan yang dikonfigurasi.",
    en: "Primary: USB — no backup method is configured yet.",
    zh: "主要：USB — 尚未配置备用方式。",
  },
  fallbackNote: {
    id: "Koneksi cadangan seperti EOS Utility, Bluetooth, atau Wi-Fi belum didukung. Aplikasi ini saat ini hanya berbicara ke kamera lewat USB via gphoto2.",
    en: "Backup connections such as EOS Utility, Bluetooth or Wi-Fi are not supported yet. This application currently talks to the camera only over USB via gphoto2.",
    zh: "尚不支持 EOS Utility、蓝牙或 Wi-Fi 等备用连接。此应用目前仅通过 gphoto2 经 USB 与相机通信。",
  },

  // Tab Konfigurasi
  configSummaryHeading: {
    id: "Ringkasan Konfigurasi",
    en: "Configuration Summary",
    zh: "配置概览",
  },
  deviceProfileLabel: { id: "Profil Device", en: "Device Profile", zh: "设备配置文件" },
  notRegisteredYet: { id: "Belum terdaftar", en: "Not registered yet", zh: "尚未登记" },
  plantBinLabel: { id: "Plant / Bin", en: "Plant / Bin", zh: "工厂 / Bin" },
  templateLabel: { id: "Template", en: "Template", zh: "模板" },
  fileNameFormatLabel: { id: "Format Nama File", en: "File Name Format", zh: "文件名格式" },
  fileFormatLabel: { id: "Format File", en: "File Format", zh: "文件格式" },
  imageIndexLabel: { id: "Indeks Gambar", en: "Image Index", zh: "图像序号" },
  saveFolderLabel: { id: "Folder Simpan", en: "Save Folder", zh: "保存文件夹" },
  configNote: {
    id: "Pengaturan profil device sekarang dirangkum di sini, sementara format nama file dan folder simpan masih mengikuti halaman Capture sampai sinkronisasi backend/device tersedia.",
    en: "Device profile settings are now summarised here, while the file name format and save folder still follow the Capture page until backend/device sync is available.",
    zh: "设备配置文件的设置现已汇总于此，而文件名格式和保存文件夹仍沿用“拍摄”页面的设置，直到后端/设备同步可用。",
  },
  editDeviceProfile: {
    id: "Edit profil device",
    en: "Edit device profile",
    zh: "编辑设备配置文件",
  },
  editCapturePrefs: {
    id: "Edit preferensi capture",
    en: "Edit capture preferences",
    zh: "编辑拍摄偏好",
  },
});

/** Tab Log: filter, saved view, daftar event, detail event, dan ekspor. */
export const deviceLogMessages = defineMessages({
  // Keterangan slot saved view
  savedViewSlot1Description: {
    id: "Audit harian rutin atau shift aktif.",
    en: "Routine daily audit or the active shift.",
    zh: "日常例行审计或当前班次。",
  },
  savedViewSlot2Description: {
    id: "Investigasi insiden atau gangguan runtime.",
    en: "Investigating incidents or runtime disruptions.",
    zh: "调查事件或运行故障。",
  },
  savedViewSlot3Description: {
    id: "View operator favorit untuk audit cepat.",
    en: "The operator's favourite view for a quick audit.",
    zh: "操作员常用的快速审计视图。",
  },

  // Nama bawaan slot saved view (nama yang diganti pengguna tidak diterjemahkan)
  savedViewDailyAudit: { id: "Audit Harian", en: "Daily Audit", zh: "日常审计" },
  savedViewIncident: { id: "Insiden", en: "Incidents", zh: "事件" },
  savedViewOperator: { id: "Operator", en: "Operator", zh: "操作员" },

  // Label tipe event
  eventMetadataFinalized: {
    id: "Metadata difinalisasi",
    en: "Metadata finalized",
    zh: "拍摄信息已确定",
  },
  eventCaptureTriggerFailed: {
    id: "Trigger capture gagal",
    en: "Capture trigger failed",
    zh: "拍摄触发失败",
  },
  eventCaptureJobFailed: { id: "Job capture gagal", en: "Capture job failed", zh: "拍摄任务失败" },
  eventCaptureMissingAsset: {
    id: "Asset capture tidak tersedia",
    en: "Capture asset not available",
    zh: "拍摄文件不可用",
  },
  eventCaptureException: { id: "Capture exception", en: "Capture exception", zh: "拍摄异常" },
  eventAutofocusTriggerFailed: {
    id: "Trigger autofocus gagal",
    en: "Autofocus trigger failed",
    zh: "自动对焦触发失败",
  },
  eventAutofocusJobFailed: {
    id: "Job autofocus gagal",
    en: "Autofocus job failed",
    zh: "自动对焦任务失败",
  },
  eventAutofocusException: {
    id: "Autofocus exception",
    en: "Autofocus exception",
    zh: "自动对焦异常",
  },
  eventNetworkSaveFallback: {
    id: "Fallback network save",
    en: "Network save fallback",
    zh: "网络保存回退",
  },
  eventFolderSaveFallback: {
    id: "Fallback folder browser",
    en: "Browser folder fallback",
    zh: "浏览器文件夹回退",
  },
  eventBrowserDownloadFallback: {
    id: "Fallback download lokal",
    en: "Local download fallback",
    zh: "本地下载回退",
  },
  eventCaptureRecordSyncFailed: {
    id: "Sinkron capture DB gagal",
    en: "Capture DB sync failed",
    zh: "拍摄记录同步数据库失败",
  },

  // Filter severity
  severityAll: { id: "Semua", en: "All", zh: "全部" },
  severityError: { id: "Error", en: "Error", zh: "错误" },
  severityWarning: { id: "Warning", en: "Warning", zh: "警告" },
  severityInfo: { id: "Info", en: "Info", zh: "信息" },
  // Nilai severity pada chip (nilai aslinya huruf kecil)
  severityValueError: { id: "error", en: "error", zh: "错误" },
  severityValueWarning: { id: "warning", en: "warning", zh: "警告" },
  severityValueInfo: { id: "info", en: "info", zh: "信息" },
  severityErrorCount: { id: "Error {count}", en: "Error {count}", zh: "错误 {count}" },
  severityWarningCount: { id: "Warning {count}", en: "Warning {count}", zh: "警告 {count}" },
  severityInfoCount: { id: "Info {count}", en: "Info {count}", zh: "信息 {count}" },

  // Filter tipe
  typeAll: { id: "Semua Tipe", en: "All Types", zh: "全部类型" },
  typeCapture: { id: "Capture", en: "Capture", zh: "拍摄" },
  typeAutofocus: { id: "Autofocus", en: "Autofocus", zh: "自动对焦" },
  typeFallback: { id: "Fallback", en: "Fallback", zh: "回退" },
  typeOther: { id: "Lainnya", en: "Other", zh: "其他" },

  // Filter waktu
  timeAll: { id: "Semua Waktu", en: "All Time", zh: "全部时间" },
  timeToday: { id: "Hari Ini", en: "Today", zh: "今天" },
  time7d: { id: "7 Hari", en: "7 Days", zh: "7 天" },
  time30d: { id: "30 Hari", en: "30 Days", zh: "30 天" },
  timeCustom: { id: "Rentang Kustom", en: "Custom Range", zh: "自定义范围" },

  // Preset filter
  presetErrorLatest: { id: "Error Terbaru", en: "Latest Errors", zh: "最新错误" },
  presetAuditFailures: { id: "Audit Gagal", en: "Failure Audit", zh: "失败审计" },
  presetFallback: { id: "Fallback", en: "Fallback", zh: "回退" },
  presetCaptureFailures: { id: "Capture Gagal", en: "Failed Captures", zh: "拍摄失败" },
  presetAutofocusFailures: { id: "Autofocus Gagal", en: "Failed Autofocus", zh: "自动对焦失败" },

  // Ringkasan filter
  savedViewNoFilter: {
    id: "Belum ada filter tersimpan.",
    en: "No filter saved yet.",
    zh: "尚未保存筛选条件。",
  },
  savedViewAllLogs: {
    id: "Semua log tanpa filter tambahan.",
    en: "All logs with no extra filter.",
    zh: "全部日志，无额外筛选。",
  },
  filterSeverity: { id: "Severity {value}", en: "Severity {value}", zh: "严重级别 {value}" },
  filterType: { id: "Tipe {value}", en: "Type {value}", zh: "类型 {value}" },
  filterTime: { id: "Waktu {value}", en: "Time {value}", zh: "时间 {value}" },
  filterSearch: { id: 'Cari "{query}"', en: 'Search "{query}"', zh: "搜索“{query}”" },
  activeFilterPinnedError: {
    id: "Preset error terbaru",
    en: "Latest errors preset",
    zh: "最新错误预设",
  },
  activeFilterSavedView: {
    id: "Saved view {name}",
    en: "Saved view {name}",
    zh: "已保存视图 {name}",
  },
  activeFilterPreset: { id: "Preset {name}", en: "Preset {name}", zh: "预设 {name}" },

  // Nilai payload & rentang kustom
  payloadYes: { id: "Ya", en: "Yes", zh: "是" },
  payloadNo: { id: "Tidak", en: "No", zh: "否" },
  rangeStartOpen: { id: "Awal", en: "Start", zh: "起始" },
  rangeEndNow: { id: "Sekarang", en: "Now", zh: "现在" },
  rangeNotSet: { id: "Rentang belum diisi", en: "Range not set", zh: "未设置范围" },

  // Toast saved view
  toastSavedViewEmptySlot: {
    id: "Slot saved view masih kosong",
    en: "This saved view slot is still empty",
    zh: "该已保存视图的槽位仍为空",
  },
  toastSavedViewEmptySlotDesc: {
    id: "Simpan kombinasi filter aktif ke slot ini terlebih dahulu.",
    en: "Save the active filter combination to this slot first.",
    zh: "请先将当前筛选组合保存到此槽位。",
  },
  toastSavedViewApplied: {
    id: 'Saved view "{name}" diterapkan',
    en: 'Saved view "{name}" applied',
    zh: "已应用已保存视图“{name}”",
  },
  toastSavedViewAppliedDesc: {
    id: "Filter log mengikuti konfigurasi audit yang tersimpan.",
    en: "The log filters follow the saved audit configuration.",
    zh: "日志筛选已按保存的审计配置设置。",
  },
  toastSavedViewUpdated: {
    id: 'Saved view "{name}" diperbarui',
    en: 'Saved view "{name}" updated',
    zh: "已更新已保存视图“{name}”",
  },
  toastSavedViewUpdatedDesc: {
    id: "Kombinasi filter aktif tersimpan untuk audit berikutnya.",
    en: "The active filter combination is saved for the next audit.",
    zh: "当前筛选组合已保存，供下次审计使用。",
  },
  toastSavedViewCleared: {
    id: 'Saved view "{name}" dibersihkan',
    en: 'Saved view "{name}" cleared',
    zh: "已清空已保存视图“{name}”",
  },
  toastSavedViewClearedDesc: {
    id: "Slot kembali kosong dan siap dipakai untuk kombinasi filter lain.",
    en: "The slot is empty again and ready for another filter combination.",
    zh: "槽位已清空，可用于其他筛选组合。",
  },
  promptRenameSavedView: {
    id: "Masukkan nama baru untuk saved view ini:",
    en: "Enter a new name for this saved view:",
    zh: "请输入此已保存视图的新名称：",
  },
  toastSavedViewNameEmpty: {
    id: "Nama saved view tidak boleh kosong",
    en: "The saved view name cannot be empty",
    zh: "已保存视图的名称不能为空",
  },
  toastSavedViewNameEmptyDesc: {
    id: "Masukkan nama singkat yang mudah dikenali operator.",
    en: "Enter a short name that operators can recognise easily.",
    zh: "请输入便于操作员识别的简短名称。",
  },
  toastSavedViewRenamed: {
    id: 'Saved view diubah menjadi "{name}"',
    en: 'Saved view renamed to "{name}"',
    zh: "已保存视图已重命名为“{name}”",
  },
  toastSavedViewRenamedDesc: {
    id: "Nama baru langsung dipakai pada slot audit ini.",
    en: "The new name is used for this audit slot right away.",
    zh: "新名称已立即用于此审计槽位。",
  },
  toastSavedViewSourceEmpty: {
    id: "Saved view sumber masih kosong",
    en: "The source saved view is still empty",
    zh: "来源已保存视图仍为空",
  },
  toastSavedViewSourceEmptyDesc: {
    id: "Simpan filter dulu sebelum menduplikasi ke slot lain.",
    en: "Save a filter first before duplicating it to another slot.",
    zh: "请先保存筛选条件，再复制到其他槽位。",
  },
  promptDuplicateSavedView: {
    id: 'Duplikat "{name}" ke slot mana?\n{options}',
    en: 'Duplicate "{name}" to which slot?\n{options}',
    zh: "将“{name}”复制到哪个槽位？\n{options}",
  },
  toastDuplicateInvalidTarget: {
    id: "Pilihan slot tujuan tidak valid",
    en: "The chosen target slot is not valid",
    zh: "所选目标槽位无效",
  },
  toastDuplicateInvalidTargetDesc: {
    id: "Gunakan nomor slot tujuan yang tersedia di daftar.",
    en: "Use a target slot number that is available in the list.",
    zh: "请使用列表中提供的目标槽位编号。",
  },
  toastSavedViewDuplicated: {
    id: 'Saved view "{name}" diduplikasi',
    en: 'Saved view "{name}" duplicated',
    zh: "已复制已保存视图“{name}”",
  },
  toastSavedViewDuplicatedDesc: {
    id: 'Isi filter berhasil disalin ke slot "{name}".',
    en: 'The filters were copied to slot "{name}".',
    zh: "筛选条件已复制到槽位“{name}”。",
  },

  // Toast auto-sync & ekspor
  toastAutoSyncPaused: {
    id: "Auto-sync log dibekukan",
    en: "Log auto-sync paused",
    zh: "日志自动同步已暂停",
  },
  toastAutoSyncResumed: {
    id: "Auto-sync log diaktifkan kembali",
    en: "Log auto-sync resumed",
    zh: "日志自动同步已恢复",
  },
  toastAutoSyncPausedDesc: {
    id: "Filter lokal tetap aktif, tetapi refresh server menunggu sampai kamu lanjutkan atau refresh manual.",
    en: "Local filters stay active, but server refresh waits until you resume or refresh manually.",
    zh: "本地筛选仍然有效，但服务器刷新将等待您恢复或手动刷新。",
  },
  toastAutoSyncResumedDesc: {
    id: "Panel log akan kembali mengikuti filter, device, dan query terbaru.",
    en: "The log panel will follow the latest filters, device and query again.",
    zh: "日志面板将重新跟随最新的筛选条件、设备和查询。",
  },
  toastLogExported: {
    id: "Log device diekspor ke {format}",
    en: "Device log exported to {format}",
    zh: "设备日志已导出为 {format}",
  },
  toastLogExportedDesc: {
    id: "Mengekspor {count} log sesuai filter aktif.",
    en: "Exported {count} logs matching the active filters.",
    zh: "已按当前筛选条件导出 {count} 条日志。",
  },
  toastLogBundleExported: {
    id: "Paket log device diekspor",
    en: "Device log bundle exported",
    zh: "设备日志包已导出",
  },
  toastLogBundleExportedDesc: {
    id: "JSON dan CSV untuk {count} log berhasil diunduh.",
    en: "JSON and CSV for {count} logs were downloaded.",
    zh: "已下载 {count} 条日志的 JSON 和 CSV。",
  },

  // Kepala tab Log
  recentLogsHeading: { id: "Log Device Terbaru", en: "Recent Device Logs", zh: "最近的设备日志" },
  exportBundle: { id: "Export Paket", en: "Export Bundle", zh: "导出日志包" },
  exportJson: { id: "Export JSON", en: "Export JSON", zh: "导出 JSON" },
  exportCsv: { id: "Export CSV", en: "Export CSV", zh: "导出 CSV" },
  resumeSync: { id: "Lanjut Sync", en: "Resume Sync", zh: "恢复同步" },
  pauseSync: { id: "Bekukan Sync", en: "Pause Sync", zh: "暂停同步" },
  refreshing: { id: "Menyegarkan…", en: "Refreshing…", zh: "正在刷新…" },
  refreshLog: { id: "Refresh Log", en: "Refresh Log", zh: "刷新日志" },
  pausedNotice: {
    id: "Tampilan log sedang dibekukan untuk investigasi. Filter lokal tetap berjalan, tetapi sinkron server menunggu sampai kamu lanjutkan atau tekan {button}.",
    en: "The log view is paused for investigation. Local filters keep working, but server sync waits until you resume or press {button}.",
    zh: "日志视图已暂停以便调查。本地筛选仍然有效，但服务器同步将等待您恢复或按下 {button}。",
  },
  resetFilter: { id: "Reset Filter", en: "Reset Filters", zh: "重置筛选" },

  // Kartu saved view
  use: { id: "Pakai", en: "Use", zh: "使用" },
  saveCurrentFilter: {
    id: "Simpan Filter Saat Ini",
    en: "Save Current Filters",
    zh: "保存当前筛选",
  },
  rename: { id: "Ganti Nama", en: "Rename", zh: "重命名" },
  duplicateTo: { id: "Duplikat ke...", en: "Duplicate to...", zh: "复制到…" },
  clear: { id: "Hapus", en: "Delete", zh: "删除" },
  updatedWhen: { id: "Diperbarui {when}", en: "Updated {when}", zh: "更新于 {when}" },
  slotEmpty: { id: "Slot masih kosong", en: "Slot is still empty", zh: "槽位仍为空" },

  // Rentang kustom & pencarian
  rangeFrom: { id: "Mulai", en: "From", zh: "开始" },
  rangeTo: { id: "Sampai", en: "To", zh: "结束" },
  auditActiveRange: {
    id: "Audit aktif: {range}",
    en: "Active audit: {range}",
    zh: "当前审计：{range}",
  },
  searchLogPlaceholder: {
    id: "Cari pesan, event, device, atau payload...",
    en: "Search messages, events, devices or payload...",
    zh: "搜索消息、事件、设备或 payload…",
  },
  searchDebouncing: {
    id: "Menunggu jeda ketik sebelum sinkron ke server...",
    en: "Waiting for a pause in typing before syncing to the server...",
    zh: "等待输入停顿后再与服务器同步…",
  },
  showingSummary: {
    id: "Menampilkan {shown} dari {total} log{type}{range}{search}.",
    en: "Showing {shown} of {total} logs{type}{range}{search}.",
    zh: "显示 {total} 条日志中的 {shown} 条{type}{range}{search}。",
  },
  showingSummaryType: { id: " tipe {type}", en: " of type {type}", zh: "，类型 {type}" },
  showingSummaryRange: { id: " dalam {range}", en: " within {range}", zh: "，时间 {range}" },
  showingSummarySearch: { id: ' untuk "{query}"', en: ' for "{query}"', zh: "，关键词“{query}”" },

  // Keadaan kosong / galat
  logLoadErrorBanner: {
    id: "Log device belum bisa dimuat: {reason}",
    en: "The device log could not be loaded: {reason}",
    zh: "无法加载设备日志：{reason}",
  },
  logEmpty: {
    id: "Belum ada log aktivitas untuk device ini.",
    en: "There is no activity log for this device yet.",
    zh: "此设备尚无操作日志。",
  },
  logNoMatch: {
    id: "Tidak ada log yang cocok dengan filter saat ini{severity}{type}{range}.",
    en: "No logs match the current filters{severity}{type}{range}.",
    zh: "没有符合当前筛选条件的日志{severity}{type}{range}。",
  },
  logNoMatchWithSearch: {
    id: 'Tidak ada log yang cocok dengan filter saat ini{severity}{type}{range} dan kata kunci "{query}".',
    en: 'No logs match the current filters{severity}{type}{range} and the keyword "{query}".',
    zh: "没有符合当前筛选条件{severity}{type}{range}且包含关键词“{query}”的日志。",
  },
  logNoMatchSeverity: {
    id: " (severity {severity})",
    en: " (severity {severity})",
    zh: "（严重级别 {severity}）",
  },
  logNoMatchType: { id: " (tipe {type})", en: " (type {type})", zh: "（类型 {type}）" },
  logNoMatchRange: { id: " (rentang {range})", en: " (range {range})", zh: "（范围 {range}）" },

  // Ringkasan aktif
  activeSummaryHeading: { id: "Ringkasan Aktif", en: "Active Summary", zh: "当前概况" },
  visibleOfTotal: {
    id: "{shown} log tampil dari {total} total",
    en: "{shown} logs shown of {total} total",
    zh: "共 {total} 条，显示 {shown} 条",
  },
  loadedSummaryMore: {
    id: "Total termuat saat ini: {loaded} log, batch berikutnya {step} log. Masih ada halaman berikutnya.",
    en: "Currently loaded: {loaded} logs, next batch {step} logs. There are more pages.",
    zh: "当前已加载 {loaded} 条日志，下一批 {step} 条。还有下一页。",
  },
  loadedSummaryEnd: {
    id: "Total termuat saat ini: {loaded} log, batch berikutnya {step} log. Sudah mencapai akhir data saat ini.",
    en: "Currently loaded: {loaded} logs, next batch {step} logs. The end of the current data has been reached.",
    zh: "当前已加载 {loaded} 条日志，下一批 {step} 条。已到达当前数据的末尾。",
  },
  noExtraFilters: {
    id: "Tidak ada filter tambahan aktif. Semua log terbaru sedang ditampilkan.",
    en: "No extra filters are active. All recent logs are shown.",
    zh: "未启用额外筛选，正在显示所有最近的日志。",
  },
  eventDevice: { id: "Device: {name}", en: "Device: {name}", zh: "设备：{name}" },
  loadMoreHint: {
    id: "Perlu audit lebih panjang? Muat batch log berikutnya dari server.",
    en: "Need a longer audit? Load the next batch of logs from the server.",
    zh: "需要更长的审计范围？从服务器加载下一批日志。",
  },
  allLoaded: {
    id: "Semua log yang tersedia untuk query saat ini sudah dimuat.",
    en: "All logs available for the current query have been loaded.",
    zh: "当前查询的所有可用日志均已加载。",
  },
  loadingShort: { id: "Memuat…", en: "Loading…", zh: "加载中…" },
  loadMore: { id: "Load More", en: "Load More", zh: "加载更多" },

  // Detail event
  eventDetailHeading: { id: "Detail Event", en: "Event Details", zh: "事件详情" },
  severityDt: { id: "Severity", en: "Severity", zh: "严重级别" },
  deviceDt: { id: "Device", en: "Device", zh: "设备" },
  timeDt: { id: "Waktu", en: "Time", zh: "时间" },
  payloadHeading: { id: "Payload", en: "Payload", zh: "Payload" },
  payloadEmpty: {
    id: "Event ini tidak membawa payload tambahan.",
    en: "This event carries no additional payload.",
    zh: "此事件不含额外的 payload。",
  },
  selectLogHint: {
    id: "Pilih salah satu log untuk melihat detail payload.",
    en: "Select a log to see its payload details.",
    zh: "选择一条日志以查看 payload 详情。",
  },

  // Kolom samping
  latestLogHeading: { id: "Log Terbaru", en: "Latest Log", zh: "最新日志" },
  registryLogUnavailable: {
    id: "Log registry belum tersedia.",
    en: "The registry log is not available yet.",
    zh: "登记表日志尚不可用。",
  },
  noRecentActivity: {
    id: "Belum ada aktivitas terbaru yang tercatat.",
    en: "No recent activity has been recorded.",
    zh: "尚无最近的活动记录。",
  },
});

/** Tab Pengaturan Kamera: profil, apply preset, dukungan edge, riwayat apply. */
export const cameraSettingsMessages = defineMessages({
  // View tersimpan riwayat apply
  historyViewAll: { id: "Semua aktivitas", en: "All activity", zh: "全部活动" },
  historyViewAllDescription: {
    id: "Semua hasil apply terbaru.",
    en: "All recent apply results.",
    zh: "所有最近的应用结果。",
  },
  historyViewFailures: { id: "Hanya gagal", en: "Failed only", zh: "仅失败" },
  historyViewFailuresDescription: {
    id: "Fokus pada apply yang gagal.",
    en: "Focus on applies that failed.",
    zh: "只看应用失败的记录。",
  },
  historyViewNeedsReview: { id: "Perlu review", en: "Needs review", zh: "需要复核" },
  historyViewNeedsReviewDescription: {
    id: "Entri dengan skipped keys yang perlu dicek operator.",
    en: "Entries with skipped keys that the operator needs to check.",
    zh: "含有被跳过的 key、需要操作员检查的记录。",
  },
  historyViewWithEdgeProfile: {
    id: "Dengan edge profile",
    en: "With edge profile",
    zh: "有 edge profile",
  },
  historyViewWithEdgeProfileDescription: {
    id: "Entri yang sudah punya edge profile.",
    en: "Entries that already have an edge profile.",
    zh: "已有 edge profile 的记录。",
  },

  // Filter, filter cepat, dan urutan riwayat
  historyFilterAll: { id: "Semua", en: "All", zh: "全部" },
  historyFilterApplied: { id: "Berhasil", en: "Succeeded", zh: "成功" },
  historyFilterFailed: { id: "Gagal", en: "Failed", zh: "失败" },
  historyQuickAny: { id: "Semua entri", en: "All entries", zh: "全部记录" },
  historyQuickHasCode: { id: "Ada kode", en: "Has code", zh: "有代码" },
  historyQuickHasSkippedKeys: {
    id: "Ada skipped keys",
    en: "Has skipped keys",
    zh: "有被跳过的 key",
  },
  historyQuickHasEdgeProfile: {
    id: "Ada edge profile",
    en: "Has edge profile",
    zh: "有 edge profile",
  },
  historySortNewest: { id: "Terbaru", en: "Newest", zh: "最新" },
  historySortOldest: { id: "Terlama", en: "Oldest", zh: "最早" },
  historySortAppliedFirst: { id: "Berhasil dulu", en: "Succeeded first", zh: "成功优先" },
  historySortFailedFirst: { id: "Gagal dulu", en: "Failed first", zh: "失败优先" },

  // Memuat konfigurasi edge
  selectActiveDeviceForConfig: {
    id: "Pilih device aktif yang terhubung untuk membaca konfigurasi kamera.",
    en: "Select an active, connected device to read the camera configuration.",
    zh: "请选择已启用且已连接的设备以读取相机配置。",
  },
  configLoadFailed: {
    id: "Config gagal dimuat.",
    en: "The config failed to load.",
    zh: "配置加载失败。",
  },
  registerFirstForProfile: {
    id: "Daftarkan device dulu untuk menentukan profil pengaturan kameranya.",
    en: "Register the device first to define its camera settings profile.",
    zh: "请先登记设备，再设定其相机设置配置文件。",
  },

  // Proses apply preset
  applyFailedGeneric: {
    id: "Gagal menerapkan preset.",
    en: "Could not apply the preset.",
    zh: "应用预设失败。",
  },
  applyingStatus: {
    id: "Creating/updating edge profile and applying preset to the camera...",
    en: "Creating/updating edge profile and applying preset to the camera...",
    zh: "正在创建/更新 edge profile 并将预设应用到相机…",
  },
  toastApplying: {
    id: "Menerapkan preset ke kamera...",
    en: "Applying the preset to the camera...",
    zh: "正在将预设应用到相机…",
  },
  toastApplyingDesc: {
    id: "Edge profile sedang dibuat atau diperbarui.",
    en: "The edge profile is being created or updated.",
    zh: "正在创建或更新 edge profile。",
  },
  toastApplyFailed: {
    id: "Gagal menerapkan preset ke kamera",
    en: "Could not apply the preset to the camera",
    zh: "无法将预设应用到相机",
  },
  appliedButRegistrySyncFailed: {
    id: "Preset diterapkan ke kamera, tetapi sinkronisasi registry gagal. Simpan ulang profil.",
    en: "The preset was applied to the camera, but the registry sync failed. Save the profile again.",
    zh: "预设已应用到相机，但登记表同步失败。请重新保存配置文件。",
  },
  appliedViaEdgeProfile: {
    id: 'Preset applied to camera via edge profile "{name}".',
    en: 'Preset applied to camera via edge profile "{name}".',
    zh: "已通过 edge profile“{name}”将预设应用到相机。",
  },
  toastApplied: {
    id: "Preset berhasil diterapkan ke kamera",
    en: "Preset applied to the camera",
    zh: "预设已成功应用到相机",
  },
  toastAppliedDesc: {
    id: 'Edge profile "{name}" sudah aktif.',
    en: 'Edge profile "{name}" is now active.',
    zh: "Edge profile“{name}”已生效。",
  },

  // Petunjuk tombol Terapkan
  hintApplying: {
    id: "Preset sedang diterapkan ke kamera.",
    en: "The preset is being applied to the camera.",
    zh: "正在将预设应用到相机。",
  },
  hintEdgeUnreachable: {
    id: "Terapkan sekarang belum tersedia karena edge API tidak reachable.",
    en: "Apply now is not available because the edge API is not reachable.",
    zh: "无法立即应用，因为 Edge API 无法访问。",
  },
  hintCameraNotConnected: {
    id: "Terapkan sekarang belum tersedia karena kamera belum terhubung.",
    en: "Apply now is not available because the camera is not connected yet.",
    zh: "无法立即应用，因为相机尚未连接。",
  },
  hintNoConfigWrite: {
    id: "Terapkan sekarang belum tersedia karena edge API belum expose configWrite.",
    en: "Apply now is not available because the edge API does not expose configWrite yet.",
    zh: "无法立即应用，因为 Edge API 尚未提供 configWrite。",
  },

  // Status apply
  applyStatusApplied: { id: "Berhasil diterapkan", en: "Applied successfully", zh: "应用成功" },
  applyStatusAppliedDetail: {
    id: "Preset terakhir berhasil diterapkan ke kamera.",
    en: "The last preset was applied to the camera.",
    zh: "最近一次预设已成功应用到相机。",
  },
  applyStatusFailed: { id: "Gagal diterapkan", en: "Apply failed", zh: "应用失败" },
  applyStatusFailedDetail: {
    id: "Preset gagal diterapkan ke kamera.",
    en: "The preset could not be applied to the camera.",
    zh: "预设未能应用到相机。",
  },
  applyStatusApplying: { id: "Sedang diterapkan", en: "Applying", zh: "正在应用" },
  applyStatusApplyingDetail: {
    id: "Edge API sedang memproses preset aktif.",
    en: "The edge API is processing the active preset.",
    zh: "Edge API 正在处理当前预设。",
  },
  applyStatusReady: { id: "Siap diterapkan", en: "Ready to apply", zh: "可以应用" },
  applyStatusNotReady: {
    id: "Belum bisa diterapkan",
    en: "Cannot be applied yet",
    zh: "暂时无法应用",
  },
  applyStatusIdleDetail: {
    id: "Preset bisa diterapkan saat edge API reachable dan kamera mendukung config write.",
    en: "The preset can be applied when the edge API is reachable and the camera supports config write.",
    zh: "当 Edge API 可访问且相机支持 config write 时，即可应用预设。",
  },

  // Checklist kesiapan
  checkEdgeReachable: {
    id: "Edge API reachable",
    en: "Edge API reachable",
    zh: "Edge API 可访问",
  },
  checkEdgeReachableDone: {
    id: "Edge API berhasil dijangkau dari aplikasi.",
    en: "The application reached the edge API.",
    zh: "应用已成功连接 Edge API。",
  },
  checkEdgeReachablePending: {
    id: "Terapkan sekarang menunggu edge API kembali reachable.",
    en: "Apply now waits for the edge API to become reachable again.",
    zh: "立即应用需等待 Edge API 恢复可访问。",
  },
  checkCameraConnected: { id: "Kamera terhubung", en: "Camera connected", zh: "相机已连接" },
  checkCameraConnectedDone: {
    id: "Kamera USB sudah terdeteksi oleh edge device.",
    en: "The USB camera has been detected by the edge device.",
    zh: "边缘设备已检测到 USB 相机。",
  },
  checkCameraConnectedPending: {
    id: "Hubungkan kamera dulu sebelum apply preset.",
    en: "Connect the camera first before applying a preset.",
    zh: "应用预设前请先连接相机。",
  },
  checkConfigWrite: {
    id: "Config write tersedia",
    en: "Config write available",
    zh: "Config write 可用",
  },
  checkConfigWriteDone: {
    id: "Edge API melaporkan capability config write.",
    en: "The edge API reports the config write capability.",
    zh: "Edge API 报告具备 config write 能力。",
  },
  checkConfigWritePending: {
    id: "Capability config write belum tersedia untuk kamera ini.",
    en: "The config write capability is not available for this camera yet.",
    zh: "此相机尚不具备 config write 能力。",
  },

  // Tindakan berikutnya
  nextRefreshStatus: {
    id: "Refresh status device untuk memastikan edge API sudah online.",
    en: "Refresh the device status to make sure the edge API is online.",
    zh: "请刷新设备状态，确认 Edge API 已上线。",
  },
  nextCheckCable: {
    id: "Periksa kabel USB, power kamera, lalu ulangi koneksi.",
    en: "Check the USB cable and the camera power, then reconnect.",
    zh: "请检查 USB 线和相机电源，然后重新连接。",
  },
  nextConfigWriteMissing: {
    id: "Capability configWrite belum tersedia; cek edge API/camera support matrix.",
    en: "The configWrite capability is not available yet; check the edge API/camera support matrix.",
    zh: "尚不具备 configWrite 能力；请查看 Edge API/相机支持矩阵。",
  },
  nextReadyToApply: {
    id: "Preset siap diterapkan. Simpan draft jika perlu, lalu klik Terapkan Preset ke Kamera.",
    en: "The preset is ready to apply. Save the draft if needed, then click Apply Preset to Camera.",
    zh: "预设可以应用。如有需要请先保存草稿，然后点击“将预设应用到相机”。",
  },

  // Riwayat apply: kosong, toast, ekspor
  historyNoMatch: {
    id: 'Tidak ada entri yang cocok untuk filter "{filter}" / "{quick}" dengan pencarian saat ini.',
    en: 'No entries match the "{filter}" / "{quick}" filters with the current search.',
    zh: "当前搜索下没有符合筛选“{filter}” / “{quick}”的记录。",
  },
  toastPresetChanged: {
    id: 'Preset aktif diubah ke "{name}"',
    en: 'Active preset changed to "{name}"',
    zh: "当前预设已更改为“{name}”",
  },
  toastPresetChangedDesc: {
    id: "Draft pengaturan kamera sudah mengikuti template terpilih.",
    en: "The camera settings draft now follows the selected template.",
    zh: "相机设置草稿已按所选模板更新。",
  },
  toastHistoryCleared: {
    id: "Riwayat apply preset dibersihkan",
    en: "Preset apply history cleared",
    zh: "预设应用历史已清空",
  },
  toastHistoryClearedDesc: {
    id: "Hanya riwayat lokal pada browser ini yang dihapus.",
    en: "Only the local history in this browser was deleted.",
    zh: "仅删除了此浏览器中的本地历史。",
  },
  toastHistoryExported: {
    id: "Apply history diekspor ke {format}",
    en: "Apply history exported to {format}",
    zh: "应用历史已导出为 {format}",
  },
  toastHistoryExportedAll: {
    id: "Mengekspor seluruh riwayat. Total entri: {count}.",
    en: "Exported the whole history. Total entries: {count}.",
    zh: "已导出全部历史，共 {count} 条记录。",
  },
  toastHistoryExportedFiltered: {
    id: "Filter aktif: {filter}. Total entri: {count}.",
    en: "Active filter: {filter}. Total entries: {count}.",
    zh: "当前筛选：{filter}，共 {count} 条记录。",
  },

  // Dukungan kamera edge
  fieldIso: { id: "ISO", en: "ISO", zh: "ISO" },
  fieldShutterSpeed: { id: "Shutter Speed", en: "Shutter Speed", zh: "快门速度" },
  fieldAperture: { id: "Aperture", en: "Aperture", zh: "光圈" },
  fieldWhiteBalance: { id: "White Balance", en: "White Balance", zh: "白平衡" },
  fieldFocusMode: { id: "Focus Mode", en: "Focus Mode", zh: "对焦模式" },
  fieldPictureStyle: { id: "Picture Style", en: "Picture Style", zh: "照片风格" },
  supportNotMapped: {
    id: "Belum dipetakan oleh edge API",
    en: "Not mapped by the edge API yet",
    zh: "Edge API 尚未映射",
  },
  supportKeyNotExposed: {
    id: "Key belum diekspos oleh kamera saat ini",
    en: "The camera does not expose this key yet",
    zh: "相机目前未提供此 key",
  },
  supportReportedUnsupported: {
    id: "Dilaporkan tidak didukung",
    en: "Reported as not supported",
    zh: "报告为不支持",
  },
  supportReadOnly: { id: "Hanya-baca", en: "Read-only", zh: "只读" },
  supportWritable: { id: "Bisa ditulis", en: "Writable", zh: "可写入" },
  edgeSupportHeading: {
    id: "Dukungan Kamera Edge",
    en: "Edge Camera Support",
    zh: "边缘相机支持情况",
  },
  edgeSupportIntro: {
    id: "Baris di bawah menunjukkan apakah setiap field preset bisa dipetakan ke edge API dan capability kamera yang sedang aktif.",
    en: "The rows below show whether each preset field can be mapped to the edge API and to the capabilities of the active camera.",
    zh: "下方各行显示每个预设字段能否映射到 Edge API 以及当前相机的能力。",
  },
  refreshCameraConfig: {
    id: "Refresh Konfigurasi Kamera",
    en: "Refresh Camera Configuration",
    zh: "刷新相机配置",
  },
  refreshing: { id: "Menyegarkan…", en: "Refreshing…", zh: "正在刷新…" },
  edgeConfigReadFailed: {
    id: "Gagal membaca konfigurasi edge: {reason}",
    en: "Could not read the edge configuration: {reason}",
    zh: "读取边缘配置失败：{reason}",
  },
  supportTarget: { id: "Target: {value}", en: "Target: {value}", zh: "目标值：{value}" },
  supportCameraValue: {
    id: "Nilai kamera: {value}",
    en: "Camera value: {value}",
    zh: "相机值：{value}",
  },

  // Kepala tab & ringkasan
  profileHeading: {
    id: "Profil Pengaturan Kamera",
    en: "Camera Settings Profile",
    zh: "相机设置配置文件",
  },
  profileIntro: {
    id: "Nilai ini disimpan sebagai profil device aktif dan bisa diterapkan ke kamera melalui edge API saat capability config write tersedia.",
    en: "These values are saved as the active device profile and can be applied to the camera through the edge API when the config write capability is available.",
    zh: "这些值保存为当前设备的配置文件，在具备 config write 能力时可通过 Edge API 应用到相机。",
  },
  saveDeviceSettings: {
    id: "Simpan Pengaturan Device",
    en: "Save Device Settings",
    zh: "保存设备设置",
  },
  applying: { id: "Menerapkan…", en: "Applying…", zh: "正在应用…" },
  applyPresetToCamera: {
    id: "Terapkan Preset ke Kamera",
    en: "Apply Preset to Camera",
    zh: "将预设应用到相机",
  },
  edgeConfigWriteTitle: {
    id: "Config Write Edge",
    en: "Edge Config Write",
    zh: "边缘设备 Config Write",
  },
  available: { id: "Tersedia", en: "Available", zh: "可用" },
  notAvailableYet: { id: "Belum tersedia", en: "Not available yet", zh: "暂不可用" },
  cameraConnectionTitle: { id: "Koneksi Kamera", en: "Camera Connection", zh: "相机连接" },
  usbConnected: { id: "USB terhubung", en: "USB connected", zh: "USB 已连接" },
  cameraNotConnectedYet: {
    id: "Kamera belum terhubung",
    en: "Camera not connected yet",
    zh: "相机尚未连接",
  },
  lastApplied: { id: "Terakhir diterapkan", en: "Last applied", zh: "上次应用" },
  neverApplied: { id: "Belum pernah", en: "Never", zh: "从未" },
  checklistHeading: {
    id: "Checklist Kesiapan Terapkan",
    en: "Apply Readiness Checklist",
    zh: "应用就绪检查清单",
  },
  nextActionsHeading: { id: "Tindakan Berikutnya", en: "Next Actions", zh: "后续操作" },
  templateLabel: { id: "Template", en: "Template", zh: "模板" },
  captureScheduleLabel: { id: "Jadwal Capture", en: "Capture Schedule", zh: "拍摄排程" },
  lastUpdated: {
    id: "Diperbarui terakhir: {when}",
    en: "Last updated: {when}",
    zh: "上次更新：{when}",
  },
  presetFilterHeading: { id: "Filter Preset", en: "Preset Filter", zh: "预设筛选" },
  presetFilterIntro: {
    id: "Saring preset explorer berdasarkan skenario sebelum mengganti template aktif.",
    en: "Filter the preset explorer by scenario before changing the active template.",
    zh: "更换当前模板前，可按场景筛选预设浏览器。",
  },
  presetComparisonTitle: { id: "Perbandingan Preset", en: "Preset Comparison", zh: "预设对比" },

  // Riwayat apply
  historyHeading: { id: "Riwayat Apply", en: "Apply History", zh: "应用历史" },
  historyIntro: {
    id: "Riwayat apply preset terakhir disimpan lokal di browser operator ini.",
    en: "The recent preset apply history is stored locally in this operator's browser.",
    zh: "最近的预设应用历史保存在此操作员的浏览器本地。",
  },
  savedViewHint: {
    id: "Gunakan view tersimpan untuk memanggil kombinasi filter audit yang sering dipakai.",
    en: "Use saved views to recall audit filter combinations you use often.",
    zh: "使用已保存视图可快速调出常用的审计筛选组合。",
  },
  exportJson: { id: "Ekspor JSON", en: "Export JSON", zh: "导出 JSON" },
  exportCsv: { id: "Ekspor CSV", en: "Export CSV", zh: "导出 CSV" },
  exportAllJson: { id: "Ekspor Semua JSON", en: "Export All JSON", zh: "导出全部 JSON" },
  exportAllCsv: { id: "Ekspor Semua CSV", en: "Export All CSV", zh: "导出全部 CSV" },
  clearHistory: { id: "Hapus riwayat", en: "Delete history", zh: "删除历史" },
  clearHistoryTitle: {
    id: "Hapus riwayat apply lokal?",
    en: "Delete the local apply history?",
    zh: "删除本地应用历史？",
  },
  clearHistoryBody: {
    id: "Tindakan ini akan menghapus semua riwayat apply preset yang tersimpan di browser operator ini. Data tidak bisa dipulihkan.",
    en: "This will delete all preset apply history stored in this operator's browser. The data cannot be recovered.",
    zh: "此操作将删除此操作员浏览器中保存的全部预设应用历史。数据无法恢复。",
  },
  cancel: { id: "Batal", en: "Cancel", zh: "取消" },
  clearHistoryConfirm: {
    id: "Ya, hapus riwayat",
    en: "Yes, delete history",
    zh: "是，删除历史",
  },
  viewModeLabel: { id: "Mode Tampilan", en: "View Mode", zh: "视图模式" },
  customView: { id: "Tampilan kustom", en: "Custom view", zh: "自定义视图" },
  savedViewBadge: { id: "View tersimpan", en: "Saved view", zh: "已保存视图" },
  customViewNote: {
    id: "Filter, pencarian, dan urutan saat ini diatur manual.",
    en: "The current filters, search and order are set manually.",
    zh: "当前的筛选、搜索和排序为手动设置。",
  },
  followsPreset: {
    id: 'Mengikuti preset "{name}".',
    en: 'Following the "{name}" preset.',
    zh: "跟随预设“{name}”。",
  },
  searchHistoryPlaceholder: {
    id: "Cari template, pesan, code...",
    en: "Search template, message, code...",
    zh: "搜索模板、消息、代码…",
  },
  sortBy: { id: "Urutkan: {order}", en: "Sort: {order}", zh: "排序：{order}" },
  historyEmpty: {
    id: "Belum ada riwayat apply preset pada browser ini.",
    en: "There is no preset apply history in this browser yet.",
    zh: "此浏览器中尚无预设应用历史。",
  },
  historyEdgeProfile: {
    id: "Profil Edge: {value}",
    en: "Edge profile: {value}",
    zh: "Edge profile 编号：{value}",
  },
  historyCode: { id: "Code: {value}", en: "Code: {value}", zh: "代码：{value}" },
  historyApplied: { id: "Diterapkan: {value}", en: "Applied: {value}", zh: "已应用：{value}" },
  historySkipped: { id: "Dilewati: {value}", en: "Skipped: {value}", zh: "已跳过：{value}" },

  // Baris status bawah
  saveStatusSaved: {
    id: "Status: Tersimpan lokal di browser ini",
    en: "Status: Saved locally in this browser",
    zh: "状态：已保存在此浏览器本地",
  },
  saveStatusDirty: {
    id: "Status: Ada perubahan lokal yang belum disimpan",
    en: "Status: There are local changes that have not been saved",
    zh: "状态：有尚未保存的本地更改",
  },
  keysApplied: {
    id: "Key diterapkan: {value}",
    en: "Keys applied: {value}",
    zh: "已应用的 key：{value}",
  },
  keysSkipped: {
    id: "Key dilewati: {value}",
    en: "Keys skipped: {value}",
    zh: "已跳过的 key：{value}",
  },
  editRegistrationData: {
    id: "Edit data registrasi",
    en: "Edit registration data",
    zh: "编辑登记数据",
  },
});

/** Komponen preset (preset-ui) dan katalog template di device-config. */
export const presetMessages = defineMessages({
  // Label setelan pada tabel pembanding
  settingIso: { id: "ISO", en: "ISO", zh: "ISO" },
  settingShutter: { id: "Shutter", en: "Shutter", zh: "快门" },
  settingAperture: { id: "Aperture", en: "Aperture", zh: "光圈" },
  settingWhiteBalance: { id: "White Balance", en: "White Balance", zh: "白平衡" },
  settingPictureStyle: { id: "Picture Style", en: "Picture Style", zh: "照片风格" },
  settingFocusMode: { id: "Mode Fokus", en: "Focus Mode", zh: "对焦模式" },

  // Tombol & keterangan
  applyNow: { id: "Terapkan sekarang", en: "Apply now", zh: "立即应用" },
  recommendedFor: {
    id: "Direkomendasikan untuk: {text}",
    en: "Recommended for: {text}",
    zh: "推荐用于：{text}",
  },
  tags: { id: "Tag: {tags}", en: "Tags: {tags}", zh: "标签：{tags}" },
  noPresetMatch: {
    id: "Tidak ada preset yang cocok dengan filter ini.",
    en: "No preset matches this filter.",
    zh: "没有符合此筛选的预设。",
  },
  selected: { id: "Dipilih", en: "Selected", zh: "已选择" },
  presetInUse: {
    id: "Preset ini sedang dipakai",
    en: "This preset is in use",
    zh: "正在使用此预设",
  },
  usePreset: { id: "Pakai preset ini", en: "Use this preset", zh: "使用此预设" },
  compareIntro: {
    id: "Bandingkan preset terpilih dengan template lain sebelum diterapkan.",
    en: "Compare the selected preset with another template before applying it.",
    zh: "应用前可将所选预设与其他模板进行对比。",
  },
  compareWith: { id: "Bandingkan dengan", en: "Compare with", zh: "对比对象" },
  noComparePreset: {
    id: "Tidak ada preset pembanding untuk filter ini.",
    en: "There is no preset to compare with for this filter.",
    zh: "此筛选下没有可对比的预设。",
  },
  compareSelected: { id: "Dipilih: {value}", en: "Selected: {value}", zh: "所选：{value}" },
  compareOther: { id: "Pembanding: {value}", en: "Compared: {value}", zh: "对比：{value}" },
  valuesSame: { id: "Nilainya sama", en: "Same value", zh: "值相同" },
  valuesDiffer: { id: "Nilainya berbeda", en: "Different value", zh: "值不同" },

  // Filter skenario
  filterAll: { id: "Semua", en: "All", zh: "全部" },
  filterGeneral: { id: "Umum", en: "General", zh: "通用" },
  filterCalcine: { id: "Calcine", en: "Calcine", zh: "焙砂" },
  filterOutdoor: { id: "Outdoor", en: "Outdoor", zh: "室外" },
  filterIndoor: { id: "Indoor", en: "Indoor", zh: "室内" },
  filterLab: { id: "Lab", en: "Lab", zh: "实验室" },
  filterNight: { id: "Malam", en: "Night", zh: "夜间" },
  filterManual: { id: "Manual", en: "Manual", zh: "手动" },

  // Katalog template: label, keterangan, rekomendasi
  templateDefaultCalcineLabel: {
    id: "Default - Sampling Calcine (R50)",
    en: "Default - Calcine Sampling (R50)",
    zh: "默认 - 焙砂取样（R50）",
  },
  templateDefaultCalcineDescription: {
    id: "Baseline seimbang untuk sampling calcine rutin dengan autofocus aktif.",
    en: "A balanced baseline for routine calcine sampling with autofocus on.",
    zh: "适用于日常焙砂取样的均衡基准，启用自动对焦。",
  },
  templateDefaultCalcineRecommended: {
    id: "Sampling calcine rutin dengan pencahayaan stabil dan framing umum.",
    en: "Routine calcine sampling with stable lighting and general framing.",
    zh: "光照稳定、常规构图的日常焙砂取样。",
  },
  templateHighResLabel: {
    id: "Sampling Resolusi Tinggi (R50)",
    en: "High-Resolution Sampling (R50)",
    zh: "高分辨率取样（R50）",
  },
  templateHighResDescription: {
    id: "Preset lebih tajam dan sedikit lebih lambat untuk sampel statis dengan cahaya kuat.",
    en: "A sharper, slightly slower preset for static samples in strong light.",
    zh: "更锐利、稍慢的预设，适用于强光下的静态样品。",
  },
  templateHighResRecommended: {
    id: "Sampel detail tinggi saat pencahayaan terkontrol dan ketajaman diprioritaskan.",
    en: "High-detail samples when lighting is controlled and sharpness is the priority.",
    zh: "光照可控且优先考虑锐度时的高细节样品。",
  },
  templateLowLightLabel: {
    id: "Inspeksi Minim Cahaya",
    en: "Low-Light Inspection",
    zh: "弱光检查",
  },
  templateLowLightDescription: {
    id: "Profil eksposur lebih terang untuk area sampling yang redup dengan shutter lebih lambat.",
    en: "A brighter exposure profile for dim sampling areas, with a slower shutter.",
    zh: "曝光更亮的方案，快门较慢，适用于昏暗的取样区域。",
  },
  templateLowLightRecommended: {
    id: "Zona plant redup, station yang sedikit teduh, atau inspeksi sore hari.",
    en: "Dim plant zones, slightly shaded stations or late-afternoon inspections.",
    zh: "昏暗的工厂区域、略有遮阴的工位或傍晚检查。",
  },
  templateFastCaptureLabel: {
    id: "Jalur Capture Cepat",
    en: "Fast Capture Line",
    zh: "快速拍摄线",
  },
  templateFastCaptureDescription: {
    id: "Profil shutter lebih cepat untuk siklus capture berulang dan workflow operator yang dinamis.",
    en: "A faster shutter profile for repeated capture cycles and a dynamic operator workflow.",
    zh: "快门更快的方案，适用于重复拍摄周期和节奏多变的操作流程。",
  },
  templateFastCaptureRecommended: {
    id: "Capture throughput tinggi saat motion blur harus ditekan.",
    en: "High-throughput capture when motion blur must be kept down.",
    zh: "需要抑制运动模糊的高频次拍摄。",
  },
  templateHighDetailLabLabel: {
    id: "Lab Detail Tinggi",
    en: "High-Detail Lab",
    zh: "实验室高细节",
  },
  templateHighDetailLabDescription: {
    id: "Preset depth-of-field lebih dalam untuk pencahayaan terkontrol dan inspeksi permukaan detail.",
    en: "A deeper depth-of-field preset for controlled lighting and detailed surface inspection.",
    zh: "景深更大的预设，适用于可控光照和精细的表面检查。",
  },
  templateHighDetailLabRecommended: {
    id: "Lab atau bench terkontrol saat tekstur dan depth-of-field sangat penting.",
    en: "A lab or controlled bench where texture and depth of field matter most.",
    zh: "对纹理和景深要求很高的实验室或受控工作台。",
  },
  templateManualInspectionLabel: {
    id: "Inspeksi Manual",
    en: "Manual Inspection",
    zh: "手动检查",
  },
  templateManualInspectionDescription: {
    id: "Profil fokus manual untuk framing dan kontrol eksposur yang dipandu operator.",
    en: "A manual focus profile for operator-guided framing and exposure control.",
    zh: "手动对焦方案，由操作员掌控构图和曝光。",
  },
  templateManualInspectionRecommended: {
    id: "Inspeksi yang dipandu operator saat framing dan eksposur perlu penilaian manual.",
    en: "Operator-guided inspections where framing and exposure need manual judgement.",
    zh: "构图和曝光需要人工判断、由操作员主导的检查。",
  },
  templateDayOutdoorLabel: {
    id: "Calcine Outdoor Shift Siang",
    en: "Calcine Outdoor Day Shift",
    zh: "焙砂室外白班",
  },
  templateDayOutdoorDescription: {
    id: "Preset daylight cerah untuk titik sampling calcine outdoor atau area dengan eksposur tinggi.",
    en: "A bright daylight preset for outdoor calcine sampling points or high-exposure areas.",
    zh: "明亮日光预设，适用于室外焙砂取样点或高曝光区域。",
  },
  templateDayOutdoorRecommended: {
    id: "Bin outdoor, deck sampling terbuka, atau kondisi shift siang yang sangat terang.",
    en: "Outdoor bins, open sampling decks or very bright day-shift conditions.",
    zh: "室外 Bin、露天取样平台或非常明亮的白班环境。",
  },
  templateIndoorConveyorLabel: {
    id: "Calcine Conveyor Indoor",
    en: "Calcine Indoor Conveyor",
    zh: "焙砂室内输送带",
  },
  templateIndoorConveyorDescription: {
    id: "Preset cepat dan seimbang untuk conveyor indoor atau jalur transfer tertutup.",
    en: "A fast, balanced preset for indoor conveyors or enclosed transfer lines.",
    zh: "快速且均衡的预设，适用于室内输送带或封闭转运线。",
  },
  templateIndoorConveyorRecommended: {
    id: "Sampling conveyor indoor, aliran material bergerak, dan pencahayaan plant fluorescent.",
    en: "Indoor conveyor sampling, moving material flow and fluorescent plant lighting.",
    zh: "室内输送带取样、流动的物料以及工厂荧光灯照明。",
  },
  templateLabMacroLabel: {
    id: "Calcine Lab Macro",
    en: "Calcine Lab Macro",
    zh: "焙砂实验室微距",
  },
  templateLabMacroDescription: {
    id: "Preset berorientasi detail untuk sampel lab close-up dan review tekstur permukaan.",
    en: "A detail-oriented preset for close-up lab samples and surface texture review.",
    zh: "注重细节的预设，适用于实验室样品特写和表面纹理检查。",
  },
  templateLabMacroRecommended: {
    id: "Tray sampel jarak dekat, framing ala macro, dan bench inspeksi terkontrol.",
    en: "Close-range sample trays, macro-style framing and controlled inspection benches.",
    zh: "近距离样品托盘、微距式构图和受控检查台。",
  },
  templateNightShiftLabel: {
    id: "Calcine Shift Malam",
    en: "Calcine Night Shift",
    zh: "焙砂夜班",
  },
  templateNightShiftDescription: {
    id: "Preset minim cahaya untuk zona sampling shift malam yang gelap atau dominan tungsten.",
    en: "A low-light preset for night-shift sampling zones that are dark or tungsten-lit.",
    zh: "弱光预设，适用于昏暗或以钨丝灯为主的夜班取样区域。",
  },
  templateNightShiftRecommended: {
    id: "Pengecekan shift malam, lorong plant yang gelap, dan pencahayaan industri hangat.",
    en: "Night-shift checks, dark plant corridors and warm industrial lighting.",
    zh: "夜班检查、昏暗的工厂通道和暖色工业照明。",
  },
  templateManualOnlyLabel: { id: "Manual Saja", en: "Manual Only", zh: "仅手动" },
  templateManualOnlyDescription: {
    id: "Gunakan saat operator ingin kontrol yang lebih ketat atas eksposur dan fokus.",
    en: "Use when the operator wants tighter control over exposure and focus.",
    zh: "当操作员希望更严格地控制曝光和对焦时使用。",
  },
  templateManualOnlyRecommended: {
    id: "Kasus khusus saat operator perlu override automasi dan menyetel langsung.",
    en: "Special cases where the operator needs to override automation and adjust directly.",
    zh: "操作员需要覆盖自动设置并直接调整的特殊情况。",
  },

  // Badge template
  badgeBalanced: { id: "Seimbang", en: "Balanced", zh: "均衡" },
  badgeRoutine: { id: "Rutin", en: "Routine", zh: "日常" },
  badgeAutofocus: { id: "Autofocus", en: "Autofocus", zh: "自动对焦" },
  badgeHighDetail: { id: "Detail Tinggi", en: "High Detail", zh: "高细节" },
  badgeControlledLight: { id: "Cahaya Terkontrol", en: "Controlled Light", zh: "可控光照" },
  badgeLowLight: { id: "Minim Cahaya", en: "Low Light", zh: "弱光" },
  badgeBrightExposure: { id: "Eksposur Cerah", en: "Bright Exposure", zh: "明亮曝光" },
  badgeFast: { id: "Cepat", en: "Fast", zh: "快速" },
  badgeAntiBlur: { id: "Anti Blur", en: "Anti Blur", zh: "防模糊" },
  badgeLab: { id: "Lab", en: "Lab", zh: "实验室" },
  badgeDeepFocus: { id: "Fokus Dalam", en: "Deep Focus", zh: "大景深" },
  badgeManualFocus: { id: "Fokus Manual", en: "Manual Focus", zh: "手动对焦" },
  badgeManual: { id: "Manual", en: "Manual", zh: "手动" },
  badgeOperatorControl: { id: "Kontrol Operator", en: "Operator Control", zh: "操作员控制" },
  badgeInspection: { id: "Inspeksi", en: "Inspection", zh: "检查" },
  badgeCalcine: { id: "Calcine", en: "Calcine", zh: "焙砂" },
  badgeOutdoor: { id: "Outdoor", en: "Outdoor", zh: "室外" },
  badgeDayShift: { id: "Shift Siang", en: "Day Shift", zh: "白班" },
  badgeIndoor: { id: "Indoor", en: "Indoor", zh: "室内" },
  badgeConveyor: { id: "Conveyor", en: "Conveyor", zh: "输送带" },
  badgeMacro: { id: "Macro", en: "Macro", zh: "微距" },
  badgeNightShift: { id: "Shift Malam", en: "Night Shift", zh: "夜班" },
  badgeFallback: { id: "Fallback", en: "Fallback", zh: "回退" },
});

/** Telemetri host (panel, hook, pustaka) dan alamat endpoint device. */
export const deviceTelemetryMessages = defineMessages({
  notAvailable: { id: "Tidak tersedia", en: "Not available", zh: "不可用" },
  capacity: {
    id: "{used} · {free} / {total} GiB tersedia",
    en: "{used} · {free} / {total} GiB available",
    zh: "{used} · 可用 {free} / {total} GiB",
  },
  cpuHost: { id: "CPU host", en: "Host CPU", zh: "主机 CPU" },
  ramHost: { id: "RAM host", en: "Host RAM", zh: "主机内存" },
  dataDisk: { id: "Disk penyimpanan data", en: "Data storage disk", zh: "数据存储磁盘" },
  cpuTemperature: { id: "Suhu CPU", en: "CPU temperature", zh: "CPU 温度" },
  sensorUnavailable: {
    id: "Sensor tidak tersedia",
    en: "Sensor not available",
    zh: "传感器不可用",
  },
  hostUptime: { id: "Uptime host", en: "Host uptime", zh: "主机运行时间" },
  uptimeValue: {
    id: "{days} hari {hours} jam",
    en: "{days} d {hours} h",
    zh: "{days} 天 {hours} 小时",
  },
  loading: { id: "Memuat...", en: "Loading...", zh: "加载中…" },
  measuredNote: {
    id: "Diukur: {when}. CPU rata-rata selama {window} ms. Disk adalah filesystem tempat data aplikasi disimpan.",
    en: "Measured: {when}. CPU averaged over {window} ms. The disk is the filesystem where application data is stored.",
    zh: "测量时间：{when}。CPU 为 {window} ms 内的平均值。磁盘指存放应用数据的文件系统。",
  },
  telemetryLoadFailed: {
    id: "Telemetri gagal dimuat. Coba refresh kembali.",
    en: "Telemetry failed to load. Try refreshing again.",
    zh: "遥测数据加载失败，请重新刷新。",
  },
  invalidEdgeAddress: {
    id: "Alamat Edge API tidak valid",
    en: "Invalid Edge API address",
    zh: "Edge API 地址无效",
  },
  addressNotSet: { id: "Alamat belum diisi", en: "Address not set", zh: "尚未填写地址" },
});
