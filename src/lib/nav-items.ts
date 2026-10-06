import {
  Camera,
  HardDrive,
  Images,
  LayoutDashboard,
  Network,
  ScrollText,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { commonMessages as c } from "@/i18n/common";
import type { Message } from "@/lib/i18n";

// Urutan grup di sidebar. Dipisah dari daftar item supaya urutannya tidak
// bergantung pada urutan item -- menambah item baru di grup mana pun tidak
// menggeser posisi grupnya.
export const NAV_GROUPS = ["Operasional", "Infrastruktur", "Pengaturan"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

// Nama grup di atas adalah KUNCI, bukan teks tampilan; yang dibaca orang ada di sini.
export const NAV_GROUP_LABELS: Record<NavGroup, Message> = {
  Operasional: c.groupOperations,
  Infrastruktur: c.groupInfrastructure,
  Pengaturan: c.groupAdministration,
};

// `adminOnly` menyembunyikan entri dari sidebar untuk non-admin. Itu semata
// kerapian tampilan -- penjaga yang sebenarnya ada di beforeLoad rute dan di
// setiap serverFn-nya, karena menyembunyikan tautan tidak menghalangi siapa pun
// mengetik URL-nya langsung.
export type NavItem = {
  // Pengenal tetap (dipakai sebagai key dan pembanding); teks tampilan ada di `label`.
  title: string;
  label: Message;
  url: string;
  icon: LucideIcon;
  group: NavGroup;
  adminOnly?: boolean;
};

// Single source of truth for the app's top-level sections, shared by the
// sidebar nav and the topbar breadcrumb so they can never drift apart.
export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    label: c.navDashboard,
    url: "/dashboard",
    icon: LayoutDashboard,
    group: "Operasional",
  },
  { title: "Capture", label: c.navCapture, url: "/capture", icon: Camera, group: "Operasional" },
  { title: "Gallery", label: c.navGallery, url: "/gallery", icon: Images, group: "Operasional" },
  {
    title: "Devices",
    label: c.navDevices,
    url: "/devices",
    icon: Network,
    group: "Infrastruktur",
    adminOnly: true,
  },
  {
    title: "Storage",
    label: c.navStorage,
    url: "/storage",
    icon: HardDrive,
    group: "Infrastruktur",
    adminOnly: true,
  },
  {
    title: "Users",
    label: c.navUsers,
    url: "/users",
    icon: UsersRound,
    group: "Pengaturan",
    adminOnly: true,
  },
  {
    title: "Log",
    label: c.navLog,
    url: "/log",
    icon: ScrollText,
    group: "Pengaturan",
    adminOnly: true,
  },
  {
    title: "Settings",
    label: c.navSettings,
    url: "/settings",
    icon: Settings,
    group: "Pengaturan",
    adminOnly: true,
  },
];

// Titles for routes nested under a NAV_ITEMS url that need their own
// breadcrumb crumb (e.g. /devices/register under /devices).
export const SUB_PAGE_LABELS: Record<string, Message> = {
  "/devices/register": c.navRegisterDevice,
};

/**
 * Apakah sebuah path hanya boleh dibuka Super Admin.
 *
 * Diturunkan dari NAV_ITEMS, bukan daftar terpisah: menandai sebuah menu
 * adminOnly langsung membuat setiap tautan menujunya ikut disembunyikan, tanpa
 * ada daftar kedua yang bisa lupa diperbarui.
 */
/**
 * Satu-satunya halaman yang boleh dibuka peran Viewer. Dipakai sidebar dan
 * gerbang di __root.tsx, supaya keduanya tidak pernah berbeda.
 */
export const VIEWER_HOME = "/gallery";

/** Apakah peran ini boleh membuka path tersebut. */
export function canRoleOpenPath(role: string | null | undefined, pathname: string): boolean {
  if (role === "viewer") return pathname === VIEWER_HOME || pathname.startsWith(`${VIEWER_HOME}/`);
  if (role === "admin") return true;
  return !isAdminOnlyPath(pathname);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return findNavItem(pathname)?.adminOnly === true;
}

/** Entri NAV_ITEMS yang memuat sebuah path, termasuk sub-halamannya. */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.url || pathname.startsWith(`${item.url}/`));
}
