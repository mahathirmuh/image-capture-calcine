import { defineMessages } from "@/lib/i18n";

// Halaman Users: daftar akun, dialog tambah/ubah, reset password, hapus.
export const usersMessages = defineMessages({
  description: {
    id: "Kelola akun yang boleh masuk ke aplikasi, perannya, dan status aktifnya.",
    en: "Manage the accounts that may sign in to the application, their roles and whether they are active.",
    zh: "管理可登录应用的账号及其角色和启用状态。",
  },
  reload: { id: "Muat ulang", en: "Reload", zh: "重新加载" },
  addUser: { id: "Tambah user", en: "Add user", zh: "添加用户" },
  loadFailedTitle: {
    id: "Daftar akun tidak bisa dimuat",
    en: "The account list could not be loaded",
    zh: "无法加载账号列表",
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
  searchPlaceholder: {
    id: "Cari username, nama, atau email",
    en: "Search username, name or email",
    zh: "搜索用户名、姓名或邮箱",
  },
  searchLabel: { id: "Cari akun", en: "Search accounts", zh: "搜索账号" },
  summary: {
    id: "{shown} dari {total} akun · {admins} {role} aktif",
    en: "{shown} of {total} accounts · active {role}: {admins}",
    zh: "显示 {shown}/{total} 个账号 · 启用的{role}：{admins}",
  },

  username: { id: "Username", en: "Username", zh: "用户名" },
  fullName: { id: "Nama lengkap", en: "Full name", zh: "姓名" },
  email: { id: "Email", en: "Email", zh: "邮箱" },
  role: { id: "Peran", en: "Role", zh: "角色" },
  plant: { id: "Plant", en: "Plant", zh: "工厂" },
  language: { id: "Bahasa", en: "Language", zh: "语言" },
  defaultLanguage: { id: "Bahasa default", en: "Default language", zh: "默认语言" },
  defaultLanguageHint: {
    id: "Dipasang otomatis setiap kali akun ini masuk, di web maupun di aplikasi mobile (mobile hanya English dan 中文). Setelah masuk, bahasanya tetap bisa diganti dari menu bahasa.",
    en: "Applied automatically every time this account signs in, on the web and in the mobile app (mobile has English and 中文 only). After signing in, the language can still be changed from the language menu.",
    zh: "该账号每次登录时自动应用，网页端和手机应用均适用（手机应用仅有 English 和 中文）。登录后仍可通过语言菜单切换。",
  },
  status: { id: "Status", en: "Status", zh: "状态" },
  lastLogin: { id: "Login terakhir", en: "Last sign-in", zh: "上次登录" },
  actions: { id: "Aksi", en: "Actions", zh: "操作" },

  loading: { id: "Memuat daftar akun...", en: "Loading accounts...", zh: "正在加载账号列表…" },
  noMatch: {
    id: "Tidak ada akun yang cocok dengan pencarian itu.",
    en: "No accounts match that search.",
    zh: "没有符合搜索条件的账号。",
  },
  empty: {
    id: "Belum ada akun terdaftar.",
    en: "No accounts have been registered yet.",
    zh: "尚未登记任何账号。",
  },
  you: { id: "Anda", en: "You", zh: "本人" },
  active: { id: "Aktif", en: "Active", zh: "启用" },
  inactive: { id: "Nonaktif", en: "Inactive", zh: "停用" },

  edit: { id: "Ubah", en: "Edit", zh: "编辑" },
  editNamed: { id: "Ubah {username}", en: "Edit {username}", zh: "编辑 {username}" },
  resetPassword: { id: "Reset password", en: "Reset password", zh: "重置密码" },
  resetPasswordNamed: {
    id: "Reset password {username}",
    en: "Reset password for {username}",
    zh: "重置 {username} 的密码",
  },
  delete: { id: "Hapus", en: "Delete", zh: "删除" },
  deleteNamed: { id: "Hapus {username}", en: "Delete {username}", zh: "删除 {username}" },
  cannotDeleteSelf: {
    id: "Tidak bisa menghapus akun sendiri",
    en: "You cannot delete your own account",
    zh: "不能删除自己的账号",
  },

  deleteTitle: {
    id: 'Hapus akun "{username}"?',
    en: 'Delete account "{username}"?',
    zh: "删除账号“{username}”？",
  },
  deleteBody: {
    id: "Akun ini langsung kehilangan akses. Foto dan catatan capture yang sudah dibuatnya tetap ada. Tindakan ini tidak bisa dibatalkan — kalau ragu, nonaktifkan saja lewat tombol Ubah.",
    en: "This account loses access immediately. The photos and capture records it created are kept. This cannot be undone — if in doubt, deactivate it with the Edit button instead.",
    zh: "该账号将立即失去访问权限，其已拍摄的照片和拍摄记录会保留。此操作无法撤销——如不确定，可通过“编辑”按钮将其停用。",
  },
  cancel: { id: "Batal", en: "Cancel", zh: "取消" },
  deleting: { id: "Menghapus...", en: "Deleting...", zh: "正在删除…" },
  deleteAccount: { id: "Hapus akun", en: "Delete account", zh: "删除账号" },
  deleted: {
    id: 'Akun "{username}" dihapus',
    en: 'Account "{username}" deleted',
    zh: "账号“{username}”已删除",
  },
  deleteFailed: {
    id: "Akun gagal dihapus.",
    en: "The account could not be deleted.",
    zh: "账号删除失败。",
  },

  // Validasi isian. Teks `id` sama dengan pesan skema di user-admin.ts, yang
  // juga menjadi pesan validasi di server.
  passwordsMismatch: {
    id: "Dua kolom password belum sama.",
    en: "The two password fields do not match.",
    zh: "两次输入的密码不一致。",
  },
  formInvalid: {
    id: "Ada isian yang belum benar.",
    en: "Some fields are not filled in correctly.",
    zh: "有填写不正确的内容。",
  },
  usernameTooShort: {
    id: "Username minimal 3 karakter",
    en: "Username must be at least 3 characters",
    zh: "用户名至少 3 个字符",
  },
  usernameTooLong: {
    id: "Username maksimal 100 karakter",
    en: "Username must be at most 100 characters",
    zh: "用户名最多 100 个字符",
  },
  usernameFormat: {
    id: "Gunakan huruf kecil, angka, titik, garis, underscore",
    en: "Use lowercase letters, digits, dots, hyphens and underscores",
    zh: "请使用小写字母、数字、点、连字符和下划线",
  },
  fullNameRequired: {
    id: "Nama lengkap wajib diisi",
    en: "Full name is required",
    zh: "请输入姓名",
  },
  emailInvalid: {
    id: "Format email tidak valid",
    en: "The email format is not valid",
    zh: "邮箱格式不正确",
  },
  emailTooLong: {
    id: "Email maksimal 200 karakter",
    en: "Email must be at most 200 characters",
    zh: "邮箱最多 200 个字符",
  },
  passwordTooShort: {
    id: "Password minimal {min} karakter",
    en: "Password must be at least {min} characters",
    zh: "密码至少 {min} 个字符",
  },
  passwordTooLong: {
    id: "Password maksimal 200 karakter",
    en: "Password must be at most 200 characters",
    zh: "密码最多 200 个字符",
  },
  passwordInvalid: {
    id: "Password belum memenuhi syarat.",
    en: "The password does not meet the requirements yet.",
    zh: "密码不符合要求。",
  },

  updated: {
    id: 'Akun "{username}" diperbarui',
    en: 'Account "{username}" updated',
    zh: "账号“{username}”已更新",
  },
  created: {
    id: 'Akun "{username}" dibuat',
    en: 'Account "{username}" created',
    zh: "账号“{username}”已创建",
  },
  saveFailed: {
    id: "Akun gagal disimpan.",
    en: "The account could not be saved.",
    zh: "账号保存失败。",
  },

  editUser: { id: "Ubah user", en: "Edit user", zh: "编辑用户" },
  createHint: {
    id: "Akun langsung bisa dipakai masuk begitu disimpan.",
    en: "The account can be used to sign in as soon as it is saved.",
    zh: "保存后即可使用该账号登录。",
  },
  editHint: {
    id: "Username tidak bisa diubah karena dipakai sebagai identitas login dan di jejak audit.",
    en: "The username cannot be changed because it is used as the sign-in identity and in the audit trail.",
    zh: "用户名不可修改，因为它用作登录标识并记录在审计记录中。",
  },
  usernameHint: {
    id: "Huruf kecil, angka, titik, garis, atau underscore. Minimal 3 karakter.",
    en: "Lowercase letters, digits, dots, hyphens or underscores. At least 3 characters.",
    zh: "小写字母、数字、点、连字符或下划线，至少 3 个字符。",
  },
  fullNamePlaceholder: {
    id: "Nama yang tampil di sidebar",
    en: "The name shown in the sidebar",
    zh: "显示在侧边栏的姓名",
  },
  emailOptional: { id: "Email (opsional)", en: "Email (optional)", zh: "邮箱（可选）" },
  emailPlaceholder: { id: "nama@mbma.co.id", en: "name@mbma.co.id", zh: "name@mbma.co.id" },
  emailHint: {
    id: "Kalau diisi, operator boleh memakainya untuk masuk selain username.",
    en: "If filled in, the operator may sign in with it as well as with the username.",
    zh: "填写后，操作员除用户名外也可用它登录。",
  },
  initialPassword: { id: "Password awal", en: "Initial password", zh: "初始密码" },
  passwordMinPlaceholder: {
    id: "Minimal {min} karakter",
    en: "At least {min} characters",
    zh: "至少 {min} 个字符",
  },
  repeatPassword: { id: "Ulangi password", en: "Repeat password", zh: "再次输入密码" },
  repeatPasswordPlaceholder: {
    id: "Ketik ulang password yang sama",
    en: "Type the same password again",
    zh: "再次输入相同的密码",
  },
  notSameAsAbove: {
    id: "Belum sama dengan kolom di atas.",
    en: "Does not match the field above yet.",
    zh: "与上方输入的不一致。",
  },
  plantHint: {
    id: "Mengunci akses capture, preview, dan device ke plant ini. Akun dengan pilihan Semua Plant tetap bisa lintas-plant, termasuk Super Admin.",
    en: "Locks capture, preview and device access to this plant. Accounts set to All Plants can still work across plants, including Super Admin.",
    zh: "将拍摄、预览和设备的访问权限限定在该工厂。选择“全部工厂”的账号仍可跨工厂使用，超级管理员也是如此。",
  },
  roleHint: {
    id: "Hanya {admin} yang bisa membuka halaman ini. {viewer} hanya bisa melihat Gallery.",
    en: "Only {admin} can open this page. {viewer} can only view the Gallery.",
    zh: "只有{admin}可以打开此页面。{viewer}只能查看图库。",
  },
  inactiveHint: {
    id: "Akun nonaktif ditolak saat login, tanpa dihapus.",
    en: "An inactive account is refused at sign-in without being deleted.",
    zh: "停用的账号在登录时会被拒绝，但不会被删除。",
  },
  createAccount: { id: "Buat akun", en: "Create account", zh: "创建账号" },
  saveChanges: { id: "Simpan perubahan", en: "Save changes", zh: "保存更改" },

  passwordChanged: {
    id: 'Password "{username}" diganti',
    en: 'Password for "{username}" changed',
    zh: "“{username}”的密码已更改",
  },
  passwordChangedHint: {
    id: "Beri tahu operatornya lewat jalur yang aman, bukan lewat grup chat.",
    en: "Tell the operator through a secure channel, not a group chat.",
    zh: "请通过安全渠道告知操作员，不要通过群聊。",
  },
  passwordSaveFailed: {
    id: "Password gagal disimpan.",
    en: "The password could not be saved.",
    zh: "密码保存失败。",
  },
  resetBody: {
    id: 'Password baru untuk "{username}". Password lama tidak bisa dibaca siapa pun, termasuk Super Admin — yang tersimpan cuma hash-nya.',
    en: 'New password for "{username}". The old password cannot be read by anyone, including Super Admin — only its hash is stored.',
    zh: "为“{username}”设置新密码。旧密码任何人都无法读取，包括超级管理员——系统只保存其哈希值。",
  },
  newPassword: { id: "Password baru", en: "New password", zh: "新密码" },
  repeatNewPassword: {
    id: "Ulangi password baru",
    en: "Repeat new password",
    zh: "再次输入新密码",
  },
  changePassword: { id: "Ganti password", en: "Change password", zh: "更改密码" },
});

// Meteran kekuatan password (src/lib/password-strength.ts).
export const passwordStrengthMessages = defineMessages({
  veryWeak: { id: "Sangat lemah", en: "Very weak", zh: "非常弱" },
  weak: { id: "Lemah", en: "Weak", zh: "弱" },
  fair: { id: "Cukup", en: "Fair", zh: "一般" },
  strong: { id: "Kuat", en: "Strong", zh: "强" },
  veryStrong: { id: "Sangat kuat", en: "Very strong", zh: "非常强" },

  hintFirstGuess: {
    id: "Password ini ada di daftar tebakan pertama. Ganti seluruhnya.",
    en: "This password is on the list of first guesses. Replace it entirely.",
    zh: "该密码属于最容易被猜到的密码，请全部更换。",
  },
  hintUsername: {
    id: "Jangan memakai username di dalam passwordnya.",
    en: "Do not use the username inside the password.",
    zh: "密码中不要包含用户名。",
  },
  hintOwnName: {
    id: "Jangan memakai nama sendiri di dalam passwordnya.",
    en: "Do not use the account holder's own name inside the password.",
    zh: "密码中不要包含本人姓名。",
  },
  hintLength: {
    id: "Tambah panjangnya. Panjang lebih menolong daripada menambah simbol.",
    en: "Make it longer. Length helps more than adding symbols.",
    zh: "请加长密码。长度比添加符号更有效。",
  },
  hintMix: {
    id: "Campur huruf dengan angka atau simbol.",
    en: "Mix letters with digits or symbols.",
    zh: "请混合使用字母与数字或符号。",
  },
  hintPattern: {
    id: "Ada urutan atau pengulangan yang mudah ditebak di dalamnya.",
    en: "It contains a sequence or repetition that is easy to guess.",
    zh: "其中包含容易被猜到的连续或重复字符。",
  },
});
