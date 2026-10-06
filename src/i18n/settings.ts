import { defineMessages } from "@/lib/i18n";

// Halaman Settings. Sebagian teks asalnya memang berbahasa Inggris; `id` tetap
// persis seperti yang tampil selama ini.
//
// Token pola nama berkas ({INDEX}, {LOCATION}, ...) adalah teks harfiah, bukan
// placeholder. Kalimat yang menyebutnya menerima tokennya lewat parameter
// ({token}, {location}, {source}, {tokens}) supaya tidak tertukar.
export const settingsMessages = defineMessages({
  description: {
    id: "Kelola preference operator, preview filename, dan akses folder simpan yang dipakai halaman Capture.",
    en: "Manage operator preferences, the filename preview and the save folder access used by the Capture page.",
    zh: "管理操作员偏好、文件名预览以及拍摄页面使用的保存文件夹访问权限。",
  },
  openCapture: { id: "Open Capture", en: "Open Capture", zh: "打开拍摄" },
  reviewStorage: { id: "Review Storage", en: "Review Storage", zh: "查看存储" },

  patternInvalid: { id: "Invalid", en: "Invalid", zh: "无效" },
  patternNeedsReview: { id: "Needs review", en: "Needs review", zh: "需要检查" },
  patternReady: { id: "Ready", en: "Ready", zh: "就绪" },

  dirConnected: { id: "Connected", en: "Connected", zh: "已连接" },
  dirPermissionRequired: { id: "Permission required", en: "Permission required", zh: "需要授权" },
  dirUnsupported: { id: "Unsupported", en: "Unsupported", zh: "不支持" },
  dirNotSet: { id: "Not set", en: "Not set", zh: "未设置" },
  dirChecking: { id: "Checking...", en: "Checking...", zh: "正在检查…" },

  toastPatternInvalid: {
    id: "Pattern filename belum valid",
    en: "The filename pattern is not valid yet",
    zh: "文件名规则尚未有效",
  },
  toastPatternInvalidBody: {
    id: "Perbaiki token yang tidak dikenal atau pattern kosong sebelum menyimpan.",
    en: "Fix the unknown tokens or the empty pattern before saving.",
    zh: "保存前请修正无法识别的标记或空的规则。",
  },
  toastSaved: {
    id: "Preferences berhasil disimpan",
    en: "Preferences saved",
    zh: "偏好已保存",
  },
  toastSavedBody: {
    id: "Perubahan akan dipakai oleh halaman Capture pada sesi berikutnya.",
    en: "The changes will be used by the Capture page in the next session.",
    zh: "拍摄页面将在下一次使用时采用这些更改。",
  },
  toastReset: {
    id: "Preferences direset ke default",
    en: "Preferences reset to default",
    zh: "偏好已恢复默认",
  },
  toastResetBody: {
    id: "Pattern filename dan counter kembali ke konfigurasi standar.",
    en: "The filename pattern and counter are back to the standard configuration.",
    zh: "文件名规则和计数器已恢复为标准配置。",
  },
  toastCounterReset: {
    id: "Counter dikembalikan ke 001",
    en: "Counter set back to 001",
    zh: "计数器已重置为 001",
  },
  toastCounterResetBody: {
    id: "Perubahan masih lokal sampai Anda menekan save preferences.",
    en: "The change stays local until you press Save preferences.",
    zh: "在您点击“保存偏好”之前，此更改仅在本地有效。",
  },
  toastFolderPicked: {
    id: "Folder simpan berhasil dipilih",
    en: "Save folder selected",
    zh: "已选择保存文件夹",
  },
  toastFolderPickedBody: {
    id: "{name} akan tersedia untuk halaman Capture.",
    en: "{name} will be available to the Capture page.",
    zh: "{name} 将可供拍摄页面使用。",
  },
  toastPickFailed: {
    id: "Gagal memilih folder",
    en: "Could not select the folder",
    zh: "选择文件夹失败",
  },
  unknownError: { id: "Unknown error", en: "Unknown error", zh: "未知错误" },
  toastPermissionRenewed: {
    id: "Izin folder berhasil diperbarui",
    en: "Folder permission renewed",
    zh: "文件夹权限已更新",
  },
  toastPermissionRenewedBody: {
    id: "{name} siap dipakai kembali dari halaman Capture.",
    en: "{name} is ready to be used again from the Capture page.",
    zh: "{name} 可再次在拍摄页面使用。",
  },
  toastPermissionDenied: {
    id: "Izin folder belum diberikan",
    en: "Folder permission has not been granted",
    zh: "尚未授予文件夹权限",
  },
  toastPermissionDeniedBody: {
    id: "Browser masih menolak akses baca/tulis ke folder tersimpan.",
    en: "The browser still refuses read/write access to the saved folder.",
    zh: "浏览器仍拒绝对已保存文件夹的读写访问。",
  },
  toastFolderForgotten: {
    id: "Folder simpan dilupakan",
    en: "Save folder forgotten",
    zh: "已忘记保存文件夹",
  },
  toastFolderForgottenBody: {
    id: "Capture akan kembali memakai folder picker atau fallback browser download.",
    en: "Capture will go back to the folder picker or the browser download fallback.",
    zh: "拍摄将改回使用文件夹选择器，或以浏览器下载作为后备。",
  },

  saveFolder: { id: "Save Folder", en: "Save Folder", zh: "保存文件夹" },
  noBrowserFolder: {
    id: "Belum ada folder browser yang disimpan",
    en: "No browser folder has been saved yet",
    zh: "尚未保存浏览器文件夹",
  },
  filenamePreview: { id: "Filename Preview", en: "Filename Preview", zh: "文件名预览" },
  filenamePreviewCardHint: {
    id: "Preview memakai lokasi aktif dan source contoh BIN1",
    en: "The preview uses the active location and the sample source BIN1",
    zh: "预览使用当前位置和示例来源 BIN1",
  },
  patternHealth: { id: "Pattern Health", en: "Pattern Health", zh: "规则状态" },
  patternHealthInvalid: {
    id: "Ada token tidak valid atau pattern kosong",
    en: "There is an invalid token or the pattern is empty",
    zh: "存在无效标记或规则为空",
  },
  patternHealthWarnings: {
    id: "Pattern masih bisa dipakai, tetapi ada catatan operator",
    en: "The pattern can still be used, but there are notes for the operator",
    zh: "规则仍可使用，但有需要操作员注意的事项",
  },
  patternHealthReady: {
    id: "Pattern siap dipakai tanpa catatan tambahan",
    en: "The pattern is ready to use with no further notes",
    zh: "规则可直接使用，无其他注意事项",
  },
  counterStart: { id: "Counter Start", en: "Counter Start", zh: "计数器起始值" },
  counterStartHint: {
    id: "Dipakai untuk token {token} pada penamaan file",
    en: "Used for the {token} token in file naming",
    zh: "用于文件命名中的 {token} 标记",
  },
  storageModel: { id: "Storage Model", en: "Storage Model", zh: "存储方式" },
  storageModelValue: {
    id: "Browser + IndexedDB",
    en: "Browser + IndexedDB",
    zh: "浏览器 + IndexedDB",
  },
  storageModelHint: {
    id: "Preference tersimpan lokal; handle folder disimpan via IndexedDB",
    en: "Preferences are stored locally; the folder handle is stored via IndexedDB",
    zh: "偏好保存在本地；文件夹句柄通过 IndexedDB 保存",
  },

  capturePreferences: {
    id: "Capture Preferences",
    en: "Capture Preferences",
    zh: "拍摄偏好",
  },
  capturePreferencesHint: {
    id: "Ubah preference default yang akan dipakai operator saat membuka halaman Capture.",
    en: "Change the default preferences that operators get when they open the Capture page.",
    zh: "修改操作员打开拍摄页面时使用的默认偏好。",
  },
  unsavedChanges: {
    id: "Ada perubahan belum disimpan",
    en: "There are unsaved changes",
    zh: "有未保存的更改",
  },
  allSaved: {
    id: "Semua perubahan sudah tersimpan",
    en: "All changes are saved",
    zh: "所有更改均已保存",
  },
  defaultLocation: { id: "Default Location", en: "Default Location", zh: "默认位置" },
  fileExtension: { id: "File Extension", en: "File Extension", zh: "文件扩展名" },
  filenamePattern: { id: "Filename Pattern", en: "Filename Pattern", zh: "文件名规则" },
  tokens: { id: "Tokens: {tokens}", en: "Tokens: {tokens}", zh: "可用标记：{tokens}" },
  resetCounter: {
    id: "Reset counter to 001",
    en: "Reset counter to 001",
    zh: "将计数器重置为 001",
  },
  locationTokenPreview: {
    id: "Location Token Preview",
    en: "Location Token Preview",
    zh: "位置标记预览",
  },
  filenamePreviewHint: {
    id: "Preview menggunakan waktu saat ini, lokasi aktif, dan source contoh `BIN1`.",
    en: "The preview uses the current time, the active location and the sample source `BIN1`.",
    zh: "预览使用当前时间、当前位置和示例来源 `BIN1`。",
  },
  patternChecks: { id: "Pattern Checks", en: "Pattern Checks", zh: "规则检查" },
  savePreferences: { id: "Save preferences", en: "Save preferences", zh: "保存偏好" },
  resetToDefault: { id: "Reset to default", en: "Reset to default", zh: "恢复默认" },

  savedFolderAccess: {
    id: "Saved Folder Access",
    en: "Saved Folder Access",
    zh: "已保存文件夹的访问权限",
  },
  currentFolder: { id: "Current folder", en: "Current folder", zh: "当前文件夹" },
  noFolderSelected: { id: "No folder selected", en: "No folder selected", zh: "未选择文件夹" },
  currentFolderHint: {
    id: "Pilihan ini dipakai sebagai fallback save di browser bila auto-save tidak tersedia.",
    en: "This choice is used as the browser save fallback when auto-save is not available.",
    zh: "自动保存不可用时，将以此选择作为浏览器内的后备保存位置。",
  },
  permissionState: { id: "Permission state", en: "Permission state", zh: "权限状态" },
  permissionStateHint: {
    id: "Browser bisa meminta ulang izin baca/tulis setelah restart sesi atau tab.",
    en: "The browser may ask for read/write permission again after the session or tab is restarted.",
    zh: "重新启动会话或标签页后，浏览器可能会再次请求读写权限。",
  },
  chooseFolder: { id: "Choose folder", en: "Choose folder", zh: "选择文件夹" },
  reconnectPermission: {
    id: "Reconnect permission",
    en: "Reconnect permission",
    zh: "重新授权",
  },
  forgetFolder: { id: "Forget folder", en: "Forget folder", zh: "忘记文件夹" },
  fsUnsupported: {
    id: "Browser ini tidak mendukung File System Access API. Capture akan mengandalkan network save atau browser download biasa.",
    en: "This browser does not support the File System Access API. Capture will rely on network save or a normal browser download.",
    zh: "此浏览器不支持 File System Access API。拍摄将依靠网络保存或普通的浏览器下载。",
  },

  howUsed: {
    id: "How Preferences Are Used",
    en: "How Preferences Are Used",
    zh: "偏好的使用方式",
  },
  howUsedNaming: {
    id: "`location`, `pattern`, dan `counter` dibaca halaman Capture untuk membentuk nama file saat save dilakukan.",
    en: "`location`, `pattern` and `counter` are read by the Capture page to build the file name when a save is made.",
    zh: "拍摄页面在保存时读取 `location`、`pattern` 和 `counter` 来生成文件名。",
  },
  howUsedFolder: {
    id: "Folder tersimpan hanya berlaku di browser/operator ini karena permission dikelola oleh browser, bukan oleh backend.",
    en: "The saved folder applies only to this browser/operator because the permission is managed by the browser, not by the backend.",
    zh: "已保存的文件夹仅对此浏览器/操作员有效，因为权限由浏览器而非后端管理。",
  },
  howUsedPermission: {
    id: "Jika folder tersimpan tidak lagi punya izin, operator harus menekan `Reconnect permission` atau memilih folder ulang.",
    en: "If the saved folder no longer has permission, the operator must press `Reconnect permission` or choose the folder again.",
    zh: "如果已保存的文件夹不再有权限，操作员需点击 `重新授权` 或重新选择文件夹。",
  },
  operatorNotes: { id: "Operator Notes", en: "Operator Notes", zh: "操作员须知" },
  noteIndex: {
    id: "Gunakan token `{token}` bila Anda ingin urutan file tetap terlihat jelas saat ada banyak capture berurutan.",
    en: "Use the `{token}` token if you want the file order to stay clear when there are many captures in a row.",
    zh: "如果希望连续多次拍摄时文件顺序仍然清晰，请使用 `{token}` 标记。",
  },
  noteLocationSource: {
    id: "Gunakan token `{location}` dan `{source}` untuk menjaga nama file tetap mudah diaudit per plant dan per bin.",
    en: "Use the `{location}` and `{source}` tokens to keep file names easy to audit per plant and per bin.",
    zh: "使用 `{location}` 和 `{source}` 标记，便于按工厂和按 Bin 审计文件名。",
  },
  noteStorage: {
    id: "Untuk troubleshooting export jaringan, cek halaman `Storage` setelah mengganti folder atau environment.",
    en: "To troubleshoot network export, check the `Storage` page after changing the folder or environment.",
    zh: "排查网络导出问题时，请在更换文件夹或环境后查看 `存储` 页面。",
  },
});

