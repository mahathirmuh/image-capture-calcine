import {
  Camera,
  HardDrive,
  Images,
  LayoutDashboard,
  Network,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for the app's top-level sections, shared by the
// sidebar nav and the topbar breadcrumb so they can never drift apart.
// `adminOnly` menyembunyikan entri dari sidebar untuk non-admin. Itu semata
// kerapian tampilan -- penjaga yang sebenarnya ada di beforeLoad rute dan di
// setiap serverFn-nya, karena menyembunyikan tautan tidak menghalangi siapa pun
// mengetik URL-nya langsung.
export type NavItem = { title: string; url: string; icon: LucideIcon; adminOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Capture", url: "/capture", icon: Camera },
  { title: "Gallery", url: "/gallery", icon: Images },
  { title: "Devices", url: "/devices", icon: Network },
  { title: "Storage", url: "/storage", icon: HardDrive },
  { title: "Users", url: "/users", icon: UsersRound, adminOnly: true },
  { title: "Settings", url: "/settings", icon: Settings },
];

// Titles for routes nested under a NAV_ITEMS url that need their own
// breadcrumb crumb (e.g. /devices/register under /devices).
export const SUB_PAGE_TITLES: Record<string, string> = {
  "/devices/register": "Daftarkan Device",
};
