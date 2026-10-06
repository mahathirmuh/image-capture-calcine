import { defineMessages } from "@/lib/i18n";

// Teks halaman Gallery. Nama plant, label slot (BIN 1, TRAIN 2), nama berkas,
// dan isi CSV yang diekspor bukan bagian dari kamus ini -- itu data, bukan
// teks antarmuka.
export const galleryMessages = defineMessages({
  // Kepala halaman
  descriptionAllPlants: {
    id: "Hasil capture dari semua plant.",
    en: "Captures from all plants.",
    zh: "所有工厂的拍摄结果。",
  },
  descriptionPlant: {
    id: "Hasil capture {plant}.",
    en: "Captures from {plant}.",
    zh: "{plant} 的拍摄结果。",
  },
  loadFailedShort: {
    id: "Galeri belum dapat dimuat.",
    en: "The gallery could not be loaded.",
    zh: "图库暂时无法加载。",
  },
  checkingAccess: {
    id: "Memeriksa akses galeri…",
    en: "Checking gallery access…",
    zh: "正在检查图库访问权限…",
  },
  compare: { id: "Bandingkan", en: "Compare", zh: "对比" },
  download: { id: "Unduh", en: "Download", zh: "下载" },
  exportCsv: { id: "Ekspor CSV", en: "Export CSV", zh: "导出 CSV" },

  // Kartu ringkasan
  filteredResults: { id: "Hasil Tersaring", en: "Filtered Results", zh: "筛选结果" },
  imagesOnNetworkFolder: {
    id: "{count} image di folder jaringan",
    en: "{count} images in the network folder",
    zh: "网络文件夹中有 {count} 张图片",
  },
  selectedItems: { id: "Item Terpilih", en: "Selected Items", zh: "已选项目" },
  selectedReady: {
    id: "{size} siap compare/download",
    en: "{size} ready to compare/download",
    zh: "{size} 可对比/下载",
  },
  noneSelected: {
    id: "Belum ada item dipilih",
    en: "No items selected yet",
    zh: "尚未选择任何项目",
  },
  visibleStorage: { id: "Storage Terlihat", en: "Visible Storage", zh: "可见存储" },
  totalOnNetworkFolder: {
    id: "{size} total di folder jaringan",
    en: "{size} total in the network folder",
    zh: "网络文件夹中共 {size}",
  },
  deviceStatus: { id: "Status Device", en: "Device Status", zh: "设备状态" },
  registryLog: { id: "Log Registry", en: "Registry Log", zh: "登记表日志" },
  recordsInMssql: {
    id: "{count} record capture di MSSQL",
    en: "{count} capture records in MSSQL",
    zh: "MSSQL 中有 {count} 条拍摄记录",
  },

  // Status edge device
  cameraConnected: { id: "Kamera terhubung", en: "Camera connected", zh: "相机已连接" },
  edgeOnline: { id: "Edge online", en: "Edge online", zh: "边缘设备在线" },
  offline: { id: "Offline", en: "Offline", zh: "离线" },
  edgeMonitored: {
    id: "Edge device aktif dan sedang dipantau.",
    en: "The edge device is active and being monitored.",
    zh: "边缘设备在线，正在监控中。",
  },
  deviceStatusUnavailable: {
    id: "Status device belum tersedia.",
    en: "The device status is not available yet.",
    zh: "暂无设备状态。",
  },
  badgeRefreshing: { id: "Menyegarkan status", en: "Refreshing status", zh: "正在刷新状态" },
  badgeChooseDevice: { id: "Pilih device", en: "Choose a device", zh: "请选择设备" },
  badgeReady: { id: "Siap capture", en: "Ready to capture", zh: "可以拍摄" },
  badgeEdgeActive: { id: "Edge aktif", en: "Edge active", zh: "边缘设备在线" },
  badgeNotConnected: { id: "Tidak terhubung", en: "Not connected", zh: "未连接" },
  detailLoading: {
    id: "Memuat daftar device dan memeriksa status kamera...",
    en: "Loading the device list and checking the camera status...",
    zh: "正在加载设备列表并检查相机状态…",
  },
  detailChooseDevice: {
    id: "Pilih device di bawah untuk memeriksa koneksi kamera.",
    en: "Choose a device below to check the camera connection.",
    zh: "请在下方选择设备以检查相机连接。",
  },
  detailNoActiveDevice: {
    id: "Belum ada device aktif. Buka Devices untuk memeriksa registrasi.",
    en: "There is no active device yet. Open Devices to check the registration.",
    zh: "尚无启用的设备。请打开“设备”检查登记情况。",
  },
  detailCameraNamed: {
    id: "Kamera {camera} terhubung ke edge device.",
    en: "Camera {camera} is connected to the edge device.",
    zh: "相机 {camera} 已连接到边缘设备。",
  },
  detailCameraActive: {
    id: "Kamera aktif terhubung ke edge device.",
    en: "An active camera is connected to the edge device.",
    zh: "相机已连接到边缘设备。",
  },
  detailCameraNotReady: {
    id: "Edge device terhubung, tetapi kamera USB belum siap dipakai untuk capture.",
    en: "The edge device is connected, but the USB camera is not ready for capture yet.",
    zh: "边缘设备已连接，但 USB 相机尚未准备好拍摄。",
  },
  neverChecked: { id: "Belum pernah dicek", en: "Never checked", zh: "尚未检查" },
  statusEdge: { id: "Status Edge", en: "Edge Status", zh: "边缘设备状态" },
  cameraDevice: { id: "Device kamera", en: "Camera device", zh: "相机设备" },
  chooseCameraDevice: {
    id: "Pilih device kamera",
    en: "Choose a camera device",
    zh: "选择相机设备",
  },
  lastChecked: { id: "Cek terakhir: {time}", en: "Last checked: {time}", zh: "上次检查：{time}" },
  refreshing: { id: "Menyegarkan...", en: "Refreshing...", zh: "正在刷新…" },
  refreshDevice: { id: "Refresh Device", en: "Refresh Device", zh: "刷新设备" },
  openDevices: { id: "Buka Devices", en: "Open Devices", zh: "打开设备" },
  deviceStatusLoadFailed: {
    id: "Status device gagal dimuat. Coba lagi.",
    en: "The device status could not be loaded. Try again.",
    zh: "设备状态加载失败，请重试。",
  },

  // Riwayat registry
  registryHistory: {
    id: "Riwayat Registry DB",
    en: "Registry DB History",
    zh: "登记表数据库历史记录",
  },
  registryHistoryHint: {
    id: "Menampilkan metadata capture yang tercatat di MSSQL. Preview gambar tetap berasal dari browser gallery lokal.",
    en: "Shows the capture metadata recorded in MSSQL. Image previews still come from the local browser gallery.",
    zh: "显示记录在 MSSQL 中的拍摄信息。图片预览仍来自本地浏览器图库。",
  },
  recordsMatchFilter: {
    id: "{count} record cocok filter",
    en: "{count} records match the filter",
    zh: "{count} 条记录符合筛选条件",
  },
  recordsLoadFailed: {
    id: "Gagal memuat capture_records dari MSSQL: {reason}",
    en: "Could not load capture_records from MSSQL: {reason}",
    zh: "无法从 MSSQL 加载 capture_records：{reason}",
  },
  recordsEmpty: {
    id: "Belum ada metadata capture di MSSQL yang cocok dengan filter saat ini.",
    en: "No capture metadata in MSSQL matches the current filter yet.",
    zh: "MSSQL 中暂无符合当前筛选条件的拍摄信息。",
  },
  colFileName: { id: "Nama File", en: "File Name", zh: "文件名" },
  colTime: { id: "Waktu", en: "Time", zh: "时间" },
  location: { id: "Lokasi", en: "Location", zh: "位置" },
  colBin: { id: "Bin", en: "Bin", zh: "Bin" },
  colSession: { id: "Sesi", en: "Session", zh: "场次" },
  operator: { id: "Operator", en: "Operator", zh: "操作员" },
  colStatus: { id: "Status", en: "Status", zh: "状态" },
  colMethod: { id: "Metode", en: "Method", zh: "方式" },
  savePath: { id: "Path Simpan", en: "Save Path", zh: "保存路径" },
  colDevice: { id: "Device", en: "Device", zh: "设备" },
  showingRecords: {
    id: "Menampilkan {from} sampai {to} dari {total} record",
    en: "Showing {from} to {to} of {total} records",
    zh: "显示第 {from} 至 {to} 条，共 {total} 条记录",
  },

  // Status record dan cara simpan
  statusDownloaded: { id: "Diunduh lokal", en: "Downloaded locally", zh: "已下载到本地" },
  waitingToBeSent: { id: "Menunggu dikirim", en: "Waiting to be sent", zh: "等待发送" },
  saved: { id: "Tersimpan", en: "Saved", zh: "已保存" },
  waitingSend: { id: "Menunggu kirim", en: "Waiting to send", zh: "等待发送" },
  notKnownYet: { id: "Belum diketahui", en: "Not known yet", zh: "尚不清楚" },
  methodAppNetwork: { id: "App -> network", en: "App -> network", zh: "应用 -> 网络" },
  methodShareImport: { id: "Ditambahkan manual", en: "Added manually", zh: "手动添加" },
  badgeManual: { id: "Manual", en: "Manual", zh: "手动" },
  badgeManualTitle: {
    id: "Ditaruh langsung di folder jaringan, bukan hasil capture",
    en: "Placed directly in the network folder, not captured by the app",
    zh: "直接放入网络文件夹，并非通过应用拍摄",
  },
  methodEdgeNetwork: { id: "Edge -> network", en: "Edge -> network", zh: "Edge -> 网络" },
  methodBrowserFolder: {
    id: "Browser -> folder",
    en: "Browser -> folder",
    zh: "浏览器 -> 文件夹",
  },
  methodBrowserDownload: { id: "Browser download", en: "Browser download", zh: "浏览器下载" },
  storageBrowserDownloads: {
    id: "Folder Unduhan browser - belum masuk share",
    en: "Browser Downloads folder - not on the share yet",
    zh: "浏览器下载文件夹 - 尚未进入共享",
  },
  storageSpooled: {
    id: "Di app server, menunggu dikirim ke share",
    en: "On the app server, waiting to be sent to the share",
    zh: "在应用服务器上，等待发送到共享",
  },
  storageNetworkFolder: { id: "Folder jaringan", en: "Network folder", zh: "网络文件夹" },
  storageBrowserFolder: {
    id: "Folder pilihan di browser",
    en: "Folder chosen in the browser",
    zh: "在浏览器中选择的文件夹",
  },

  // View tersimpan
  savedViews: { id: "View Tersimpan", en: "Saved Views", zh: "已保存视图" },
  savedViewsHint: {
    id: "Filter, sort, mode tampilan, dan page size terakhir akan tersimpan di browser ini.",
    en: "The last filter, sort, view mode and page size are saved in this browser.",
    zh: "最近使用的筛选、排序、显示模式和每页数量会保存在此浏览器中。",
  },
  customView: { id: "View kustom", en: "Custom view", zh: "自定义视图" },
  reapplySavedView: {
    id: "Terapkan ulang view tersimpan",
    en: "Reapply the saved view",
    zh: "重新应用已保存视图",
  },
  viewActive: { id: "Aktif", en: "Active", zh: "使用中" },
  viewSelected: { id: "Dipilih", en: "Selected", zh: "已选择" },
  viewPreset: { id: "Preset", en: "Preset", zh: "预设" },

  // Filter
  allLocations: { id: "Semua lokasi", en: "All locations", zh: "全部位置" },
  filterLocationAria: { id: "Filter lokasi", en: "Location filter", zh: "位置筛选" },
  sourceBin: { id: "Sumber (Bin)", en: "Source (Bin)", zh: "来源（Bin）" },
  allOfTerm: { id: "Semua {term}", en: "All {term}", zh: "全部 {term}" },
  filterSlotAria: { id: "Filter slot", en: "Slot filter", zh: "槽位筛选" },
  date: { id: "Tanggal", en: "Date", zh: "日期" },
  filterDateAria: { id: "Filter tanggal", en: "Date filter", zh: "日期筛选" },
  allSessions: { id: "Semua Sesi", en: "All Sessions", zh: "全部场次" },
  filterSessionAria: { id: "Filter sesi", en: "Session filter", zh: "场次筛选" },
  shift: { id: "Shift", en: "Shift", zh: "班次" },
  allShifts: { id: "Semua Shift", en: "All Shifts", zh: "全部班次" },
  filterShiftAria: {
    id: "Filter shift (belum aktif)",
    en: "Shift filter (not active yet)",
    zh: "班次筛选（尚未启用）",
  },
  qcStatus: { id: "QC Status", en: "QC Status", zh: "QC 状态" },
  all: { id: "Semua", en: "All", zh: "全部" },
  filterQcAria: {
    id: "Filter QC status (belum aktif)",
    en: "QC status filter (not active yet)",
    zh: "QC 状态筛选（尚未启用）",
  },
  clearFilters: { id: "Bersihkan Filter", en: "Clear Filters", zh: "清除筛选" },
  imageQuality: { id: "Kualitas gambar", en: "Image quality", zh: "图片质量" },
  qualitySaver: { id: "Hemat (cepat)", en: "Saver (fast)", zh: "省流（快速）" },
  qualityHd: { id: "HD (berkas asli)", en: "HD (original file)", zh: "HD（原始文件）" },
  imageQualityTitle: {
    id: "Hemat memakai thumbnail (~50 KB). HD menarik berkas asli (~11 MB) dari folder jaringan.",
    en: "Saver uses thumbnails (~50 KB). HD pulls the original file (~11 MB) from the network folder.",
    zh: "省流模式使用缩略图（约 50 KB）。HD 会从网络文件夹拉取原始文件（约 11 MB）。",
  },
  searchFileName: { id: "Cari nama file", en: "Search file name", zh: "搜索文件名" },
  searchPlaceholder: { id: "mis. capture-001", en: "e.g. capture-001", zh: "例如 capture-001" },
  activeFilters: { id: "Filter Aktif", en: "Active Filters", zh: "当前筛选" },
  chipLocation: { id: "Lokasi: {value}", en: "Location: {value}", zh: "位置：{value}" },
  chipBin: { id: "Bin: {value}", en: "Bin: {value}", zh: "来源（Bin）：{value}" },
  chipSession: { id: "Sesi: {value}", en: "Session: {value}", zh: "场次：{value}" },
  chipDate: { id: "Tanggal: {value}", en: "Date: {value}", zh: "日期：{value}" },
  chipSearch: { id: "Cari: {value}", en: "Search: {value}", zh: "搜索：{value}" },
  resetAll: { id: "Reset semua", en: "Reset all", zh: "全部重置" },

  // Pilihan batch
  batchSelected: {
    id: "{count} gambar dipilih untuk tindakan batch",
    en: "{count} images selected for batch actions",
    zh: "已选择 {count} 张图片进行批量操作",
  },
  batchHint: {
    id: "Gunakan compare untuk review visual, atau download batch untuk export lokal.",
    en: "Use compare for a visual review, or batch download for a local export.",
    zh: "使用对比进行目视检查，或批量下载以导出到本地。",
  },
  compareSelection: { id: "Bandingkan pilihan", en: "Compare selection", zh: "对比所选" },
  downloadSelection: { id: "Unduh pilihan", en: "Download selection", zh: "下载所选" },
  clearSelection: { id: "Bersihkan pilihan", en: "Clear selection", zh: "清除所选" },

  // Kepala daftar
  totalImages: {
    id: "Total {count} gambar",
    en: "{count} images in total",
    zh: "共 {count} 张图片",
  },
  sortBy: { id: "Urutkan", en: "Sort", zh: "排序" },
  sortNewest: { id: "Terbaru dulu", en: "Newest first", zh: "最新优先" },
  sortOldest: { id: "Terlama dulu", en: "Oldest first", zh: "最早优先" },
  sortNameAsc: { id: "Nama A → Z", en: "Name A → Z", zh: "名称 A → Z" },
  sortNameDesc: { id: "Nama Z → A", en: "Name Z → A", zh: "名称 Z → A" },
  gridMode: { id: "Mode grid", en: "Grid mode", zh: "网格模式" },
  listMode: { id: "Mode list", en: "List mode", zh: "列表模式" },

  // Pembuatan thumbnail foto lama
  backfillProgress: {
    id: "Membuat thumbnail... {done} dari {total}. Tiap foto ditarik ukuran penuh sekali dari folder jaringan, jadi ini butuh waktu — halaman boleh ditinggal terbuka.",
    en: "Creating thumbnails... {done} of {total}. Each photo is pulled at full size once from the network folder, so this takes time — you can leave the page open.",
    zh: "正在生成缩略图… {done} / {total}。每张照片需从网络文件夹完整拉取一次，因此需要一些时间——可以让页面保持打开。",
  },
  backfillPaused: {
    id: "{photos} belum punya thumbnail. Pembuatannya dihentikan — tekan Lanjutkan untuk meneruskan. Yang sudah jadi tetap tersimpan.",
    en: "{photos} still without a thumbnail. Creation was stopped — press Continue to resume. Those already created are kept.",
    zh: "{photos}还没有缩略图。生成已停止——点击“继续”以恢复。已生成的会保留。",
  },
  photoCount: { id: "{count} foto", en: "{count} photos", zh: "{count} 张照片" },
  backfillStop: { id: "Hentikan", en: "Stop", zh: "停止" },
  backfillContinue: { id: "Lanjutkan", en: "Continue", zh: "继续" },
  localOnlyHidden: {
    id: "{count} foto tidak ditampilkan karena tidak pernah masuk folder jaringan — berkasnya hanya ada di folder Unduhan PC yang melakukan capture. Detailnya ada di tabel Riwayat Registry DB di atas, bertanda {label}.",
    en: "{count} photos are not shown because they never reached the network folder — the files exist only in the Downloads folder of the PC that captured them. Details are in the Registry DB History table above, marked {label}.",
    zh: "有 {count} 张照片未显示，因为它们从未进入网络文件夹——文件只存在于执行拍摄的电脑的下载文件夹中。详情见上方的“登记表数据库历史记录”表，标记为 {label}。",
  },

  // Keadaan kosong
  loadFailedLong: {
    id: "Galeri belum dapat dimuat. Periksa koneksi atau sesi login Anda.",
    en: "The gallery could not be loaded. Check your connection or sign-in session.",
    zh: "图库暂时无法加载。请检查网络连接或登录状态。",
  },
  loadingGallery: {
    id: "Memeriksa akses dan memuat galeri…",
    en: "Checking access and loading the gallery…",
    zh: "正在检查权限并加载图库…",
  },
  emptyGallery: {
    id: "Hasil capture tersimpan akan muncul di sini.",
    en: "Saved captures will appear here.",
    zh: "已保存的拍摄结果将显示在这里。",
  },
  openCapture: { id: "Buka Capture", en: "Open Capture", zh: "打开拍摄" },
  checkStorageFlow: { id: "Cek Alur Storage", en: "Check the Storage Flow", zh: "检查存储流程" },
  noMatch: {
    id: "Tidak ada capture yang cocok dengan pencarian atau filter saat ini.",
    en: "No captures match the current search or filter.",
    zh: "没有符合当前搜索或筛选条件的拍摄。",
  },

  // Kartu dan baris daftar
  thumbPlaceholder: {
    id: "Klik untuk memuat dari folder jaringan",
    en: "Click to load from the network folder",
    zh: "点击以从网络文件夹加载",
  },
  selectNamed: { id: "Pilih {name}", en: "Select {name}", zh: "选择 {name}" },
  select: { id: "Pilih", en: "Select", zh: "选择" },
  compareNeedsLocalCopy: {
    id: "Perbandingan butuh salinan di browser ini",
    en: "Comparing needs a copy in this browser",
    zh: "对比需要此浏览器中有副本",
  },
  viewFullscreen: { id: "Lihat layar penuh", en: "View full screen", zh: "全屏查看" },
  viewNamedFullscreen: {
    id: "Lihat {name} layar penuh",
    en: "View {name} full screen",
    zh: "全屏查看 {name}",
  },
  viewDetailOf: {
    id: "Lihat detail {name}",
    en: "View details of {name}",
    zh: "查看 {name} 的详情",
  },
  detail: { id: "Detail", en: "Details", zh: "详情" },
  preparing: { id: "Menyiapkan...", en: "Preparing...", zh: "正在准备…" },
  rename: { id: "Ubah nama", en: "Rename", zh: "重命名" },
  delete: { id: "Hapus", en: "Delete", zh: "删除" },
  colName: { id: "Nama", en: "Name", zh: "名称" },
  captureTime: { id: "Waktu Capture", en: "Capture Time", zh: "拍摄时间" },
  colQc: { id: "QC", en: "QC", zh: "QC" },
  showingImages: {
    id: "Menampilkan {from} sampai {to} dari {total} gambar",
    en: "Showing {from} to {to} of {total} images",
    zh: "显示第 {from} 至 {to} 张，共 {total} 张图片",
  },
  perPage: { id: "{count} / halaman", en: "{count} / page", zh: "{count} / 页" },
  perPageAria: { id: "Jumlah per halaman", en: "Items per page", zh: "每页数量" },

  // Panel detail
  fetchingImage: {
    id: "Mengambil gambar dari folder jaringan...",
    en: "Fetching the image from the network folder...",
    zh: "正在从网络文件夹获取图片…",
  },
  imageUnavailable: {
    id: "Gambar tidak tersedia.",
    en: "The image is not available.",
    zh: "图片不可用。",
  },
  fullscreen: { id: "Layar penuh", en: "Full screen", zh: "全屏" },
  loading: { id: "Memuat...", en: "Loading...", zh: "正在加载…" },
  loadFullSize: { id: "Muat ukuran penuh", en: "Load full size", zh: "加载完整尺寸" },
  loadFullSizeWithSize: {
    id: "Muat ukuran penuh ({size})",
    en: "Load full size ({size})",
    zh: "加载完整尺寸（{size}）",
  },
  previousImage: {
    id: "Gambar sebelumnya (panah kiri)",
    en: "Previous image (left arrow)",
    zh: "上一张（左方向键）",
  },
  nextImage: {
    id: "Gambar berikutnya (panah kanan)",
    en: "Next image (right arrow)",
    zh: "下一张（右方向键）",
  },
  positionHint: {
    id: "{index} dari {total} · panah kiri/kanan untuk berpindah",
    en: "{index} of {total} · left/right arrows to move",
    zh: "{index} / {total} · 使用左右方向键切换",
  },
  notInFilteredList: {
    id: "Gambar ini sudah tidak ada di daftar yang sedang difilter.",
    en: "This image is no longer in the filtered list.",
    zh: "此图片已不在当前筛选的列表中。",
  },
  metadata: { id: "Metadata", en: "Metadata", zh: "详细信息" },
  renameFileTitle: {
    id: "Ubah nama berkas, termasuk berkasnya di folder jaringan",
    en: "Rename the file, including the file in the network folder",
    zh: "重命名文件，包括网络文件夹中的文件",
  },
  edit: { id: "Edit", en: "Edit", zh: "编辑" },
  sourceBinDetail: { id: "Source (Bin)", en: "Source (Bin)", zh: "来源（Bin）" },
  dbStatus: { id: "Status DB", en: "DB Status", zh: "数据库状态" },
  notRecorded: { id: "Belum tercatat", en: "Not recorded yet", zh: "尚未记录" },
  saveMethod: { id: "Metode Simpan", en: "Save Method", zh: "保存方式" },
  camera: { id: "Kamera", en: "Camera", zh: "相机" },
  miniPc: { id: "Mini PC", en: "Mini PC", zh: "迷你电脑" },
  fileSize: { id: "Ukuran File", en: "File Size", zh: "文件大小" },
  storedIn: { id: "Tersimpan di", en: "Stored in", zh: "保存位置" },
  imageSize: { id: "Ukuran Gambar", en: "Image Size", zh: "图片尺寸" },
  fileFormat: { id: "Format File", en: "File Format", zh: "文件格式" },
  fullPath: { id: "Path lengkap", en: "Full path", zh: "完整路径" },
  copy: { id: "Salin", en: "Copy", zh: "复制" },
  notOnNetworkFolder: {
    id: "Belum berada di folder jaringan. Pindahkan manual bila diperlukan.",
    en: "Not in the network folder yet. Move it manually if needed.",
    zh: "尚未进入网络文件夹。如有需要请手动移动。",
  },
  qualityCheck: { id: "Quality Check (QC)", en: "Quality Check (QC)", zh: "质量检查（QC）" },
  focusScore: { id: "Focus Score", en: "Focus Score", zh: "对焦评分" },
  lensCleanliness: { id: "Kebersihan Lensa", en: "Lens Cleanliness", zh: "镜头清洁度" },
  exposure: { id: "Exposure", en: "Exposure", zh: "曝光" },
  resolution: { id: "Resolusi", en: "Resolution", zh: "分辨率" },
  lighting: { id: "Pencahayaan", en: "Lighting", zh: "光照" },
  blurLevel: { id: "Level Blur", en: "Blur Level", zh: "模糊程度" },
  histogram: { id: "Histogram", en: "Histogram", zh: "直方图" },
  calculating: { id: "Menghitung...", en: "Calculating...", zh: "正在计算…" },
  downloadLocalCopy: {
    id: "Unduh salinan lokal",
    en: "Download the local copy",
    zh: "下载本地副本",
  },
  downloadFromNetwork: {
    id: "Ditarik dari folder jaringan -- berkasnya berukuran penuh",
    en: "Pulled from the network folder -- the file is full size",
    zh: "从网络文件夹拉取——文件为完整尺寸",
  },
  deselect: { id: "Batalkan pilih", en: "Deselect", zh: "取消选择" },

  // Layar penuh dan perbandingan
  loadingFullResolution: {
    id: "Memuat resolusi penuh...",
    en: "Loading full resolution...",
    zh: "正在加载完整分辨率…",
  },
  loadHdTitle: {
    id: "Tarik berkas asli dari folder jaringan (~11 MB)",
    en: "Pull the original file from the network folder (~11 MB)",
    zh: "从网络文件夹拉取原始文件（约 11 MB）",
  },
  loadHd: { id: "Muat HD", en: "Load HD", zh: "加载 HD" },
  compareCount: { id: "Bandingkan ({count})", en: "Compare ({count})", zh: "对比（{count}）" },

  // Dialog hapus
  deleteTitle: { id: "Hapus capture ini?", en: "Delete this capture?", zh: "删除这次拍摄？" },
  deleteShareFile: {
    id: "Berkasnya ikut dibuang dari folder jaringan:",
    en: "The file is also removed from the network folder:",
    zh: "文件也会从网络文件夹中删除：",
  },
  deleteNoShareFile: {
    id: "Capture ini tidak punya berkas di folder jaringan.",
    en: "This capture has no file in the network folder.",
    zh: "此拍摄在网络文件夹中没有文件。",
  },
  deletePermanentWarning: {
    id: "Tidak ada recycle bin di folder jaringan. Penghapusan ini permanen.",
    en: "There is no recycle bin in the network folder. This deletion is permanent.",
    zh: "网络文件夹没有回收站。此删除操作不可恢复。",
  },
  cancel: { id: "Batal", en: "Cancel", zh: "取消" },
  deleting: { id: "Menghapus...", en: "Deleting...", zh: "正在删除…" },
  deletePermanently: { id: "Hapus permanen", en: "Delete permanently", zh: "永久删除" },

  // Dialog ubah nama
  renameDialogTitle: { id: "Ubah nama berkas", en: "Rename file", zh: "重命名文件" },
  renameDialogBody: {
    id: "Nama berkas di folder jaringan ikut berubah, bukan hanya catatannya di registry.",
    en: "The file name in the network folder changes too, not just its entry in the registry.",
    zh: "网络文件夹中的文件名也会更改，而不仅是登记表中的记录。",
  },
  newNameLabel: {
    id: "Nama baru (sertakan ekstensi)",
    en: "New name (include the extension)",
    zh: "新名称（包含扩展名）",
  },
  forbiddenChars: {
    id: "Tidak boleh memuat {chars}",
    en: "Must not contain {chars}",
    zh: "不能包含 {chars}",
  },
  saving: { id: "Menyimpan...", en: "Saving...", zh: "正在保存…" },
  saveName: { id: "Simpan nama", en: "Save name", zh: "保存名称" },

  // Toast dan pesan kegagalan
  cacheUnreadable: {
    id: "Cache browser tidak bisa dibaca. Galeri tetap memakai registry server.",
    en: "The browser cache could not be read. The gallery still uses the server registry.",
    zh: "无法读取浏览器缓存。图库仍使用服务器登记表。",
  },
  registryRequestFailed: {
    id: "Permintaan ke registry gagal.",
    en: "The request to the registry failed.",
    zh: "对登记表的请求失败。",
  },
  imageRequestFailed: {
    id: "Gagal meminta gambar dari app server.",
    en: "Could not request the image from the app server.",
    zh: "无法从应用服务器请求图片。",
  },
  recordDeletedFileKept: {
    id: "Record dihapus, berkasnya dibiarkan",
    en: "Record deleted, the file was left in place",
    zh: "记录已删除，文件已保留",
  },
  recordDeletedFileKeptDetail: {
    id: "{path} berada di luar folder yang dikelola app (capture lama), jadi tidak disentuh. Hapus manual dari share kalau memang tidak dipakai lagi.",
    en: "{path} is outside the folder managed by the app (an old capture), so it was not touched. Delete it manually from the share if it is no longer needed.",
    zh: "{path} 位于应用管理的文件夹之外（旧的拍摄），因此未作改动。如确实不再需要，请从共享中手动删除。",
  },
  deleteFailed: { id: "Gagal menghapus item", en: "Could not delete the item", zh: "删除项目失败" },
  renameFailed: {
    id: "Gagal mengubah nama file",
    en: "Could not rename the file",
    zh: "重命名文件失败",
  },
  downloadPrepareFailed: {
    id: "Gagal menyiapkan unduhan: {reason}",
    en: "Could not prepare the download: {reason}",
    zh: "准备下载失败：{reason}",
  },
  downloadFetchFailed: {
    id: "Berkas tidak bisa diambil dari folder jaringan.",
    en: "The file could not be fetched from the network folder.",
    zh: "无法从网络文件夹获取文件。",
  },
  downloadSelectionFailed: {
    id: "{failed} dari {total} foto gagal diunduh dari folder jaringan.",
    en: "{failed} of {total} photos could not be downloaded from the network folder.",
    zh: "{total} 张照片中有 {failed} 张无法从网络文件夹下载。",
  },
  downloadFailed: {
    id: "Gagal mengunduh dari folder jaringan.",
    en: "Could not download from the network folder.",
    zh: "从网络文件夹下载失败。",
  },
});