// Kartu "Jadwal capture per plant" (src/components/capture-schedule-settings.tsx).
export const scheduleSettingsMessages = defineMessages({
  saved: { id: "Jadwal capture disimpan", en: "Capture schedule saved", zh: "拍摄排程已保存" },
  title: {
    id: "Jadwal capture per plant",
    en: "Capture schedule per plant",
    zh: "各工厂拍摄排程",
  },
  intro: {
    id: "Atur sesi sampling manual. Perubahan berlaku mulai tanggal yang dipilih; jadwal historis tetap disimpan.",
    en: "Set up the manual sampling sessions. Changes take effect from the chosen date; past schedules are kept.",
    zh: "设置人工取样场次。更改自所选日期起生效；历史排程会保留。",
  },
  reload: { id: "Muat ulang jadwal", en: "Reload schedule", zh: "重新加载排程" },
  reloading: { id: "Memuat ulang jadwal…", en: "Reloading schedule…", zh: "正在重新加载排程…" },
  loading: { id: "Memuat jadwal…", en: "Loading schedule…", zh: "正在加载排程…" },
  plant: { id: "Plant", en: "Plant", zh: "工厂" },
  saveOrDiscardFirst: {
    id: "Simpan atau batalkan sebelum pindah plant.",
    en: "Save or discard before switching plant.",
    zh: "切换工厂前请先保存或取消更改。",
  },
  startHour: { id: "Jam mulai", en: "Start hour", zh: "开始时间" },
  interval: { id: "Interval sesi", en: "Session interval", zh: "场次间隔" },
  everyHours: { id: "Setiap {hours} jam", en: "Every {hours} h", zh: "每 {hours} 小时" },
  window: {
    id: "Jendela capture (menit)",
    en: "Capture window (minutes)",
    zh: "拍摄时间窗（分钟）",
  },
  timezone: { id: "Timezone plant", en: "Plant time zone", zh: "工厂时区" },
  effectiveDate: {
    id: "Mulai berlaku (YYYY-MM-DD)",
    en: "Effective from (YYYY-MM-DD)",
    zh: "生效日期（YYYY-MM-DD）",
  },
  preview: {
    id: "Preview: {sessions} sesi · {photos} foto per hari",
    en: "Preview: {sessions} sessions · {photos} photos per day",
    zh: "预览：{sessions} 个场次 · 每天 {photos} 张照片",
  },
  fixToPreview: {
    id: "Perbaiki pengaturan untuk melihat preview.",
    en: "Fix the settings to see the preview.",
    zh: "请修正设置以查看预览。",
  },
  previewNote: {
    id: "Jam ditampilkan sesuai timezone plant. Jendela yang melewati tengah malam tetap milik tanggal awal sesi.",
    en: "Hours are shown in the plant time zone. A window that runs past midnight still belongs to the date on which the session started.",
    zh: "时间按工厂时区显示。跨越午夜的时间窗仍归属于场次开始的日期。",
  },
  saving: { id: "Menyimpan…", en: "Saving…", zh: "正在保存…" },
  save: { id: "Simpan jadwal", en: "Save schedule", zh: "保存排程" },
  discard: { id: "Batalkan perubahan", en: "Discard changes", zh: "取消更改" },
  history: {
    id: "Riwayat jadwal ({count})",
    en: "Schedule history ({count})",
    zh: "排程历史（{count}）",
  },
  historyEntry: {
    id: "{date} — setiap {interval} jam, mulai {start}, jendela {window} menit · {timezone}",
    en: "{date} — every {interval} h, from {start}, {window}-minute window · {timezone}",
    zh: "{date} — 每 {interval} 小时，{start} 开始，时间窗 {window} 分钟 · {timezone}",
  },

  // Galat jadwal. Teks `id` sama persis dengan yang ditulis scheduleValidation
  // (src/lib/capture-schedule.ts) dan server (capture-schedules.ts); dari
  // kesamaan itulah galatnya dikenali untuk ditampilkan dalam bahasa lain.
  errorStartHour: {
    id: "Jam mulai harus antara 00 dan 23.",
    en: "The start hour must be between 00 and 23.",
    zh: "开始时间必须在 00 到 23 之间。",
  },
  errorInterval: {
    id: "Interval harus 1, 2, 3, 4, 6, 8, 12, atau 24 jam.",
    en: "The interval must be 1, 2, 3, 4, 6, 8, 12 or 24 hours.",
    zh: "间隔必须为 1、2、3、4、6、8、12 或 24 小时。",
  },
  errorWindow: {
    id: "Jendela capture harus 1 menit hingga panjang interval sesi.",
    en: "The capture window must be between 1 minute and the length of the session interval.",
    zh: "拍摄时间窗必须在 1 分钟到场次间隔时长之间。",
  },
  errorTimezone: {
    id: "Timezone tidak valid.",
    en: "The time zone is not valid.",
    zh: "时区无效。",
  },
  errorDate: {
    id: "Tanggal berlaku tidak valid.",
    en: "The effective date is not valid.",
    zh: "生效日期无效。",
  },
  errorBusy: {
    id: "Jadwal sedang disimpan. Muat ulang dan coba lagi.",
    en: "The schedule is being saved. Reload and try again.",
    zh: "排程正在保存中，请重新加载后重试。",
  },
  errorConflict: {
    id: "Jadwal telah berubah. Muat ulang sebelum menyimpan.",
    en: "The schedule has changed. Reload before saving.",
    zh: "排程已被更改，请重新加载后再保存。",
  },
  errorTomorrowOnly: {
    id: "Perubahan hanya boleh berlaku mulai besok; riwayat hari ini tetap dipertahankan.",
    en: "Changes can only take effect from tomorrow; today's history is kept.",
    zh: "更改最早只能从明天起生效；今天的记录会保留。",
  },
  errorSessionEnded: {
    id: "Sesi Anda sudah berakhir. Silakan login kembali.",
    en: "Your session has ended. Please sign in again.",
    zh: "您的登录已过期，请重新登录。",
  },
  errorAdminOnly: {
    id: "Hanya Super Admin yang boleh mengubah jadwal.",
    en: "Only Super Admin may change the schedule.",
    zh: "只有超级管理员可以更改排程。",
  },
  // Dua galat berikut berawalan kode dan dikenali dari kodenya.
  errorStorageUnavailable: {
    id: "SCHEDULE_STORAGE_UNAVAILABLE: CAPTURE_SPOOL_DIR belum dikonfigurasi.",
    en: "CAPTURE_SPOOL_DIR is not configured on the app server, so the schedule cannot be stored.",
    zh: "应用服务器尚未配置 CAPTURE_SPOOL_DIR，无法保存排程。",
  },
  errorStorageInvalid: {
    id: "SCHEDULE_STORAGE_INVALID: Data jadwal tidak valid; periksa backup.",
    en: "The stored schedule data is not valid; check the backup.",
    zh: "已保存的排程数据无效，请检查备份。",
  },
});

