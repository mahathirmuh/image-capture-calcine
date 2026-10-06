import { defineMessages } from "@/lib/i18n";

// Halaman Dashboard. Nama plant, label slot (BIN 1 / BIN 2), nama berkas, nama
// device, isi event device, dan nilai connectionState adalah data atau pengenal
// teknis -- tampil apa adanya dan tidak ada di kamus ini.
export const dashboardMessages = defineMessages({
  pageTitle: { id: "Dashboard", en: "Dashboard", zh: "仪表板" },
  pageDescription: {
    id: "Ringkasan capture, kamera, dan status device.",
    en: "Summary of captures, the camera and device status.",
    zh: "拍摄、相机和设备状态概览。",
  },
  updatedAt: { id: "Diperbarui {time}", en: "Updated {time}", zh: "更新于 {time}" },
  refresh: { id: "Refresh dashboard", en: "Refresh dashboard", zh: "刷新仪表板" },

  // Label sumbu grafik 7 hari. Teks asalnya memang singkatan Inggris.
  daySun: { id: "Sun", en: "Sun", zh: "周日" },
  dayMon: { id: "Mon", en: "Mon", zh: "周一" },
  dayTue: { id: "Tue", en: "Tue", zh: "周二" },
  dayWed: { id: "Wed", en: "Wed", zh: "周三" },
  dayThu: { id: "Thu", en: "Thu", zh: "周四" },
  dayFri: { id: "Fri", en: "Fri", zh: "周五" },
  daySat: { id: "Sat", en: "Sat", zh: "周六" },

  // Nama jenis event device (eventType tetap dipakai sebagai kunci).
  eventMetadataFinalized: {
    id: "Metadata difinalisasi",
    en: "Metadata finalized",
    zh: "元数据已完成",
  },
  eventCaptureTriggerFailed: {
    id: "Trigger capture gagal",
    en: "Capture trigger failed",
    zh: "拍摄触发失败",
  },
  eventCaptureJobFailed: {
    id: "Job capture gagal",
    en: "Capture job failed",
    zh: "拍摄任务失败",
  },
  eventCaptureMissingAsset: {
    id: "Asset capture tidak tersedia",
    en: "Capture asset not available",
    zh: "拍摄文件不可用",
  },
  eventCaptureException: {
    id: "Capture exception",
    en: "Capture exception",
    zh: "拍摄异常",
  },
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
    zh: "拍摄数据库同步失败",
  },

  notAvailable: { id: "Belum tersedia", en: "Not available yet", zh: "暂无" },
  compareCount: {
    id: "{count} capture ({pct}%)",
    en: "{count} captures ({pct}%)",
    zh: "{count} 次拍摄（{pct}%）",
  },
  captureCount: { id: "{count} capture", en: "{count} captures", zh: "{count} 次拍摄" },

  // Waktu relatif. Selalu disisipkan ke tengah kalimat lain lewat {when}.
  relativeNotChecked: { id: "Belum dicek", en: "not checked yet", zh: "尚未检查" },
  relativeJustNow: { id: "Baru saja", en: "just now", zh: "刚刚" },
  relativeMinutes: { id: "{count} menit lalu", en: "{count} min ago", zh: "{count} 分钟前" },
  relativeHours: { id: "{count} jam lalu", en: "{count} h ago", zh: "{count} 小时前" },
  relativeDays: { id: "{count} hari lalu", en: "{count} d ago", zh: "{count} 天前" },

  modelUnknown: { id: "Model tidak diketahui", en: "Unknown model", zh: "型号未知" },
  notDetected: { id: "Belum terdeteksi", en: "Not detected yet", zh: "尚未检测到" },

  readinessAttention: { id: "Perlu perhatian", en: "Needs attention", zh: "需要关注" },
  readinessReady: { id: "Siap", en: "Ready", zh: "就绪" },
  readinessCameraCheck: {
    id: "Edge siap, kamera perlu dicek",
    en: "Edge ready, camera needs checking",
    zh: "边缘设备就绪，相机需检查",
  },

  // Catatan operasional di bawah daftar perhatian.
  noteEdgeUnreachable: {
    id: "Edge device belum reachable. Cek Mini PC, jaringan LAN, atau service edge API.",
    en: "The edge device is not reachable. Check the Mini PC, the LAN or the Edge API service.",
    zh: "边缘设备暂时无法访问。请检查迷你电脑、局域网或 Edge API 服务。",
  },
  noteCameraNotReady: {
    id: "Edge API reachable, tetapi kamera belum terhubung atau sesi belum siap.",
    en: "The Edge API is reachable, but the camera is not connected or the camera session is not ready.",
    zh: "Edge API 可以访问，但相机尚未连接或相机会话尚未就绪。",
  },
  noteNoCaptureToday: {
    id: "Belum ada capture hari ini. Jika shift sudah berjalan, lakukan pengecekan alur capture.",
    en: "No captures today yet. If the shift is already under way, check the capture flow.",
    zh: "今天还没有拍摄。如果班次已经开始，请检查拍摄流程。",
  },
  noteLastCaptureSaved: {
    id: "Capture terakhir tersimpan pada {time}.",
    en: "The last capture was saved on {time}.",
    zh: "最近一次拍摄保存于 {time}。",
  },
  noteNoCaptureInRegistry: {
    id: "Belum ada capture yang tercatat di registry.",
    en: "No captures are recorded in the registry yet.",
    zh: "登记表中还没有拍摄记录。",
  },
  noteRegistryLoadFailed: {
    id: "Registry DB belum bisa dimuat: {reason}",
    en: "The registry DB could not be loaded: {reason}",
    zh: "无法加载登记表数据库：{reason}",
  },
  noteRegistryLastCapture: {
    id: "Registry DB terakhir mencatat capture {when}.",
    en: "The registry DB last recorded a capture {when}.",
    zh: "登记表数据库最近一次记录拍摄：{when}。",
  },
  noteNoMetadata: {
    id: "Belum ada metadata capture di registry MSSQL.",
    en: "There is no capture metadata in the MSSQL registry yet.",
    zh: "MSSQL 登记表中还没有拍摄元数据。",
  },
  noteDeviceLogLoadFailed: {
    id: "Log device belum bisa dimuat: {reason}",
    en: "The device log could not be loaded: {reason}",
    zh: "无法加载设备日志：{reason}",
  },
  noteLatestDeviceEvent: {
    id: "Event device terbaru {when}: {event}.",
    en: "Latest device event {when}: {event}.",
    zh: "最新设备事件（{when}）：{event}。",
  },
  noteNoDeviceEvent: {
    id: "Belum ada event device terbaru yang tercatat di MSSQL.",
    en: "No recent device events are recorded in MSSQL yet.",
    zh: "MSSQL 中还没有最近的设备事件记录。",
  },

  // Empat kartu kesegaran data.
  historyTitle: { id: "Riwayat capture", en: "Capture history", zh: "拍摄历史" },
  historyHasCapture: { id: "Ada capture", en: "Has captures", zh: "已有拍摄" },
  historyNoCapture: { id: "Belum ada capture", en: "No captures yet", zh: "暂无拍摄" },
  historyLastCapture: {
    id: "Capture terakhir {when}.",
    en: "Last capture {when}.",
    zh: "最近一次拍摄：{when}。",
  },
  historyEmpty: {
    id: "Registry belum memuat satu pun capture.",
    en: "The registry does not contain any captures yet.",
    zh: "登记表中还没有任何拍摄。",
  },
  historyRecordsReady: {
    id: "{count} record terbaru siap direview.",
    en: "{count} latest records ready for review.",
    zh: "最近 {count} 条记录可供查看。",
  },
  historyStartHint: {
    id: "Mulai dari halaman Capture, atau periksa apakah penyimpanan ke folder jaringan gagal.",
    en: "Start from the Capture page, or check whether saving to the network folder failed.",
    zh: "请从“拍摄”页面开始，或检查保存到网络文件夹是否失败。",
  },
  openGallery: { id: "Buka Gallery", en: "Open Gallery", zh: "打开图库" },

  edgeTitle: { id: "Edge device", en: "Edge device", zh: "边缘设备" },
  connected: { id: "Terhubung", en: "Connected", zh: "已连接" },
  offline: { id: "Offline", en: "Offline", zh: "离线" },
  edgeStatusUpdated: {
    id: "Status terakhir diperbarui {when}.",
    en: "Status last updated {when}.",
    zh: "状态最近更新：{when}。",
  },
  edgeUnreachableAtRefresh: {
    id: "Dashboard belum bisa menjangkau edge device saat refresh terakhir.",
    en: "The dashboard could not reach the edge device at the last refresh.",
    zh: "上次刷新时仪表板无法连接边缘设备。",
  },
  edgeStateCameraConnected: {
    id: "Status koneksi: {state} • kamera terhubung.",
    en: "Connection state: {state} • camera connected.",
    zh: "连接状态：{state} • 相机已连接。",
  },
  edgeStateCameraNotReady: {
    id: "Status koneksi: {state} • kamera belum siap.",
    en: "Connection state: {state} • camera not ready.",
    zh: "连接状态：{state} • 相机未就绪。",
  },
  edgeOfflineHint: {
    id: "Periksa Mini PC, jaringan LAN, service edge API, atau halaman Devices untuk diagnosa lanjutan.",
    en: "Check the Mini PC, the LAN, the Edge API service, or the Devices page for further diagnosis.",
    zh: "请检查迷你电脑、局域网、Edge API 服务，或前往“设备”页面进一步诊断。",
  },
  openDevices: { id: "Buka Devices", en: "Open Devices", zh: "打开设备" },

  registryTitle: { id: "Registry DB", en: "Registry DB", zh: "登记表数据库" },
  registryRecorded: { id: "Tercatat", en: "Recorded", zh: "已记录" },
  registryNeedsCheck: { id: "Perlu cek", en: "Needs checking", zh: "需检查" },
  registryNoLog: { id: "Belum ada log", en: "No log yet", zh: "暂无记录" },
  registryLastCapture: {
    id: "Capture DB terakhir {when}.",
    en: "Last capture in the DB {when}.",
    zh: "数据库中最近一次拍摄：{when}。",
  },
  registryLoadFailed: {
    id: "Dashboard belum bisa memuat metadata capture dari MSSQL.",
    en: "The dashboard could not load capture metadata from MSSQL.",
    zh: "仪表板无法从 MSSQL 加载拍摄元数据。",
  },
  registryNoMetadata: {
    id: "Belum ada metadata capture yang tercatat di registry MSSQL.",
    en: "No capture metadata is recorded in the MSSQL registry yet.",
    zh: "MSSQL 登记表中还没有拍摄元数据记录。",
  },
  registryCounts: {
    id: "{today} capture hari ini • {total} total record.",
    en: "{today} captures today • {total} records in total.",
    zh: "今日拍摄 {today} 次 • 共 {total} 条记录。",
  },
  registryPendingHint: {
    id: "Capture akan muncul di sini setelah tersimpan dan tercatat ke DB.",
    en: "Captures appear here once they are saved and recorded in the DB.",
    zh: "拍摄保存并记入数据库后将显示在这里。",
  },
  auditRegistry: { id: "Audit Registry", en: "Audit Registry", zh: "审核登记表" },

  autoSaveTitle: { id: "Auto-save target", en: "Auto-save target", zh: "自动保存目标" },
  autoSaveConfigured: { id: "Sudah diisi", en: "Configured", zh: "已设置" },
  autoSaveNeedsSetup: { id: "Perlu setup", en: "Needs setup", zh: "需要设置" },
  autoSaveLoaded: {
    id: "App server sudah memuat path target untuk auto-save.",
    en: "The app server has loaded the target path for auto-save.",
    zh: "应用服务器已加载自动保存的目标路径。",
  },
  autoSaveMissing: {
    id: "NETWORK_SAVE_ROOT belum tersedia untuk app server ini.",
    en: "NETWORK_SAVE_ROOT is not available to this app server.",
    zh: "此应用服务器尚未提供 NETWORK_SAVE_ROOT。",
  },
  autoSaveHint: {
    id: "Buka Storage untuk cek env target path dan kesiapan write probe.",
    en: "Open Storage to check the target path env and whether the write probe is ready.",
    zh: "请打开“存储”检查目标路径环境变量和写入探测是否就绪。",
  },
  openStorage: { id: "Buka Storage", en: "Open Storage", zh: "打开存储" },

  // Daftar "Perhatian & Tindakan Berikutnya".
  attentionEdgeOfflineTitle: {
    id: "Edge device sedang offline",
    en: "The edge device is offline",
    zh: "边缘设备已离线",
  },
  attentionEdgeOfflineDetail: {
    id: "Dashboard tidak bisa menjangkau edge device. Buka Devices untuk cek connection state dan identitas Mini PC.",
    en: "The dashboard cannot reach the edge device. Open Devices to check the connection state and the Mini PC identity.",
    zh: "仪表板无法连接边缘设备。请打开“设备”检查连接状态和迷你电脑标识。",
  },
  attentionCameraTitle: {
    id: "Sesi kamera perlu perhatian",
    en: "The camera session needs attention",
    zh: "相机会话需要关注",
  },
  attentionCameraDetail: {
    id: "Edge API terhubung, tetapi kamera belum siap untuk capture baru.",
    en: "The Edge API is connected, but the camera is not ready for a new capture.",
    zh: "Edge API 已连接，但相机尚未准备好进行新的拍摄。",
  },
  checkCameraStatus: { id: "Cek Status Kamera", en: "Check Camera Status", zh: "检查相机状态" },
  attentionStorageTitle: {
    id: "Target auto-save belum dikonfigurasi",
    en: "The auto-save target is not configured",
    zh: "尚未配置自动保存目标",
  },
  attentionStorageDetail: {
    id: "App server belum memuat NETWORK_SAVE_ROOT. Storage page akan membantu verifikasi env dan alur save.",
    en: "The app server has not loaded NETWORK_SAVE_ROOT. The Storage page helps verify the env and the save flow.",
    zh: "应用服务器尚未加载 NETWORK_SAVE_ROOT。“存储”页面可帮助核实环境变量和保存流程。",
  },
  configureStorage: { id: "Konfigurasi Storage", en: "Configure Storage", zh: "配置存储" },
  attentionRegistryTitle: {
    id: "Registry capture belum sinkron",
    en: "The capture registry is not in sync",
    zh: "拍摄登记表尚未同步",
  },
  attentionRegistryDetail: {
    id: "Dashboard gagal memuat ringkasan capture dari MSSQL. Buka Gallery untuk cek riwayat registry atau verifikasi koneksi DB.",
    en: "The dashboard failed to load the capture summary from MSSQL. Open Gallery to check the registry history or verify the DB connection.",
    zh: "仪表板无法从 MSSQL 加载拍摄摘要。请打开“图库”查看登记表历史，或核实数据库连接。",
  },
  checkGallery: { id: "Cek Gallery", en: "Check Gallery", zh: "查看图库" },
  attentionNoCaptureTitle: {
    id: "Belum ada capture hari ini",
    en: "No captures today yet",
    zh: "今天还没有拍摄",
  },
  attentionNoCaptureDetail: {
    id: "Jika shift sudah berjalan, buka Capture untuk uji autofocus dan ambil sample baru.",
    en: "If the shift is already under way, open Capture to test autofocus and take a new sample.",
    zh: "如果班次已经开始，请打开“拍摄”测试自动对焦并拍摄新样品。",
  },
  openCapture: { id: "Buka Capture", en: "Open Capture", zh: "打开拍摄" },

  // Panel "Snapshot Operasional".
  snapshotEyebrow: { id: "Snapshot Operasional", en: "Operational Snapshot", zh: "运营快照" },
  snapshotCameraReady: {
    id: "Kamera terhubung dan siap dipakai untuk capture berikutnya.",
    en: "The camera is connected and ready for the next capture.",
    zh: "相机已连接，可以进行下一次拍摄。",
  },
  snapshotCameraAttention: {
    id: "Perangkat edge online, tetapi koneksi kamera masih perlu perhatian.",
    en: "The edge device is online, but the camera connection still needs attention.",
    zh: "边缘设备在线，但相机连接仍需关注。",
  },
  snapshotEdgeUnconfirmed: {
    id: "Dashboard belum bisa mengonfirmasi koneksi edge device saat ini.",
    en: "The dashboard cannot confirm the edge device connection right now.",
    zh: "仪表板目前无法确认边缘设备的连接。",
  },
  lastCapture: { id: "Capture terakhir", en: "Last capture", zh: "最近一次拍摄" },
  capturesThisWeek: { id: "Capture minggu ini", en: "Captures this week", zh: "本周拍摄" },
  plantsCoveredToday: {
    id: "Plant tercakup hari ini",
    en: "Plants covered today",
    zh: "今日已覆盖工厂",
  },
  localCopies: {
    id: "Salinan di browser ini",
    en: "Copies in this browser",
    zh: "此浏览器中的副本",
  },
  photoCount: { id: "{count} foto", en: "{count} photos", zh: "{count} 张照片" },

  actionCaptureDescription: {
    id: "Mulai autofocus, ambil gambar, dan simpan hasil.",
    en: "Start autofocus, take a picture and save the result.",
    zh: "开始自动对焦、拍摄并保存结果。",
  },
  reviewGallery: { id: "Tinjau Gallery", en: "Review Gallery", zh: "查看图库" },
  actionGalleryDescription: {
    id: "Audit hasil capture, compare, rename, atau download batch.",
    en: "Audit captures, compare, rename or download in batches.",
    zh: "审核拍摄结果、对比、重命名或批量下载。",
  },
  checkStorage: { id: "Cek Storage", en: "Check Storage", zh: "检查存储" },
  actionStorageDescription: {
    id: "Verifikasi share path, edge reachability, dan fallback save.",
    en: "Verify the share path, edge reachability and the fallback save.",
    zh: "核实共享路径、边缘设备连通性和回退保存。",
  },
  operatorSettings: { id: "Settings Operator", en: "Operator Settings", zh: "操作员设置" },
  actionSettingsDescription: {
    id: "Atur pattern filename, counter, dan akses folder simpan.",
    en: "Set the filename pattern, the counter and access to the save folder.",
    zh: "设置文件名规则、计数器和保存文件夹的访问权限。",
  },

  attentionHeading: {
    id: "Perhatian & Tindakan Berikutnya",
    en: "Attention & Next Actions",
    zh: "注意事项与后续操作",
  },
  operationallyReady: {
    id: "Siap secara operasional",
    en: "Operationally ready",
    zh: "运营就绪",
  },
  operationallyReadyDetail: {
    id: "Edge device online, storage target terkonfigurasi, dan dashboard tidak melihat blocker utama saat ini.",
    en: "The edge device is online, the storage target is configured, and the dashboard sees no major blocker right now.",
    zh: "边缘设备在线，存储目标已配置，仪表板目前未发现主要阻碍。",
  },
  sourceNote: {
    id: 'Angka capture di halaman ini dibaca dari registry MSSQL, jadi sama di setiap PC. Hanya "Salinan di browser ini" yang bersifat lokal — itu memang menghitung isi penyimpanan browser yang sedang dipakai.',
    en: 'The capture figures on this page are read from the MSSQL registry, so they are the same on every PC. Only "Copies in this browser" is local — it counts what is stored in the browser you are using.',
    zh: "本页的拍摄数字读取自 MSSQL 登记表，因此在每台电脑上都相同。只有“此浏览器中的副本”是本地数据——它统计的是当前所用浏览器中存储的内容。",
  },

  // Deret KPI.
  totalCaptures: { id: "Total Capture", en: "Total Captures", zh: "拍摄总数" },
  registryUnreadable: {
    id: "Registry belum bisa dibaca",
    en: "The registry could not be read",
    zh: "无法读取登记表",
  },
  allTimeAllPlants: {
    id: "Semua waktu, seluruh plant",
    en: "All time, all plants",
    zh: "全部时间，所有工厂",
  },
  waitingForRegistry: {
    id: "Menunggu registry",
    en: "Waiting for the registry",
    zh: "正在等待登记表",
  },
  capturesToday: { id: "Capture Hari Ini", en: "Captures Today", zh: "今日拍摄" },
  operatorLocalDate: {
    id: "Tanggal lokal operator",
    en: "Operator's local date",
    zh: "操作员本地日期",
  },
  camera: { id: "Kamera", en: "Camera", zh: "相机" },
  sessionActive: { id: "Sesi aktif", en: "Session active", zh: "会话进行中" },
  recordedSize: { id: "Ukuran Tercatat", en: "Recorded Size", zh: "已记录大小" },
  recordedSizeHint: {
    id: "Total berkas menurut registry",
    en: "Total file size according to the registry",
    zh: "登记表统计的文件总大小",
  },

  // Sebaran dan tren.
  byLocation: { id: "Capture per Lokasi", en: "Captures by Location", zh: "按位置统计拍摄" },
  noCaptures: { id: "Belum ada capture.", en: "No captures yet.", zh: "还没有拍摄。" },
  otherLocation: {
    id: "Lainnya / belum ditentukan",
    en: "Other / not specified",
    zh: "其他 / 未指定",
  },
  byBin: { id: "Capture per Bin", en: "Captures by Bin", zh: "按 Bin 统计拍摄" },
  unspecified: { id: "Belum ditentukan", en: "Not specified", zh: "未指定" },
  last7Days: {
    id: "Capture — 7 Hari Terakhir",
    en: "Captures — Last 7 Days",
    zh: "拍摄 — 最近 7 天",
  },
  capturesThisWeekCount: {
    id: "{count} capture minggu ini",
    en: "{count} captures this week",
    zh: "本周拍摄 {count} 次",
  },

  // Tiga daftar di kaki halaman.
  latestCaptures: { id: "Capture Terbaru", en: "Latest Captures", zh: "最新拍摄" },
  viewAll: { id: "Lihat semua", en: "View all", zh: "查看全部" },
  latestCapturesEmpty: {
    id: "Metadata capture dari MSSQL akan muncul di sini.",
    en: "Capture metadata from MSSQL will appear here.",
    zh: "来自 MSSQL 的拍摄元数据将显示在这里。",
  },
  saveBreakdown: {
    id: "{saved} tersimpan ke folder jaringan • {downloaded} baru diunduh lokal.",
    en: "{saved} saved to the network folder • {downloaded} only downloaded locally.",
    zh: "{saved} 张已保存到网络文件夹 • {downloaded} 张仅下载到本地。",
  },
  noSummary: {
    id: "Belum ada ringkasan untuk ditampilkan.",
    en: "No summary to show yet.",
    zh: "暂无可显示的摘要。",
  },
  latestDeviceEvents: {
    id: "Event Device Terbaru",
    en: "Latest Device Events",
    zh: "最新设备事件",
  },
  deviceEventsEmpty: {
    id: "Event operasional device akan muncul di sini.",
    en: "Device operational events will appear here.",
    zh: "设备运行事件将显示在这里。",
  },
  deviceHealth: { id: "Kesehatan Device", en: "Device Health", zh: "设备健康状况" },
  manage: { id: "Kelola", en: "Manage", zh: "管理" },
  miniPc: { id: "Mini PC", en: "Mini PC", zh: "迷你电脑" },
  connectionState: { id: "Status koneksi", en: "Connection state", zh: "连接状态" },
  agentVersion: { id: "Versi Agent", en: "Agent Version", zh: "Agent 版本" },
  cpuRamDisk: { id: "CPU / RAM / Disk", en: "CPU / RAM / Disk", zh: "CPU / 内存 / 磁盘" },
  uptime: { id: "Uptime", en: "Uptime", zh: "运行时间" },
});
