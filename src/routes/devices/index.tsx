import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Cpu,
  Download,
  FileText,
  LayoutGrid,
  List,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PresetCompareTable,
  PresetExplorerGrid,
  PresetFilterBar,
  PresetTemplatePreview,
} from "@/components/preset-ui";
import {
  getDeviceStatus,
  listCameraConfigs,
  upsertAndApplyEdgePreset,
  type CameraConfig,
  type DeviceStatus,
} from "@/lib/camera-api";
import { loadGallery } from "@/lib/gallery-store";
import { loadPrefs } from "@/lib/capture-prefs";
import {
  APERTURE_OPTIONS,
  APPLY_HISTORY_SAVED_VIEW_OPTIONS,
  DEVICE_SCHEDULES,
  DEVICE_TEMPLATES,
  FOCUS_MODE_OPTIONS,
  ISO_OPTIONS,
  PRESET_FILTERS,
  PICTURE_STYLE_OPTIONS,
  SHUTTER_OPTIONS,
  WHITE_BALANCE_OPTIONS,
  createProfileFromInput,
  appendApplyHistory,
  clearApplyHistory,
  filterTemplatesByTag,
  getTemplateById,
  getTemplateCameraSettings,
  loadApplyHistory,
  loadApplyHistorySavedViewPreference,
  loadDeviceProfile,
  loadPresetFilterPreference,
  saveDeviceProfile,
  saveApplyHistorySavedViewPreference,
  savePresetFilterPreference,
  type ApplyHistoryEntry,
  type ApplyHistorySavedViewPreference,
  type CameraSettings,
  type DeviceProfile,
  type PresetFilter,
} from "@/lib/device-config";
import {
  buildDeviceProfileFromRegisteredDevice,
  listRegisteredDevices,
  toUpsertRegisteredDeviceInput,
  upsertRegisteredDeviceProfile,
  type RegisteredDevice,
} from "@/lib/device-registry";
import { listDeviceEvents, type DeviceEventView } from "@/lib/capture-records";

export const Route = createFileRoute("/devices/")({
  component: DevicesPage,
  head: () => ({
    meta: [
      { title: "Devices — Capture App" },
      { name: "description", content: "Kelola dan pantau Mini PC serta kamera operasional." },
      { property: "og:title", content: "Devices — Capture App" },
      {
        property: "og:description",
        content: "Kelola dan pantau Mini PC serta kamera operasional.",
      },
    ],
  }),
});

// This app only ever talks to one edge device (CAMERA_API_URL) -- there is
// no device registry, so the "fleet" grid below always shows exactly one
// real card. Fields with no real data source (CPU/RAM/disk, temperature,
// uptime, camera QC scoring, activity logs, restart/sync actions) show an
// honest "Belum tersedia" instead of invented numbers.

const TABS = [
  { id: "overview", label: "Ringkasan" },
  { id: "camera-settings", label: "Pengaturan Kamera" },
  { id: "health", label: "Kesehatan & Status" },
  { id: "logs", label: "Log" },
  { id: "configuration", label: "Konfigurasi" },
  { id: "fallback", label: "Koneksi Cadangan" },
] as const;
type TabId = (typeof TABS)[number]["id"];
type ApplyHistoryFilter = "All" | "Applied" | "Failed";
type ApplyHistorySort = "Newest" | "Oldest" | "Applied first" | "Failed first";
type ApplyHistoryQuickFilter = "Any" | "Has code" | "Has skipped keys" | "Has edge profile";
type ApplyHistorySavedViewId = ApplyHistorySavedViewPreference;

type ApplyHistorySavedView = {
  id: ApplyHistorySavedViewId;
  label: string;
  description: string;
  filter: ApplyHistoryFilter;
  quickFilter: ApplyHistoryQuickFilter;
  sort: ApplyHistorySort;
};

const APPLY_HISTORY_SAVED_VIEWS: ApplyHistorySavedView[] = [
  {
    id: "all-activity",
    label: "Semua aktivitas",
    description: "Semua hasil apply terbaru.",
    filter: "All",
    quickFilter: "Any",
    sort: "Newest",
  },
  {
    id: "failures-only",
    label: "Hanya gagal",
    description: "Fokus pada apply yang gagal.",
    filter: "Failed",
    quickFilter: "Any",
    sort: "Newest",
  },
  {
    id: "needs-review",
    label: "Perlu review",
    description: "Entri dengan skipped keys yang perlu dicek operator.",
    filter: "All",
    quickFilter: "Has skipped keys",
    sort: "Failed first",
  },
  {
    id: "with-edge-profile",
    label: "Dengan edge profile",
    description: "Entri yang sudah punya edge profile.",
    filter: "All",
    quickFilter: "Has edge profile",
    sort: "Newest",
  },
];

const APPLY_HISTORY_FILTER_LABELS: Record<ApplyHistoryFilter, string> = {
  All: "Semua",
  Applied: "Berhasil",
  Failed: "Gagal",
};

const APPLY_HISTORY_QUICK_FILTER_LABELS: Record<ApplyHistoryQuickFilter, string> = {
  Any: "Semua entri",
  "Has code": "Ada kode",
  "Has skipped keys": "Ada skipped keys",
  "Has edge profile": "Ada edge profile",
};

const APPLY_HISTORY_SORT_LABELS: Record<ApplyHistorySort, string> = {
  Newest: "Terbaru",
  Oldest: "Terlama",
  "Applied first": "Berhasil dulu",
  "Failed first": "Gagal dulu",
};

const DEFAULT_APPLY_HISTORY_SAVED_VIEW = APPLY_HISTORY_SAVED_VIEW_OPTIONS[0];

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

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) return "Belum ada data";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "muted" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "error"
        ? "bg-destructive/10 text-destructive"
        : tone === "warning"
          ? "bg-amber-500/10 text-amber-700"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{label}</span>
  );
}

function formatDeviceEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    "metadata-finalized": "Metadata difinalisasi",
    "capture-trigger-failed": "Trigger capture gagal",
    "capture-job-failed": "Job capture gagal",
    "capture-missing-asset": "Asset capture tidak tersedia",
    "capture-exception": "Capture exception",
    "autofocus-trigger-failed": "Trigger autofocus gagal",
    "autofocus-job-failed": "Job autofocus gagal",
    "autofocus-exception": "Autofocus exception",
    "network-save-fallback": "Fallback network save",
    "folder-save-fallback": "Fallback folder browser",
    "browser-download-fallback": "Fallback download lokal",
    "capture-record-sync-failed": "Sinkron capture DB gagal",
  };
  return labels[eventType] ?? eventType;
}

type DeviceEventFilter = "all" | "info" | "warning" | "error";
type DeviceEventTypeFilter = "all" | "capture" | "autofocus" | "fallback" | "other";
type DeviceEventTimeRange = "all" | "today" | "7d" | "30d";

const DEVICE_EVENT_FILTERS: Array<{ id: DeviceEventFilter; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "error", label: "Error" },
  { id: "warning", label: "Warning" },
  { id: "info", label: "Info" },
];

const DEVICE_EVENT_TYPE_FILTERS: Array<{ id: DeviceEventTypeFilter; label: string }> = [
  { id: "all", label: "Semua Tipe" },
  { id: "capture", label: "Capture" },
  { id: "autofocus", label: "Autofocus" },
  { id: "fallback", label: "Fallback" },
  { id: "other", label: "Lainnya" },
];

const DEVICE_EVENT_TIME_FILTERS: Array<{ id: DeviceEventTimeRange; label: string }> = [
  { id: "all", label: "Semua Waktu" },
  { id: "today", label: "Hari Ini" },
  { id: "7d", label: "7 Hari" },
  { id: "30d", label: "30 Hari" },
];

function getDeviceEventTypeGroup(eventType: string): DeviceEventTypeFilter {
  if (eventType.startsWith("capture-")) return "capture";
  if (eventType.startsWith("autofocus-")) return "autofocus";
  if (eventType.includes("fallback")) return "fallback";
  return "other";
}

function matchesDeviceEventTimeRange(
  event: DeviceEventView,
  range: DeviceEventTimeRange,
  nowMs: number,
) {
  if (range === "all") return true;

  const eventTime = new Date(event.createdAt).getTime();
  if (Number.isNaN(eventTime)) return false;

  if (range === "today") {
    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    return eventTime >= startOfToday.getTime();
  }

  const rangeMs = range === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return eventTime >= nowMs - rangeMs;
}

function formatDeviceEventPayloadKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatDeviceEventPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "string") return value.trim() === "" ? "—" : value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function matchesDeviceEventSearch(event: DeviceEventView, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") return true;

  const payloadTerms = event.payload
    ? Object.entries(event.payload).flatMap(([key, value]) => [
        formatDeviceEventPayloadKey(key),
        formatDeviceEventPayloadValue(value),
      ])
    : [];

  return [
    formatDeviceEventLabel(event.eventType),
    event.eventType,
    event.severity,
    event.message,
    event.deviceName ?? "",
    event.deviceCode,
    ...payloadTerms,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function formatDeviceEventGroupDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function ReadinessCard({
  title,
  status,
  detail,
  hint,
  icon: Icon,
  tone,
  actionLabel,
  onAction,
}: {
  title: string;
  status: string;
  detail: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "muted";
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <StatusChip label={status} tone={tone} />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      <p className="mt-3 text-[11px] text-muted-foreground/80">{hint}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}

function highlightHistoryText(text: string, query: string) {
  const normalizedQuery = query.trim();
  if (normalizedQuery === "") return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), match: false });
    }

    parts.push({
      text: text.slice(matchIndex, matchIndex + normalizedQuery.length),
      match: true,
    });
    cursor = matchIndex + normalizedQuery.length;
  }

  return parts.map((part, index) =>
    part.match ? (
      <mark key={`${part.text}-${index}`} className="rounded bg-amber-200 px-0.5 text-foreground">
        {part.text}
      </mark>
    ) : (
      <span key={`${part.text}-${index}`}>{part.text}</span>
    ),
  );
}