// Kartu "Edge API" (src/components/edge-api-settings.tsx).
export const edgeApiMessages = defineMessages({
  serverNoResponse: {
    id: "Server tidak merespons.",
    en: "The server did not respond.",
    zh: "服务器没有响应。",
  },
  saved: {
    id: 'Alamat "{name}" disimpan',
    en: 'Address for "{name}" saved',
    zh: "“{name}”的地址已保存",
  },
  saveFailed: {
    id: "Alamat gagal disimpan.",
    en: "The address could not be saved.",
    zh: "地址保存失败。",
  },
  testFailed: {
    id: "Uji koneksi gagal.",
    en: "The connection test failed.",
    zh: "连接测试失败。",
  },
  reload: { id: "Muat ulang", en: "Reload", zh: "重新加载" },
  intro: {
    id: "Alamat service kamera untuk tiap device. Tiap device boleh memakai port berbeda — tulis URL utuhnya, portnya ikut di dalamnya.",
    en: "The camera service address for each device. Each device may use a different port — write the full URL, with the port in it.",
    zh: "每台设备的相机服务地址。各设备可使用不同端口——请填写完整 URL，端口包含在内。",
  },
  fallbackAddress: {
    id: "Alamat cadangan (CAMERA_API_URL)",
    en: "Fallback address (CAMERA_API_URL)",
    zh: "备用地址（CAMERA_API_URL）",
  },
  notSet: { id: "belum diisi", en: "not set", zh: "未填写" },
  sharedToken: {
    id: "Token bersama (CAMERA_API_TOKEN)",
    en: "Shared token (CAMERA_API_TOKEN)",
    zh: "共用令牌（CAMERA_API_TOKEN）",
  },
  tokenSet: { id: "terpasang", en: "set", zh: "已设置" },
  tokenUnused: { id: "tidak dipakai", en: "not used", zh: "未使用" },
  envNote: {
    id: "Keduanya berasal dari berkas {env} di server dan hanya bisa diubah di sana, bukan dari halaman ini — nilainya tidak pernah dikirim ke browser. Cadangan dipakai untuk device yang alamatnya dikosongkan.",
    en: "Both come from the {env} file on the server and can only be changed there, not from this page — their values are never sent to the browser. The fallback is used for devices whose address is left empty.",
    zh: "两者均来自服务器上的 {env} 文件，只能在服务器上修改，不能在此页面修改——其值绝不会发送到浏览器。地址留空的设备将使用备用地址。",
  },
  loading: {
    id: "Memuat registry device...",
    en: "Loading the device registry...",
    zh: "正在加载设备登记表…",
  },
  empty: {
    id: "Belum ada device di registry. Daftarkan dulu lewat menu Devices.",
    en: "There are no devices in the registry yet. Register one first from the Devices menu.",
    zh: "登记表中尚无设备，请先通过“设备”菜单登记。",
  },
  plantUnset: { id: "Plant belum ditentukan", en: "Plant not set", zh: "未指定工厂" },
  inactive: { id: "Nonaktif", en: "Inactive", zh: "停用" },
  usesFallback: { id: "Pakai cadangan", en: "Uses fallback", zh: "使用备用地址" },
  addressLabel: {
    id: "Alamat Edge API {name}",
    en: "Edge API address for {name}",
    zh: "{name} 的 Edge API 地址",
  },
  save: { id: "Simpan", en: "Save", zh: "保存" },
  saveBeforeTest: {
    id: "Simpan dulu sebelum menguji",
    en: "Save before testing",
    zh: "请先保存再测试",
  },
  testThisAddress: {
    id: "Uji koneksi ke alamat ini",
    en: "Test the connection to this address",
    zh: "测试与此地址的连接",
  },
  test: { id: "Uji", en: "Test", zh: "测试" },
  accessNote: {
    id: "Akun yang dipasang ke plant tertentu hanya bisa memakai device dari plant itu. Hanya akun ber-plant Semua Plant yang bebas memakai device mana pun. Aturan itu ditegakkan di server pada tiap panggilan kamera, bukan dengan menyembunyikan pilihan di layar.",
    en: "An account assigned to a specific plant can only use devices from that plant. Only accounts set to All Plants are free to use any device. The rule is enforced on the server on every camera call, not by hiding options on screen.",
    zh: "分配到特定工厂的账号只能使用该工厂的设备。只有设为“全部工厂”的账号可以使用任意设备。该规则在每次相机调用时由服务器强制执行，而不是通过隐藏界面上的选项来实现。",
  },
});
