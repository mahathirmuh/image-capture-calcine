import { defineMessages } from "@/lib/i18n";

// Halaman Log (jejak aktivitas). Isi tiap baris -- detail, username, alamat IP --
// adalah data dan tampil apa adanya; yang diterjemahkan hanya kerangka halaman
// dan nama tiap jenis aksi.
export const logMessages = defineMessages({
  pageTitle: { id: "Log", en: "Log", zh: "日志" },
  pageDescription: {
    id: "Jejak siapa masuk, siapa mengubah akun, dan siapa menyentuh capture, perangkat, atau folder jaringan — beserta kejadian sistem seperti antrean kirim yang tertahan. Baris tidak bisa disunting atau dihapus dari halaman ini.",
    en: "A record of who signed in, who changed accounts, and who touched captures, devices or the network folder — along with system events such as a stalled send queue. Rows cannot be edited or deleted from this page.",
    zh: "记录谁登录过、谁修改过账号，以及谁操作过拍摄、设备或网络文件夹——还包括发送队列受阻等系统事件。此页面中的记录无法编辑或删除。",
  },

  reload: { id: "Muat ulang", en: "Reload", zh: "重新加载" },
  export: { id: "Ekspor", en: "Export", zh: "导出" },
  exportCsv: { id: "CSV untuk Excel", en: "CSV for Excel", zh: "CSV（适用于 Excel）" },
  exportJson: { id: "JSON mentah", en: "Raw JSON", zh: "原始 JSON" },

  loadFailedTitle: {
    id: "Jejak aktivitas tidak bisa dimuat",
    en: "The activity log could not be loaded",
    zh: "无法加载操作日志",
  },
  serverNoResponse: {
    id: "Server aplikasi tidak merespons.",
    en: "The app server did not respond.",
    zh: "应用服务器没有响应。",
  },
  serverNoResponseWith: {
    id: "Server aplikasi tidak merespons: {reason}",
    en: "The app server did not respond: {reason}",
    zh: "应用服务器没有响应：{reason}",
  },

  exportNoMatch: {
    id: "Tidak ada kejadian yang cocok dengan penyaring itu",
    en: "No events match that filter",
    zh: "没有符合该筛选条件的事件",
  },
  exported: {
    id: "{count} kejadian diekspor ke {format}",
    en: "{count} events exported to {format}",
    zh: "已将 {count} 条事件导出为 {format}",
  },
  exportTruncated: {
    id: "Terpotong di {limit} baris teratas dari {total} yang cocok. Persempit penyaringnya untuk mengambil sisanya.",
    en: "Cut off at the first {limit} rows of {total} matches. Narrow the filter to get the rest.",
    zh: "符合条件的共 {total} 条，仅导出前 {limit} 条。请缩小筛选范围以获取其余记录。",
  },
  exportComplete: {
    id: "Seluruh kejadian yang cocok dengan penyaring ikut terbawa.",
    en: "Every event that matches the filter is included.",
    zh: "符合筛选条件的事件已全部导出。",
  },
  exportFailed: { id: "Ekspor gagal.", en: "Export failed.", zh: "导出失败。" },

  searchPlaceholder: {
    id: "Cari username, detail, atau IP",
    en: "Search username, detail or IP",
    zh: "搜索用户名、详情或 IP",
  },
  searchLabel: {
    id: "Cari jejak aktivitas",
    en: "Search the activity log",
    zh: "搜索操作日志",
  },
  actionFilterLabel: {
    id: "Saring per jenis aksi",
    en: "Filter by action type",
    zh: "按操作类型筛选",
  },
  allActions: { id: "Semua aksi", en: "All actions", zh: "全部操作" },
  pageSizeLabel: {
    id: "Jumlah baris per halaman",
    en: "Rows per page",
    zh: "每页行数",
  },
  perPage: { id: "{size} / halaman", en: "{size} / page", zh: "{size} 条/页" },
  pageRange: {
    id: "{start}–{end} dari {total} kejadian",
    en: "{start}–{end} of {total} events",
    zh: "第 {start}–{end} 条，共 {total} 条事件",
  },
  previousPage: { id: "Halaman sebelumnya", en: "Previous page", zh: "上一页" },
  nextPage: { id: "Halaman berikutnya", en: "Next page", zh: "下一页" },

  columnTime: { id: "Waktu", en: "Time", zh: "时间" },
  columnAction: { id: "Aksi", en: "Action", zh: "操作" },
  columnActor: { id: "Pelaku", en: "Actor", zh: "操作人" },
  columnTarget: { id: "Sasaran", en: "Target", zh: "对象" },
  columnDetail: { id: "Detail", en: "Detail", zh: "详情" },
  columnIp: { id: "Alamat IP", en: "IP address", zh: "IP 地址" },

  loading: {
    id: "Memuat jejak aktivitas...",
    en: "Loading the activity log...",
    zh: "正在加载操作日志…",
  },
  emptyLog: {
    id: "Belum ada kejadian tercatat. Baris pertama muncul begitu ada yang masuk atau mengubah akun.",
    en: "No events recorded yet. The first row appears as soon as someone signs in or changes an account.",
    zh: "尚无事件记录。有人登录或修改账号后，第一行就会出现。",
  },
  emptyFiltered: {
    id: "Tidak ada kejadian yang cocok dengan penyaring itu.",
    en: "No events match that filter.",
    zh: "没有符合该筛选条件的事件。",
  },
  unknownActor: { id: "tidak dikenal", en: "unknown", zh: "未知" },

  // Nama tiap jenis aksi (ACTION_LABELS di src/lib/activity-log.ts).
  actionLoginSuccess: { id: "Berhasil masuk", en: "Signed in", zh: "登录成功" },
  actionLoginFailed: { id: "Gagal masuk", en: "Sign-in failed", zh: "登录失败" },
  actionLoginBlocked: { id: "Masuk ditolak", en: "Sign-in blocked", zh: "登录被拒绝" },
  actionLogout: { id: "Keluar", en: "Signed out", zh: "退出登录" },
  actionUserCreated: { id: "Akun dibuat", en: "Account created", zh: "账号已创建" },
  actionUserUpdated: { id: "Akun diubah", en: "Account changed", zh: "账号已修改" },
  actionUserDeleted: { id: "Akun dihapus", en: "Account deleted", zh: "账号已删除" },
  actionUserPasswordReset: { id: "Password direset", en: "Password reset", zh: "密码已重置" },
  actionCaptureDeleted: { id: "Capture dihapus", en: "Capture deleted", zh: "拍摄已删除" },
  actionCaptureRenamed: {
    id: "Capture diubah nama",
    en: "Capture renamed",
    zh: "拍摄已重命名",
  },
  actionStorageTargetChanged: {
    id: "Alamat edge diubah",
    en: "Edge address changed",
    zh: "边缘设备地址已更改",
  },
  actionStorageForwardFailed: {
    id: "Antrean gagal terkirim",
    en: "Send queue delivery failed",
    zh: "发送队列发送失败",
  },
  actionStorageForwardRecovered: {
    id: "Antrean pulih",
    en: "Send queue recovered",
    zh: "发送队列已恢复",
  },
  actionDeviceUpdated: { id: "Device diperbarui", en: "Device updated", zh: "设备已更新" },
  actionCameraSettingsApplied: {
    id: "Setelan kamera diterapkan",
    en: "Camera settings applied",
    zh: "相机设置已应用",
  },
  actionCaptureCreated: { id: "Capture dibuat", en: "Capture created", zh: "拍摄已创建" },
  actionCaptureImported: {
    id: "Berkas folder didaftarkan",
    en: "Folder files registered",
    zh: "已登记文件夹中的文件",
  },
  actionStorageFlushManual: {
    id: "Antrean dikirim manual",
    en: "Send queue sent manually",
    zh: "手动发送队列",
  },
});
