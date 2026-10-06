import { defineMessages } from "@/lib/i18n";

export const loginMessages = defineMessages({
  dashboardSubtitle: { id: "Ringkasan Operasi", en: "Operations Summary", zh: "运营概览" },
  dashboardDescription: {
    id: "Volume capture, status edge device, dan tren sampling harian dalam satu layar.",
    en: "Capture volume, edge device status and daily sampling trends on one screen.",
    zh: "在一个页面查看拍摄量、边缘设备状态和每日取样趋势。",
  },
  captureSubtitle: { id: "Ambil Foto Sampel", en: "Take Sample Photos", zh: "拍摄样品照片" },
  captureDescription: {
    id: "Live preview, kontrol kamera Canon, dan simpan BIN 1 / BIN 2 dalam satu alur.",
    en: "Live preview, Canon camera control and saving BIN 1 / BIN 2 in one flow.",
    zh: "实时预览、Canon 相机控制以及保存 BIN 1 / BIN 2，一个流程完成。",
  },
  gallerySubtitle: { id: "Arsip Hasil Capture", en: "Capture Archive", zh: "拍摄档案" },
  galleryDescription: {
    id: "Telusuri foto per tanggal, plant, dan station lengkap dengan metadatanya.",
    en: "Browse photos by date, plant and station, complete with their metadata.",
    zh: "按日期、工厂和工位浏览照片及其详细信息。",
  },
  devicesSubtitle: { id: "Registry Kamera", en: "Camera Registry", zh: "相机登记表" },
  devicesDescription: {
    id: "Daftarkan Mini PC dan kamera, atur preset ISO, shutter, serta white balance.",
    en: "Register Mini PCs and cameras, and set ISO, shutter and white balance presets.",
    zh: "登记迷你电脑和相机，设置 ISO、快门和白平衡预设。",
  },
  storageSubtitle: { id: "Tujuan Simpan", en: "Save Destination", zh: "保存位置" },
  storageDescription: {
    id: "Pantau share jaringan dan diagnosa kegagalan penyimpanan otomatis.",
    en: "Monitor the network share and diagnose automatic save failures.",
    zh: "监控网络共享并诊断自动保存失败。",
  },
  settingsSubtitle: { id: "Preferensi Aplikasi", en: "Application Preferences", zh: "应用偏好" },
  settingsDescription: {
    id: "Pola penamaan berkas, jadwal pengambilan, dan zona waktu operasional.",
    en: "File naming pattern, capture schedule and operating time zone.",
    zh: "文件命名规则、拍摄排程和运行时区。",
  },

  pillarRecorded: { id: "Sampel Terekam", en: "Samples Recorded", zh: "样品有记录" },
  pillarRecordedSub: {
    id: "Tiap BIN Terdokumentasi",
    en: "Every BIN Documented",
    zh: "每个 BIN 均有存档",
  },
  pillarMetadata: { id: "Metadata Lengkap", en: "Complete Metadata", zh: "信息完整" },
  pillarMetadataSub: {
    id: "Waktu, Plant, Station",
    en: "Time, Plant, Station",
    zh: "时间、工厂、工位",
  },
  pillarAutoSave: { id: "Simpan Otomatis", en: "Automatic Save", zh: "自动保存" },
  pillarAutoSaveSub: { id: "Langsung ke Share", en: "Straight to the Share", zh: "直接存入共享" },
  pillarHistory: { id: "Riwayat Terlacak", en: "Traceable History", zh: "历史可追溯" },
  pillarHistorySub: { id: "Audit per Operator", en: "Audit per Operator", zh: "按操作员审计" },

  identifierRequired: {
    id: "Username atau email wajib diisi",
    en: "Username or email is required",
    zh: "请输入用户名或邮箱",
  },
  passwordRequired: { id: "Password wajib diisi", en: "Password is required", zh: "请输入密码" },
  incomplete: {
    id: "Lengkapi username dan password.",
    en: "Enter your username and password.",
    zh: "请填写用户名和密码。",
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

  progressTitle: { id: "Sedang masuk...", en: "Signing in...", zh: "正在登录…" },
  successTitle: { id: "Berhasil Masuk", en: "Signed In", zh: "登录成功" },
  successMessage: {
    id: "Selamat datang, {name}. Anda akan dialihkan sebentar lagi.",
    en: "Welcome, {name}. You will be redirected in a moment.",
    zh: "欢迎，{name}。即将为您跳转。",
  },
  failedTitle: { id: "Gagal Masuk", en: "Sign-In Failed", zh: "登录失败" },
  loggedOutTitle: { id: "Berhasil Keluar", en: "Signed Out", zh: "已退出登录" },
  loggedOutMessage: { id: "Sampai jumpa!", en: "See you again!", zh: "再见！" },
  ok: { id: "OK", en: "OK", zh: "确定" },

  welcome: { id: "Selamat Datang", en: "Welcome", zh: "欢迎" },
  welcomeCopy: {
    id: "Masuk untuk mulai mendokumentasikan sampel calcine.",
    en: "Sign in to start documenting calcine samples.",
    zh: "登录后开始记录焙砂样品。",
  },
  identifierLabel: { id: "Username atau email", en: "Username or email", zh: "用户名或邮箱" },
  passwordLabel: { id: "Password", en: "Password", zh: "密码" },
  passwordPlaceholder: {
    id: "Password akun operator",
    en: "Operator account password",
    zh: "操作员账号密码",
  },
  hidePassword: { id: "Sembunyikan password", en: "Hide password", zh: "隐藏密码" },
  showPassword: { id: "Tampilkan password", en: "Show password", zh: "显示密码" },
  forgotPassword: { id: "Lupa password?", en: "Forgot password?", zh: "忘记密码？" },
  checking: { id: "Memeriksa...", en: "Checking...", zh: "正在验证…" },
  signIn: { id: "Masuk", en: "Sign in", zh: "登录" },
  footerPlant: { id: "Operasional Plant", en: "Plant Operations", zh: "工厂运营" },
  footerAudit: {
    id: "Penggunaan akun dicatat untuk keperluan audit.",
    en: "Account activity is recorded for audit purposes.",
    zh: "账号使用情况会被记录以备审计。",
  },

  groupLogosAlt: {
    id: "Merdeka Copper Gold, Merdeka Battery Materials, dan Merdeka Gold Resources",
    en: "Merdeka Copper Gold, Merdeka Battery Materials and Merdeka Gold Resources",
    zh: "Merdeka Copper Gold、Merdeka Battery Materials 和 Merdeka Gold Resources",
  },
  taglineFirst: {
    id: "Dokumentasi Sampling Calcine",
    en: "Calcine Sampling Documentation",
    zh: "焙砂取样记录",
  },
  taglineSecond: {
    id: "Cepat, Konsisten, dan Terlacak",
    en: "Fast, Consistent and Traceable",
    zh: "快速、一致、可追溯",
  },
  intro: {
    id: "Platform terpadu untuk mengambil, menyimpan, dan menelusuri foto sampel calcine dari seluruh plant — satu alur kerja dari kamera di lapangan sampai arsip di share jaringan.",
    en: "One platform to capture, store and browse calcine sample photos from every plant — a single workflow from the camera in the field to the archive on the network share.",
    zh: "集拍摄、保存和查阅各工厂焙砂样品照片于一体的平台——从现场相机到网络共享存档，一个流程完成。",
  },

  ssoNotReady: {
    id: "SSO belum tersedia - masuk dengan username dan password.",
    en: "SSO is not available yet - sign in with your username and password.",
    zh: "暂不支持 SSO，请使用用户名和密码登录。",
  },
  ssoDivider: { id: "atau masuk dengan SSO", en: "or sign in with SSO", zh: "或使用 SSO 登录" },

  helpQuestion: { id: "Butuh bantuan masuk?", en: "Need help signing in?", zh: "登录遇到问题？" },
  helpTitle: { id: "Panduan Login", en: "Sign-In Guide", zh: "登录指南" },
  helpUsernameBefore: {
    id: "Pakai username operator yang didaftarkan Super Admin, misalnya",
    en: "Use the operator username registered by a Super Admin, for example",
    zh: "请使用超级管理员登记的操作员用户名，例如",
  },
  helpUsernameAfter: {
    id: "Email kantor juga diterima di kolom yang sama.",
    en: "Your work email is accepted in the same field.",
    zh: "同一栏也可填写工作邮箱。",
  },
  helpWrongPassword: {
    id: "Password salah berulang kali? Berhenti menebak dan hubungi Super Admin.",
    en: "Wrong password again and again? Stop guessing and contact a Super Admin.",
    zh: "多次输错密码？请不要再尝试，联系超级管理员。",
  },
  helpReset: {
    id: "Reset password dan pembuatan akun baru dilakukan Super Admin lewat menu Users di dalam aplikasi, bukan dari halaman ini.",
    en: "Password resets and new accounts are handled by a Super Admin in the Users menu inside the application, not on this page.",
    zh: "重置密码和创建新账号由超级管理员在应用内的“用户”菜单中处理，而不是在此页面。",
  },
  helpDatabase: {
    id: "Kalau muncul pesan database tidak bisa dihubungi, itu kendala server, bukan akun Anda.",
    en: "If a message says the database cannot be reached, that is a server problem, not your account.",
    zh: "如果提示无法连接数据库，那是服务器问题，与您的账号无关。",
  },
});