function matchesApplyHistoryQuickFilter(
  entry: ApplyHistoryEntry,
  quickFilter: ApplyHistoryQuickFilter,
) {
  switch (quickFilter) {
    case "Has code":
      return !!entry.code;
    case "Has skipped keys":
      return entry.skippedKeys.length > 0;
    case "Has edge profile":
      return !!entry.edgeProfileId;
    case "Any":
    default:
      return true;
  }
}

function matchesApplyHistoryFilter(entry: ApplyHistoryEntry, filter: ApplyHistoryFilter) {
  if (filter === "All") return true;
  return filter === "Applied" ? entry.status === "applied" : entry.status === "failed";
}

function NotAvailable() {
  return <span className="text-muted-foreground">Belum tersedia</span>;
}

function DevicesPage() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturesToday, setCapturesToday] = useState<number | null>(null);
  const [lastCaptureAt, setLastCaptureAt] = useState<number | null>(null);
  const [deviceEvents, setDeviceEvents] = useState<DeviceEventView[]>([]);
  const [deviceEventsLoading, setDeviceEventsLoading] = useState(false);
  const [deviceEventsError, setDeviceEventsError] = useState<string | null>(null);
  const [deviceEventFilter, setDeviceEventFilter] = useState<DeviceEventFilter>("all");
  const [deviceEventTypeFilter, setDeviceEventTypeFilter] = useState<DeviceEventTypeFilter>("all");
  const [deviceEventSearchQuery, setDeviceEventSearchQuery] = useState("");
  const [deviceEventTimeRange, setDeviceEventTimeRange] = useState<DeviceEventTimeRange>("all");
  const [selectedDeviceEventId, setSelectedDeviceEventId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedDevice =
    registeredDevices.find((device) => device.id === selectedDeviceId) ??
    registeredDevices[0] ??
    null;

  const syncProfileFromRegistryDevice = useCallback(
    (device: RegisteredDevice, existingProfile?: DeviceProfile | null) => {
      const nextProfile = buildDeviceProfileFromRegisteredDevice(device, existingProfile);
      saveDeviceProfile(nextProfile);
      setProfile(nextProfile);
      return nextProfile;
    },
    [],
  );

  const loadRegistry = useCallback(
    async (existingProfile?: DeviceProfile | null, preferredDeviceId?: number | null) => {
      setRegistryLoading(true);
      const result = await listRegisteredDevices();
      setRegistryLoading(false);

      if (!result.ok) {
        setRegistryError(result.message);
        setRegisteredDevices([]);
        setSelectedDeviceId(null);
        return;
      }

      setRegistryError(null);
      setRegisteredDevices(result.devices);

      if (result.devices.length === 0) {
        setSelectedDeviceId(null);
        return;
      }

      const nextSelected =
        (preferredDeviceId
          ? result.devices.find((device) => device.id === preferredDeviceId)
          : null) ??
        (existingProfile
          ? result.devices.find((device) => device.deviceCode === existingProfile.deviceCode)
          : null) ??
        result.devices[0];

      setSelectedDeviceId(nextSelected.id);
      syncProfileFromRegistryDevice(nextSelected, existingProfile);
    },
    [syncProfileFromRegistryDevice],
  );

  async function refresh() {
    setLoading(true);
    try {
      const [result] = await Promise.all([
        getDeviceStatus(),
        loadRegistry(profile, selectedDeviceId),
      ]);
      setStatus(result);
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }

  const loadRecentDeviceEvents = useCallback(async (deviceCode?: string | null) => {
    setDeviceEventsLoading(true);
    const result = await listDeviceEvents({
      data: {
        limit: 8,
        ...(deviceCode ? { deviceCode } : {}),
      },
    });
    setDeviceEventsLoading(false);

    if (!result.ok) {
      setDeviceEvents([]);
      setDeviceEventsError(result.message);
      return;
    }

    setDeviceEvents(result.events);
    setDeviceEventsError(null);
  }, []);

  // Guarded against a stale response clobbering a newer one -- without this,
  // React StrictMode's mount/cleanup/remount in dev fires this effect twice,
  // and whichever of the two overlapping requests resolves last "wins" even
  // if it was the earlier, now-irrelevant one.
  useEffect(() => {
    let cancelled = false;
    const storedProfile = loadDeviceProfile();

    setProfile(storedProfile);
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

    void loadRegistry(storedProfile);

    return () => {
      cancelled = true;
    };
  }, [loadRegistry]);

  useEffect(() => {
    const deviceCode = selectedDevice?.deviceCode ?? profile?.deviceCode ?? null;
    void loadRecentDeviceEvents(deviceCode);
  }, [loadRecentDeviceEvents, profile?.deviceCode, selectedDevice?.deviceCode]);

  useEffect(() => {
    if (deviceEvents.length === 0) {
      setSelectedDeviceEventId(null);
      return;
    }
    setSelectedDeviceEventId((current) =>
      current && deviceEvents.some((event) => event.id === current) ? current : deviceEvents[0].id,
    );
  }, [deviceEvents]);

  const cameraConnected = !!status?.camera?.connected;
  const cameraLabel = status?.camera
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") ||
      "Model tidak diketahui"
    : "Belum terdeteksi";
  const profileTemplate = profile ? getTemplateById(profile.templateId) : null;
  const readinessLabel = !status?.online
    ? "Perlu perhatian"
    : cameraConnected
      ? "Siap"
      : "Edge siap, kamera perlu dicek";
  const deviceAttentionItems = [
    !status?.online
      ? {
          title: "Edge device sedang offline",
          detail:
            "Status Mini PC belum reachable. Refresh koneksi lalu cek tab Ringkasan untuk detail koneksi edge.",
          actionLabel: "Buka Ringkasan",
          action: () => setActiveTab("overview"),
        }
      : null,
    status?.online && !cameraConnected
      ? {
          title: "Camera belum terhubung",
          detail: "Preset belum bisa diterapkan sampai kamera USB kembali terhubung dan sesi siap.",
          actionLabel: "Buka Pengaturan Kamera",
          action: () => setActiveTab("camera-settings"),
        }
      : null,
    registeredDevices.length === 0 && !registryLoading
      ? {
          title: "Profil device belum lengkap",
          detail:
            "Registrasi device di database diperlukan agar preset, plant, dan bin punya konteks operasional yang jelas.",
          actionLabel: "Daftarkan Device",
          action: () => {},
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    detail: string;
    actionLabel: string;
    action: () => void;
  }>;
  const readinessCards = [
    {
      title: "Edge API",
      status: status?.online ? "Terjangkau" : "Offline",
      detail: status?.online
        ? `Terakhir sinkron ${lastSync ? formatRelativeTime(lastSync.getTime()) : "baru saja"}.`
        : "App belum bisa menjangkau edge API pada refresh terakhir.",
      hint: status?.online
        ? `Status koneksi: ${status.connectionState ?? "unknown"}.`
        : "Periksa jaringan LAN, service edge API, atau status Mini PC.",
      icon: Wifi,
      tone: status?.online ? ("success" as const) : ("warning" as const),
      actionLabel: "Buka Ringkasan",
      onAction: () => setActiveTab("overview"),
    },
    {
      title: "Koneksi Kamera",
      status: cameraConnected ? "USB terhubung" : "Terputus",
      detail: cameraConnected
        ? "Kamera siap dipakai untuk capture dan apply preset."
        : "Koneksi kamera belum siap untuk operasi config write.",
      hint: cameraConnected ? cameraLabel : "Cek kabel USB, power kamera, atau sesi edge device.",
      icon: Camera,
      tone: cameraConnected ? ("success" as const) : ("warning" as const),
      actionLabel: "Buka Pengaturan Kamera",
      onAction: () => setActiveTab("camera-settings"),
    },
    {
      title: "Freshness Capture Lokal",
      status: lastCaptureAt ? "Ada data terbaru" : "Belum ada capture",
      detail: lastCaptureAt
        ? `Capture terakhir ${formatRelativeTime(lastCaptureAt)}.`
        : "Belum ada capture lokal yang bisa dipakai untuk audit device ini.",
      hint: lastCaptureAt
        ? `Total capture hari ini: ${capturesToday ?? 0}.`
        : "Gunakan halaman Capture untuk mengambil sample baru.",
      icon: Activity,
      tone: lastCaptureAt ? ("success" as const) : ("warning" as const),
      actionLabel: "Buka Ringkasan",
      onAction: () => setActiveTab("overview"),
    },
  ];
  const latestDeviceEvent = deviceEvents[0] ?? null;
  const nowMs = Date.now();
  const visibleDeviceEvents = deviceEvents.filter(
    (event) =>
      (deviceEventFilter === "all" ? true : event.severity === deviceEventFilter) &&
      (deviceEventTypeFilter === "all"
        ? true
        : getDeviceEventTypeGroup(event.eventType) === deviceEventTypeFilter) &&
      matchesDeviceEventTimeRange(event, deviceEventTimeRange, nowMs) &&
      matchesDeviceEventSearch(event, deviceEventSearchQuery),
  );
  const selectedDeviceEvent =
    visibleDeviceEvents.find((event) => event.id === selectedDeviceEventId) ??
    visibleDeviceEvents[0] ??
    null;
  const hasDeviceEventSearch = deviceEventSearchQuery.trim() !== "";
  const hasDeviceEventTypeFilter = deviceEventTypeFilter !== "all";
  const hasDeviceEventTimeRangeFilter = deviceEventTimeRange !== "all";
  const hasPinnedErrorView =
    deviceEventFilter === "error" &&
    deviceEventTypeFilter === "all" &&
    deviceEventTimeRange === "7d" &&
    !hasDeviceEventSearch;
  const groupedVisibleDeviceEvents = visibleDeviceEvents.reduce(
    (groups, event) => {
      const eventDate = new Date(event.createdAt);
      const dateKey = eventDate.toISOString().slice(0, 10);
      const currentGroup = groups.at(-1);

      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        groups.push({
          dateKey,
          label: formatDeviceEventGroupDate(eventDate),
          events: [event],
        });
        return groups;
      }

      currentGroup.events.push(event);
      return groups;
    },
    [] as Array<{ dateKey: string; label: string; events: DeviceEventView[] }>,
  );
  const eventCounts = {
    all: deviceEvents.length,
    info: deviceEvents.filter((event) => event.severity === "info").length,
    warning: deviceEvents.filter((event) => event.severity === "warning").length,
    error: deviceEvents.filter((event) => event.severity === "error").length,
  } satisfies Record<DeviceEventFilter, number>;
  const eventTypeCounts = {
    all: deviceEvents.length,
    capture: deviceEvents.filter((event) => getDeviceEventTypeGroup(event.eventType) === "capture")
      .length,
    autofocus: deviceEvents.filter(
      (event) => getDeviceEventTypeGroup(event.eventType) === "autofocus",
    ).length,
    fallback: deviceEvents.filter(
      (event) => getDeviceEventTypeGroup(event.eventType) === "fallback",
    ).length,
    other: deviceEvents.filter((event) => getDeviceEventTypeGroup(event.eventType) === "other")
      .length,
  } satisfies Record<DeviceEventTypeFilter, number>;
  const eventTimeCounts = {
    all: deviceEvents.length,
    today: deviceEvents.filter((event) => matchesDeviceEventTimeRange(event, "today", nowMs))
      .length,
    "7d": deviceEvents.filter((event) => matchesDeviceEventTimeRange(event, "7d", nowMs)).length,
    "30d": deviceEvents.filter((event) => matchesDeviceEventTimeRange(event, "30d", nowMs)).length,
  } satisfies Record<DeviceEventTimeRange, number>;
  const pinnedErrorViewCount = deviceEvents.filter(
    (event) => event.severity === "error" && matchesDeviceEventTimeRange(event, "7d", nowMs),
  ).length;
  const visibleEventSeverityCounts = {
    info: visibleDeviceEvents.filter((event) => event.severity === "info").length,
    warning: visibleDeviceEvents.filter((event) => event.severity === "warning").length,
    error: visibleDeviceEvents.filter((event) => event.severity === "error").length,
  } as const;
  const activeDeviceLogFilters = [
    hasPinnedErrorView ? "Preset error terbaru" : null,
    deviceEventFilter !== "all"
      ? `Severity ${
          DEVICE_EVENT_FILTERS.find((filter) => filter.id === deviceEventFilter)?.label ??
          deviceEventFilter
        }`
      : null,
    hasDeviceEventTypeFilter
      ? `Tipe ${
          DEVICE_EVENT_TYPE_FILTERS.find((filter) => filter.id === deviceEventTypeFilter)?.label ??
          deviceEventTypeFilter
        }`
      : null,
    hasDeviceEventTimeRangeFilter
      ? `Waktu ${
          DEVICE_EVENT_TIME_FILTERS.find((filter) => filter.id === deviceEventTimeRange)?.label ??
          deviceEventTimeRange
        }`
      : null,
    hasDeviceEventSearch ? `Cari "${deviceEventSearchQuery.trim()}"` : null,
  ].filter(Boolean) as string[];

  const visibleDevices = registeredDevices.filter((device) => {
    const query = searchQuery.trim().toLowerCase();
    if (query === "") return true;
    return [
      device.deviceCode,
      device.deviceName,
      device.plant,
      device.bin,
      device.station,
      device.serialNumber ?? "",
      device.cameraModel ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  async function persistProfileToRegistry(nextProfile: DeviceProfile) {
    const result = await upsertRegisteredDeviceProfile({
      data: toUpsertRegisteredDeviceInput(nextProfile),
    });

    if (!result.ok) {
      toast.error("Profil device tersimpan lokal, tetapi gagal sinkron ke database", {
        description: result.message,
      });
      return;
    }

    await loadRegistry(result.profile, result.device.id);
  }

  function handleProfileSave(nextProfile: DeviceProfile) {
    saveDeviceProfile(nextProfile);
    setProfile(nextProfile);
    void persistProfileToRegistry(nextProfile);
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Kelola dan pantau semua Mini PC serta kamera operasional.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip
              label={readinessLabel}
              tone={!status?.online ? "warning" : cameraConnected ? "success" : "warning"}
            />
            <span className="text-xs text-muted-foreground">
              Sinkron terakhir {lastSync ? formatDateTime(lastSync) : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh status"
            className="rounded-md border border-input bg-background p-2 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/devices/register"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Daftarkan Device
          </Link>
        </div>
      </header>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kesiapan Device
              </div>
              <h2 className="mt-1 text-xl font-semibold">{readinessLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Halaman ini merangkum status edge, koneksi kamera, dan freshness capture lokal untuk
                operator sebelum masuk ke detail tab.
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-right text-xs">
              <div className="text-muted-foreground">Profil aktif</div>
              <div className="mt-1 font-medium text-foreground">
                {profileTemplate?.label ?? "Belum ada profil"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {readinessCards.map((card) => (
              <ReadinessCard key={card.title} {...card} />
            ))}
          </div>
        </div>

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Perhatian & Tindakan Berikutnya</h2>
          </div>
          {deviceAttentionItems.length > 0 ? (
            <div className="space-y-3">
              {deviceAttentionItems.map((item) =>
                item.actionLabel === "Daftarkan Device" ? (
                  <Link
                    key={item.title}
                    to="/devices/register"
                    className="group block rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/20"
                  >
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <span>{item.actionLabel}</span>
                    </div>
                  </Link>
                ) : (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.action}
                    className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/20"
                  >
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <span>{item.actionLabel}</span>
                    </div>
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
              Profil device tersimpan, edge device reachable, dan kamera tidak menunjukkan blocker
              utama saat ini.
            </div>
          )}
          <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Data capture di sini tetap berbasis browser lokal operator. Jika operator berpindah
            browser/profile, freshness capture bisa berbeda walau device yang dipakai sama.
          </div>
        </section>
      </section>

      {/* Filter bar -- functional against the one real device we have */}
      <section className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari device..."
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>Lokasi: Semua</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>Status: Semua</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>Koneksi: Semua</option>
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

      {registryError && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          Registry database belum bisa dimuat: {registryError}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Registry device berasal dari MSSQL. Status runtime live di bawah mengikuti device yang
          sedang dipilih sebagai profil aktif.
        </span>
        <span>
          {registryLoading ? "Memuat registry..." : `${registeredDevices.length} device terdaftar`}
        </span>
      </div>

      {visibleDevices.length > 0 ? (
        <div
          className={
            viewMode === "grid" ? "mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "mb-6 space-y-2"
          }
        >
          {visibleDevices.map((device) => {
            const isSelected = selectedDevice?.id === device.id;
            const isActiveRuntime = profile?.deviceCode === device.deviceCode;
            const cardStatus = isActiveRuntime
              ? status?.online
                ? "Terjangkau"
                : "Offline"
              : "Terdaftar";
            const cardTone = isActiveRuntime
              ? status?.online
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground"
              : "bg-sky-500/10 text-sky-700";

            return (
              <button
                key={device.id}
                type="button"
                onClick={() => {
                  setSelectedDeviceId(device.id);
                  syncProfileFromRegistryDevice(device, profile);
                }}
                className={`rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/20 ${
                  isSelected ? "border-2 border-primary" : ""
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-semibold">
                        {device.deviceName || "Device tidak dikenal"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {device.plant} • {device.bin}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cardTone}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActiveRuntime && status?.online ? "bg-emerald-500" : "bg-current/60"
                      }`}
                    />
                    {cardStatus}
                  </span>
                </div>

                <div className="mb-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Wifi className="h-3 w-3" />{" "}
                    {isActiveRuntime
                      ? cameraConnected
                        ? "USB terhubung"
                        : "Belum terhubung"
                      : "Status runtime mengikuti device aktif"}
                  </div>
                  <div>
                    Template:{" "}
                    <span className="font-medium text-foreground">
                      {getTemplateById(device.templateId).label}
                    </span>
                  </div>
                  <div>
                    Device Code:{" "}
                    <span className="font-medium text-foreground">{device.deviceCode}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">Station</div>
                    <div className="font-semibold">{device.station || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Capture Hari Ini</div>
                    <div className="font-semibold">
                      {isActiveRuntime ? (capturesToday ?? "—") : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Kamera</div>
                    <div className="font-semibold">{device.cameraModel ?? "—"}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {registeredDevices.length === 0
            ? "Belum ada device yang terdaftar di registry database."
            : `Tidak ada device yang cocok dengan "${searchQuery}".`}
        </div>
      )}

      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">
            {selectedDevice?.deviceName ||
              profile?.deviceName ||
              status?.deviceId ||
              "Device tidak dikenal"}
          </span>
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
                    <Package className="h-3.5 w-3.5" /> Informasi Device
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Nama Device</dt>
                    <dd className="text-right font-medium">{profile?.deviceName ?? "—"}</dd>
                    <dt className="text-muted-foreground">Kode Device</dt>
                    <dd className="text-right font-medium">
                      {selectedDevice?.deviceCode ?? profile?.deviceCode ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">Hostname</dt>
                    <dd className="text-right font-medium">{status?.deviceId ?? "—"}</dd>
                    <dt className="text-muted-foreground">Agent Version</dt>
                    <dd className="text-right font-medium">{status?.agentVersion ?? "—"}</dd>
                    <dt className="text-muted-foreground">Plant / Lokasi</dt>
                    <dd className="text-right font-medium">{profile?.plant ?? "—"}</dd>
                    <dt className="text-muted-foreground">Sumber Bin</dt>
                    <dd className="text-right font-medium">{profile?.bin ?? "—"}</dd>
                    <dt className="text-muted-foreground">Jadwal</dt>
                    <dd className="text-right font-medium">{profile?.schedule ?? "—"}</dd>
                    <dt className="text-muted-foreground">IP Address</dt>
                    <dd className="text-right font-medium">
                      {selectedDevice?.ipAddress ?? <NotAvailable />}
                    </dd>
                    <dt className="text-muted-foreground">OS</dt>
                    <dd className="text-right font-medium">
                      <NotAvailable />
                    </dd>
                  </dl>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Camera className="h-3.5 w-3.5" /> Informasi Kamera
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Model Kamera</dt>
                    <dd className="text-right font-medium">
                      {selectedDevice?.cameraModel ?? cameraLabel}
                    </dd>
                    <dt className="text-muted-foreground">Nomor Serial</dt>
                    <dd className="text-right font-medium">
                      {status?.camera?.serialNumber ?? selectedDevice?.serialNumber ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">Versi Firmware</dt>
                    <dd className="text-right font-medium">
                      {status?.camera?.firmwareVersion ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">Baterai / Daya</dt>
                    <dd className="text-right font-medium">
                      <NotAvailable />
                    </dd>
                    <dt className="text-muted-foreground">Koneksi USB</dt>
                    <dd className="text-right font-medium">
                      {cameraConnected ? "Terhubung" : "Belum terhubung"}
                    </dd>
                  </dl>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Wifi className="h-3.5 w-3.5" /> Status Koneksi
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Edge API</dt>
                    <dd
                      className={`text-right font-medium ${status?.online ? "text-emerald-600" : ""}`}
                    >
                      {status?.online ? "Terjangkau" : "Tidak terjangkau"}
                    </dd>
                    <dt className="text-muted-foreground">Kamera (USB)</dt>
                    <dd
                      className={`text-right font-medium ${cameraConnected ? "text-emerald-600" : ""}`}
                    >
                      {cameraConnected ? "Terhubung" : "Belum terhubung"}
                    </dd>
                  </dl>
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="mt-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {loading ? "Mengecek…" : "Tes Koneksi"}
                  </button>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Settings2 className="h-3.5 w-3.5" /> Aksi Cepat
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Restart Kamera",
                      "Restart API Service",
                      "Restart Mini PC",
                      "Sinkronkan Pengaturan",
                    ].map((action) => (
                      <button
                        key={action}
                        disabled
                        title="Belum tersedia"
                        className="rounded-md border border-input bg-muted px-2 py-1.5 text-xs opacity-50"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Aksi device jarak jauh belum tersedia saat ini.
                  </p>
                </div>
              </>
            )}

            {activeTab === "camera-settings" && (
              <CameraSettingsTab
                profile={profile}
                deviceStatus={status}
                onSaveProfile={handleProfileSave}
              />
            )}

            {activeTab === "health" && (
              <div className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Activity className="h-3.5 w-3.5" /> Kesehatan Device
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Penggunaan CPU</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                  <dt className="text-muted-foreground">Penggunaan RAM</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                  <dt className="text-muted-foreground">Penggunaan Disk</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                  <dt className="text-muted-foreground">Suhu</dt>
                  <dd className="text-right">
                    <NotAvailable />
                  </dd>
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Telemetri sistem memerlukan agent yang berjalan di Mini PC, dan komponen itu belum
                  tersedia di aplikasi ini.
                </p>
              </div>
            )}

            {activeTab === "logs" && (
              <div className="rounded-md border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <FileText className="h-3.5 w-3.5" /> Log Device Terbaru
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportDeviceEvents("json")}
                      disabled={visibleDeviceEvents.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" /> Export JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDeviceEvents("csv")}
                      disabled={visibleDeviceEvents.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void loadRecentDeviceEvents(
                          selectedDevice?.deviceCode ?? profile?.deviceCode ?? null,
                        )
                      }
                      disabled={deviceEventsLoading}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      {deviceEventsLoading ? "Menyegarkan…" : "Refresh Log"}
                    </button>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceEventFilter("error");
                      setDeviceEventTypeFilter("all");
                      setDeviceEventTimeRange("7d");
                      setDeviceEventSearchQuery("");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                      hasPinnedErrorView
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Error Terbaru</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                        hasPinnedErrorView
                          ? "bg-destructive-foreground/15 text-destructive-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pinnedErrorViewCount}
                    </span>
                  </button>
                  {hasPinnedErrorView ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceEventFilter("all");
                        setDeviceEventTypeFilter("all");
                        setDeviceEventTimeRange("all");
                        setDeviceEventSearchQuery("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Reset Filter
                    </button>
                  ) : null}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {DEVICE_EVENT_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setDeviceEventFilter(filter.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        deviceEventFilter === filter.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          deviceEventFilter === filter.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {eventCounts[filter.id]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {DEVICE_EVENT_TYPE_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setDeviceEventTypeFilter(filter.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        deviceEventTypeFilter === filter.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          deviceEventTypeFilter === filter.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {eventTypeCounts[filter.id]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {DEVICE_EVENT_TIME_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setDeviceEventTimeRange(filter.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        deviceEventTimeRange === filter.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          deviceEventTimeRange === filter.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {eventTimeCounts[filter.id]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={deviceEventSearchQuery}
                      onChange={(e) => setDeviceEventSearchQuery(e.target.value)}
                      placeholder="Cari pesan, event, device, atau payload..."
                      className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Menampilkan {visibleDeviceEvents.length} dari {eventCounts[deviceEventFilter]}{" "}
                    log
                    {hasDeviceEventTypeFilter
                      ? ` tipe ${DEVICE_EVENT_TYPE_FILTERS.find((filter) => filter.id === deviceEventTypeFilter)?.label ?? deviceEventTypeFilter}`
                      : ""}
                    {hasDeviceEventTimeRangeFilter
                      ? ` dalam ${DEVICE_EVENT_TIME_FILTERS.find((filter) => filter.id === deviceEventTimeRange)?.label ?? deviceEventTimeRange}`
                      : ""}
                    {hasDeviceEventSearch ? ` untuk "${deviceEventSearchQuery.trim()}"` : ""}.
                  </div>
                </div>
                {deviceEventsError ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                    Log device belum bisa dimuat: {deviceEventsError}
                  </div>
                ) : deviceEvents.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Belum ada log aktivitas untuk device ini.
                  </div>
                ) : visibleDeviceEvents.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Tidak ada log yang cocok dengan filter saat ini
                    {deviceEventFilter !== "all"
                      ? ` (severity ${deviceEventFilter.toUpperCase()})`
                      : ""}
                    {hasDeviceEventTypeFilter
                      ? ` (tipe ${DEVICE_EVENT_TYPE_FILTERS.find((filter) => filter.id === deviceEventTypeFilter)?.label ?? deviceEventTypeFilter})`
                      : ""}
                    {hasDeviceEventTimeRangeFilter
                      ? ` (rentang ${DEVICE_EVENT_TIME_FILTERS.find((filter) => filter.id === deviceEventTimeRange)?.label ?? deviceEventTimeRange})`
                      : ""}
                    {hasDeviceEventSearch
                      ? ` dan kata kunci "${deviceEventSearchQuery.trim()}".`
                      : "."}
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-[1.25fr_0.85fr]">
                    <div className="space-y-2">
                      <div className="sticky top-0 z-20 rounded-md border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Ringkasan Aktif
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {visibleDeviceEvents.length} log tampil dari {deviceEvents.length}{" "}
                              total
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 font-medium text-destructive">
                              Error {visibleEventSeverityCounts.error}
                            </span>
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 font-medium text-amber-700">
                              Warning {visibleEventSeverityCounts.warning}
                            </span>
                            <span className="rounded-full border border-muted bg-muted/50 px-2.5 py-1 font-medium text-muted-foreground">
                              Info {visibleEventSeverityCounts.info}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activeDeviceLogFilters.length > 0 ? (
                            activeDeviceLogFilters.map((filter) => (
                              <span
                                key={filter}
                                className="rounded-full border border-input bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                              >
                                {filter}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Tidak ada filter tambahan aktif. Semua log terbaru sedang ditampilkan.
                            </span>
                          )}
                        </div>
                      </div>
                      {groupedVisibleDeviceEvents.map((group) => (
                        <div key={group.dateKey} className="space-y-2">
                          <div className="sticky top-[92px] z-10 rounded-md border bg-muted/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </div>
                          {group.events.map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => setSelectedDeviceEventId(event.id)}
                              className={`block w-full rounded-md border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-accent/20 ${
                                selectedDeviceEvent?.id === event.id
                                  ? "border-primary bg-accent/20"
                                  : ""
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {highlightHistoryText(
                                        formatDeviceEventLabel(event.eventType),
                                        deviceEventSearchQuery,
                                      )}
                                    </span>
                                    <StatusChip
                                      label={event.severity}
                                      tone={
                                        event.severity === "error"
                                          ? "error"
                                          : event.severity === "warning"
                                            ? "warning"
                                            : "muted"
                                      }
                                    />
                                  </div>
                                  <div className="text-muted-foreground">
                                    {highlightHistoryText(event.message, deviceEventSearchQuery)}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    Device:{" "}
                                    {highlightHistoryText(
                                      event.deviceName ?? event.deviceCode,
                                      deviceEventSearchQuery,
                                    )}
                                  </div>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDateTime(new Date(event.createdAt))}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                        Detail Event
                      </h4>
                      {selectedDeviceEvent ? (
                        <div className="space-y-3 text-xs">
                          <div>
                            <div className="font-medium text-foreground">
                              {highlightHistoryText(
                                formatDeviceEventLabel(selectedDeviceEvent.eventType),
                                deviceEventSearchQuery,
                              )}
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              {highlightHistoryText(
                                selectedDeviceEvent.message,
                                deviceEventSearchQuery,
                              )}
                            </div>
                          </div>
                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                            <dt className="text-muted-foreground">Severity</dt>
                            <dd className="text-right">
                              <StatusChip
                                label={selectedDeviceEvent.severity}
                                tone={
                                  selectedDeviceEvent.severity === "error"
                                    ? "error"
                                    : selectedDeviceEvent.severity === "warning"
                                      ? "warning"
                                      : "muted"
                                }
                              />
                            </dd>
                            <dt className="text-muted-foreground">Device</dt>
                            <dd className="text-right font-medium">
                              {highlightHistoryText(
                                selectedDeviceEvent.deviceName ?? selectedDeviceEvent.deviceCode,
                                deviceEventSearchQuery,
                              )}
                            </dd>
                            <dt className="text-muted-foreground">Waktu</dt>
                            <dd className="text-right font-medium">
                              {formatDateTime(new Date(selectedDeviceEvent.createdAt))}
                            </dd>
                          </dl>
                          <div>
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Payload
                            </div>
                            {selectedDeviceEvent.payload &&
                            Object.keys(selectedDeviceEvent.payload).length > 0 ? (
                              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-md border bg-background px-3 py-2">
                                {Object.entries(selectedDeviceEvent.payload).map(([key, value]) => (
                                  <div
                                    key={`${selectedDeviceEvent.id}-${key}`}
                                    className="contents"
                                  >
                                    <dt className="text-muted-foreground">
                                      {highlightHistoryText(
                                        formatDeviceEventPayloadKey(key),
                                        deviceEventSearchQuery,
                                      )}
                                    </dt>
                                    <dd className="break-all text-right font-medium">
                                      {highlightHistoryText(
                                        formatDeviceEventPayloadValue(value),
                                        deviceEventSearchQuery,
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : (
                              <div className="rounded-md border border-dashed bg-background px-3 py-2 text-muted-foreground">
                                Event ini tidak membawa payload tambahan.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed bg-background px-3 py-8 text-center text-muted-foreground">
                          Pilih salah satu log untuk melihat detail payload.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "configuration" && <ConfigurationTab profile={profile} />}

            {activeTab === "fallback" && (
              <div className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <RotateCcw className="h-3.5 w-3.5" /> Koneksi Cadangan
                </h3>
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Utama: USB — belum ada metode cadangan yang dikonfigurasi.
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Koneksi cadangan seperti EOS Utility, Bluetooth, atau Wi-Fi belum didukung.
                  Aplikasi ini saat ini hanya berbicara ke kamera lewat USB via gphoto2.
                </p>
              </div>
            )}
          </div>

          {/* Right column: only ever honest placeholders -- there's no
              telemetry agent or QC scoring pipeline behind these yet. */}
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Kesehatan Device</h3>
              <div className="space-y-1.5 text-xs">
                {["CPU", "RAM", "Disk", "Suhu"].map((label) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <NotAvailable />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                Kesehatan Kamera (QC)
              </h3>
              <div className="space-y-1.5 text-xs">
                {["Kondisi Lensa", "Pencahayaan", "Exposure", "Fokus", "Kualitas Gambar"].map(
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
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Log Terbaru</h3>
              {deviceEventsError ? (
                <p className="text-xs text-muted-foreground">Log registry belum tersedia.</p>
              ) : latestDeviceEvent ? (
                <div className="space-y-1 text-xs">
                  <div className="font-medium text-foreground">
                    {formatDeviceEventLabel(latestDeviceEvent.eventType)}
                  </div>
                  <div className="text-muted-foreground">{latestDeviceEvent.message}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(new Date(latestDeviceEvent.createdAt).getTime())}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Belum ada aktivitas terbaru yang tercatat.
                </p>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground">
              Sinkron terakhir: {lastSync ? formatDateTime(lastSync) : "—"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CameraSettingsTab({
  profile,
  deviceStatus,
  onSaveProfile,
}: {
  profile: DeviceProfile | null;
  deviceStatus: DeviceStatus | null;
  onSaveProfile: (profile: DeviceProfile) => void;
}) {
  const [templateId, setTemplateId] = useState(profile?.templateId ?? DEVICE_TEMPLATES[0].id);
  const [templateFilter, setTemplateFilter] = useState<PresetFilter>(PRESET_FILTERS[0]);
  const [compareTemplateId, setCompareTemplateId] = useState(
    DEVICE_TEMPLATES.find(
      (template) => template.id !== (profile?.templateId ?? DEVICE_TEMPLATES[0].id),
    )?.id ?? DEVICE_TEMPLATES[0].id,
  );
  const [schedule, setSchedule] = useState(profile?.schedule ?? DEVICE_SCHEDULES[1]);
  const [draft, setDraft] = useState<CameraSettings | null>(profile?.cameraSettings ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [edgeConfigs, setEdgeConfigs] = useState<CameraConfig[]>([]);
  const [edgeConfigsLoading, setEdgeConfigsLoading] = useState(false);
  const [edgeConfigsError, setEdgeConfigsError] = useState<string | null>(null);
  const [applyHistory, setApplyHistory] = useState<ApplyHistoryEntry[]>([]);
  const [applyHistorySavedView, setApplyHistorySavedView] = useState<ApplyHistorySavedViewId>(
    DEFAULT_APPLY_HISTORY_SAVED_VIEW,
  );
  const [applyHistorySavedViewLoaded, setApplyHistorySavedViewLoaded] = useState(false);
  const [applyHistoryFilter, setApplyHistoryFilter] = useState<ApplyHistoryFilter>("All");
  const [applyHistorySearch, setApplyHistorySearch] = useState("");
  const [applyHistorySort, setApplyHistorySort] = useState<ApplyHistorySort>("Newest");
  const [applyHistoryQuickFilter, setApplyHistoryQuickFilter] =
    useState<ApplyHistoryQuickFilter>("Any");
  const [applyState, setApplyState] = useState<{
    status: "idle" | "applying" | "applied" | "failed";
    message: string | null;
    code?: string;
    appliedKeys?: string[];
    skippedKeys?: string[];
  }>({
    status: "idle",
    message: null,
  });

  useEffect(() => {
    setTemplateId(profile?.templateId ?? DEVICE_TEMPLATES[0].id);
    setCompareTemplateId(
      DEVICE_TEMPLATES.find(
        (template) => template.id !== (profile?.templateId ?? DEVICE_TEMPLATES[0].id),
      )?.id ?? DEVICE_TEMPLATES[0].id,
    );
    setSchedule(profile?.schedule ?? DEVICE_SCHEDULES[1]);
    setDraft(profile?.cameraSettings ?? null);
    setSaveState("idle");
  }, [profile]);

  useEffect(() => {
    setTemplateFilter(loadPresetFilterPreference());
    setApplyHistory(loadApplyHistory());
    setApplyHistoryView(loadApplyHistorySavedViewPreference());
    setApplyHistorySavedViewLoaded(true);
  }, []);

  useEffect(() => {
    savePresetFilterPreference(templateFilter);
  }, [templateFilter]);

  useEffect(() => {
    if (!applyHistorySavedViewLoaded) return;
    saveApplyHistorySavedViewPreference(applyHistorySavedView);
  }, [applyHistorySavedView, applyHistorySavedViewLoaded]);

  const activeTemplate = getTemplateById(templateId);
  const filteredTemplates = filterTemplatesByTag(templateFilter);
  const compareCandidates = filteredTemplates.filter((template) => template.id !== templateId);

  useEffect(() => {
    if (filteredTemplates.some((template) => template.id === compareTemplateId)) return;
    setCompareTemplateId(compareCandidates[0]?.id ?? templateId);
  }, [compareCandidates, compareTemplateId, filteredTemplates, templateId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEdgeConfigs() {
      setEdgeConfigsLoading(true);
      setEdgeConfigsError(null);
      const result = await listCameraConfigs();
      if (cancelled) return;
      if (!result.ok) {
        setEdgeConfigs([]);
        setEdgeConfigsError(result.message);
      } else {
        setEdgeConfigs(result.items);
      }
      setEdgeConfigsLoading(false);
    }

    void loadEdgeConfigs();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile || !draft) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Daftarkan device dulu untuk menentukan profil pengaturan kameranya.
      </div>
    );
  }

  function updateSetting<K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaveState("idle");
    setApplyState({ status: "idle", message: null });
  }

  function buildNextProfile() {
    return createProfileFromInput({
      ...profile,
      templateId,
      schedule,
      cameraSettings: draft,
      edgeProfileId: profile.edgeProfileId,
      edgeLastAppliedAt: profile.edgeLastAppliedAt,
      registeredAt: profile.registeredAt,
      updatedAt: Date.now(),
    });
  }

  function saveCameraProfile() {
    const nextProfile = buildNextProfile();
    onSaveProfile(nextProfile);
    setSaveState("saved");
    return nextProfile;
  }

  function saveSpecificCameraProfile(nextProfile: DeviceProfile) {
    onSaveProfile(nextProfile);
    setSaveState("saved");
    return nextProfile;
  }

  async function refreshEdgeConfigs() {
    setEdgeConfigsLoading(true);
    setEdgeConfigsError(null);
    const result = await listCameraConfigs();
    if (!result.ok) {
      setEdgeConfigs([]);
      setEdgeConfigsError(result.message);
    } else {
      setEdgeConfigs(result.items);
    }
    setEdgeConfigsLoading(false);
  }

  async function applyProfileToCamera(nextProfile: DeviceProfile) {
    setApplyState({
      status: "applying",
      message: "Creating/updating edge profile and applying preset to the camera...",
    });
    toast.message("Menerapkan preset ke kamera...", {
      description: "Edge profile sedang dibuat atau diperbarui.",
    });

    const result = await upsertAndApplyEdgePreset({ data: nextProfile });
    if (!result.ok) {
      setApplyState({
        status: "failed",
        message: result.message,
        code: result.code,
      });
      const nextHistory = appendApplyHistory({
        id: crypto.randomUUID(),
        status: "failed",
        templateId: nextProfile.templateId,
        templateLabel: getTemplateById(nextProfile.templateId).label,
        timestamp: Date.now(),
        message: result.message,
        edgeProfileId: nextProfile.edgeProfileId,
        appliedKeys: [],
        skippedKeys: [],
        code: result.code,
      });
      setApplyHistory(nextHistory);
      toast.error("Gagal menerapkan preset ke kamera", {
        description: result.message,
      });
      return;
    }

    const syncedProfile = createProfileFromInput({
      ...nextProfile,
      edgeProfileId: result.edgeProfileId,
      edgeLastAppliedAt: result.edgeLastAppliedAt,
      updatedAt: Date.now(),
      registeredAt: nextProfile.registeredAt,
    });
    onSaveProfile(syncedProfile);
    setApplyState({
      status: "applied",
      message: `Preset applied to camera via edge profile "${result.edgeProfileName}".`,
      appliedKeys: result.appliedKeys,
      skippedKeys: result.skippedKeys,
    });
    const nextHistory = appendApplyHistory({
      id: crypto.randomUUID(),
      status: "applied",
      templateId: nextProfile.templateId,
      templateLabel: getTemplateById(nextProfile.templateId).label,
      timestamp: Date.now(),
      message: `Preset applied to camera via edge profile "${result.edgeProfileName}".`,
      edgeProfileId: result.edgeProfileId,
      appliedKeys: result.appliedKeys,
      skippedKeys: result.skippedKeys,
      code: null,
    });
    setApplyHistory(nextHistory);
    toast.success("Preset berhasil diterapkan ke kamera", {
      description: `Edge profile "${result.edgeProfileName}" sudah aktif.`,
    });
    await refreshEdgeConfigs();
  }

  async function applyPresetToCamera() {
    const nextProfile = saveCameraProfile();
    await applyProfileToCamera(nextProfile);
  }

  const configWriteSupported = !!deviceStatus?.capabilities.includes("configWrite");
  const canApplyPreset =
    !!deviceStatus?.online &&
    !!deviceStatus.camera?.connected &&
    configWriteSupported &&
    applyState.status !== "applying";
  const applyActionHint =
    applyState.status === "applying"
      ? "Preset sedang diterapkan ke kamera."
      : !deviceStatus?.online
        ? "Terapkan sekarang belum tersedia karena edge API tidak reachable."
        : !deviceStatus.camera?.connected
          ? "Terapkan sekarang belum tersedia karena kamera belum terhubung."
          : !configWriteSupported
            ? "Terapkan sekarang belum tersedia karena edge API belum expose configWrite."
            : null;
  const applyStatusMeta =
    applyState.status === "applied"
      ? {
          label: "Berhasil diterapkan",
          detail: "Preset terakhir berhasil diterapkan ke kamera.",
          tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
          icon: CheckCircle2,
        }
      : applyState.status === "failed"
        ? {
            label: "Gagal diterapkan",
            detail: applyState.message ?? "Preset gagal diterapkan ke kamera.",
            tone: "border-destructive/30 bg-destructive/10 text-destructive",
            icon: AlertTriangle,
          }
        : applyState.status === "applying"
          ? {
              label: "Sedang diterapkan",
              detail: "Edge API sedang memproses preset aktif.",
              tone: "border-primary/30 bg-primary/10 text-primary",
              icon: RefreshCw,
            }
          : {
              label: canApplyPreset ? "Siap diterapkan" : "Belum bisa diterapkan",
              detail:
                applyActionHint ??
                "Preset bisa diterapkan saat edge API reachable dan kamera mendukung config write.",
              tone: canApplyPreset
                ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700",
              icon: canApplyPreset ? CheckCircle2 : AlertTriangle,
            };
  const applyChecklist = [
    {
      label: "Edge API reachable",
      done: !!deviceStatus?.online,
      detail: deviceStatus?.online
        ? "Edge API berhasil dijangkau dari aplikasi."
        : "Terapkan sekarang menunggu edge API kembali reachable.",
    },
    {
      label: "Kamera terhubung",
      done: !!deviceStatus?.camera?.connected,
      detail: deviceStatus?.camera?.connected
        ? "Kamera USB sudah terdeteksi oleh edge device."
        : "Hubungkan kamera dulu sebelum apply preset.",
    },
    {
      label: "Config write tersedia",
      done: configWriteSupported,
      detail: configWriteSupported
        ? "Edge API melaporkan capability config write."
        : "Capability config write belum tersedia untuk kamera ini.",
    },
  ];
  const applyNextActions = [
    !deviceStatus?.online ? "Refresh status device untuk memastikan edge API sudah online." : null,
    deviceStatus?.online && !deviceStatus.camera?.connected
      ? "Periksa kabel USB, power kamera, lalu ulangi koneksi."
      : null,
    deviceStatus?.online && deviceStatus.camera?.connected && !configWriteSupported
      ? "Capability configWrite belum tersedia; cek edge API/camera support matrix."
      : null,
    canApplyPreset
      ? "Preset siap diterapkan. Simpan draft jika perlu, lalu klik Terapkan Preset ke Kamera."
      : null,
  ].filter(Boolean) as string[];
  const historyForFilter = applyHistory.filter((entry) =>
    matchesApplyHistoryFilter(entry, applyHistoryFilter),
  );
  const applyHistorySavedViewCounts: Record<ApplyHistorySavedViewId, number> = {
    "all-activity": applyHistory.length,
    "failures-only": applyHistory.filter((entry) => entry.status === "failed").length,
    "needs-review": applyHistory.filter((entry) =>
      matchesApplyHistoryQuickFilter(entry, "Has skipped keys"),
    ).length,
    "with-edge-profile": applyHistory.filter((entry) =>
      matchesApplyHistoryQuickFilter(entry, "Has edge profile"),
    ).length,
  };
  const applyHistoryCounts: Record<ApplyHistoryFilter, number> = {
    All: applyHistory.length,
    Applied: applyHistory.filter((entry) => entry.status === "applied").length,
    Failed: applyHistory.filter((entry) => entry.status === "failed").length,
  };
  const applyHistoryQuickFilterCounts: Record<ApplyHistoryQuickFilter, number> = {
    Any: historyForFilter.length,
    "Has code": historyForFilter.filter((entry) => !!entry.code).length,
    "Has skipped keys": historyForFilter.filter((entry) => entry.skippedKeys.length > 0).length,
    "Has edge profile": historyForFilter.filter((entry) => !!entry.edgeProfileId).length,
  };
  const applyHistoryEmptyMessage =
    `Tidak ada entri yang cocok untuk filter "${APPLY_HISTORY_FILTER_LABELS[applyHistoryFilter]}" / "${APPLY_HISTORY_QUICK_FILTER_LABELS[applyHistoryQuickFilter]}" ` +
    "dengan pencarian saat ini.";
  const activeSavedView =
    applyHistorySearch.trim() === ""
      ? (APPLY_HISTORY_SAVED_VIEWS.find(
          (view) =>
            view.filter === applyHistoryFilter &&
            view.quickFilter === applyHistoryQuickFilter &&
            view.sort === applyHistorySort,
        ) ?? null)
      : null;
  const isApplyHistoryCustomView = activeSavedView === null;
  const visibleApplyHistory = [...historyForFilter]
    .filter((entry) => matchesApplyHistoryQuickFilter(entry, applyHistoryQuickFilter))
    .filter((entry) => {
      const query = applyHistorySearch.trim().toLowerCase();
      if (query === "") return true;
      return [
        entry.templateLabel,
        entry.templateId,
        entry.message,
        entry.code ?? "",
        entry.edgeProfileId ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => {
      switch (applyHistorySort) {
        case "Oldest":
          return left.timestamp - right.timestamp;
        case "Applied first":
          if (left.status !== right.status) return left.status === "applied" ? -1 : 1;
          return right.timestamp - left.timestamp;
        case "Failed first":
          if (left.status !== right.status) return left.status === "failed" ? -1 : 1;
          return right.timestamp - left.timestamp;
        case "Newest":
        default:
          return right.timestamp - left.timestamp;
      }
    });

  function setApplyHistoryView(viewId: ApplyHistorySavedViewId) {
    const view = APPLY_HISTORY_SAVED_VIEWS.find((item) => item.id === viewId);
    if (!view) return;

    setApplyHistorySavedView(view.id);
    setApplyHistoryFilter(view.filter);
    setApplyHistoryQuickFilter(view.quickFilter);
    setApplyHistorySort(view.sort);
    setApplyHistorySearch("");
  }

  const supportRows: Array<{
    label: string;
    localKey: keyof CameraSettings;
    edgeKey: string | null;
  }> = [
    { label: "ISO", localKey: "iso", edgeKey: "iso" },
    { label: "Shutter Speed", localKey: "shutter", edgeKey: "shutterSpeed" },
    { label: "Aperture", localKey: "aperture", edgeKey: "aperture" },
    { label: "White Balance", localKey: "whiteBalance", edgeKey: "whiteBalance" },
    { label: "Focus Mode", localKey: "focusMode", edgeKey: "focusMode" },
    { label: "Picture Style", localKey: "pictureStyle", edgeKey: null },
  ];

  function getSupportLabel(edgeKey: string | null) {
    if (!edgeKey) return "Belum dipetakan oleh edge API";
    const match = edgeConfigs.find((item) => item.key === edgeKey);
    if (!match) return "Key belum diekspos oleh kamera saat ini";
    if (!match.supported) return "Dilaporkan tidak didukung";
    if (!match.writable) return "Hanya-baca";
    return "Bisa ditulis";
  }

  function selectTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    setDraft(getTemplateCameraSettings(nextTemplateId));
    setSaveState("idle");
    setApplyState({ status: "idle", message: null });
  }

  function handleUseTemplate(nextTemplateId: string) {
    selectTemplate(nextTemplateId);
    const nextTemplate = getTemplateById(nextTemplateId);
    toast.success(`Preset aktif diubah ke "${nextTemplate.label}"`, {
      description: "Draft pengaturan kamera sudah mengikuti template terpilih.",
    });
  }

  function clearApplyHistoryEntries() {
    clearApplyHistory();
    setApplyHistory([]);
    setApplyHistorySavedView(DEFAULT_APPLY_HISTORY_SAVED_VIEW);
    setApplyHistoryFilter("All");
    setApplyHistoryQuickFilter("Any");
    setApplyHistorySearch("");
    setApplyHistorySort("Newest");
    toast.success("Riwayat apply preset dibersihkan", {
      description: "Hanya riwayat lokal pada browser ini yang dihapus.",
    });
  }

  function exportDeviceEvents(format: "json" | "csv") {
    if (visibleDeviceEvents.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filterSuffix = deviceEventFilter === "all" ? "all" : deviceEventFilter;
    const eventTypeSuffix = deviceEventTypeFilter === "all" ? "all-types" : deviceEventTypeFilter;
    const timeRangeSuffix = deviceEventTimeRange === "all" ? "all-time" : deviceEventTimeRange;
    const searchSuffix = hasDeviceEventSearch ? "-search" : "";

    let blob: Blob;
    let fileName: string;

    if (format === "json") {
      blob = new Blob(
        [
          JSON.stringify(
            visibleDeviceEvents.map((event) => ({
              ...event,
              eventLabel: formatDeviceEventLabel(event.eventType),
            })),
            null,
            2,
          ),
        ],
        {
          type: "application/json;charset=utf-8;",
        },
      );
      fileName = `device-events-${filterSuffix}-${eventTypeSuffix}-${timeRangeSuffix}${searchSuffix}-${timestamp}.json`;
    } else {
      const rows = [
        [
          "id",
          "created_at",
          "severity",
          "event_type",
          "event_label",
          "device_code",
          "device_name",
          "message",
          "payload_json",
        ],
        ...visibleDeviceEvents.map((event) => [
          String(event.id),
          event.createdAt,
          event.severity,
          event.eventType,
          formatDeviceEventLabel(event.eventType),
          event.deviceCode,
          event.deviceName ?? "",
          event.message,
          event.payload ? JSON.stringify(event.payload) : "",
        ]),
      ];
      const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
      blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      fileName = `device-events-${filterSuffix}-${eventTypeSuffix}-${timeRangeSuffix}${searchSuffix}-${timestamp}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    toast.success(`Log device diekspor ke ${format.toUpperCase()}`, {
      description: `Mengekspor ${visibleDeviceEvents.length} log sesuai filter aktif.`,
    });
  }

  function exportApplyHistory(format: "json" | "csv", scope: "filtered" | "all" = "filtered") {
    const entries = scope === "all" ? applyHistory : visibleApplyHistory;
    if (entries.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = scope === "all" ? "all" : applyHistoryFilter.toLowerCase();

    let blob: Blob;
    let fileName: string;

    if (format === "json") {
      blob = new Blob([JSON.stringify(entries, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      fileName = `apply-history-${suffix}-${timestamp}.json`;
    } else {
      const rows = [
        [
          "status",
          "template_id",
          "template_label",
          "timestamp",
          "message",
          "edge_profile_id",
          "code",
          "applied_keys",
          "skipped_keys",
        ],
        ...entries.map((entry) => [
          entry.status,
          entry.templateId,
          entry.templateLabel,
          new Date(entry.timestamp).toISOString(),
          entry.message,
          entry.edgeProfileId ?? "",
          entry.code ?? "",
          entry.appliedKeys.join("|"),
          entry.skippedKeys.join("|"),
        ]),
      ];
      const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
      blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      fileName = `apply-history-${suffix}-${timestamp}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    toast.success(`Apply history diekspor ke ${format.toUpperCase()}`, {
      description:
        scope === "all"
          ? `Mengekspor seluruh riwayat. Total entri: ${entries.length}.`
          : `Filter aktif: ${APPLY_HISTORY_FILTER_LABELS[applyHistoryFilter]}. Total entri: ${entries.length}.`,
    });
  }

  async function applyTemplateImmediately(nextTemplateId: string) {
    const nextDraft = getTemplateCameraSettings(nextTemplateId);
    const nextProfile = createProfileFromInput({
      ...profile,
      templateId: nextTemplateId,
      schedule,
      cameraSettings: nextDraft,
      edgeProfileId: profile.edgeProfileId,
      edgeLastAppliedAt: profile.edgeLastAppliedAt,
      registeredAt: profile.registeredAt,
      updatedAt: Date.now(),
    });
    setTemplateId(nextTemplateId);
    setDraft(nextDraft);
    saveSpecificCameraProfile(nextProfile);
    await applyProfileToCamera(nextProfile);
  }

  return (
    <div className="rounded-md border p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Camera className="h-3.5 w-3.5" /> Profil Pengaturan Kamera
          </h3>
          <p className="text-xs text-muted-foreground">
            Nilai ini disimpan sebagai profil device aktif dan bisa diterapkan ke kamera melalui
            edge API saat capability config write tersedia.
          </p>
        </div>
        <div className="flex max-w-md flex-col items-stretch gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveCameraProfile}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Simpan Pengaturan Device
            </button>
            <button
              onClick={() => void applyPresetToCamera()}
              disabled={!canApplyPreset}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applyState.status === "applying" ? "Menerapkan…" : "Terapkan Preset ke Kamera"}
            </button>
          </div>
          <div className={`rounded-md border px-3 py-2 text-xs ${applyStatusMeta.tone}`}>
            <div className="flex items-center gap-2 font-medium">
              <applyStatusMeta.icon
                className={`h-3.5 w-3.5 ${applyState.status === "applying" ? "animate-spin" : ""}`}
              />
              <span>{applyStatusMeta.label}</span>
            </div>
            <div className="mt-1">{applyStatusMeta.detail}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Config Write Edge</div>
          <div>{configWriteSupported ? "Tersedia" : "Belum tersedia"}</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Koneksi Kamera</div>
          <div>{deviceStatus?.camera?.connected ? "USB terhubung" : "Kamera belum terhubung"}</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Terakhir diterapkan</div>
          <div>
            {profile.edgeLastAppliedAt
              ? formatDateTime(new Date(profile.edgeLastAppliedAt))
              : "Belum pernah"}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Checklist Kesiapan Terapkan</h4>
          </div>
          <div className="space-y-2">
            {applyChecklist.map((item) => (
              <div key={item.label} className="rounded-md border bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                  <span>{item.label}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Tindakan Berikutnya</h4>
          </div>
          <div className="space-y-2">
            {applyNextActions.map((item) => (
              <div
                key={item}
                className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </div>
          {applyActionHint && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              {applyActionHint}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Template</label>
          <select
            value={templateId}
            onChange={(e) => {
              selectTemplate(e.target.value);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEVICE_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <PresetTemplatePreview template={activeTemplate} compact />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Jadwal Capture</label>
          <select
            value={schedule}
            onChange={(e) => {
              setSchedule(e.target.value);
              setSaveState("idle");
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEVICE_SCHEDULES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{profile.deviceName}</div>
          <div>
            {profile.plant} • {profile.bin}
          </div>
          <div>Diperbarui terakhir: {formatDateTime(new Date(profile.updatedAt))}</div>
        </div>
        <div className="md:col-span-3">
          <PresetTemplatePreview template={activeTemplate} />
        </div>
        <div className="md:col-span-3 rounded-md border bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Filter Preset</div>
              <p className="text-xs text-muted-foreground">
                Saring preset explorer berdasarkan skenario sebelum mengganti template aktif.
              </p>
            </div>
          </div>
          <PresetFilterBar value={templateFilter} onChange={setTemplateFilter} />
          <div className="mt-3">
            <PresetExplorerGrid
              templates={filteredTemplates}
              selectedTemplateId={templateId}
              onSelectTemplate={selectTemplate}
              onUseTemplate={handleUseTemplate}
              onApplyTemplate={(nextTemplateId) => void applyTemplateImmediately(nextTemplateId)}
              applyActionDisabled={!canApplyPreset}
              applyActionHint={applyActionHint}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">ISO</label>
          <select
            value={draft.iso}
            onChange={(e) => updateSetting("iso", e.target.value as CameraSettings["iso"])}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ISO_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Shutter Speed</label>
          <select
            value={draft.shutter}
            onChange={(e) => updateSetting("shutter", e.target.value as CameraSettings["shutter"])}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SHUTTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Aperture</label>
          <select
            value={draft.aperture}
            onChange={(e) =>
              updateSetting("aperture", e.target.value as CameraSettings["aperture"])
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {APERTURE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">White Balance</label>
          <select
            value={draft.whiteBalance}
            onChange={(e) =>
              updateSetting("whiteBalance", e.target.value as CameraSettings["whiteBalance"])
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {WHITE_BALANCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Picture Style</label>
          <select
            value={draft.pictureStyle}
            onChange={(e) =>
              updateSetting("pictureStyle", e.target.value as CameraSettings["pictureStyle"])
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PICTURE_STYLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Focus Mode</label>
          <select
            value={draft.focusMode}
            onChange={(e) =>
              updateSetting("focusMode", e.target.value as CameraSettings["focusMode"])
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {FOCUS_MODE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <PresetCompareTable
          title="Perbandingan Preset"
          baseTemplate={activeTemplate}
          compareOptions={compareCandidates}
          compareTemplateId={compareTemplateId}
          onCompareTemplateChange={setCompareTemplateId}
          onUseBaseTemplate={() => handleUseTemplate(templateId)}
          onApplyBaseTemplate={() => void applyTemplateImmediately(templateId)}
          applyActionDisabled={!canApplyPreset}
          applyActionHint={applyActionHint}
        />
      </div>

      <div className="mt-4 rounded-md border bg-muted/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">Dukungan Kamera Edge</h4>
            <p className="text-xs text-muted-foreground">
              Baris di bawah menunjukkan apakah setiap field preset bisa dipetakan ke edge API dan
              capability kamera yang sedang aktif.
            </p>
          </div>
          <button
            onClick={() => void refreshEdgeConfigs()}
            disabled={edgeConfigsLoading}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
          >
            {edgeConfigsLoading ? "Menyegarkan…" : "Refresh Konfigurasi Kamera"}
          </button>
        </div>
        {edgeConfigsError && (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            Gagal membaca konfigurasi edge: {edgeConfigsError}
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {supportRows.map((row) => {
            const currentEdgeValue = row.edgeKey
              ? edgeConfigs.find((item) => item.key === row.edgeKey)?.value
              : null;
            return (
              <div key={row.label} className="rounded-md border bg-background px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{getSupportLabel(row.edgeKey)}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Target:{" "}
                  <span className="font-medium text-foreground">{String(draft[row.localKey])}</span>
                </div>
                <div className="text-muted-foreground">
                  Nilai kamera:{" "}
                  <span className="font-medium text-foreground">
                    {currentEdgeValue === null || currentEdgeValue === undefined
                      ? "—"
                      : String(currentEdgeValue)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-muted/20 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">Riwayat Apply</h4>
            <p className="text-xs text-muted-foreground">
              Riwayat apply preset terakhir disimpan lokal di browser operator ini.
            </p>
          </div>
        </div>
        {applyHistory.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {APPLY_HISTORY_SAVED_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setApplyHistoryView(view.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                    applyHistorySavedView === view.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  <span>{view.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                      applyHistorySavedView === view.id
                        ? "bg-primary-foreground/15 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {applyHistorySavedViewCounts[view.id]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {activeSavedView?.description ??
                "Gunakan view tersimpan untuk memanggil kombinasi filter audit yang sering dipakai."}
            </p>
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {(["All", "Applied", "Failed"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setApplyHistoryFilter(filter);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      applyHistoryFilter === filter
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    <span>{APPLY_HISTORY_FILTER_LABELS[filter]}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                        applyHistoryFilter === filter
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {applyHistoryCounts[filter]}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => exportApplyHistory("json")}
                  disabled={visibleApplyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  Ekspor JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportApplyHistory("csv")}
                  disabled={visibleApplyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Ekspor CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportApplyHistory("json", "all")}
                  disabled={applyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  Ekspor Semua JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportApplyHistory("csv", "all")}
                  disabled={applyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Ekspor Semua CSV
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={applyHistory.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus riwayat
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus riwayat apply lokal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini akan menghapus semua riwayat apply preset yang tersimpan di
                        browser operator ini. Data tidak bisa dipulihkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={clearApplyHistoryEntries}>
                        Ya, hapus riwayat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Mode Tampilan
                </span>
                {isApplyHistoryCustomView ? (
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Tampilan kustom
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    View tersimpan
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {isApplyHistoryCustomView
                    ? "Filter, pencarian, dan urutan saat ini diatur manual."
                    : `Mengikuti preset "${activeSavedView?.label ?? "Semua aktivitas"}".`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["Any", "Has code", "Has skipped keys", "Has edge profile"] as const).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setApplyHistoryQuickFilter(filter);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        applyHistoryQuickFilter === filter
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      <span>{APPLY_HISTORY_QUICK_FILTER_LABELS[filter]}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          applyHistoryQuickFilter === filter
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {applyHistoryQuickFilterCounts[filter]}
                      </span>
                    </button>
                  ),
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={applyHistorySearch}
                    onChange={(event) => {
                      setApplyHistorySearch(event.target.value);
                    }}
                    placeholder="Cari template, pesan, code..."
                    className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
                <select
                  value={applyHistorySort}
                  onChange={(event) => {
                    setApplyHistorySort(event.target.value as ApplyHistorySort);
                  }}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                >
                  {(["Newest", "Oldest", "Applied first", "Failed first"] as const).map(
                    (option) => (
                      <option key={option} value={option}>
                        Urutkan: {APPLY_HISTORY_SORT_LABELS[option]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </>
        )}
        {applyHistory.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Belum ada riwayat apply preset pada browser ini.
          </div>
        ) : visibleApplyHistory.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {applyHistoryEmptyMessage}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleApplyHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {entry.status === "applied" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="font-medium text-foreground">
                      {highlightHistoryText(entry.templateLabel, applyHistorySearch)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        entry.status === "applied"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {entry.status === "applied" ? "Berhasil" : "Gagal"}
                    </span>
                  </div>
                  <span>{formatDateTime(new Date(entry.timestamp))}</span>
                </div>
                <div className="mt-1">
                  {highlightHistoryText(entry.message, applyHistorySearch)}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Profil Edge:{" "}
                    <span className="font-medium text-foreground">
                      {entry.edgeProfileId
                        ? highlightHistoryText(entry.edgeProfileId, applyHistorySearch)
                        : "—"}
                    </span>
                  </span>
                  {entry.code && (
                    <span>
                      Code:{" "}
                      <span className="font-medium text-foreground">
                        {highlightHistoryText(entry.code, applyHistorySearch)}
                      </span>
                    </span>
                  )}
                  {entry.appliedKeys.length > 0 && (
                    <span>
                      Diterapkan:{" "}
                      <span className="font-medium text-foreground">
                        {entry.appliedKeys.join(", ")}
                      </span>
                    </span>
                  )}
                  {entry.skippedKeys.length > 0 && (
                    <span>
                      Dilewati:{" "}
                      <span className="font-medium text-foreground">
                        {entry.skippedKeys.join(", ")}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <div className="space-y-1">
          <div className="text-muted-foreground">
            Status:{" "}
            {saveState === "saved"
              ? "Tersimpan lokal di browser ini"
              : "Ada perubahan lokal yang belum disimpan"}
          </div>
          {applyState.message && (
            <div
              className={`flex items-center gap-1.5 ${
                applyState.status === "applied"
                  ? "text-emerald-700"
                  : applyState.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {applyState.status === "applied" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : applyState.status === "failed" ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{applyState.message}</span>
            </div>
          )}
          {applyState.appliedKeys && applyState.appliedKeys.length > 0 && (
            <div className="text-muted-foreground">
              Key diterapkan:{" "}
              <span className="font-medium text-foreground">
                {applyState.appliedKeys.join(", ")}
              </span>
            </div>
          )}
          {applyState.skippedKeys && applyState.skippedKeys.length > 0 && (
            <div className="text-muted-foreground">
              Key dilewati:{" "}
              <span className="font-medium text-foreground">
                {applyState.skippedKeys.join(", ")}
              </span>
            </div>
          )}
        </div>
        <Link
          to="/devices/register"
          className="rounded-md border border-input bg-background px-3 py-1.5 font-medium hover:bg-accent"
        >
          Edit data registrasi
        </Link>
      </div>
    </div>
  );
}

function ConfigurationTab({ profile }: { profile: DeviceProfile | null }) {
  const [prefs, setPrefs] = useState<ReturnType<typeof loadPrefs> | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  return (
    <div className="rounded-md border p-4">
      <h3 className="mb-3 text-sm font-semibold">Ringkasan Konfigurasi</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Profil Device</dt>
        <dd className="text-right font-medium">{profile?.deviceName ?? "Belum terdaftar"}</dd>
        <dt className="text-muted-foreground">Plant / Bin</dt>
        <dd className="text-right font-medium">
          {profile ? `${profile.plant} • ${profile.bin}` : "—"}
        </dd>
        <dt className="text-muted-foreground">Template</dt>
        <dd className="text-right font-medium">
          {profile ? getTemplateById(profile.templateId).label : "—"}
        </dd>
        <dt className="text-muted-foreground">Jadwal</dt>
        <dd className="text-right font-medium">{profile?.schedule ?? "—"}</dd>
        <dt className="text-muted-foreground">Format Nama File</dt>
        <dd className="text-right font-mono font-medium">{prefs?.pattern ?? "—"}</dd>
        <dt className="text-muted-foreground">Format File</dt>
        <dd className="text-right font-medium">{prefs?.ext?.toUpperCase() ?? "—"}</dd>
        <dt className="text-muted-foreground">Indeks Gambar</dt>
        <dd className="text-right font-medium">
          {prefs ? String(prefs.counter).padStart(3, "0") : "—"}
        </dd>
        <dt className="text-muted-foreground">Folder Simpan</dt>
        <dd className="text-right font-medium">
          <NotAvailable />
        </dd>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pengaturan profil device sekarang dirangkum di sini, sementara format nama file dan folder
        simpan masih mengikuti halaman Capture sampai sinkronisasi backend/device tersedia.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/devices/register"
          className="inline-block rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Edit profil device
        </Link>
        <Link
          to="/capture"
          className="inline-block rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Edit preferensi capture
        </Link>
      </div>
    </div>
  );
}
