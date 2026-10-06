import { defineMessages } from "@/lib/i18n";

// Halaman Storage (src/routes/storage.tsx). Nama variabel lingkungan
// (NETWORK_SAVE_ROOT, CAMERA_API_URL), path, dan perintah shell adalah
// pengenal: ditulis sama di ketiga bahasa.
export const storageMessages = defineMessages({
  edgeServiceUnreachable: {
    id: "Storage belum bisa menjangkau edge camera service.",
    en: "Storage cannot reach the edge camera service yet.",
    zh: "存储页面暂时无法连接边缘相机服务。",
  },

  // Jenis dan bentuk path.
  notConfigured: { id: "Belum dikonfigurasi", en: "Not configured", zh: "未配置" },
  pathKindUnc: { id: "UNC share", en: "UNC share", zh: "UNC 共享" },
  pathKindLocal: { id: "Path lokal", en: "Local path", zh: "本地路径" },
  pathMismatchUnc: {
    id: "Path UNC tidak berlaku di app server {platform}. Pakai path mount, misalnya /mnt/mti/ML/MTI.",
    en: "A UNC path does not work on a {platform} app server. Use a mount path, for example /mnt/mti/ML/MTI.",
    zh: "UNC 路径在 {platform} 应用服务器上无效。请使用挂载路径，例如 /mnt/mti/ML/MTI。",
  },
  pathMismatchPosix: {
    id: "Path bergaya POSIX di app server Windows. Pakai bentuk UNC, misalnya \\\\host\\share\\folder.",
    en: "POSIX-style path on a Windows app server. Use the UNC form, for example \\\\host\\share\\folder.",
    zh: "Windows 应用服务器上使用了 POSIX 风格的路径。请使用 UNC 形式，例如 \\\\host\\share\\folder。",
  },

  // Ringkasan status save root.
  checking: { id: "Mengecek...", en: "Checking...", zh: "正在检查…" },
  testingConnection: {
    id: "Menguji koneksi...",
    en: "Testing connection...",
    zh: "正在测试连接…",
  },
  notTested: { id: "Belum diuji", en: "Not tested yet", zh: "尚未测试" },
  connectedWritable: {
    id: "Terhubung, bisa ditulis",
    en: "Connected, writable",
    zh: "已连接，可写入",
  },
  notAccessible: { id: "Tidak bisa diakses", en: "Cannot be accessed", zh: "无法访问" },

  // Panduan probe: berhasil.
  guideOkHeadline: {
    id: "App server sudah bisa menulis dan menghapus file uji di target root ini.",
    en: "The app server can already write and delete a test file in this target root.",
    zh: "应用服务器已能在此目标根目录中写入并删除测试文件。",
  },
  guideOkCauseResponds: {
    id: "Path target merespons operasi create/delete dari runtime aplikasi.",
    en: "The target path responds to create/delete operations from the application runtime.",
    zh: "目标路径能响应应用运行时的创建/删除操作。",
  },
  guideOkCausePermission: {
    id: "Permission dasar untuk read/write terlihat tersedia pada proses app server saat probe dijalankan.",
    en: "Basic read/write permission appears to be available to the app server process when the probe ran.",
    zh: "运行探测时，应用服务器进程看起来具备基本的读写权限。",
  },
  guideOkActionEndToEnd: {
    id: "Lanjutkan uji end-to-end dari halaman Capture untuk memastikan edge service juga berhasil export file final.",
    en: "Continue with an end-to-end test from the Capture page to make sure the edge service also exports the final file successfully.",
    zh: "请继续在“拍摄”页面做端到端测试，确认边缘服务也能成功导出最终文件。",
  },
  guideOkActionIfFails: {
    id: "Jika export nyata masih gagal, fokuskan pengecekan ke edge service, lease kamera, atau payload export.",
    en: "If a real export still fails, focus the checks on the edge service, the camera session or the export payload.",
    zh: "如果实际导出仍然失败，请重点检查边缘服务、相机会话或导出数据。",
  },

  // Panduan probe: NOT_CONFIGURED.
  guideNotConfiguredHeadline: {
    id: "Auto-save belum punya target path karena `NETWORK_SAVE_ROOT` belum diisi.",
    en: "Auto-save has no target path yet because `NETWORK_SAVE_ROOT` is not set.",
    zh: "自动保存还没有目标路径，因为尚未设置 `NETWORK_SAVE_ROOT`。",
  },
  guideNotConfiguredCauseEnv: {
    id: "Environment app server belum memuat `NETWORK_SAVE_ROOT`.",
    en: "The app server environment has not loaded `NETWORK_SAVE_ROOT`.",
    zh: "应用服务器环境尚未加载 `NETWORK_SAVE_ROOT`。",
  },
  guideNotConfiguredCauseDeploy: {
    id: "File `.env` atau variable deployment belum diterapkan ke runtime yang aktif.",
    en: "The `.env` file or the deployment variables have not been applied to the active runtime.",
    zh: "`.env` 文件或部署变量尚未应用到当前运行时。",
  },
  guideNotConfiguredActionSet: {
    id: "Isi `NETWORK_SAVE_ROOT` dengan path target yang benar lalu restart app server.",
    en: "Set `NETWORK_SAVE_ROOT` to the correct target path, then restart the app server.",
    zh: "将 `NETWORK_SAVE_ROOT` 设置为正确的目标路径，然后重启应用服务器。",
  },
  guideNotConfiguredActionRerun: {
    id: "Setelah restart, buka halaman ini lagi dan jalankan probe ulang.",
    en: "After the restart, open this page again and run the probe again.",
    zh: "重启后，请重新打开此页面并再次运行探测。",
  },

  // Panduan probe: NOT_DIRECTORY.
  guideNotDirectoryHeadline: {
    id: "Path yang dikonfigurasi ada, tetapi bukan folder yang bisa dipakai untuk save.",
    en: "The configured path exists, but it is not a folder that can be used for saving.",
    zh: "配置的路径存在，但不是可用于保存的文件夹。",
  },
  guideNotDirectoryCauseTarget: {
    id: "Path menunjuk ke file, shortcut, atau target yang tidak resolve sebagai direktori.",
    en: "The path points to a file, a shortcut or a target that does not resolve to a directory.",
    zh: "路径指向文件、快捷方式，或无法解析为目录的目标。",
  },
  guideNotDirectoryCauseTypo: {
    id: "Nilai env mengandung typo atau mengarah ke level path yang salah.",
    en: "The env value contains a typo or points to the wrong path level.",
    zh: "环境变量的值有拼写错误，或指向了错误的路径层级。",
  },
  guideNotDirectoryActionUpdate: {
    id: "Perbarui `NETWORK_SAVE_ROOT` agar menunjuk langsung ke folder tujuan.",
    en: "Update `NETWORK_SAVE_ROOT` so that it points directly to the destination folder.",
    zh: "更新 `NETWORK_SAVE_ROOT`，使其直接指向目标文件夹。",
  },
  guideNotDirectoryActionVerify: {
    id: "Verifikasi path tersebut dengan Explorer atau PowerShell pada mesin app server.",
    en: "Verify that path with Explorer or PowerShell on the app server machine.",
    zh: "在应用服务器上用 Explorer 或 PowerShell 验证该路径。",
  },

  // Panduan probe: ENOENT.
  guideEnoentHeadline: {
    id: "Target root tidak ditemukan dari sisi runtime aplikasi.",
    en: "The target root was not found from the application runtime.",
    zh: "应用运行时找不到目标根目录。",
  },
  guideEnoentCauseMissing: {
    id: "Folder tujuan belum ada atau nama share/path salah.",
    en: "The destination folder does not exist yet, or the share/path name is wrong.",
    zh: "目标文件夹尚不存在，或共享/路径名称有误。",
  },
  guideEnoentCauseUnc: {
    id: "Host share atau nama folder UNC tidak bisa di-resolve dari mesin app server.",
    en: "The share host or the UNC folder name cannot be resolved from the app server machine.",
    zh: "应用服务器无法解析共享主机或 UNC 文件夹名称。",
  },
  guideEnoentCauseLocal: {
    id: "Path lokal tidak ada pada mesin tempat app server berjalan.",
    en: "The local path does not exist on the machine where the app server runs.",
    zh: "运行应用服务器的机器上不存在该本地路径。",
  },
  guideEnoentActionSpelling: {
    id: "Cek ulang ejaan path, termasuk nama host share dan subfolder.",
    en: "Recheck the spelling of the path, including the share host name and the subfolders.",
    zh: "请重新检查路径拼写，包括共享主机名和子文件夹。",
  },
  guideEnoentActionExists: {
    id: "Pastikan folder tujuan benar-benar ada lalu jalankan probe ulang.",
    en: "Make sure the destination folder really exists, then run the probe again.",
    zh: "确认目标文件夹确实存在，然后再次运行探测。",
  },

  // Panduan probe: EACCES / EPERM.
  guideAccessHeadline: {
    id: "Runtime aplikasi bisa melihat path target, tetapi tidak punya izin tulis yang cukup.",
    en: "The application runtime can see the target path, but does not have sufficient write permission.",
    zh: "应用运行时能看到目标路径，但没有足够的写入权限。",
  },
  guideAccessCauseAccount: {
    id: "Akun proses app server tidak punya hak create/delete pada folder tujuan.",
    en: "The app server process account has no create/delete rights on the destination folder.",
    zh: "应用服务器进程账号对目标文件夹没有创建/删除权限。",
  },
  guideAccessCauseUnc: {
    id: "UNC share meminta kredensial yang tidak dimiliki service account.",
    en: "The UNC share asks for credentials that the service account does not have.",
    zh: "UNC 共享要求的凭据是服务账号所没有的。",
  },
  guideAccessCauseLocal: {
    id: "ACL folder lokal menolak akses write/delete untuk user service.",
    en: "The local folder ACL denies write/delete access to the service user.",
    zh: "本地文件夹的 ACL 拒绝了服务用户的写入/删除访问。",
  },
  guideAccessActionAccount: {
    id: "Jalankan service/app dengan akun yang memang punya akses ke folder tujuan.",
    en: "Run the service/app with an account that does have access to the destination folder.",
    zh: "请使用确实有权访问目标文件夹的账号运行服务/应用。",
  },
  guideAccessActionManual: {
    id: "Uji create/delete file manual menggunakan akun runtime yang sama dengan app server.",
    en: "Test creating and deleting a file manually using the same runtime account as the app server.",
    zh: "使用与应用服务器相同的运行账号，手动测试创建/删除文件。",
  },

  // Panduan probe: kode lain.
  guideOtherHeadlineUnc: {
    id: "UNC share belum bisa dipakai andal dari runtime aplikasi ini.",
    en: "The UNC share cannot yet be used reliably from this application runtime.",
    zh: "此应用运行时还无法可靠地使用该 UNC 共享。",
  },
  guideOtherHeadline: {
    id: "Probe gagal dengan error yang belum terklasifikasi otomatis.",
    en: "The probe failed with an error that is not classified automatically yet.",
    zh: "探测失败，错误暂时无法自动归类。",
  },
  guideOtherCauseUnc: {
    id: "Share jaringan mungkin tidak reachable dari service account, walau terlihat benar dari sesi login biasa.",
    en: "The network share may not be reachable from the service account, even though it looks right from a normal login session.",
    zh: "服务账号可能无法访问该网络共享，即使在普通登录会话中看起来正常。",
  },
  guideOtherCauseLocal: {
    id: "Path target merespons tidak normal saat dicek oleh app server.",
    en: "The target path responded abnormally when checked by the app server.",
    zh: "应用服务器检查时，目标路径响应异常。",
  },
  guideOtherCauseContext: {
    id: "Proses app server bisa berjalan pada konteks user/credential yang berbeda dari operator yang sedang login.",
    en: "The app server process may run in a different user/credential context from the operator who is signed in.",
    zh: "应用服务器进程的用户/凭据上下文可能与当前登录的操作员不同。",
  },
  guideOtherActionUnc: {
    id: "Coba akses UNC path yang sama langsung dari mesin app server memakai akun runtime yang sama.",
    en: "Try accessing the same UNC path directly from the app server machine with the same runtime account.",
    zh: "请在应用服务器上使用相同的运行账号直接访问同一个 UNC 路径。",
  },
  guideOtherActionLocal: {
    id: "Cek log runtime server dan uji create/delete file manual pada path target.",
    en: "Check the server runtime log and test creating and deleting a file manually at the target path.",
    zh: "请查看服务器运行日志，并在目标路径手动测试创建/删除文件。",
  },
  guideOtherActionVerify: {
    id: "Pastikan host share, kredensial, izin tulis, dan policy service account sudah sesuai.",
    en: "Make sure the share host, credentials, write permission and service account policy are all correct.",
    zh: "请确认共享主机、凭据、写入权限和服务账号策略均正确。",
  },

  // Tindakan berikutnya yang disarankan.
  stepSetRoot: {
    id: "Set `NETWORK_SAVE_ROOT` di environment app agar export otomatis punya target path.",
    en: "Set `NETWORK_SAVE_ROOT` in the app environment so that automatic export has a target path.",
    zh: "请在应用环境中设置 `NETWORK_SAVE_ROOT`，让自动导出有目标路径。",
  },
  stepEdgeReachable: {
    id: "Pastikan edge camera service reachable dari aplikasi sebelum mencoba auto-save.",
    en: "Make sure the edge camera service is reachable from the application before trying auto-save.",
    zh: "尝试自动保存前，请确认应用能连接边缘相机服务。",
  },
  stepFixWriteAccess: {
    id: "Perbaiki akses tulis app server ke target root. Error terakhir: {code}.",
    en: "Fix the app server's write access to the target root. Last error: {code}.",
    zh: "请修复应用服务器对目标根目录的写入权限。最近的错误：{code}。",
  },
  stepEndToEnd: {
    id: "Lanjutkan tes end-to-end dari halaman Capture untuk memverifikasi penulisan final oleh app server.",
    en: "Continue with an end-to-end test from the Capture page to verify the final write by the app server.",
    zh: "请继续在“拍摄”页面做端到端测试，验证应用服务器的最终写入。",
  },

  // Urutan alur simpan.
  flowNetworkSave: { id: "Network save", en: "Network save", zh: "网络保存" },
  flowNetworkSaveDescription: {
    id: "App server menarik gambar dari edge lalu menulisnya sendiri ke NETWORK_SAVE_ROOT. Probe di halaman ini menguji mesin yang sama, jadi hasilnya mewakili jalur sebenarnya.",
    en: "The app server pulls the image from the edge and writes it to NETWORK_SAVE_ROOT itself. The probe on this page tests the same machine, so its result represents the real path.",
    zh: "应用服务器从边缘设备拉取图像，并自行写入 NETWORK_SAVE_ROOT。此页面的探测针对的是同一台机器，因此结果能代表实际路径。",
  },
  flowFolderHandle: { id: "Folder handle", en: "Folder handle", zh: "浏览器所选文件夹" },
  flowFolderHandleDescription: {
    id: "Jika network export tidak bisa dipakai, operator dapat menyimpan ke folder yang dipilih di browser.",
    en: "If network export cannot be used, the operator can save to a folder chosen in the browser.",
    zh: "如果无法使用网络导出，操作员可以保存到在浏览器中选择的文件夹。",
  },
  flowBrowserDownload: { id: "Browser download", en: "Browser download", zh: "浏览器下载" },
  flowBrowserDownloadDescription: {
    id: "Fallback terakhir adalah download biasa dari browser bila jalur lain tidak tersedia.",
    en: "The last fallback is a normal browser download when no other path is available.",
    zh: "当其他路径都不可用时，最后的备用方式是普通的浏览器下载。",
  },

  // Checklist kesiapan.
  checkRootSet: {
    id: "NETWORK_SAVE_ROOT terisi",
    en: "NETWORK_SAVE_ROOT is set",
    zh: "NETWORK_SAVE_ROOT 已设置",
  },
  checkRootSetDone: {
    id: "Target path sudah dimuat dari env.",
    en: "The target path has been loaded from env.",
    zh: "目标路径已从环境变量加载。",
  },
  checkRootSetPending: {
    id: "Env belum menyediakan target path.",
    en: "The env does not provide a target path yet.",
    zh: "环境变量尚未提供目标路径。",
  },
  checkEdgeReachable: {
    id: "Edge API reachable",
    en: "Edge API reachable",
    zh: "Edge API 可连接",
  },
  checkEdgeReachableDone: {
    id: "Aplikasi berhasil membaca status edge device.",
    en: "The application read the edge device status successfully.",
    zh: "应用已成功读取边缘设备状态。",
  },
  checkEdgeReachablePending: {
    id: "Aplikasi belum bisa menjangkau edge device saat ini.",
    en: "The application cannot reach the edge device at the moment.",
    zh: "应用目前无法连接边缘设备。",
  },
  checkWriteProbe: {
    id: "Write probe berhasil",
    en: "Write probe succeeded",
    zh: "写入探测成功",
  },
  checkWriteProbeDone: {
    id: "App server berhasil create/delete file uji.",
    en: "The app server created and deleted the test file successfully.",
    zh: "应用服务器已成功创建并删除测试文件。",
  },
  checkWriteProbeFailed: {
    id: "Probe terakhir gagal dengan code {code}.",
    en: "The last probe failed with code {code}.",
    zh: "最近一次探测失败，代码为 {code}。",
  },
  checkWriteProbePending: {
    id: "Belum ada hasil probe untuk memverifikasi akses tulis.",
    en: "There is no probe result yet to verify write access.",
    zh: "尚无探测结果可用于验证写入权限。",
  },

  // Kepala halaman.
  pageDescription: {
    id: "Uji NETWORK_SAVE_ROOT, konfirmasi reachability edge API, dan pahami kapan Capture akan berpindah ke fallback browser download.",
    en: "Test NETWORK_SAVE_ROOT, confirm edge API reachability, and understand when Capture will switch to the browser download fallback.",
    zh: "测试 NETWORK_SAVE_ROOT，确认 Edge API 是否可连接，并了解“拍摄”何时会改用浏览器下载作为备用方式。",
  },
  refreshStatus: { id: "Refresh Status", en: "Refresh Status", zh: "刷新状态" },
  openCapture: { id: "Buka Capture", en: "Open Capture", zh: "打开拍摄" },

  // Kartu ringkasan.
  cardAutoSaveTitle: {
    id: "Kesiapan Auto-Save",
    en: "Auto-Save Readiness",
    zh: "自动保存就绪情况",
  },
  ready: { id: "Siap", en: "Ready", zh: "就绪" },
  needsFallback: { id: "Perlu fallback", en: "Fallback needed", zh: "需要备用方式" },
  cardAutoSaveDescription: {
    id: "Menilai apakah Capture bisa mencoba auto-save sebelum fallback browser.",
    en: "Assesses whether Capture can try auto-save before the browser fallback.",
    zh: "判断“拍摄”能否在改用浏览器备用方式前先尝试自动保存。",
  },
  cardNetworkRootTitle: { id: "Network Root", en: "Network Root", zh: "网络根目录" },
  rootSet: { id: "Sudah diisi", en: "Set", zh: "已设置" },
  rootMissing: { id: "Belum ada", en: "Not set", zh: "未设置" },
  cardNetworkRootEmpty: {
    id: "Belum ada target network root yang dimuat dari env.",
    en: "No target network root has been loaded from env yet.",
    zh: "尚未从环境变量加载目标网络根目录。",
  },
  cardEdgeTitle: { id: "Reachability Edge", en: "Edge Reachability", zh: "边缘设备连接情况" },
  connected: { id: "Terhubung", en: "Connected", zh: "已连接" },
  offline: { id: "Offline", en: "Offline", zh: "离线" },
  cameraApiUrlEnvMissing: {
    id: "Belum ada CAMERA_API_URL yang termuat.",
    en: "No CAMERA_API_URL has been loaded yet.",
    zh: "尚未加载 CAMERA_API_URL。",
  },
  cardLastProbeTitle: { id: "Probe Terakhir", en: "Last Probe", zh: "最近一次探测" },
  writeOk: { id: "Write OK", en: "Write OK", zh: "写入正常" },
  failedWithCode: { id: "Gagal ({code})", en: "Failed ({code})", zh: "失败（{code}）" },
  notRunYet: { id: "Belum dijalankan", en: "Not run yet", zh: "尚未运行" },
  checkedAt: { id: "Dicek {time}", en: "Checked {time}", zh: "检查于 {time}" },
  cardLastProbeEmpty: {
    id: "Jalankan write probe untuk menguji akses tulis app server.",
    en: "Run the write probe to test the app server's write access.",
    zh: "运行写入探测以测试应用服务器的写入权限。",
  },

  // Antrean kirim.
  spoolUnwritableTitle: {
    id: "Antrean kirim tidak bisa ditulis",
    en: "The send queue cannot be written",
    zh: "发送队列无法写入",
  },
  spoolUnwritableBody: {
    id: "App server tidak punya izin menulis di folder antrean, jadi setiap capture gagal tersimpan ke folder jaringan dan jatuh ke unduhan browser. Umumnya ini terjadi karena volume Docker-nya terbuat milik {root} sementara container berjalan sebagai {node}. Jalankan di server: {chown}, lalu {up}.",
    en: "The app server is not allowed to write to the queue folder, so every capture fails to be saved to the network folder and falls back to a browser download. This usually happens because the Docker volume was created owned by {root} while the container runs as {node}. Run on the server: {chown}, then {up}.",
    zh: "应用服务器没有写入队列文件夹的权限，因此每次拍摄都无法保存到网络文件夹，只能改为浏览器下载。通常是因为 Docker 卷创建时属于 {root}，而容器以 {node} 身份运行。请在服务器上运行：{chown}，然后运行 {up}。",
  },
  spoolPendingTitle: {
    id: "{count} foto menunggu dikirim ke folder jaringan",
    en: "{count} photos waiting to be sent to the network folder",
    zh: "{count} 张照片等待发送到网络文件夹",
  },
  spoolPendingBody: {
    id: "Foto sudah aman di app server dan akan terkirim sendiri begitu folder jaringan terjangkau. {used} MB terpakai dari {cap} MB.",
    en: "The photos are safe on the app server and will be sent automatically as soon as the network folder is reachable. {used} MB used of {cap} MB.",
    zh: "照片已安全保存在应用服务器上，网络文件夹可访问后会自动发送。已使用 {used} MB，共 {cap} MB。",
  },
  spoolPendingBodyWithOldest: {
    id: "Foto sudah aman di app server dan akan terkirim sendiri begitu folder jaringan terjangkau. {used} MB terpakai dari {cap} MB. Paling lama menunggu sejak {time}.",
    en: "The photos are safe on the app server and will be sent automatically as soon as the network folder is reachable. {used} MB used of {cap} MB. The oldest has been waiting since {time}.",
    zh: "照片已安全保存在应用服务器上，网络文件夹可访问后会自动发送。已使用 {used} MB，共 {cap} MB。最早的一张自 {time} 起等待。",
  },
  sending: { id: "Mengirim...", en: "Sending...", zh: "正在发送…" },
  sendNow: { id: "Kirim sekarang", en: "Send now", zh: "立即发送" },

  // Kartu Network Save Root, Edge API, dan jalur simpan.
  saveRootTitle: { id: "Network Save Root", en: "Network Save Root", zh: "网络保存根目录" },
  saveRootEmpty: {
    id: "Isi NETWORK_SAVE_ROOT di .env untuk mengaktifkan network save otomatis.",
    en: "Set NETWORK_SAVE_ROOT in .env to enable automatic network save.",
    zh: "在 .env 中设置 NETWORK_SAVE_ROOT 以启用自动网络保存。",
  },
  pathKind: { id: "Jenis path: {kind}", en: "Path type: {kind}", zh: "路径类型：{kind}" },
  pathKindWithPlatform: {
    id: "Jenis path: {kind} · app server: {platform}",
    en: "Path type: {kind} · app server: {platform}",
    zh: "路径类型：{kind} · 应用服务器：{platform}",
  },
  testing: { id: "Menguji...", en: "Testing...", zh: "正在测试…" },
  testConnection: { id: "Uji koneksi", en: "Test connection", zh: "测试连接" },
  offlineNotConnected: {
    id: "Offline / tidak terhubung",
    en: "Offline / not connected",
    zh: "离线 / 未连接",
  },
  cameraApiUrlMissing: {
    id: "Belum ada camera API URL yang termuat",
    en: "No camera API URL has been loaded yet",
    zh: "尚未加载 Camera API URL",
  },
  lastCheck: {
    id: "Pengecekan terakhir: {time}",
    en: "Last check: {time}",
    zh: "上次检查：{time}",
  },
  savePathTitle: { id: "Jalur Simpan Capture", en: "Capture Save Path", zh: "拍摄保存路径" },
  readyForNetworkExport: {
    id: "Siap mencoba network export",
    en: "Ready to try network export",
    zh: "可以尝试网络导出",
  },
  fallbackMayBeUsed: {
    id: "Fallback mungkin dipakai",
    en: "A fallback may be used",
    zh: "可能会使用备用方式",
  },
  savePathHint: {
    id: "Simpan otomatis dari `/capture` membutuhkan save root yang sudah dikonfigurasi dan edge camera service yang bisa dijangkau.",
    en: "Automatic save from `/capture` needs a configured save root and a reachable edge camera service.",
    zh: "从 `/capture` 自动保存需要已配置的保存根目录和可连接的边缘相机服务。",
  },

  // Tindakan berikutnya, alur simpan, checklist, panduan.
  nextActionsTitle: { id: "Tindakan Berikutnya", en: "Next Actions", zh: "后续操作" },
  allDependenciesReady: {
    id: "Semua dependency utama terlihat siap. Lakukan tes nyata dari halaman Capture untuk memastikan edge service berhasil menulis file akhir ke target storage.",
    en: "All main dependencies look ready. Run a real test from the Capture page to make sure the edge service writes the final file to the storage target.",
    zh: "所有主要依赖项看起来都已就绪。请在“拍摄”页面做一次实际测试，确认边缘服务能将最终文件写入存储目标。",
  },
  saveFlowTitle: { id: "Urutan Alur Simpan", en: "Save Flow Order", zh: "保存流程顺序" },
  activePath: { id: "Jalur aktif", en: "Active path", zh: "当前路径" },
  readinessTitle: { id: "Checklist Kesiapan", en: "Readiness Checklist", zh: "就绪检查清单" },
  probeGuideTitle: { id: "Panduan Probe", en: "Probe Guidance", zh: "探测指南" },
  possibleCauses: { id: "Kemungkinan penyebab", en: "Possible causes", zh: "可能的原因" },
  nextActions: { id: "Tindakan berikutnya", en: "Next actions", zh: "后续操作" },
  probeGuideEmpty: {
    id: "Jalankan write probe dulu agar halaman ini bisa memberi arahan troubleshooting yang lebih spesifik berdasarkan error runtime yang aktual.",
    en: "Run the write probe first so that this page can give more specific troubleshooting guidance based on the actual runtime error.",
    zh: "请先运行写入探测，这样此页面才能根据实际的运行时错误给出更具体的排查建议。",
  },

  // Probe storage app server.
  probeSectionTitle: {
    id: "Probe Storage App Server",
    en: "App Server Storage Probe",
    zh: "应用服务器存储探测",
  },
  probeSectionHint: {
    id: "Menjalankan probe write-delete yang aman dari app server ini ke `NETWORK_SAVE_ROOT`.",
    en: "Runs a safe write-delete probe from this app server to `NETWORK_SAVE_ROOT`.",
    zh: "从此应用服务器向 `NETWORK_SAVE_ROOT` 运行一次安全的写入-删除探测。",
  },
  runWriteProbe: { id: "Jalankan Write Probe", en: "Run Write Probe", zh: "运行写入探测" },
  probeResultEmpty: {
    id: "Belum ada hasil probe. Jalankan tes ini untuk memastikan app server bisa membuat dan menghapus file sementara di dalam root yang dikonfigurasi.",
    en: "There is no probe result yet. Run this test to make sure the app server can create and delete a temporary file inside the configured root.",
    zh: "尚无探测结果。请运行此测试，确认应用服务器能在配置的根目录中创建并删除临时文件。",
  },
  probeSucceeded: { id: "Probe berhasil", en: "Probe succeeded", zh: "探测成功" },
  probeFailedWithCode: {
    id: "Probe gagal ({code})",
    en: "Probe failed ({code})",
    zh: "探测失败（{code}）",
  },
  targetPath: { id: "Path target", en: "Target path", zh: "目标路径" },
  checkTime: { id: "Waktu cek", en: "Check time", zh: "检查时间" },
  appServerPlatform: {
    id: "Platform app server",
    en: "App server platform",
    zh: "应用服务器平台",
  },
  probeFile: { id: "File probe", en: "Probe file", zh: "探测文件" },

  // Cara membaca halaman ini.
  howToReadTitle: {
    id: "Cara Membaca Halaman Ini",
    en: "How to Read This Page",
    zh: "如何阅读此页面",
  },
  howToReadHint: {
    id: "Halaman ini membantu diagnosis alur simpan, tetapi tidak menggantikan tes capture yang nyata.",
    en: "This page helps diagnose the save flow, but it does not replace a real capture test.",
    zh: "此页面有助于诊断保存流程，但不能替代实际的拍摄测试。",
  },
  howToReadSaveRoot: {
    id: "Jika `Network Save Root` belum dikonfigurasi, `/capture` akan langsung berpindah ke folder-picker atau fallback browser download.",
    en: "If `Network Save Root` is not configured, `/capture` switches straight to the folder picker or the browser download fallback.",
    zh: "如果 `网络保存根目录` 尚未配置，`/capture` 会直接改用文件夹选择器或浏览器下载作为备用方式。",
  },
  howToReadEdge: {
    id: "Jika `Edge API` sedang offline, aplikasi tidak bisa meminta camera service mengekspor aset hasil capture ke network share.",
    en: "If `Edge API` is offline, the application cannot ask the camera service to export the captured assets to the network share.",
    zh: "如果 `Edge API` 处于离线状态，应用将无法让相机服务把拍摄结果导出到网络共享。",
  },
  howToReadProbeFails: {
    id: "Jika `Jalankan Write Probe` gagal, berarti app server ini sendiri belum bisa menulis ke path yang dikonfigurasi. Ini pertanda kuat bahwa auto-save tidak akan andal di runtime saat ini.",
    en: "If `Run Write Probe` fails, this app server itself cannot write to the configured path yet. That is a strong sign that auto-save will not be reliable in the current runtime.",
    zh: "如果 `运行写入探测` 失败，说明此应用服务器本身还无法写入配置的路径。这强烈表明自动保存在当前运行环境下不可靠。",
  },
  howToReadProbeSucceeds: {
    id: "Meski probe ini berhasil, export capture final tetap bergantung pada edge camera service untuk menyelesaikan request export-nya sendiri.",
    en: "Even when this probe succeeds, the final capture export still depends on the edge camera service completing its own export request.",
    zh: "即使此探测成功，最终的拍摄导出仍取决于边缘相机服务能否完成它自己的导出请求。",
  },
  reviewSettings: { id: "Tinjau Settings", en: "Review Settings", zh: "查看设置" },
});
