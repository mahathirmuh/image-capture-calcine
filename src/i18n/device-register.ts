import { defineMessages } from "@/lib/i18n";

// Halaman Daftarkan / Edit Device (src/routes/devices/register.tsx).
export const deviceRegisterMessages = defineMessages({
  // Panel "cara kerja" di sisi kanan.
  howStepInstallTitle: {
    id: "Install Capture Agent",
    en: "Install Capture Agent",
    zh: "安装 Capture Agent",
  },
  howStepInstallBody: {
    id: "Pasang Capture Agent di Mini PC lalu hubungkan kameranya.",
    en: "Install Capture Agent on the Mini PC, then connect its camera.",
    zh: "在迷你电脑上安装 Capture Agent，然后连接相机。",
  },
  howStepAddressTitle: {
    id: "Isi Alamat Edge API",
    en: "Enter the Edge API address",
    zh: "填写 Edge API 地址",
  },
  howStepAddressBody: {
    id: "Masukkan alamat Camera API. Device Code akan terisi otomatis.",
    en: "Enter the Camera API address. The Device Code is filled in automatically.",
    zh: "输入 Camera API 地址，设备代码会自动填入。",
  },
  howStepRegisterTitle: {
    id: "Daftarkan di Web UI",
    en: "Register in the Web UI",
    zh: "在 Web UI 中登记",
  },
  howStepRegisterBody: {
    id: "Periksa hasil deteksi, tentukan nama dan lokasi, lalu simpan device.",
    en: "Check the detection result, set the name and location, then save the device.",
    zh: "检查检测结果，设置名称和位置，然后保存设备。",
  },
  howStepSyncTitle: { id: "Sinkron & Siap", en: "Synced & Ready", zh: "同步并就绪" },
  howStepSyncBody: {
    id: "Device akan menyelaraskan konfigurasi dari server lalu siap dipakai capture.",
    en: "The device syncs its configuration from the server and is then ready for capture.",
    zh: "设备会从服务器同步配置，之后即可用于拍摄。",
  },

  configuredTemplate: {
    id: "Template profil kamera dan default exposure manual",
    en: "Camera profile template and manual exposure defaults",
    zh: "相机档案模板和手动曝光默认值",
  },
  configuredMetadata: {
    id: "Metadata plant, source bin, dan station",
    en: "Plant, source bin and station metadata",
    zh: "工厂、来源 Bin 和工位信息",
  },
  configuredSchedule: { id: "Jadwal capture", en: "Capture schedule", zh: "拍摄排程" },
  configuredTimezone: {
    id: "Timezone dan catatan operator",
    en: "Timezone and operator notes",
    zh: "时区和操作员备注",
  },
  configuredSyncPayload: {
    id: "Payload sinkronisasi untuk rollout edge-agent berikutnya",
    en: "Sync payload for the next edge-agent rollout",
    zh: "用于下一次 edge-agent 发布的同步数据",
  },

  // Memuat device yang sedang diedit.
  loadFailed: {
    id: "Gagal memuat device.",
    en: "Could not load the device.",
    zh: "加载设备失败。",
  },
  loadingDevice: {
    id: "Memuat data device...",
    en: "Loading device data...",
    zh: "正在加载设备数据…",
  },
  backToDevices: { id: "Kembali ke Devices", en: "Back to Devices", zh: "返回设备" },

  // Uji koneksi ke Edge API.
  probeNoIdentity: {
    id: "API tidak mengirim identitas device yang valid.",
    en: "The API did not send a valid device identity.",
    zh: "API 未返回有效的设备标识。",
  },
  probeIdentityMismatch: {
    id: "Identitas API berbeda dari device ini. Periksa alamatnya.",
    en: "The API identity differs from this device. Check the address.",
    zh: "API 标识与此设备不符，请检查地址。",
  },
  probeFailed: {
    id: "Uji koneksi gagal.",
    en: "The connection test failed.",
    zh: "连接测试失败。",
  },

  // Toast hasil simpan.
  registerFailed: {
    id: "Gagal mendaftarkan device",
    en: "Could not register the device",
    zh: "登记设备失败",
  },
  deviceUpdated: {
    id: "Device berhasil diperbarui",
    en: "Device updated successfully",
    zh: "设备更新成功",
  },
  deviceRegistered: {
    id: "Device berhasil didaftarkan",
    en: "Device registered successfully",
    zh: "设备登记成功",
  },
  registrySynced: {
    id: "Registry MSSQL dan profil lokal sudah sinkron.",
    en: "The MSSQL registry and the local profile are in sync.",
    zh: "MSSQL 登记表与本地档案已同步。",
  },
  saveFailed: {
    id: "Gagal menyimpan device",
    en: "Could not save the device",
    zh: "保存设备失败",
  },
  tryAgainHint: { id: "Coba lagi.", en: "Try again.", zh: "请重试。" },
  presetChanged: {
    id: 'Preset aktif diubah ke "{label}"',
    en: 'Active preset changed to "{label}"',
    zh: "当前预设已改为“{label}”",
  },
  presetChangedDetail: {
    id: "Camera defaults telah mengikuti template terpilih.",
    en: "The camera defaults now follow the selected template.",
    zh: "相机默认值已跟随所选模板。",
  },

  // Kepala halaman.
  editDevice: { id: "Edit Device", en: "Edit Device", zh: "编辑设备" },
  registerDevice: { id: "Daftarkan Device", en: "Register Device", zh: "登记设备" },
  registerNewDevice: {
    id: "Daftarkan Device Baru",
    en: "Register New Device",
    zh: "登记新设备",
  },
  pageDescription: {
    id: "Kelola identitas, alamat Edge API, dan profil device. Pengaturan kamera diterapkan melalui halaman Devices.",
    en: "Manage the device identity, Edge API address and profile. Camera settings are applied from the Devices page.",
    zh: "管理设备的标识、Edge API 地址和档案。相机设置通过“设备”页面应用。",
  },
  howItWorks: { id: "Cara kerjanya", en: "How it works", zh: "工作原理" },
  cancel: { id: "Batal", en: "Cancel", zh: "取消" },

  // Penanda langkah dan judul bagian.
  stepIdentify: { id: "Identifikasi Device", en: "Device Identification", zh: "设备识别" },
  stepLocation: { id: "Lokasi & Sumber", en: "Location & Source", zh: "位置与来源" },
  stepConfig: { id: "Konfigurasi", en: "Configuration", zh: "配置" },
  stepReview: { id: "Tinjau & Selesai", en: "Review & Finish", zh: "确认并完成" },

  savedBanner: {
    id: "Device sudah tersimpan ke registry MSSQL dan profil aktif lokal sudah diperbarui.",
    en: "The device has been saved to the MSSQL registry and the local active profile has been updated.",
    zh: "设备已保存到 MSSQL 登记表，本地当前档案也已更新。",
  },

  // Langkah 1.
  identifyHint: {
    id: "Isi Alamat Edge API di bagian Lokasi & Sumber. Identitas device akan dideteksi otomatis.",
    en: "Enter the Edge API address in the Location & Source section. The device identity is detected automatically.",
    zh: "请在“位置与来源”部分填写 Edge API 地址，设备标识会自动检测。",
  },
  deviceCode: { id: "Device Code", en: "Device Code", zh: "设备代码" },
  deviceCodePlaceholder: {
    id: "Otomatis dari Alamat Edge API",
    en: "Automatic from the Edge API address",
    zh: "根据 Edge API 地址自动填入",
  },
  deviceCodeHint: {
    id: "Kode diambil otomatis dari Camera API dan tidak perlu diketik.",
    en: "The code is read automatically from the Camera API and does not need to be typed.",
    zh: "代码从 Camera API 自动读取，无需手动输入。",
  },
  deviceName: { id: "Nama Device", en: "Device Name", zh: "设备名称" },
  deviceNamePlaceholder: {
    id: "e.g. MINIPC-004",
    en: "e.g. MINIPC-004",
    zh: "例如 MINIPC-004",
  },
  deviceNameHint: {
    id: "Gunakan nama unik agar device ini mudah dikenali operator.",
    en: "Use a unique name so that operators can easily recognise this device.",
    zh: "请使用唯一的名称，方便操作员识别此设备。",
  },
  identityVerified: {
    id: "Identitas Device Terverifikasi",
    en: "Device Identity Verified",
    zh: "设备标识已验证",
  },
  identityVerifiedDetail: {
    id: "Identitas device sudah dibaca dari Camera API.",
    en: "The device identity has been read from the Camera API.",
    zh: "已从 Camera API 读取设备标识。",
  },
  identityPending: {
    id: "Isi Alamat Edge API untuk mendeteksi device.",
    en: "Enter the Edge API address to detect the device.",
    zh: "填写 Edge API 地址以检测设备。",
  },

  // Langkah 2.
  locationHint: {
    id: "Tentukan lokasi plant dan sumber bin untuk device sampling ini.",
    en: "Set the plant location and source bin for this sampling device.",
    zh: "为此取样设备设置工厂位置和来源 Bin。",
  },
  plantLocation: { id: "Plant / Lokasi", en: "Plant / Location", zh: "工厂 / 位置" },
  edgeApiAddress: { id: "Alamat Edge API", en: "Edge API Address", zh: "Edge API 地址" },
  testConnection: { id: "Uji koneksi", en: "Test connection", zh: "测试连接" },
  edgeApiAddressHint: {
    id: "Alamat service kamera pada Mini PC ini, lengkap dengan portnya. Tiap device boleh memakai port berbeda. Device Code dibaca otomatis setelah Anda selesai mengisi alamat.",
    en: "The address of the camera service on this Mini PC, including its port. Each device may use a different port. The Device Code is read automatically once you finish entering the address.",
    zh: "此迷你电脑上相机服务的地址，需包含端口。每台设备可以使用不同的端口。填写完地址后会自动读取设备代码。",
  },
  sourceBin: { id: "Sumber (Bin)", en: "Source (Bin)", zh: "来源（Bin）" },
  stationAreaOptional: {
    id: "Station / Area (Opsional)",
    en: "Station / Area (Optional)",
    zh: "工位 / 区域（可选）",
  },
  descriptionOptional: {
    id: "Deskripsi (Opsional)",
    en: "Description (Optional)",
    zh: "描述（可选）",
  },
  descriptionPlaceholder: {
    id: "Calcine sampling station - {plant}",
    en: "Calcine sampling station - {plant}",
    zh: "焙砂取样工位 - {plant}",
  },

  // Langkah 3.
  configTitle: {
    id: "Konfigurasi & Profil Kamera",
    en: "Configuration & Camera Profile",
    zh: "配置与相机档案",
  },
  configHint: {
    id: "Pilih template, lalu rapikan default kamera yang akan menjadi bagian dari profil device ini.",
    en: "Choose a template, then adjust the camera defaults that will be part of this device profile.",
    zh: "选择模板，然后调整将作为此设备档案一部分的相机默认值。",
  },
  configTemplate: {
    id: "Template Konfigurasi",
    en: "Configuration Template",
    zh: "配置模板",
  },
  captureSchedule: { id: "Jadwal Capture", en: "Capture Schedule", zh: "拍摄排程" },
  timezone: { id: "Timezone", en: "Timezone", zh: "时区" },
  cameraDefaults: { id: "Default Kamera", en: "Camera Defaults", zh: "相机默认值" },
  cameraDefaultsHint: {
    id: "Pengaturan ini disimpan sebagai baseline profil device. Proses apply atau sync ke hardware tetap mengikuti alur edge API pada halaman Devices.",
    en: "These settings are saved as the baseline of the device profile. Applying or syncing them to the hardware still follows the edge API flow on the Devices page.",
    zh: "这些设置将保存为设备档案的基准。应用或同步到硬件仍按“设备”页面的 Edge API 流程进行。",
  },
  resetFromTemplate: {
    id: "Reset dari template",
    en: "Reset from template",
    zh: "按模板重置",
  },
  presetFilter: { id: "Filter Preset", en: "Preset Filter", zh: "预设筛选" },
  presetFilterHint: {
    id: "Saring preset explorer berdasarkan skenario sebelum memilih template.",
    en: "Filter the preset explorer by scenario before choosing a template.",
    zh: "选择模板前，可按场景筛选预设。",
  },
  shutterSpeed: { id: "Shutter Speed", en: "Shutter Speed", zh: "快门速度" },
  aperture: { id: "Aperture", en: "Aperture", zh: "光圈" },
  whiteBalance: { id: "White Balance", en: "White Balance", zh: "白平衡" },
  pictureStyle: { id: "Picture Style", en: "Picture Style", zh: "照片风格" },
  focusMode: { id: "Focus Mode", en: "Focus Mode", zh: "对焦模式" },
  presetComparison: {
    id: "Perbandingan Preset",
    en: "Preset Comparison",
    zh: "预设对比",
  },
  configNote: {
    id: "Tahap ini menyimpan profil device ke registry MSSQL dan profil lokal operator agar `/devices` bisa menjadi pusat kontrol default kamera. Mengirim nilai tersebut ke kamera fisik tetap mengikuti endpoint edge API.",
    en: "This step saves the device profile to the MSSQL registry and the operator's local profile so that `/devices` can be the control centre for camera defaults. Sending those values to the physical camera still goes through the edge API endpoint.",
    zh: "此步骤将设备档案保存到 MSSQL 登记表和操作员的本地档案，使 `/devices` 成为相机默认值的控制中心。将这些值发送到实体相机仍通过 Edge API 端点进行。",
  },

  // Langkah 4.
  reviewHint: {
    id: "Konfirmasi detail konfigurasi sebelum disimpan.",
    en: "Confirm the configuration details before saving.",
    zh: "保存前请确认配置详情。",
  },
  stationArea: { id: "Station / Area", en: "Station / Area", zh: "工位 / 区域" },
  template: { id: "Template", en: "Template", zh: "模板" },
  schedule: { id: "Jadwal", en: "Schedule", zh: "排程" },
  shutter: { id: "Shutter", en: "Shutter", zh: "快门" },

  // Tombol bawah.
  next: { id: "Lanjut", en: "Next", zh: "下一步" },
  alreadySaved: { id: "Sudah tersimpan", en: "Saved", zh: "已保存" },
  registering: { id: "Mendaftarkan...", en: "Registering...", zh: "正在登记…" },
  saveChanges: { id: "Simpan Perubahan", en: "Save Changes", zh: "保存更改" },

  // Panel kanan.
  howToRegister: {
    id: "Cara Mendaftarkan Device",
    en: "How to Register a Device",
    zh: "如何登记设备",
  },
  whatGetsConfigured: {
    id: "Apa saja yang akan dikonfigurasi?",
    en: "What will be configured?",
    zh: "将配置哪些内容？",
  },
  editableLater: {
    id: "Semua pengaturan masih bisa diedit lagi setelah pendaftaran dari halaman detail device.",
    en: "All settings can still be edited after registration from the device detail page.",
    zh: "登记后仍可在设备详情页修改所有设置。",
  },
});
