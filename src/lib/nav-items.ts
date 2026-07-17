import { Camera, Images, LayoutDashboard, Network, Settings, type LucideIcon } from "lucide-react";

// Single source of truth for the app's top-level sections, shared by the
// sidebar nav and the topbar breadcrumb so they can never drift apart.
export type NavItem = { title: string; url: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Capture", url: "/capture", icon: Camera },
  { title: "Gallery", url: "/gallery", icon: Images },
  { title: "Devices", url: "/devices", icon: Network },
  { title: "Settings", url: "/settings", icon: Settings },
];

// Titles for routes nested under a NAV_ITEMS url that need their own
// breadcrumb crumb (e.g. /devices/register under /devices).
export const SUB_PAGE_TITLES: Record<string, string> = {
  "/devices/register": "Register Device",
};
