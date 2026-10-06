import { defineMessages, type Message } from "@/lib/i18n";

// Teks yang dipakai kerangka aplikasi: navigasi, menu pengguna, halaman galat.
// Teks milik satu halaman tinggal di berkasnya sendiri di folder ini.
export const commonMessages = defineMessages({
  language: { id: "Bahasa", en: "Language", zh: "语言" },
  appTagline: { id: "Operasional Calcine", en: "Calcine Operations", zh: "焙砂运营" },
  logoAlt: { id: "Logo Capture Calcine", en: "Capture Calcine logo", zh: "Capture Calcine 标志" },

  navDashboard: { id: "Dashboard", en: "Dashboard", zh: "仪表板" },
  navCapture: { id: "Capture", en: "Capture", zh: "拍摄" },
  navGallery: { id: "Gallery", en: "Gallery", zh: "图库" },
  navDevices: { id: "Devices", en: "Devices", zh: "设备" },
  navStorage: { id: "Storage", en: "Storage", zh: "存储" },
  navUsers: { id: "Users", en: "Users", zh: "用户" },
  navLog: { id: "Log", en: "Log", zh: "日志" },
  navSettings: { id: "Settings", en: "Settings", zh: "设置" },
  navRegisterDevice: { id: "Daftarkan Device", en: "Register Device", zh: "登记设备" },

  groupOperations: { id: "Operasional", en: "Operations", zh: "运营" },
  groupInfrastructure: { id: "Infrastruktur", en: "Infrastructure", zh: "基础设施" },
  groupAdministration: { id: "Pengaturan", en: "Administration", zh: "管理" },

  roleAdmin: { id: "Super Admin", en: "Super Admin", zh: "超级管理员" },
  roleOperator: { id: "Operator", en: "Operator", zh: "操作员" },
  roleViewer: { id: "Viewer", en: "Viewer", zh: "查看者" },
  allPlants: { id: "Semua Plant", en: "All Plants", zh: "全部工厂" },

  accountOf: { id: "Akun {name}", en: "Account of {name}", zh: "{name} 的账号" },
  noEmail: { id: "Tanpa email", en: "No email", zh: "无邮箱" },
  signOut: { id: "Keluar", en: "Sign out", zh: "退出登录" },
  signingOut: { id: "Keluar...", en: "Signing out...", zh: "正在退出…" },
  signOutFailed: {
    id: "Gagal keluar dari sesi.",
    en: "Could not sign out.",
    zh: "退出登录失败。",
  },
  signOutFailedWith: {
    id: "Gagal keluar: {reason}",
    en: "Could not sign out: {reason}",
    zh: "退出登录失败：{reason}",
  },

  showSidebar: { id: "Tampilkan sidebar", en: "Show sidebar", zh: "显示侧边栏" },
  hideSidebar: { id: "Sembunyikan sidebar", en: "Hide sidebar", zh: "隐藏侧边栏" },
  breadcrumb: { id: "Breadcrumb", en: "Breadcrumb", zh: "当前位置" },

  notFoundTitle: { id: "Halaman tidak ditemukan", en: "Page not found", zh: "未找到页面" },
  notFoundBody: {
    id: "Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.",
    en: "The page you are looking for is not available or has been moved.",
    zh: "您访问的页面不存在或已被移动。",
  },
  backToCapture: { id: "Kembali ke Capture", en: "Back to Capture", zh: "返回拍摄" },
  errorTitle: { id: "Halaman gagal dimuat", en: "The page failed to load", zh: "页面加载失败" },
  errorBody: {
    id: "Terjadi kendala di aplikasi. Coba muat ulang halaman ini atau kembali ke Capture.",
    en: "The application ran into a problem. Reload this page or go back to Capture.",
    zh: "应用出现问题。请重新加载此页面或返回拍摄。",
  },
  tryAgain: { id: "Coba lagi", en: "Try again", zh: "重试" },
  toCapture: { id: "Ke Capture", en: "Go to Capture", zh: "前往拍摄" },
});

const ROLE_MESSAGES: Record<string, Message> = {
  admin: commonMessages.roleAdmin,
  operator: commonMessages.roleOperator,
  viewer: commonMessages.roleViewer,
};

/** Pesan untuk sebuah peran; null kalau perannya tidak dikenal (tampilkan apa adanya). */
export function roleMessage(role: string | null | undefined): Message | null {
  return (role && ROLE_MESSAGES[role]) || null;
}
