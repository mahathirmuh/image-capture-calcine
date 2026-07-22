import { Camera } from "lucide-react";
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { loadGallery } from "@/lib/gallery-store";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { NAV_ITEMS } from "@/lib/nav-items";

const items = NAV_ITEMS;

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
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") ||
      "Model tidak diketahui"
    : "Belum terdeteksi";

  return (
    <div className="rounded-md border bg-sidebar-accent/40 p-3 text-xs group-data-[collapsible=icon]:hidden">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-sidebar-foreground">Status Device</span>
        <span
          className={`h-2 w-2 rounded-full ${status?.online ? "bg-emerald-500" : "bg-sidebar-foreground/30"}`}
          title={status?.online ? "Terhubung" : "Offline"}
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
          <dt>Kamera</dt>
          <dd className="truncate font-medium text-sidebar-foreground" title={cameraLabel}>
            {cameraLabel}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Koneksi</dt>
          <dd className="font-medium text-sidebar-foreground">{cameraConnected ? "USB" : "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Jaringan</dt>
          <dd className="font-medium text-sidebar-foreground">
            {status?.online ? "Terhubung" : "Offline"}
          </dd>
        </div>
      </dl>
      <div className="mt-2 border-t pt-2 text-[10px] text-sidebar-foreground/50">
        Sinkron terakhir: {lastSync ? formatSyncTime(lastSync) : "—"}
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
      <SidebarHeader className="gap-0 border-b border-sidebar-border px-3 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Camera className="h-4 w-4" />
          </span>
          <div className="flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
              Capture App
            </span>
            <span className="truncate text-[11px] leading-tight text-sidebar-foreground/50">
              Operasional Calcine
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Navigasi
          </SidebarGroupLabel>
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
                      tooltip={item.title}
                      className="text-sidebar-foreground hover:text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm"
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
                          <Badge className="ml-auto h-5 shrink-0 border-transparent bg-sidebar-primary px-1.5 text-[10px] text-sidebar-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:hidden">
                            {captureCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                    {showBadge && (
                      <span
                        className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sidebar-primary transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[state=expanded]:scale-0 group-data-[state=expanded]:opacity-0 group-data-[state=collapsed]:scale-100 group-data-[state=collapsed]:opacity-100"
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
      <SidebarFooter className="border-t border-sidebar-border">
        <DeviceStatusCard />
      </SidebarFooter>
    </Sidebar>
  );
}
