import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  Cpu,
  FileText,
  LayoutGrid,
  List,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Wifi,
} from "lucide-react";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { loadGallery } from "@/lib/gallery-store";
import { loadPrefs } from "@/lib/capture-prefs";

export const Route = createFileRoute("/devices/")({
  component: DevicesPage,
  head: () => ({
    meta: [
      { title: "Devices — Capture App" },
      { name: "description", content: "Manage and monitor Mini PCs and cameras." },
      { property: "og:title", content: "Devices — Capture App" },
      { property: "og:description", content: "Manage and monitor Mini PCs and cameras." },
    ],
  }),
});

// This app only ever talks to one edge device (CAMERA_API_URL) -- there is
// no device registry, so the "fleet" grid below always shows exactly one
// real card. Fields with no real data source (CPU/RAM/disk, temperature,
// uptime, camera QC scoring, activity logs, restart/sync actions) show an
// honest "Not available" instead of invented numbers.

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "camera-settings", label: "Camera Settings" },
  { id: "health", label: "Health & Status" },
  { id: "logs", label: "Logs" },
  { id: "configuration", label: "Configuration" },
  { id: "fallback", label: "Fallback" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function formatDateTime(date: Date) {
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

function NotAvailable() {
  return <span className="text-muted-foreground">Not available</span>;
}

function DevicesPage() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturesToday, setCapturesToday] = useState<number | null>(null);
  const [lastCaptureAt, setLastCaptureAt] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const result = await getDeviceStatus();
      setStatus(result);
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }

  // Guarded against a stale response clobbering a newer one -- without this,
  // React StrictMode's mount/cleanup/remount in dev fires this effect twice,
  // and whichever of the two overlapping requests resolves last "wins" even
  // if it was the earlier, now-irrelevant one.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDeviceStatus()
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        setLastSync(new Date());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    loadGallery().then((items) => {
      if (cancelled) return;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayCount = items.filter((item) => item.createdAt >= startOfToday.getTime()).length;
      setCapturesToday(todayCount);
      setLastCaptureAt(items.length > 0 ? Math.max(...items.map((item) => item.createdAt)) : null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const cameraConnected = !!status?.camera?.connected;
  const cameraLabel = status?.camera
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") || "Unknown model"
    : "Not detected";

  const matchesSearch =
    searchQuery.trim() === "" ||
    (status?.deviceId ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    cameraLabel.toLowerCase().includes(searchQuery.trim().toLowerCase());

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor all Mini PCs and cameras.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            className="rounded-md border border-input bg-background p-2 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/devices/register"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Register Device
          </Link>
        </div>
      </header>

      {/* Filter bar -- functional against the one real device we have */}
      <section className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search devices…"
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>Location: All</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>Status: All</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>Connection: All</option>
        </select>
        <div className="ml-auto flex overflow-hidden rounded-md border border-input">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 ${viewMode === "grid" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 ${viewMode === "list" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Device card(s) -- always exactly one, since there's no registry yet */}
      {matchesSearch ? (
        <div
          className={
            viewMode === "grid" ? "mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "mb-6 space-y-2"
          }
        >
          <div className="rounded-lg border-2 border-primary bg-card p-4">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Cpu className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-semibold">{status?.deviceId ?? "Unknown device"}</div>
                  <div className="text-xs text-muted-foreground">{cameraLabel}</div>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  status?.online
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${status?.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                />
                {status?.online ? "Online" : "Offline"}
              </span>
            </div>

            <div className="mb-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3 w-3" /> {cameraConnected ? "USB Connected" : "Not connected"}
              </div>
              <div>
                Last Capture:{" "}
                <span className="font-medium text-foreground">
                  {lastCaptureAt ? formatDateTime(new Date(lastCaptureAt)) : "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
              <div>
                <div className="text-muted-foreground">Uptime</div>
                <div className="font-semibold">—</div>
              </div>
              <div>
                <div className="text-muted-foreground">Capture Today</div>
                <div className="font-semibold">{capturesToday ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Health</div>
                <div className="font-semibold">—</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          No devices match "{searchQuery}".
        </div>
      )}

      {/* Detail panel for the (one) device */}
      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{status?.deviceId ?? "Unknown device"}</span>
          <span
            className={`ml-1 h-2 w-2 rounded-full ${status?.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
        </div>

        <div className="flex flex-wrap gap-1 border-b px-4 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {activeTab === "overview" && (
              <>
                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Package className="h-3.5 w-3.5" /> Device Information
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Device Name</dt>
                    <dd className="text-right font-medium">{status?.deviceId ?? "—"}</dd>
                    <dt className="text-muted-foreground">Hostname</dt>
                    <dd className="text-right font-medium">{status?.deviceId ?? "—"}</dd>
                    <dt className="text-muted-foreground">Agent Version</dt>
                    <dd className="text-right font-medium">{status?.agentVersion ?? "—"}</dd>
                    <dt className="text-muted-foreground">IP Address</dt>
                    <dd className="text-right font-medium">
                      <NotAvailable />
                    </dd>
                    <dt className="text-muted-foreground">OS</dt>
                    <dd className="text-right font-medium">
                      <NotAvailable />
                    </dd>
                  </dl>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Camera className="h-3.5 w-3.5" /> Camera Information
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Camera Model</dt>
                    <dd className="text-right font-medium">{cameraLabel}</dd>
                    <dt className="text-muted-foreground">Serial Number</dt>
                    <dd className="text-right font-medium">
                      {status?.camera?.serialNumber ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">Firmware Version</dt>
                    <dd className="text-right font-medium">
                      {status?.camera?.firmwareVersion ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">Battery / Power</dt>
                    <dd className="text-right font-medium">
                      <NotAvailable />
                    </dd>
                    <dt className="text-muted-foreground">USB Connection</dt>
                    <dd className="text-right font-medium">
                      {cameraConnected ? "Connected" : "Not connected"}
                    </dd>
                  </dl>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Wifi className="h-3.5 w-3.5" /> Connection Status
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Edge API</dt>
                    <dd
                      className={`text-right font-medium ${status?.online ? "text-emerald-600" : ""}`}
                    >
                      {status?.online ? "Reachable" : "Unreachable"}
                    </dd>
                    <dt className="text-muted-foreground">Camera (USB)</dt>
                    <dd
                      className={`text-right font-medium ${cameraConnected ? "text-emerald-600" : ""}`}
                    >
                      {cameraConnected ? "Connected" : "Not connected"}
                    </dd>
                  </dl>
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="mt-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {loading ? "Testing…" : "Test Connection"}
                  </button>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Settings2 className="h-3.5 w-3.5" /> Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Restart Camera",
                      "Restart API Service",
                      "Restart Mini PC",
                      "Sync Settings",
                    ].map((action) => (
                      <button
                        key={action}
                        disabled
                        title="Not available yet"
                        className="rounded-md border border-input bg-muted px-2 py-1.5 text-xs opacity-50"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Remote device actions aren't implemented yet.
                  </p>
                </div>
              </>
            )}

            {activeTab === "camera-settings" && (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Remote camera settings (ISO, shutter, aperture) editing isn't available yet.
              </div>
            )}

            {activeTab === "health" && (
              <div className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Activity className="h-3.5 w-3.5" /> Device Health
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">CPU Usage</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                  <dt className="text-muted-foreground">RAM Usage</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                  <dt className="text-muted-foreground">Disk Usage</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                  <dt className="text-muted-foreground">Temperature</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  System telemetry requires an agent running on the Mini PC that this app doesn't
                  have yet.
                </p>
              </div>
            )}

            {activeTab === "logs" && (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 h-5 w-5" />
                No activity logs available yet.
              </div>
            )}

            {activeTab === "configuration" && <ConfigurationTab />}

            {activeTab === "fallback" && (
              <div className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <RotateCcw className="h-3.5 w-3.5" /> Fallback Connection
                </h3>
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Primary: USB — no fallback method configured.
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Fallback connections (EOS Utility, Bluetooth, Wi-Fi) aren't supported yet — this
                  app only talks to the camera over USB via gphoto2.
                </p>
              </div>
            )}
          </div>

          {/* Right column: only ever honest placeholders -- there's no
              telemetry agent or QC scoring pipeline behind these yet. */}
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Device Health</h3>
              <div className="space-y-1.5 text-xs">
                {["CPU", "RAM", "Disk", "Temperature"].map((label) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <NotAvailable />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                Camera Health (QC)
              </h3>
              <div className="space-y-1.5 text-xs">
                {["Lens Condition", "Lighting", "Exposure", "Focus", "Image Quality"].map(
                  (label) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <NotAvailable />
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Recent Logs</h3>
              <p className="text-xs text-muted-foreground">No recent activity recorded.</p>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Last sync: {lastSync ? formatDateTime(lastSync) : "—"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ConfigurationTab() {
  const [prefs, setPrefs] = useState<ReturnType<typeof loadPrefs> | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  return (
    <div className="rounded-md border p-4">
      <h3 className="mb-3 text-sm font-semibold">Configuration Summary</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Filename Format</dt>
        <dd className="text-right font-mono font-medium">{prefs?.pattern ?? "—"}</dd>
        <dt className="text-muted-foreground">File Format</dt>
        <dd className="text-right font-medium">{prefs?.ext?.toUpperCase() ?? "—"}</dd>
        <dt className="text-muted-foreground">Image Index</dt>
        <dd className="text-right font-medium">
          {prefs ? String(prefs.counter).padStart(3, "0") : "—"}
        </dd>
        <dt className="text-muted-foreground">Save Directory</dt>
        <dd className="text-right font-medium">
          <NotAvailable />
        </dd>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Save directory isn't readable here — browsers don't expose picked folder handles outside the
        page that picked them.
      </p>
      <Link
        to="/capture"
        className="mt-3 inline-block rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Edit on Capture page
      </Link>
    </div>
  );
}
