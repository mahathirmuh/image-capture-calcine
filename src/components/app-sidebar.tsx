import { Camera, Images, Network, Settings } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { loadGallery } from "@/lib/gallery-store";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";

const items = [
  { title: "Capture", url: "/capture", icon: Camera },
  { title: "Gallery", url: "/gallery", icon: Images },
  { title: "Devices", url: "/devices", icon: Network },
  { title: "Settings", url: "/settings", icon: Settings },
];

const DEVICE_STATUS_POLL_MS = 30_000;

function formatSyncTime(date: Date) {
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

function DeviceStatusCard() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const result = await getDeviceStatus().catch(
        (): DeviceStatus => ({
          online: false,
          deviceId: null,
          agentVersion: null,
          connectionState: null,
          capabilities: [],
          camera: null,
        }),
      );
      if (cancelled) return;
      setStatus(result);
      setLastSync(new Date());
    }
    tick();
    const interval = setInterval(tick, DEVICE_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const cameraConnected = !!status?.camera?.connected;
  const cameraLabel = status?.camera
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") || "Unknown model"
    : "Not detected";

  return (
    <div className="rounded-md border bg-sidebar-accent/40 p-3 text-xs group-data-[collapsible=icon]:hidden">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-sidebar-foreground">Device Status</span>
        <span
          className={`h-2 w-2 rounded-full ${status?.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          title={status?.online ? "Online" : "Offline"}
        />
      </div>
      <dl className="space-y-1 text-sidebar-foreground/70">
        <div className="flex items-center justify-between gap-2">
          <dt>Mini PC</dt>
          <dd
            className="truncate font-medium text-sidebar-foreground"
            title={status?.deviceId ?? undefined}
          >
            {status?.deviceId ?? "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Camera</dt>
          <dd className="truncate font-medium text-sidebar-foreground" title={cameraLabel}>
            {cameraLabel}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Connection</dt>
          <dd className="font-medium text-sidebar-foreground">{cameraConnected ? "USB" : "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Network</dt>
          <dd className="font-medium text-sidebar-foreground">
            {status?.online ? "Online" : "Offline"}
          </dd>
        </div>
      </dl>
      <div className="mt-2 border-t pt-2 text-[10px] text-sidebar-foreground/50">
        Last sync: {lastSync ? formatSyncTime(lastSync) : "—"}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });
  const [captureCount, setCaptureCount] = useState(0);

  useEffect(() => {
    loadGallery().then((items) => setCaptureCount(items.length));
  }, []);

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Capture App</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                const showBadge = item.title === "Gallery" && captureCount > 0;
                return (
                  <SidebarMenuItem key={item.title} className="relative">
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm"
                    >
                      <Link
                        to={item.url}
                        className="flex items-center gap-2"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpenMobile(false)}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
                          {item.title}
                        </span>
                        {showBadge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 shrink-0 px-1.5 text-[10px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:hidden"
                          >
                            {captureCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                    {showBadge && (
                      <span
                        className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[state=expanded]:scale-0 group-data-[state=expanded]:opacity-0 group-data-[state=collapsed]:scale-100 group-data-[state=collapsed]:opacity-100"
                        aria-hidden="true"
                      />
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DeviceStatusCard />
      </SidebarFooter>
    </Sidebar>
  );
}
