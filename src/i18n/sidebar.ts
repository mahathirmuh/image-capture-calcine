import { defineMessages } from "@/lib/i18n";

// Kartu "Status Device" di kaki sidebar. Label navigasi dan nama grup ada di
// common.ts; yang di sini hanya milik kartu itu.
export const sidebarMessages = defineMessages({
  title: { id: "Status Device", en: "Device Status", zh: "设备状态" },
  connected: { id: "Terhubung", en: "Connected", zh: "已连接" },
  offline: { id: "Offline", en: "Offline", zh: "离线" },
  notConnected: { id: "Tidak terhubung", en: "Not connected", zh: "未连接" },

  device: { id: "Device", en: "Device", zh: "设备" },
  address: { id: "Alamat", en: "Address", zh: "地址" },
  plant: { id: "Plant", en: "Plant", zh: "工厂" },
  camera: { id: "Kamera", en: "Camera", zh: "相机" },
  network: { id: "Jaringan", en: "Network", zh: "网络" },

  modelUnknown: { id: "Model tidak diketahui", en: "Unknown model", zh: "型号未知" },
  notDetected: { id: "Belum terdeteksi", en: "Not detected yet", zh: "尚未检测到" },

  statusUnreadable: {
    id: "Status edge kamera belum bisa dibaca dari sidebar.",
    en: "The edge camera status could not be read from the sidebar.",
    zh: "侧边栏暂时无法读取边缘相机状态。",
  },
  edgeActive: {
    id: "Edge device aktif. Status kamera dan jaringan terus disegarkan otomatis.",
    en: "The edge device is active. Camera and network status refresh automatically.",
    zh: "边缘设备运行中。相机和网络状态会自动刷新。",
  },
  edgeNotConnected: {
    id: "Edge camera service belum terhubung. Periksa Mini PC, LAN, atau service edge API.",
    en: "The edge camera service is not connected. Check the Mini PC, the LAN or the Edge API service.",
    zh: "边缘相机服务尚未连接。请检查迷你电脑、局域网或 Edge API 服务。",
  },
  mismatch: {
    id: "Registry menyebut device ini {expected}, tetapi yang menjawab di alamat itu memperkenalkan diri sebagai {actual}. Alamatnya kemungkinan menunjuk ke mesin yang salah.",
    en: "The registry calls this device {expected}, but the machine answering at that address identifies itself as {actual}. The address probably points to the wrong machine.",
    zh: "登记表中此设备为 {expected}，但在该地址应答的机器自称 {actual}。该地址可能指向了错误的机器。",
  },
  lastSync: { id: "Sinkron terakhir: {time}", en: "Last sync: {time}", zh: "上次同步：{time}" },
});