// Nama dan keterangan view bawaan, dipakai GALLERY_SAVED_VIEWS di
// src/lib/gallery-preferences.ts. Id view-nya ("all-images", ...) tetap menjadi
// kunci penyimpanan; yang ada di sini hanya teks tampilannya.
export const gallerySavedViewMessages = defineMessages({
  allImages: { id: "All images", en: "All images", zh: "全部图片" },
  allImagesDescription: {
    id: "Semua capture terbaru dalam tampilan grid standar.",
    en: "All the latest captures in the standard grid view.",
    zh: "以标准网格视图显示所有最新拍摄。",
  },
  slot1Review: { id: "Slot 1 review", en: "Slot 1 review", zh: "槽位 1 复核" },
  slot1ReviewDescription: {
    id: "Fokus audit capture dari slot 1.",
    en: "Focus on auditing captures from slot 1.",
    zh: "重点审核槽位 1 的拍摄。",
  },
  slot2Review: { id: "Slot 2 review", en: "Slot 2 review", zh: "槽位 2 复核" },
  slot2ReviewDescription: {
    id: "Fokus audit capture dari slot 2.",
    en: "Focus on auditing captures from slot 2.",
    zh: "重点审核槽位 2 的拍摄。",
  },
  compactAudit: { id: "Compact audit", en: "Compact audit", zh: "紧凑审核" },
  compactAuditDescription: {
    id: "List view dengan urutan terlama untuk review kronologis.",
    en: "List view sorted oldest first for chronological review.",
    zh: "列表视图，按最早优先排序，便于按时间顺序复核。",
  },
  // Judul view yang menyorot satu slot, dirakit dengan istilah plant si
  // penonton: "BIN 1 review", "TRAIN 1 review".
  slotReviewTitle: { id: "{slot} review", en: "{slot} review", zh: "{slot} 复核" },
});

