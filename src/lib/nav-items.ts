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

// Urutan grup di sidebar. Dipisah dari daftar item supaya urutannya tidak
// bergantung pada urutan item -- menambah item baru di grup mana pun tidak
// menggeser posisi grupnya.
export const NAV_GROUPS = ["Operasional", "Infrastruktur", "Pengaturan"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

// `adminOnly` menyembunyikan entri dari sidebar untuk non-admin. Itu semata
// kerapian tampilan -- penjaga yang sebenarnya ada di beforeLoad rute dan di
// setiap serverFn-nya, karena menyembunyikan tautan tidak menghalangi siapa pun
// mengetik URL-nya langsung.
export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  group: NavGroup;
  adminOnly?: boolean;
};

// Single source of truth for the app's top-level sections, shared by the
// sidebar nav and the topbar breadcrumb so they can never drift apart.
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "Operasional" },
  { title: "Capture", url: "/capture", icon: Camera, group: "Operasional" },
  { title: "Gallery", url: "/gallery", icon: Images, group: "Operasional" },
  { title: "Devices", url: "/devices", icon: Network, group: "Infrastruktur", adminOnly: true },
  { title: "Storage", url: "/storage", icon: HardDrive, group: "Infrastruktur", adminOnly: true },
  { title: "Users", url: "/users", icon: UsersRound, group: "Pengaturan", adminOnly: true },
  { title: "Log", url: "/log", icon: ScrollText, group: "Pengaturan", adminOnly: true },
  { title: "Settings", url: "/settings", icon: Settings, group: "Pengaturan", adminOnly: true },
];

// Titles for routes nested under a NAV_ITEMS url that need their own
// breadcrumb crumb (e.g. /devices/register under /devices).
export const SUB_PAGE_TITLES: Record<string, string> = {
  "/devices/register": "Daftarkan Device",
};

/**
 * Apakah sebuah path hanya boleh dibuka Super Admin.
 *
 * Diturunkan dari NAV_ITEMS, bukan daftar terpisah: menandai sebuah menu
 * adminOnly langsung membuat setiap tautan menujunya ikut disembunyikan, tanpa
 * ada daftar kedua yang bisa lupa diperbarui.
 */
export function isAdminOnlyPath(pathname: string): boolean {
  return findNavItem(pathname)?.adminOnly === true;
}

/** Entri NAV_ITEMS yang memuat sebuah path, termasuk sub-halamannya. */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.url || pathname.startsWith(`${item.url}/`));
}