// Teks pemilih tanggal (src/components/app-date-picker.tsx).
export const datePickerMessages = defineMessages({
  allDates: { id: "Semua tanggal", en: "All dates", zh: "全部日期" },
  clearDateFilter: {
    id: "Hapus filter tanggal",
    en: "Clear the date filter",
    zh: "清除日期筛选",
  },
  today: { id: "Hari ini", en: "Today", zh: "今天" },
});

// Dialog "Sinkronkan folder": mendaftarkan foto yang ditaruh langsung di folder
// jaringan supaya tampil di Gallery.
export const shareSyncMessages = defineMessages({
  button: { id: "Sinkronkan folder", en: "Sync folder", zh: "同步文件夹" },
  title: {
    id: "Sinkronkan folder jaringan",
    en: "Sync the network folder",
    zh: "同步网络文件夹",
  },
  intro: {
    id: "Foto yang ditaruh langsung di folder jaringan belum tampil di Gallery sampai didaftarkan. Periksa dulu, lalu daftarkan berkas yang ditemukan.",
    en: "Photos placed directly in the network folder do not appear in Gallery until they are registered. Check first, then register the files that were found.",
    zh: "直接放入网络文件夹的照片在登记之前不会显示在图库中。请先检查，再登记找到的文件。",
  },
  from: { id: "Dari tanggal", en: "From date", zh: "开始日期" },
  to: { id: "Sampai tanggal", en: "To date", zh: "结束日期" },
  rangeHint: {
    id: "Rentang berlaku untuk folder tanggal (tahun/bulan/hari), paling panjang {max} hari. Foto yang ditaruh langsung di folder plant selalu ikut diperiksa.",
    en: "The range applies to date folders (year/month/day), {max} days at most. Photos placed directly in a plant folder are always checked.",
    zh: "范围适用于日期文件夹（年/月/日），最长 {max} 天。直接放在工厂文件夹中的照片始终会被检查。",
  },
  rangeInvalid: {
    id: "Isi kedua tanggal. Tanggal awal tidak boleh melewati tanggal akhir, dan rentangnya paling panjang {max} hari.",
    en: "Fill in both dates. The start date cannot be after the end date, and the range can be {max} days at most.",
    zh: "请填写两个日期。开始日期不能晚于结束日期，范围最长 {max} 天。",
  },
  check: { id: "Periksa folder", en: "Check folder", zh: "检查文件夹" },
  checking: { id: "Memeriksa...", en: "Checking...", zh: "正在检查…" },
  register: {
    id: "Daftarkan {count} berkas",
    en: "Register {count} files",
    zh: "登记 {count} 个文件",
  },
  registering: { id: "Mendaftarkan...", en: "Registering...", zh: "正在登记…" },
  close: { id: "Tutup", en: "Close", zh: "关闭" },
  summarySeen: {
    id: "{seen} foto ditemukan di {folders} folder plant.",
    en: "{seen} photos found in {folders} plant folders.",
    zh: "在 {folders} 个工厂文件夹中找到 {seen} 张照片。",
  },
  statNew: { id: "Baru", en: "New", zh: "新文件" },
  statRegistered: { id: "Sudah terdaftar", en: "Already registered", zh: "已登记" },
  statSkipped: { id: "Dilewati", en: "Skipped", zh: "已跳过" },
  statMissing: { id: "Berkas hilang", en: "Missing files", zh: "文件缺失" },
  nothingNew: {
    id: "Tidak ada berkas baru. Semua foto yang ditemukan sudah terdaftar.",
    en: "No new files. Every photo that was found is already registered.",
    zh: "没有新文件。找到的照片均已登记。",
  },
  newFilesTitle: {
    id: "Berkas yang akan didaftarkan",
    en: "Files to be registered",
    zh: "将要登记的文件",
  },
  colFile: { id: "Berkas", en: "File", zh: "文件" },
  colSession: { id: "Sesi", en: "Session", zh: "场次" },
  colSlot: { id: "Train/Bin", en: "Train/Bin", zh: "Train/Bin" },
  colTime: { id: "Dicatat sebagai", en: "Recorded as", zh: "记录时间" },
  moreRows: { id: "dan {count} lainnya", en: "and {count} more", zh: "另有 {count} 项" },
  truncated: {
    id: "Berkas baru lebih dari {max}. Sekali jalan hanya memproses {max}; jalankan lagi untuk sisanya.",
    en: "There are more than {max} new files. One run handles {max}; run it again for the rest.",
    zh: "新文件超过 {max} 个。每次只处理 {max} 个，请再次运行以处理其余文件。",
  },
  consequence: {
    id: "Setelah terdaftar, Hapus dan Ubah nama di Gallery berlaku pada berkas aslinya di folder jaringan.",
    en: "Once registered, Delete and Rename in Gallery act on the original file in the network folder.",
    zh: "登记后，图库中的“删除”和“重命名”将作用于网络文件夹中的原始文件。",
  },
  skippedTitle: { id: "Dilewati ({count})", en: "Skipped ({count})", zh: "已跳过（{count}）" },
  reasonUnsupportedType: {
    id: "bukan JPG, PNG, atau WebP",
    en: "not a JPG, PNG or WebP",
    zh: "不是 JPG、PNG 或 WebP",
  },
  reasonNoDevice: {
    id: "plant ini belum punya device di registry",
    en: "this plant has no device in the registry yet",
    zh: "该工厂在登记表中尚无设备",
  },
  reasonPathTooLong: {
    id: "path atau nama berkas terlalu panjang",
    en: "the path or file name is too long",
    zh: "路径或文件名过长",
  },
  otherFoldersTitle: {
    id: "Subfolder yang tidak diperiksa ({count})",
    en: "Subfolders that were not checked ({count})",
    zh: "未检查的子文件夹（{count}）",
  },
  otherFoldersHint: {
    id: "Hanya folder tanggal (tahun/bulan/hari) yang dibaca. Pindahkan fotonya ke folder tanggal atau langsung ke folder plant.",
    en: "Only date folders (year/month/day) are read. Move the photos into a date folder or straight into the plant folder.",
    zh: "只读取日期文件夹（年/月/日）。请将照片移到日期文件夹或直接放入工厂文件夹。",
  },
  missingTitle: {
    id: "Tercatat tetapi berkasnya tidak ada ({count})",
    en: "Registered but the file is gone ({count})",
    zh: "已登记但文件不存在（{count}）",
  },
  missingHint: {
    id: "Baris ini tetap tampil di Gallery. Hapus dari Gallery kalau berkasnya memang sudah dibuang.",
    en: "These rows still appear in Gallery. Delete them from Gallery if the files were removed on purpose.",
    zh: "这些记录仍会显示在图库中。如果文件确实已被移除，请在图库中删除它们。",
  },
  foldersMissing: {
    id: "Folder plant yang tidak ditemukan di folder jaringan: {folders}",
    en: "Plant folders not found in the network folder: {folders}",
    zh: "网络文件夹中未找到的工厂文件夹：{folders}",
  },
  doneImported: {
    id: "{count} berkas terdaftar dan sekarang tampil di Gallery.",
    en: "{count} files registered and now shown in Gallery.",
    zh: "已登记 {count} 个文件，现已显示在图库中。",
  },
  doneNone: {
    id: "Tidak ada berkas yang didaftarkan.",
    en: "No files were registered.",
    zh: "没有登记任何文件。",
  },
  failedTitle: { id: "Gagal ({count})", en: "Failed ({count})", zh: "失败（{count}）" },
  requestFailed: {
    id: "Permintaan ke server gagal. Coba lagi.",
    en: "The request to the server failed. Try again.",
    zh: "向服务器发送请求失败，请重试。",
  },
});
