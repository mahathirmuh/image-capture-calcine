import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { DeviceTelemetryPanel } from "@/components/device-telemetry-panel";
import { useDeviceTelemetry } from "@/hooks/use-device-telemetry";
import { deviceEndpointHost } from "@/lib/device-diagnostics";
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
  getCameraDetails,
  type CameraDetails,
  listCameraConfigs,
  upsertAndApplyEdgePreset,
  type CameraConfig,
  type DeviceStatus,
} from "@/lib/camera-api";
import { loadGallery } from "@/lib/gallery-store";
import { loadPrefs } from "@/lib/capture-prefs";
import { PageTitle } from "@/components/page-shell";
import { downloadBlobFile, escapeCsvValue } from "@/lib/csv";
import { commonMessages as c } from "@/i18n/common";
import { deviceStatusText } from "@/i18n/device-status";
import {
  cameraSettingsMessages as cm,
  deviceLogMessages as lm,
  devicesMessages as m,
} from "@/i18n/devices";
import { failureText } from "@/i18n/errors";
import {
  translateId,
  useLocale,
  useNativeLocale,
  useRichT,
  useT,
  type Message,
  type Translator,
} from "@/lib/i18n";
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
  getDeviceEventSavedViewLabel,
  getTemplateById,
  getTemplateCameraSettings,
  getTemplateLabel,
  loadApplyHistory,
  loadApplyHistorySavedViewPreference,
  loadDeviceEventSavedViews,
  loadDeviceProfile,
  loadPresetFilterPreference,
  saveDeviceProfile,
  clearDeviceProfile,
  saveApplyHistorySavedViewPreference,
  saveDeviceEventSavedViews,
  savePresetFilterPreference,
  type ApplyHistoryEntry,
  type ApplyHistorySavedViewPreference,
  type CameraSettings,
  type DeviceEventSavedViewEntry,
  type DeviceEventSavedViewPreference,
  type DeviceEventSavedViewState,
  type DeviceProfile,
  type PresetFilter,
} from "@/lib/device-config";
import {
  buildDeviceProfileFromRegisteredDevice,
  listRegisteredDevices,
  changeRegisteredDeviceState,
  toUpsertRegisteredDeviceInput,
  upsertRegisteredDeviceProfile,
  type RegisteredDevice,
} from "@/lib/device-registry";
import {
  getDeviceEventAggregates,
  getDeviceEventPresetCounts,
  getDeviceEventSavedViewCounts,
  listDeviceEvents,
  type DeviceEventAggregates,
  type DeviceEventCursor,
  type DeviceEventPresetCounts,
  type DeviceEventSavedViewCounts,
  type DeviceEventView,
} from "@/lib/capture-records";

export const Route = createFileRoute("/devices/")({
  // Registry kamera dan tujuan simpan itu konfigurasi yang berlaku untuk semua
  // orang, bukan pengaturan per operator. Penjaga tampilan; entri sidebarnya
  // ikut disaring, tapi keduanya tidak menghalangi siapa pun mengetik URL-nya.
  beforeLoad: ({ context }) => {
    if (context.user && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
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

// Runtime data is fetched for the selected registry ID. Host telemetry and QC are not supplied by the edge API.

const TABS = [
  { id: "overview", label: m.tabOverview },
  { id: "camera-settings", label: m.tabCameraSettings },
  { id: "health", label: m.tabHealth },
  { id: "logs", label: m.tabLogs },
  { id: "configuration", label: m.tabConfiguration },
  { id: "fallback", label: m.tabFallback },
] as const;
type TabId = (typeof TABS)[number]["id"];
type ApplyHistoryFilter = "All" | "Applied" | "Failed";
type ApplyHistorySort = "Newest" | "Oldest" | "Applied first" | "Failed first";
type ApplyHistoryQuickFilter = "Any" | "Has code" | "Has skipped keys" | "Has edge profile";
type ApplyHistorySavedViewId = ApplyHistorySavedViewPreference;
type DeviceEventSavedViewId = DeviceEventSavedViewPreference;

type ApplyHistorySavedView = {
  id: ApplyHistorySavedViewId;
  label: Message;
  description: Message;
  filter: ApplyHistoryFilter;
  quickFilter: ApplyHistoryQuickFilter;
  sort: ApplyHistorySort;
};

const DEVICE_EVENT_SAVED_VIEW_DESCRIPTIONS: Record<DeviceEventSavedViewId, Message> = {
  "audit-slot-1": lm.savedViewSlot1Description,
  "audit-slot-2": lm.savedViewSlot2Description,
  "audit-slot-3": lm.savedViewSlot3Description,
};
const EMPTY_DEVICE_EVENT_SAVED_VIEW_COUNTS: DeviceEventSavedViewCounts = {
  "audit-slot-1": 0,
  "audit-slot-2": 0,
  "audit-slot-3": 0,
};

const APPLY_HISTORY_SAVED_VIEWS: ApplyHistorySavedView[] = [
  {
    id: "all-activity",
    label: cm.historyViewAll,
    description: cm.historyViewAllDescription,
    filter: "All",
    quickFilter: "Any",
    sort: "Newest",
  },
  {
    id: "failures-only",
    label: cm.historyViewFailures,
    description: cm.historyViewFailuresDescription,
    filter: "Failed",
    quickFilter: "Any",
    sort: "Newest",
  },
  {
    id: "needs-review",
    label: cm.historyViewNeedsReview,
    description: cm.historyViewNeedsReviewDescription,
    filter: "All",
    quickFilter: "Has skipped keys",
    sort: "Failed first",
  },
  {
    id: "with-edge-profile",
    label: cm.historyViewWithEdgeProfile,
    description: cm.historyViewWithEdgeProfileDescription,
    filter: "All",
    quickFilter: "Has edge profile",
    sort: "Newest",
  },
];

const APPLY_HISTORY_FILTER_LABELS: Record<ApplyHistoryFilter, Message> = {
  All: cm.historyFilterAll,
  Applied: cm.historyFilterApplied,
  Failed: cm.historyFilterFailed,
};

const APPLY_HISTORY_QUICK_FILTER_LABELS: Record<ApplyHistoryQuickFilter, Message> = {
  Any: cm.historyQuickAny,
  "Has code": cm.historyQuickHasCode,
  "Has skipped keys": cm.historyQuickHasSkippedKeys,
  "Has edge profile": cm.historyQuickHasEdgeProfile,
};

const APPLY_HISTORY_SORT_LABELS: Record<ApplyHistorySort, Message> = {
  Newest: cm.historySortNewest,
  Oldest: cm.historySortOldest,
  "Applied first": cm.historySortAppliedFirst,
  "Failed first": cm.historySortFailedFirst,
};

const DEFAULT_APPLY_HISTORY_SAVED_VIEW = APPLY_HISTORY_SAVED_VIEW_OPTIONS[0];

function formatDateTime(date: Date, locale: string) {
  const datePart = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

function formatRelativeTime(timestamp: number | null, t: Translator) {
  if (!timestamp) return t(m.relNoData);
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return t(m.relJustNow);
  if (diffMinutes < 60) return t(m.relMinutesAgo, { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t(m.relHoursAgo, { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return t(m.relDaysAgo, { count: diffDays });
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

function CountBadge({
  value,
  loading,
  className,
}: {
  value: number;
  loading: boolean;
  className: string;
}) {
  return (
    // Keep the last known value visible while the server refreshes the badge count.
    <span
      aria-busy={loading}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${className} ${
        loading ? "opacity-80" : ""
      }`}
    >
      {loading ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current/60" /> : null}
      <span>{value}</span>
    </span>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

// `t` bawaannya Indonesia: berkas ekspor (JSON/CSV) tidak ikut bahasa antarmuka.
function formatDeviceEventLabel(eventType: string, t: Translator = translateId): string {
  const labels: Record<string, Message> = {
    "metadata-finalized": lm.eventMetadataFinalized,
    "capture-trigger-failed": lm.eventCaptureTriggerFailed,
    "capture-job-failed": lm.eventCaptureJobFailed,
    "capture-missing-asset": lm.eventCaptureMissingAsset,
    "capture-exception": lm.eventCaptureException,
    "autofocus-trigger-failed": lm.eventAutofocusTriggerFailed,
    "autofocus-job-failed": lm.eventAutofocusJobFailed,
    "autofocus-exception": lm.eventAutofocusException,
    "network-save-fallback": lm.eventNetworkSaveFallback,
    "folder-save-fallback": lm.eventFolderSaveFallback,
    "browser-download-fallback": lm.eventBrowserDownloadFallback,
    "capture-record-sync-failed": lm.eventCaptureRecordSyncFailed,
  };
  const label = labels[eventType];
  return label ? t(label) : eventType;
}

// Severity adalah nilai data (info/warning/error); ini hanya teks tampilannya.
function formatDeviceEventSeverity(severity: string, t: Translator): string {
  const labels: Record<string, Message> = {
    info: lm.severityValueInfo,
    warning: lm.severityValueWarning,
    error: lm.severityValueError,
  };
  const label = labels[severity];
  return label ? t(label) : severity;
}

type DeviceEventFilter = "all" | "info" | "warning" | "error";
type DeviceEventTypeFilter = "all" | "capture" | "autofocus" | "fallback" | "other";
type DeviceEventTimeRange = "all" | "today" | "7d" | "30d" | "custom";
type DeviceEventPresetId =
  "error-latest" | "audit-failures" | "fallback-events" | "capture-failures" | "autofocus-failures";

const DEVICE_EVENT_FILTERS: Array<{ id: DeviceEventFilter; label: Message }> = [
  { id: "all", label: lm.severityAll },
  { id: "error", label: lm.severityError },
  { id: "warning", label: lm.severityWarning },
  { id: "info", label: lm.severityInfo },
];

const DEVICE_EVENT_TYPE_FILTERS: Array<{ id: DeviceEventTypeFilter; label: Message }> = [
  { id: "all", label: lm.typeAll },
  { id: "capture", label: lm.typeCapture },
  { id: "autofocus", label: lm.typeAutofocus },
  { id: "fallback", label: lm.typeFallback },
  { id: "other", label: lm.typeOther },
];

const DEVICE_EVENT_TIME_FILTERS: Array<{ id: DeviceEventTimeRange; label: Message }> = [
  { id: "all", label: lm.timeAll },
  { id: "today", label: lm.timeToday },
  { id: "7d", label: lm.time7d },
  { id: "30d", label: lm.time30d },
  { id: "custom", label: lm.timeCustom },
];
const DEVICE_EVENT_SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_DEVICE_EVENT_FETCH_LIMIT = 8;
const DEVICE_EVENT_FETCH_STEP = 8;

/** Label sebuah pilihan filter; id-nya sendiri kalau pilihannya tidak dikenal. */
function filterLabel<T extends string>(
  filters: Array<{ id: T; label: Message }>,
  id: T,
  t: Translator,
): string {
  const match = filters.find((filter) => filter.id === id);
  return match ? t(match.label) : id;
}

const DEVICE_EVENT_PRESETS: Array<{
  id: DeviceEventPresetId;
  label: Message;
  severity: DeviceEventFilter;
  eventType: DeviceEventTypeFilter;
  timeRange: DeviceEventTimeRange;
}> = [
  {
    id: "error-latest",
    label: lm.presetErrorLatest,
    severity: "error",
    eventType: "all",
    timeRange: "7d",
  },
  {
    id: "audit-failures",
    label: lm.presetAuditFailures,
    severity: "error",
    eventType: "all",
    timeRange: "30d",
  },
  {
    id: "fallback-events",
    label: lm.presetFallback,
    severity: "all",
    eventType: "fallback",
    timeRange: "30d",
  },
  {
    id: "capture-failures",
    label: lm.presetCaptureFailures,
    severity: "error",
    eventType: "capture",
    timeRange: "30d",
  },
  {
    id: "autofocus-failures",
    label: lm.presetAutofocusFailures,
    severity: "error",
    eventType: "autofocus",
    timeRange: "30d",
  },
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
  customStartMs?: number | null,
  customEndMs?: number | null,
) {
  if (range === "all") return true;

  const eventTime = new Date(event.createdAt).getTime();
  if (Number.isNaN(eventTime)) return false;

  if (range === "today") {
    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    return eventTime >= startOfToday.getTime();
  }

  if (range === "custom") {
    if (!customStartMs && !customEndMs) return true;
    if (customStartMs && eventTime < customStartMs) return false;
    if (customEndMs && eventTime > customEndMs) return false;
    return true;
  }

  const rangeMs = range === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return eventTime >= nowMs - rangeMs;
}

function formatDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function getDeviceEventTimeRangeBounds(
  range: DeviceEventTimeRange,
  nowMs: number,
  customStartMs?: number | null,
  customEndMs?: number | null,
) {
  if (range === "all") {
    return { rangeStart: undefined, rangeEnd: undefined };
  }

  if (range === "today") {
    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    return {
      rangeStart: startOfToday.toISOString(),
      rangeEnd: undefined,
    };
  }

  if (range === "custom") {
    return {
      rangeStart: customStartMs ? new Date(customStartMs).toISOString() : undefined,
      rangeEnd: customEndMs ? new Date(customEndMs).toISOString() : undefined,
    };
  }

  const rangeMs = range === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return {
    rangeStart: new Date(nowMs - rangeMs).toISOString(),
    rangeEnd: undefined,
  };
}

function matchesDeviceEventSavedView(
  state: DeviceEventSavedViewState,
  current: DeviceEventSavedViewState,
) {
  return (
    state.severity === current.severity &&
    state.eventType === current.eventType &&
    state.timeRange === current.timeRange &&
    state.searchQuery.trim() === current.searchQuery.trim() &&
    state.customStart === current.customStart &&
    state.customEnd === current.customEnd
  );
}

function summarizeDeviceEventSavedView(state: DeviceEventSavedViewState | null, t: Translator) {
  if (!state) return t(lm.savedViewNoFilter);

  const parts = [
    state.severity === "all"
      ? null
      : t(lm.filterSeverity, { value: formatDeviceEventSeverity(state.severity, t) }),
    state.eventType === "all" ? null : t(lm.filterType, { value: state.eventType }),
    state.timeRange === "all" ? null : t(lm.filterTime, { value: state.timeRange }),
    state.searchQuery.trim() ? t(lm.filterSearch, { query: state.searchQuery.trim() }) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" • ") : t(lm.savedViewAllLogs);
}

function normalizeDeviceEventSavedViewLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

function toAuditFileSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatDeviceEventPayloadKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatDeviceEventPayloadValue(value: unknown, t: Translator): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? t(lm.payloadYes) : t(lm.payloadNo);
  if (typeof value === "string") return value.trim() === "" ? "—" : value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

// Pencarian mencocokkan teks yang tampil di layar, jadi ikut bahasa antarmuka.
function matchesDeviceEventSearch(event: DeviceEventView, query: string, t: Translator) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") return true;

  const payloadTerms = event.payload
    ? Object.entries(event.payload).flatMap(([key, value]) => [
        formatDeviceEventPayloadKey(key),
        formatDeviceEventPayloadValue(value, t),
      ])
    : [];

  return [
    formatDeviceEventLabel(event.eventType, t),
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

function formatDeviceEventGroupDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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
    <div className="rounded-xl border bg-card shadow-sm p-4">
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
  const t = useT();
  return <span className="text-muted-foreground">{t(m.notAvailableYet)}</span>;
}

function DevicesPage() {
  const t = useT();
  const rich = useRichT();
  const locale = useLocale();
  const nativeLocale = useNativeLocale();
  // Callback pemuat data (useCallback) membaca penerjemah lewat ref, supaya
  // berganti bahasa tidak ikut memuat ulang registry, status, dan log.
  const translate = useRef(t);
  useEffect(() => {
    translate.current = t;
  }, [t]);
  const [rawStatus, setStatus] = useState<DeviceStatus | null>(null);
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
  const [deviceEventCustomStart, setDeviceEventCustomStart] = useState("");
  const [deviceEventCustomEnd, setDeviceEventCustomEnd] = useState("");
  const [deviceEventSavedViews, setDeviceEventSavedViews] = useState<DeviceEventSavedViewEntry[]>(
    [],
  );
  const [deviceEventAggregates, setDeviceEventAggregates] = useState<DeviceEventAggregates | null>(
    null,
  );
  const [deviceEventAggregatesLoading, setDeviceEventAggregatesLoading] = useState(false);
  const [deviceEventPresetServerCountsLoading, setDeviceEventPresetServerCountsLoading] =
    useState(false);
  const [deviceEventPresetServerCounts, setDeviceEventPresetServerCounts] =
    useState<DeviceEventPresetCounts | null>(null);
  const [deviceEventSavedViewServerCountsLoading, setDeviceEventSavedViewServerCountsLoading] =
    useState(false);
  const [deviceEventSavedViewServerCounts, setDeviceEventSavedViewServerCounts] =
    useState<DeviceEventSavedViewCounts | null>(null);
  const [deviceEventsHasMore, setDeviceEventsHasMore] = useState(false);
  const [deviceEventsNextCursor, setDeviceEventsNextCursor] = useState<DeviceEventCursor | null>(
    null,
  );
  const [deviceEventAutoRefreshPaused, setDeviceEventAutoRefreshPaused] = useState(false);
  const [selectedDeviceEventId, setSelectedDeviceEventId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedDeviceEventSearchQuery = useDebouncedValue(
    deviceEventSearchQuery,
    DEVICE_EVENT_SEARCH_DEBOUNCE_MS,
  );
  const deviceEventsRequestIdRef = useRef(0);
  const deviceEventAggregatesRequestIdRef = useRef(0);
  const deviceEventSavedViewCountsRequestIdRef = useRef(0);
  const deviceEventPresetCountsRequestIdRef = useRef(0);

  const selectedDevice =
    registeredDevices.find((device) => device.id === selectedDeviceId) ??
    registeredDevices[0] ??
    null;

  const status = rawStatus?.target?.deviceId === selectedDevice?.id ? rawStatus : null;
  const {
    telemetry,
    error: telemetryError,
    loading: telemetryLoading,
    refresh: refreshTelemetry,
  } = useDeviceTelemetry(
    selectedDevice?.id,
    !!selectedDevice?.isActive,
    selectedDevice?.edgeApiUrl,
  );
  const [cameraDetails, setCameraDetails] = useState<CameraDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const missingCameraDetail = loading
    ? t(m.loadingEllipsis)
    : detailsError
      ? t(m.loadFailedShort)
      : !status?.online
        ? t(m.deviceNotConnected)
        : !status.camera?.connected
          ? t(m.cameraNotConnected)
          : t(m.notReportedByCamera);
  const [stateBusy, setStateBusy] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [cameraOperationBusy, setCameraOperationBusy] = useState(false);
  const [pendingStateAction, setPendingStateAction] = useState<
    "activate" | "deactivate" | "delete" | null
  >(null);
  const runtimeRequest = useRef(0);
  const refreshRuntime = useCallback(async () => {
    const request = ++runtimeRequest.current;
    setStatus(null);
    setCameraDetails(null);
    setDetailsError(null);
    setLastSync(null);
    if (!selectedDevice?.isActive) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = { deviceId: selectedDevice.id };
    try {
      const result = await getDeviceStatus({ data });
      if (request !== runtimeRequest.current) return;
      setStatus(result);
      setLastSync(new Date());
      if (result.online && result.camera?.connected) {
        const detail = await getCameraDetails({ data });
        if (request !== runtimeRequest.current) return;
        if (detail.ok) setCameraDetails(detail.details);
        else setDetailsError(failureText(translate.current, detail));
      }
    } catch (error) {
      if (request === runtimeRequest.current)
        setDetailsError(
          error instanceof Error ? error.message : translate.current(m.statusLoadFailed),
        );
    }
    if (request === runtimeRequest.current) setLoading(false);
  }, [selectedDevice?.id, selectedDevice?.isActive]);
  useEffect(() => {
    void refreshRuntime();
    return () => {
      runtimeRequest.current += 1;
    };
  }, [refreshRuntime, selectedDevice?.edgeApiUrl]);

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
      let result;
      try {
        result = await listRegisteredDevices();
      } catch (error) {
        setRegistryError(
          error instanceof Error ? error.message : translate.current(m.registryLoadFailed),
        );
        setRegistryLoading(false);
        return;
      }
      setRegistryLoading(false);

      if (!result.ok) {
        setRegistryError(failureText(translate.current, result));
        setRegisteredDevices([]);
        setSelectedDeviceId(null);
        setProfile(null);
        setStatus(null);
        setCameraDetails(null);
        return;
      }

      setRegistryError(null);
      setRegisteredDevices(result.devices);

      if (result.devices.length === 0) {
        setSelectedDeviceId(null);
        setProfile(null);
        clearDeviceProfile();
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
    await Promise.all([
      refreshRuntime(),
      refreshTelemetry(),
      loadRegistry(profile, selectedDeviceId),
    ]);
  }

  async function confirmStateChange() {
    if (!selectedDevice || !pendingStateAction || stateBusy) return;
    setStateBusy(true);
    try {
      const result = await changeRegisteredDeviceState({
        data: { deviceId: selectedDevice.id, action: pendingStateAction },
      });
      if (!result.ok) throw new Error(failureText(t, result));
      toast.success(t(m.toastRegistryStateUpdated));
      setPendingStateAction(null);
      await loadRegistry(null, selectedDevice.id);
    } catch (error) {
      toast.error(t(m.toastChangeFailed), {
        description: error instanceof Error ? error.message : t(m.tryAgainShort),
      });
    } finally {
      setStateBusy(false);
    }
  }

  const loadRecentDeviceEvents = useCallback(
    async ({
      deviceCode,
      limit = DEFAULT_DEVICE_EVENT_FETCH_LIMIT,
      beforeCursor,
      append = false,
    }: {
      deviceCode?: string | null;
      limit?: number;
      beforeCursor?: DeviceEventCursor | null;
      append?: boolean;
    }) => {
      const requestId = ++deviceEventsRequestIdRef.current;
      const now = Date.now();
      const rangeBounds = getDeviceEventTimeRangeBounds(
        deviceEventTimeRange,
        now,
        parseDateTimeLocalValue(deviceEventCustomStart),
        parseDateTimeLocalValue(deviceEventCustomEnd),
      );

      setDeviceEventsLoading(true);
      const result = await listDeviceEvents({
        data: {
          limit,
          ...(deviceCode ? { deviceCode } : {}),
          severity: deviceEventFilter,
          eventType: deviceEventTypeFilter,
          searchQuery: debouncedDeviceEventSearchQuery.trim(),
          ...rangeBounds,
          ...(beforeCursor
            ? {
                beforeId: beforeCursor.id,
                beforeCreatedAt: beforeCursor.createdAt,
              }
            : {}),
        },
      });
      if (requestId !== deviceEventsRequestIdRef.current) return;
      setDeviceEventsLoading(false);

      if (!result.ok) {
        if (!append) {
          setDeviceEvents([]);
          setDeviceEventsHasMore(false);
          setDeviceEventsNextCursor(null);
        }
        setDeviceEventsError(failureText(translate.current, result));
        return;
      }

      setDeviceEvents((current) => (append ? [...current, ...result.events] : result.events));
      setDeviceEventsHasMore(result.hasMore);
      setDeviceEventsNextCursor(result.nextCursor);
      setDeviceEventsError(null);
    },
    [
      deviceEventCustomEnd,
      deviceEventCustomStart,
      deviceEventFilter,
      debouncedDeviceEventSearchQuery,
      deviceEventTimeRange,
      deviceEventTypeFilter,
    ],
  );

  const loadDeviceEventAggregates = useCallback(
    async (deviceCode?: string | null) => {
      const requestId = ++deviceEventAggregatesRequestIdRef.current;
      setDeviceEventAggregatesLoading(true);
      const customRangeBounds = getDeviceEventTimeRangeBounds(
        "custom",
        Date.now(),
        parseDateTimeLocalValue(deviceEventCustomStart),
        parseDateTimeLocalValue(deviceEventCustomEnd),
      );

      const result = await getDeviceEventAggregates({
        data: {
          ...(deviceCode ? { deviceCode } : {}),
          searchQuery: debouncedDeviceEventSearchQuery.trim(),
          customRangeStart: customRangeBounds.rangeStart,
          customRangeEnd: customRangeBounds.rangeEnd,
        },
      });
      if (requestId !== deviceEventAggregatesRequestIdRef.current) return;

      if (!result.ok) {
        setDeviceEventAggregatesLoading(false);
        return;
      }

      setDeviceEventAggregates(result.aggregates);
      setDeviceEventAggregatesLoading(false);
    },
    [debouncedDeviceEventSearchQuery, deviceEventCustomEnd, deviceEventCustomStart],
  );

  const loadDeviceEventSavedViewServerCounts = useCallback(
    async (deviceCode?: string | null) => {
      const requestId = ++deviceEventSavedViewCountsRequestIdRef.current;
      const views = deviceEventSavedViews.map((view) => {
        if (!view.state) {
          return {
            id: view.id,
            state: null,
          };
        }

        const rangeBounds = getDeviceEventTimeRangeBounds(
          view.state.timeRange,
          Date.now(),
          parseDateTimeLocalValue(view.state.customStart),
          parseDateTimeLocalValue(view.state.customEnd),
        );

        return {
          id: view.id,
          state: {
            severity: view.state.severity,
            eventType: view.state.eventType,
            searchQuery: view.state.searchQuery.trim(),
            rangeStart: rangeBounds.rangeStart,
            rangeEnd: rangeBounds.rangeEnd,
          },
        };
      });

      if (views.every((view) => view.state === null)) {
        if (requestId !== deviceEventSavedViewCountsRequestIdRef.current) return;
        setDeviceEventSavedViewServerCounts(EMPTY_DEVICE_EVENT_SAVED_VIEW_COUNTS);
        setDeviceEventSavedViewServerCountsLoading(false);
        return;
      }

      setDeviceEventSavedViewServerCountsLoading(true);
      const result = await getDeviceEventSavedViewCounts({
        data: {
          ...(deviceCode ? { deviceCode } : {}),
          views,
        },
      });
      if (requestId !== deviceEventSavedViewCountsRequestIdRef.current) return;

      if (!result.ok) {
        setDeviceEventSavedViewServerCountsLoading(false);
        return;
      }

      setDeviceEventSavedViewServerCounts(result.counts);
      setDeviceEventSavedViewServerCountsLoading(false);
    },
    [deviceEventSavedViews],
  );

  const loadDeviceEventPresetServerCounts = useCallback(
    async (deviceCode?: string | null) => {
      const requestId = ++deviceEventPresetCountsRequestIdRef.current;
      setDeviceEventPresetServerCountsLoading(true);
      const result = await getDeviceEventPresetCounts({
        data: {
          ...(deviceCode ? { deviceCode } : {}),
          searchQuery: debouncedDeviceEventSearchQuery.trim(),
        },
      });
      if (requestId !== deviceEventPresetCountsRequestIdRef.current) return;

      if (!result.ok) {
        setDeviceEventPresetServerCountsLoading(false);
        return;
      }

      setDeviceEventPresetServerCounts(result.counts);
      setDeviceEventPresetServerCountsLoading(false);
    },
    [debouncedDeviceEventSearchQuery],
  );

  const refreshDeviceLogPanel = useCallback(
    ({
      deviceCode,
      resetPaging = false,
      force = false,
    }: {
      deviceCode?: string | null;
      resetPaging?: boolean;
      force?: boolean;
    }) => {
      if (deviceEventAutoRefreshPaused && !force) return;

      if (resetPaging) {
        setDeviceEventsHasMore(false);
        setDeviceEventsNextCursor(null);
      }

      void loadRecentDeviceEvents({
        deviceCode,
        limit: DEFAULT_DEVICE_EVENT_FETCH_LIMIT,
      });
      void loadDeviceEventAggregates(deviceCode);
      void loadDeviceEventSavedViewServerCounts(deviceCode);
      void loadDeviceEventPresetServerCounts(deviceCode);
    },
    [
      deviceEventAutoRefreshPaused,
      loadDeviceEventAggregates,
      loadDeviceEventPresetServerCounts,
      loadDeviceEventSavedViewServerCounts,
      loadRecentDeviceEvents,
    ],
  );

  // Guarded against a stale response clobbering a newer one -- without this,
  // React StrictMode's mount/cleanup/remount in dev fires this effect twice,
  // and whichever of the two overlapping requests resolves last "wins" even
  // if it was the earlier, now-irrelevant one.
  useEffect(() => {
    let cancelled = false;
    const storedProfile = loadDeviceProfile();

    setProfile(storedProfile);

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
    setDeviceEventSavedViews(loadDeviceEventSavedViews());
  }, []);

  useEffect(() => {
    const deviceCode = selectedDevice?.deviceCode ?? profile?.deviceCode ?? null;
    refreshDeviceLogPanel({
      deviceCode,
      resetPaging: true,
    });
  }, [refreshDeviceLogPanel, profile?.deviceCode, selectedDevice?.deviceCode]);

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
      t(m.unknownModel)
    : t(m.notDetectedYet);
  const profileTemplate = profile ? getTemplateById(profile.templateId) : null;
  const runtimePaused = !selectedDevice?.isActive;
  const readinessLabel = runtimePaused
    ? t(m.readinessInactive)
    : !status?.online
      ? t(m.readinessAttention)
      : cameraConnected
        ? t(m.readinessReady)
        : t(m.readinessEdgeReadyCameraCheck);
  const deviceAttentionItems = [
    runtimePaused
      ? {
          title: m.attentionRuntimeSkippedTitle,
          detail: m.attentionRuntimeSkippedDetail,
          actionLabel: m.actionOpenOverview,
          action: () => setActiveTab("overview"),
        }
      : !status?.online
        ? {
            title: m.attentionEdgeOfflineTitle,
            detail: m.attentionEdgeOfflineDetail,
            actionLabel: m.actionOpenOverview,
            action: () => setActiveTab("overview"),
          }
        : null,
    status?.online && !cameraConnected
      ? {
          title: m.attentionCameraDisconnectedTitle,
          detail: m.attentionCameraDisconnectedDetail,
          actionLabel: m.actionOpenCameraSettings,
          action: () => setActiveTab("camera-settings"),
        }
      : null,
    registeredDevices.length === 0 && !registryLoading
      ? {
          title: m.attentionProfileIncompleteTitle,
          detail: m.attentionProfileIncompleteDetail,
          actionLabel: m.registerDevice,
          action: () => {},
        }
      : null,
  ].filter(Boolean) as Array<{
    title: Message;
    detail: Message;
    actionLabel: Message;
    action: () => void;
  }>;
  const readinessCards = [
    {
      title: "Edge API",
      status: runtimePaused
        ? t(m.statusNotChecked)
        : status?.online
          ? t(m.statusConnected)
          : t(m.statusOffline),
      detail: runtimePaused
        ? t(m.edgeDetailInactive)
        : status?.online
          ? t(m.edgeDetailSynced, {
              when: lastSync ? formatRelativeTime(lastSync.getTime(), t) : t(m.justNowLower),
            })
          : (deviceStatusText(t, status) ?? t(m.edgeDetailUnreachable)),
      hint: runtimePaused
        ? t(m.edgeHintInactive)
        : status?.online
          ? t(m.edgeHintConnectionState, { state: status.connectionState ?? "unknown" })
          : (deviceStatusText(t, status) ?? t(m.edgeHintCheckNetwork)),
      icon: Wifi,
      tone: status?.online ? ("success" as const) : ("warning" as const),
      actionLabel: t(m.actionOpenOverview),
      onAction: () => setActiveTab("overview"),
    },
    {
      title: t(m.cameraConnectionTitle),
      status: runtimePaused
        ? t(m.statusNotChecked)
        : cameraConnected
          ? t(m.usbConnected)
          : t(m.statusDisconnected),
      detail: runtimePaused
        ? t(m.edgeDetailInactive)
        : cameraConnected
          ? t(m.cameraDetailReady)
          : t(m.cameraDetailNotReady),
      hint: runtimePaused
        ? t(m.cameraHintInactive)
        : cameraConnected
          ? cameraLabel
          : t(m.cameraHintCheckCable),
      icon: Camera,
      tone: cameraConnected ? ("success" as const) : ("warning" as const),
      actionLabel: t(m.actionOpenCameraSettings),
      onAction: () => setActiveTab("camera-settings"),
    },
    {
      title: t(m.freshnessTitle),
      status: lastCaptureAt ? t(m.freshnessHasData) : t(m.freshnessNoCapture),
      detail: lastCaptureAt
        ? t(m.freshnessDetailLast, { when: formatRelativeTime(lastCaptureAt, t) })
        : t(m.freshnessDetailNone),
      hint: lastCaptureAt
        ? t(m.freshnessHintTotal, { count: capturesToday ?? 0 })
        : t(m.freshnessHintUseCapture),
      icon: Activity,
      tone: lastCaptureAt ? ("success" as const) : ("warning" as const),
      actionLabel: t(m.actionOpenOverview),
      onAction: () => setActiveTab("overview"),
    },
  ];
  const latestDeviceEvent = deviceEvents[0] ?? null;
  const nowMs = Date.now();
  const currentDeviceEventViewState: DeviceEventSavedViewState = {
    severity: deviceEventFilter,
    eventType: deviceEventTypeFilter,
    timeRange: deviceEventTimeRange,
    searchQuery: deviceEventSearchQuery,
    customStart: deviceEventCustomStart,
    customEnd: deviceEventCustomEnd,
  };
  const customStartMs = parseDateTimeLocalValue(deviceEventCustomStart);
  const customEndMs = parseDateTimeLocalValue(deviceEventCustomEnd);
  const buildCustomRangeLabel = (translator: Translator, dateLocale: string) =>
    customStartMs || customEndMs
      ? `${deviceEventCustomStart ? new Date(customStartMs ?? 0).toLocaleString(dateLocale) : translator(lm.rangeStartOpen)} - ${deviceEventCustomEnd ? new Date(customEndMs ?? 0).toLocaleString(dateLocale) : translator(lm.rangeEndNow)}`
      : translator(lm.rangeNotSet);
  const customRangeLabel = buildCustomRangeLabel(t, nativeLocale);
  // Nama berkas ekspor tidak ikut bahasa antarmuka: tetap bentuk Indonesianya.
  const customRangeFileLabel = buildCustomRangeLabel(translateId, "id-ID");
  const visibleDeviceEvents = deviceEvents.filter(
    (event) =>
      (deviceEventFilter === "all" ? true : event.severity === deviceEventFilter) &&
      (deviceEventTypeFilter === "all"
        ? true
        : getDeviceEventTypeGroup(event.eventType) === deviceEventTypeFilter) &&
      matchesDeviceEventTimeRange(event, deviceEventTimeRange, nowMs, customStartMs, customEndMs) &&
      matchesDeviceEventSearch(event, deviceEventSearchQuery, t),
  );
  const selectedDeviceEvent =
    visibleDeviceEvents.find((event) => event.id === selectedDeviceEventId) ??
    visibleDeviceEvents[0] ??
    null;
  const hasDeviceEventSearch = deviceEventSearchQuery.trim() !== "";
  const isDeviceEventSearchDebouncing =
    deviceEventSearchQuery.trim() !== debouncedDeviceEventSearchQuery.trim();
  const hasDeviceEventTypeFilter = deviceEventTypeFilter !== "all";
  const hasDeviceEventTimeRangeFilter = deviceEventTimeRange !== "all";
  const hasPinnedErrorView =
    deviceEventFilter === "error" &&
    deviceEventTypeFilter === "all" &&
    deviceEventTimeRange === "7d" &&
    !hasDeviceEventSearch;
  const activeDeviceEventPreset = !hasDeviceEventSearch
    ? (DEVICE_EVENT_PRESETS.find(
        (preset) =>
          preset.severity === deviceEventFilter &&
          preset.eventType === deviceEventTypeFilter &&
          preset.timeRange === deviceEventTimeRange,
      ) ?? null)
    : null;
  const groupedVisibleDeviceEvents = visibleDeviceEvents.reduce(
    (groups, event) => {
      const eventDate = new Date(event.createdAt);
      const dateKey = eventDate.toISOString().slice(0, 10);
      const currentGroup = groups.at(-1);

      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        groups.push({
          dateKey,
          label: formatDeviceEventGroupDate(eventDate, nativeLocale),
          events: [event],
        });
        return groups;
      }

      currentGroup.events.push(event);
      return groups;
    },
    [] as Array<{ dateKey: string; label: string; events: DeviceEventView[] }>,
  );
  const eventCounts =
    deviceEventAggregates?.severity ??
    ({
      all: deviceEvents.length,
      info: deviceEvents.filter((event) => event.severity === "info").length,
      warning: deviceEvents.filter((event) => event.severity === "warning").length,
      error: deviceEvents.filter((event) => event.severity === "error").length,
    } satisfies Record<DeviceEventFilter, number>);
  const eventTypeCounts =
    deviceEventAggregates?.eventType ??
    ({
      all: deviceEvents.length,
      capture: deviceEvents.filter(
        (event) => getDeviceEventTypeGroup(event.eventType) === "capture",
      ).length,
      autofocus: deviceEvents.filter(
        (event) => getDeviceEventTypeGroup(event.eventType) === "autofocus",
      ).length,
      fallback: deviceEvents.filter(
        (event) => getDeviceEventTypeGroup(event.eventType) === "fallback",
      ).length,
      other: deviceEvents.filter((event) => getDeviceEventTypeGroup(event.eventType) === "other")
        .length,
    } satisfies Record<DeviceEventTypeFilter, number>);
  const eventTimeCounts =
    deviceEventAggregates?.timeRange ??
    ({
      all: deviceEvents.length,
      today: deviceEvents.filter((event) => matchesDeviceEventTimeRange(event, "today", nowMs))
        .length,
      "7d": deviceEvents.filter((event) => matchesDeviceEventTimeRange(event, "7d", nowMs)).length,
      "30d": deviceEvents.filter((event) => matchesDeviceEventTimeRange(event, "30d", nowMs))
        .length,
      custom: deviceEvents.filter((event) =>
        matchesDeviceEventTimeRange(event, "custom", nowMs, customStartMs, customEndMs),
      ).length,
    } satisfies Record<DeviceEventTimeRange, number>);
  const pinnedErrorViewCount =
    deviceEventPresetServerCounts?.["error-latest"] ??
    deviceEventAggregates?.preset["error-latest"] ??
    deviceEvents.filter(
      (event) => event.severity === "error" && matchesDeviceEventTimeRange(event, "7d", nowMs),
    ).length;
  const deviceEventSavedViewLocalCounts = Object.fromEntries(
    deviceEventSavedViews.map((view) => {
      const state = view.state;
      return [
        view.id,
        state
          ? deviceEvents.filter(
              (event) =>
                (state?.severity === "all" ? true : event.severity === state.severity) &&
                (state?.eventType === "all"
                  ? true
                  : getDeviceEventTypeGroup(event.eventType) === state.eventType) &&
                matchesDeviceEventTimeRange(
                  event,
                  state.timeRange,
                  nowMs,
                  parseDateTimeLocalValue(state.customStart),
                  parseDateTimeLocalValue(state.customEnd),
                ) &&
                matchesDeviceEventSearch(event, state.searchQuery, t),
            ).length
          : 0,
      ];
    }),
  ) as Record<DeviceEventSavedViewId, number>;
  const deviceEventSavedViewCounts =
    deviceEventSavedViewServerCounts ?? deviceEventSavedViewLocalCounts;
  const presetCounts =
    deviceEventPresetServerCounts ??
    deviceEventAggregates?.preset ??
    (Object.fromEntries(
      DEVICE_EVENT_PRESETS.map((preset) => [
        preset.id,
        deviceEvents.filter(
          (event) =>
            (preset.severity === "all" ? true : event.severity === preset.severity) &&
            (preset.eventType === "all"
              ? true
              : getDeviceEventTypeGroup(event.eventType) === preset.eventType) &&
            matchesDeviceEventTimeRange(event, preset.timeRange, nowMs),
        ).length,
      ]),
    ) as Record<DeviceEventPresetId, number>);
  const visibleEventSeverityCounts = {
    info: visibleDeviceEvents.filter((event) => event.severity === "info").length,
    warning: visibleDeviceEvents.filter((event) => event.severity === "warning").length,
    error: visibleDeviceEvents.filter((event) => event.severity === "error").length,
  } as const;
  const canLoadMoreDeviceEvents = deviceEventsHasMore && deviceEventsNextCursor !== null;
  const activeDeviceSavedView =
    deviceEventSavedViews.find(
      (view) => view.state && matchesDeviceEventSavedView(view.state, currentDeviceEventViewState),
    ) ?? null;
  const activeDeviceLogFilters = [
    hasPinnedErrorView ? t(lm.activeFilterPinnedError) : null,
    activeDeviceSavedView
      ? t(lm.activeFilterSavedView, {
          name: getDeviceEventSavedViewLabel(activeDeviceSavedView, t),
        })
      : null,
    deviceEventFilter !== "all"
      ? t(lm.filterSeverity, {
          value: filterLabel(DEVICE_EVENT_FILTERS, deviceEventFilter, t),
        })
      : null,
    hasDeviceEventTypeFilter
      ? t(lm.filterType, {
          value: filterLabel(DEVICE_EVENT_TYPE_FILTERS, deviceEventTypeFilter, t),
        })
      : null,
    hasDeviceEventTimeRangeFilter
      ? t(lm.filterTime, {
          value:
            deviceEventTimeRange === "custom"
              ? customRangeLabel
              : filterLabel(DEVICE_EVENT_TIME_FILTERS, deviceEventTimeRange, t),
        })
      : null,
    activeDeviceEventPreset
      ? t(lm.activeFilterPreset, { name: t(activeDeviceEventPreset.label) })
      : null,
    hasDeviceEventSearch ? t(lm.filterSearch, { query: deviceEventSearchQuery.trim() }) : null,
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

  async function handleProfileSave(nextProfile: DeviceProfile): Promise<boolean> {
    if (!selectedDevice || profileSaving) return false;
    setProfileSaving(true);
    try {
      const result = await upsertRegisteredDeviceProfile({
        data: { ...toUpsertRegisteredDeviceInput(nextProfile), deviceId: selectedDevice.id },
      });
      if (!result.ok) throw new Error(failureText(t, result));
      const savedProfile = buildDeviceProfileFromRegisteredDevice(result.device, nextProfile);
      saveDeviceProfile(savedProfile);
      setProfile(savedProfile);
      await loadRegistry(savedProfile, result.device.id);
      toast.success(t(m.toastProfileSaved));
      return true;
    } catch (error) {
      toast.error(t(m.toastProfileNotSaved), {
        description: error instanceof Error ? error.message : t(m.tryAgainShort),
      });
      return false;
    } finally {
      setProfileSaving(false);
    }
  }

  function applyDeviceEventPreset(preset: (typeof DEVICE_EVENT_PRESETS)[number]) {
    setDeviceEventFilter(preset.severity);
    setDeviceEventTypeFilter(preset.eventType);
    setDeviceEventTimeRange(preset.timeRange);
    setDeviceEventSearchQuery("");
  }

  function applyDeviceEventSavedView(viewId: DeviceEventSavedViewId) {
    const view = deviceEventSavedViews.find((item) => item.id === viewId);
    if (!view?.state) {
      toast.message(t(lm.toastSavedViewEmptySlot), {
        description: t(lm.toastSavedViewEmptySlotDesc),
      });
      return;
    }

    setDeviceEventFilter(view.state.severity);
    setDeviceEventTypeFilter(view.state.eventType);
    setDeviceEventTimeRange(view.state.timeRange);
    setDeviceEventSearchQuery(view.state.searchQuery);
    setDeviceEventCustomStart(view.state.customStart);
    setDeviceEventCustomEnd(view.state.customEnd);
    toast.success(t(lm.toastSavedViewApplied, { name: getDeviceEventSavedViewLabel(view, t) }), {
      description: t(lm.toastSavedViewAppliedDesc),
    });
  }

  function saveCurrentDeviceEventView(viewId: DeviceEventSavedViewId) {
    const nextViews = deviceEventSavedViews.map((view) =>
      view.id === viewId
        ? {
            ...view,
            state: currentDeviceEventViewState,
            updatedAt: Date.now(),
          }
        : view,
    );

    setDeviceEventSavedViews(nextViews);
    saveDeviceEventSavedViews(nextViews);

    const view = nextViews.find((item) => item.id === viewId);
    toast.success(
      t(lm.toastSavedViewUpdated, {
        name: view ? getDeviceEventSavedViewLabel(view, t) : viewId,
      }),
      {
        description: t(lm.toastSavedViewUpdatedDesc),
      },
    );
  }

  function clearDeviceEventSavedView(viewId: DeviceEventSavedViewId) {
    const nextViews = deviceEventSavedViews.map((view) =>
      view.id === viewId
        ? {
            ...view,
            state: null,
            updatedAt: null,
          }
        : view,
    );

    setDeviceEventSavedViews(nextViews);
    saveDeviceEventSavedViews(nextViews);

    const view = nextViews.find((item) => item.id === viewId);
    toast.success(
      t(lm.toastSavedViewCleared, {
        name: view ? getDeviceEventSavedViewLabel(view, t) : viewId,
      }),
      {
        description: t(lm.toastSavedViewClearedDesc),
      },
    );
  }

  function renameDeviceEventSavedView(viewId: DeviceEventSavedViewId) {
    const currentView = deviceEventSavedViews.find((view) => view.id === viewId);
    if (!currentView || typeof window === "undefined") return;

    const currentLabel = getDeviceEventSavedViewLabel(currentView, t);
    const nextLabel = window.prompt(t(lm.promptRenameSavedView), currentLabel);
    if (nextLabel === null) return;

    const normalizedLabel = normalizeDeviceEventSavedViewLabel(nextLabel);
    if (normalizedLabel === "") {
      toast.error(t(lm.toastSavedViewNameEmpty), {
        description: t(lm.toastSavedViewNameEmptyDesc),
      });
      return;
    }

    const nextViews = deviceEventSavedViews.map((view) =>
      view.id === viewId
        ? {
            ...view,
            // Nama bawaan yang tampil terjemahannya tidak ikut tersimpan sebagai
            // nama kustom kalau pengguna tidak mengubahnya.
            label: normalizedLabel === currentLabel ? view.label : normalizedLabel,
          }
        : view,
    );

    setDeviceEventSavedViews(nextViews);
    saveDeviceEventSavedViews(nextViews);
    toast.success(t(lm.toastSavedViewRenamed, { name: normalizedLabel }), {
      description: t(lm.toastSavedViewRenamedDesc),
    });
  }

  function duplicateDeviceEventSavedView(sourceViewId: DeviceEventSavedViewId) {
    if (typeof window === "undefined") return;

    const sourceView = deviceEventSavedViews.find((view) => view.id === sourceViewId);
    if (!sourceView?.state) {
      toast.message(t(lm.toastSavedViewSourceEmpty), {
        description: t(lm.toastSavedViewSourceEmptyDesc),
      });
      return;
    }

    const targetOptions = deviceEventSavedViews
      .filter((view) => view.id !== sourceViewId)
      .map((view, index) => `${index + 1}. ${getDeviceEventSavedViewLabel(view, t)}`)
      .join("\n");
    const selectedTarget = window.prompt(
      t(lm.promptDuplicateSavedView, {
        name: getDeviceEventSavedViewLabel(sourceView, t),
        options: targetOptions,
      }),
      "1",
    );

    if (selectedTarget === null) return;

    const targetIndex = Number(selectedTarget) - 1;
    const targetCandidates = deviceEventSavedViews.filter((view) => view.id !== sourceViewId);
    const targetView = targetCandidates[targetIndex];

    if (!targetView) {
      toast.error(t(lm.toastDuplicateInvalidTarget), {
        description: t(lm.toastDuplicateInvalidTargetDesc),
      });
      return;
    }

    const nextViews = deviceEventSavedViews.map((view) =>
      view.id === targetView.id
        ? {
            ...view,
            state: sourceView.state,
            updatedAt: Date.now(),
          }
        : view,
    );

    setDeviceEventSavedViews(nextViews);
    saveDeviceEventSavedViews(nextViews);
    toast.success(
      t(lm.toastSavedViewDuplicated, { name: getDeviceEventSavedViewLabel(sourceView, t) }),
      {
        description: t(lm.toastSavedViewDuplicatedDesc, {
          name: getDeviceEventSavedViewLabel(targetView, t),
        }),
      },
    );
  }

  async function handleLoadMoreDeviceEvents() {
    const deviceCode = selectedDevice?.deviceCode ?? profile?.deviceCode ?? null;
    if (!deviceEventsNextCursor) return;
    await loadRecentDeviceEvents({
      deviceCode,
      limit: DEVICE_EVENT_FETCH_STEP,
      beforeCursor: deviceEventsNextCursor,
      append: true,
    });
  }

  function toggleDeviceEventAutoRefresh() {
    setDeviceEventAutoRefreshPaused((current) => {
      const nextValue = !current;
      toast.message(nextValue ? t(lm.toastAutoSyncPaused) : t(lm.toastAutoSyncResumed), {
        description: nextValue ? t(lm.toastAutoSyncPausedDesc) : t(lm.toastAutoSyncResumedDesc),
      });
      return nextValue;
    });
  }

  function buildDeviceEventExportBaseFileName(timestamp: string) {
    const filterSuffix = deviceEventFilter === "all" ? "all" : deviceEventFilter;
    const eventTypeSuffix = deviceEventTypeFilter === "all" ? "all-types" : deviceEventTypeFilter;
    const timeRangeSuffix =
      deviceEventTimeRange === "all"
        ? "all-time"
        : deviceEventTimeRange === "custom"
          ? `custom-${toAuditFileSlug(customRangeFileLabel)}`
          : deviceEventTimeRange;
    const savedViewSuffix = activeDeviceSavedView
      ? `-${toAuditFileSlug(activeDeviceSavedView.label)}`
      : "";
    const presetSuffix = activeDeviceEventPreset
      ? `-${toAuditFileSlug(activeDeviceEventPreset.label.id)}`
      : "";
    const searchSuffix = hasDeviceEventSearch ? "-search" : "";
    return `device-events${savedViewSuffix}${presetSuffix}-${filterSuffix}-${eventTypeSuffix}-${timeRangeSuffix}${searchSuffix}-${timestamp}`;
  }

  function buildDeviceEventExportFile(format: "json" | "csv", timestamp: string) {
    const baseFileName = buildDeviceEventExportBaseFileName(timestamp);

    if (format === "json") {
      return {
        blob: new Blob(
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
        ),
        fileName: `${baseFileName}.json`,
      };
    }

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
    return {
      blob: new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
      fileName: `${baseFileName}.csv`,
    };
  }

  function exportDeviceEvents(format: "json" | "csv") {
    if (visibleDeviceEvents.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const { blob, fileName } = buildDeviceEventExportFile(format, timestamp);
    downloadBlobFile(blob, fileName);

    toast.success(t(lm.toastLogExported, { format: format.toUpperCase() }), {
      description: t(lm.toastLogExportedDesc, { count: visibleDeviceEvents.length }),
    });
  }

  function exportDeviceEventBundle() {
    if (visibleDeviceEvents.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonFile = buildDeviceEventExportFile("json", timestamp);
    const csvFile = buildDeviceEventExportFile("csv", timestamp);
    downloadBlobFile(jsonFile.blob, jsonFile.fileName);
    downloadBlobFile(csvFile.blob, csvFile.fileName);

    toast.success(t(lm.toastLogBundleExported), {
      description: t(lm.toastLogBundleExportedDesc, { count: visibleDeviceEvents.length }),
    });
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle title={t(c.navDevices)} description={t(m.pageDescription)} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip
              label={readinessLabel}
              tone={!status?.online ? "warning" : cameraConnected ? "success" : "warning"}
            />
            <span className="text-xs text-muted-foreground">
              {t(m.lastSyncInline, { when: lastSync ? formatDateTime(lastSync, locale) : "—" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            title={t(m.refreshStatusTitle)}
            className="rounded-md border border-input bg-background p-2 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/devices/register"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t(m.registerDevice)}
          </Link>
        </div>
      </header>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(m.readinessHeading)}
              </div>
              <h2 className="mt-1 text-xl font-semibold">{readinessLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(m.readinessIntro)}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-right text-xs">
              <div className="text-muted-foreground">{t(m.activeProfile)}</div>
              <div className="mt-1 font-medium text-foreground">
                {profileTemplate ? getTemplateLabel(profileTemplate, t) : t(m.noProfileYet)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {readinessCards.map((card) => (
              <ReadinessCard key={card.title} {...card} />
            ))}
          </div>
        </div>

        <section className="rounded-xl border bg-card shadow-sm p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t(m.attentionHeading)}</h2>
          </div>
          {deviceAttentionItems.length > 0 ? (
            <div className="space-y-3">
              {deviceAttentionItems.map((item) =>
                item.actionLabel === m.registerDevice ? (
                  <Link
                    key={item.title.id}
                    to="/devices/register"
                    className="group block rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/20"
                  >
                    <div className="text-sm font-medium text-foreground">{t(item.title)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{t(item.detail)}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <span>{t(item.actionLabel)}</span>
                    </div>
                  </Link>
                ) : (
                  <button
                    key={item.title.id}
                    type="button"
                    onClick={item.action}
                    className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/20"
                  >
                    <div className="text-sm font-medium text-foreground">{t(item.title)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{t(item.detail)}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <span>{t(item.actionLabel)}</span>
                    </div>
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
              {t(m.attentionAllClear)}
            </div>
          )}
          <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {t(m.localDataNote)}
          </div>
        </section>
      </section>

      {/* Filter bar -- functional against the one real device we have */}
      <section className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card shadow-sm p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(m.searchDevicePlaceholder)}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>{t(m.filterLocationAll)}</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>{t(m.filterStatusAll)}</option>
        </select>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          disabled
        >
          <option>{t(m.filterConnectionAll)}</option>
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
          {t(m.registryLoadErrorBanner, { reason: registryError })}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t(m.registrySourceNote)}</span>
        <span>
          {registryLoading
            ? t(m.registryLoading)
            : t(m.devicesRegisteredCount, { count: registeredDevices.length })}
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
            const isActiveRuntime = status?.target?.deviceId === device.id;
            const cardStatus = !device.isActive
              ? t(m.cardInactive)
              : isActiveRuntime
                ? status?.online
                  ? t(m.statusConnected)
                  : t(m.statusOffline)
                : t(m.cardRegistered);
            const cardTone = isActiveRuntime
              ? status?.online
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground"
              : "bg-sky-500/10 text-sky-700";

            return (
              <button
                key={device.id}
                type="button"
                disabled={profileSaving || stateBusy || cameraOperationBusy}
                onClick={() => {
                  setStatus(null);
                  setCameraDetails(null);
                  setDetailsError(null);
                  setSelectedDeviceId(device.id);
                  syncProfileFromRegistryDevice(device, profile);
                }}
                className={`rounded-xl border bg-card shadow-sm p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/20 ${
                  isSelected ? "border-2 border-primary" : ""
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-semibold">{device.deviceName || t(m.unknownDevice)}</div>
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
                        ? t(m.usbConnected)
                        : t(m.notConnectedYet)
                      : t(m.runtimeFollowsActive)}
                  </div>
                  <div>
                    {rich(m.cardTemplate, {
                      value: (
                        <span className="font-medium text-foreground">
                          {getTemplateLabel(getTemplateById(device.templateId), t)}
                        </span>
                      ),
                    })}
                  </div>
                  <div>
                    {rich(m.cardDeviceCode, {
                      value: (
                        <span className="font-medium text-foreground">{device.deviceCode}</span>
                      ),
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">{t(m.cardStation)}</div>
                    <div className="font-semibold">{device.station || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t(m.cardCapturesToday)}</div>
                    <div className="font-semibold">
                      {isActiveRuntime ? (capturesToday ?? "—") : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t(m.cardCamera)}</div>
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
            ? t(m.emptyNoDevices)
            : t(m.emptyNoMatch, { query: searchQuery })}
        </div>
      )}

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">
            {selectedDevice?.deviceName ||
              profile?.deviceName ||
              status?.deviceId ||
              t(m.unknownDevice)}
          </span>
          <span
            className={`ml-1 h-2 w-2 rounded-full ${status?.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {selectedDevice && (
            <div className="ml-auto flex flex-wrap gap-2 text-xs">
              <Link
                to="/devices/register"
                search={{ deviceId: selectedDevice.id }}
                onClick={(event) => {
                  if (cameraOperationBusy || profileSaving) event.preventDefault();
                }}
                className="rounded-md border px-3 py-2"
              >
                {t(m.editDevice)}
              </Link>
              <button
                type="button"
                disabled={stateBusy || profileSaving || cameraOperationBusy}
                onClick={() =>
                  setPendingStateAction(selectedDevice.isActive ? "deactivate" : "activate")
                }
                className="rounded-md border px-3 py-2 disabled:opacity-50"
              >
                {selectedDevice.isActive ? t(m.deactivate) : t(m.activate)}
              </button>
              <button
                type="button"
                disabled={
                  stateBusy || profileSaving || cameraOperationBusy || selectedDevice.isActive
                }
                title={
                  selectedDevice.isActive ? t(m.deleteTitleDeactivateFirst) : t(m.deleteTitleRemove)
                }
                onClick={() => setPendingStateAction("delete")}
                className="rounded-md border px-3 py-2 text-destructive disabled:opacity-50"
              >
                {t(m.deleteDevice)}
              </button>
            </div>
          )}
        </div>

        <AlertDialog
          open={pendingStateAction !== null}
          onOpenChange={(open) => {
            if (!open && !stateBusy) setPendingStateAction(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingStateAction === "delete"
                  ? t(m.confirmDeleteTitle)
                  : pendingStateAction === "activate"
                    ? t(m.confirmActivateTitle)
                    : t(m.confirmDeactivateTitle)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedDevice?.deviceName} ({selectedDevice?.deviceCode}).{" "}
                {pendingStateAction === "delete"
                  ? t(m.confirmDeleteBody)
                  : pendingStateAction === "activate"
                    ? t(m.confirmActivateBody)
                    : t(m.confirmDeactivateBody)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={stateBusy || profileSaving || cameraOperationBusy}>
                {t(m.cancel)}
              </AlertDialogCancel>
              <button
                type="button"
                disabled={stateBusy || profileSaving || cameraOperationBusy}
                onClick={() => void confirmStateChange()}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {stateBusy ? t(m.saving) : t(m.confirm)}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {(detailsError || status?.statusMessage || !selectedDevice?.isActive) && (
          <p className="px-4 pt-3 text-xs text-muted-foreground" role="status">
            {!selectedDevice
              ? t(m.selectOrRegisterDevice)
              : !selectedDevice.isActive
                ? t(m.deviceInactiveNoCheck)
                : (detailsError ?? deviceStatusText(t, status))}
          </p>
        )}

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
              {t(tab.label)}
            </button>
          ))}
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {activeTab === "overview" && (
              <>
                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Package className="h-3.5 w-3.5" /> {t(m.deviceInfoHeading)}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">{t(m.deviceNameLabel)}</dt>
                    <dd className="text-right font-medium">{profile?.deviceName ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t(m.deviceCodeLabel)}</dt>
                    <dd className="text-right font-medium">
                      {selectedDevice?.deviceCode ?? profile?.deviceCode ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.edgeApiIdLabel)}</dt>
                    <dd className="text-right font-medium">{status?.deviceId ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t(m.agentVersionLabel)}</dt>
                    <dd className="text-right font-medium">{status?.agentVersion ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t(m.plantLocationLabel)}</dt>
                    <dd className="text-right font-medium">{profile?.plant ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t(m.binSourceLabel)}</dt>
                    <dd className="text-right font-medium">{profile?.bin ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t(m.scheduleLabel)}</dt>
                    <dd className="text-right font-medium">{profile?.schedule ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t(m.endpointAddressLabel)}</dt>
                    <dd className="text-right font-medium">
                      {status?.target?.host ??
                        deviceEndpointHost(
                          selectedDevice?.edgeApiUrl,
                          selectedDevice?.ipAddress,
                          t,
                        )}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t(m.osLabel, {
                        scope: telemetry?.identity.scope === "host" ? "host" : "runtime",
                      })}
                    </dt>
                    <dd className="text-right font-medium">
                      {telemetry?.identity.osName ?? t(m.notAvailable)}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t(m.hostnameLabel, {
                        scope: telemetry?.identity.scope === "host" ? "host" : "runtime",
                      })}
                    </dt>
                    <dd className="text-right font-medium">
                      {telemetry?.identity.hostname ?? t(m.notAvailable)}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t(m.networkAddressLabel, {
                        scope: telemetry?.network.scope === "host" ? "host" : "runtime",
                      })}
                    </dt>
                    <dd className="break-all text-right font-medium">
                      {telemetry?.network.addresses
                        .map((item) => `${item.interface}: ${item.address}`)
                        .join("; ") || t(m.notAvailable)}
                    </dd>
                  </dl>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Camera className="h-3.5 w-3.5" /> {t(m.cameraInfoHeading)}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">{t(m.cameraModelLabel)}</dt>
                    <dd className="text-right font-medium">
                      {selectedDevice?.cameraModel ?? cameraLabel}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.serialNumberLabel)}</dt>
                    <dd className="text-right font-medium">
                      {status?.camera?.serialNumber ?? selectedDevice?.serialNumber ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.firmwareVersionLabel)}</dt>
                    <dd className="text-right font-medium">
                      {status?.camera?.firmwareVersion ?? "—"}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.batteryPowerLabel)}</dt>
                    <dd className="text-right font-medium">
                      {cameraDetails?.batteryLevel != null
                        ? `${cameraDetails.batteryLevel}${typeof cameraDetails.batteryLevel === "number" ? "%" : ""}`
                        : missingCameraDetail}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.lensLabel)}</dt>
                    <dd className="text-right font-medium">
                      {cameraDetails?.lensName ?? missingCameraDetail}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.cameraStorageLabel)}</dt>
                    <dd className="text-right font-medium">
                      {cameraDetails?.storage.length
                        ? cameraDetails.storage
                            .map((store) =>
                              t(m.cameraStorageEntry, {
                                name: store.description,
                                free: (store.freeBytes / 1e9).toFixed(2),
                                total: (store.totalBytes / 1e9).toFixed(2),
                              }),
                            )
                            .join("; ")
                        : missingCameraDetail}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.usbConnectionLabel)}</dt>
                    <dd className="text-right font-medium">
                      {cameraConnected ? t(m.statusConnected) : t(m.notConnectedYet)}
                    </dd>
                  </dl>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Wifi className="h-3.5 w-3.5" /> {t(m.connectionStatusHeading)}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Edge API</dt>
                    <dd
                      className={`text-right font-medium ${status?.online ? "text-emerald-600" : ""}`}
                    >
                      {status?.online ? t(m.statusConnected) : t(m.statusNotConnected)}
                    </dd>
                    <dt className="text-muted-foreground">{t(m.cameraUsbLabel)}</dt>
                    <dd
                      className={`text-right font-medium ${cameraConnected ? "text-emerald-600" : ""}`}
                    >
                      {cameraConnected ? t(m.statusConnected) : t(m.notConnectedYet)}
                    </dd>
                  </dl>
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="mt-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {loading ? t(m.checking) : t(m.testConnection)}
                  </button>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Settings2 className="h-3.5 w-3.5" /> {t(m.quickActionsHeading)}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      m.quickRestartCamera,
                      m.quickRestartApi,
                      m.quickRestartMiniPc,
                      m.quickSyncSettings,
                    ].map((action) => (
                      <button
                        key={action.id}
                        disabled
                        title={t(m.notAvailableYet)}
                        className="rounded-md border border-input bg-muted px-2 py-1.5 text-xs opacity-50"
                      >
                        {t(action)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{t(m.remoteActionsNote)}</p>
                </div>
              </>
            )}

            {activeTab === "camera-settings" && (
              <CameraSettingsTab
                key={selectedDevice?.id ?? "none"}
                deviceId={selectedDevice?.id}
                profile={profile}
                deviceStatus={status}
                onSaveProfile={handleProfileSave}
                onOperationBusy={setCameraOperationBusy}
              />
            )}

            {activeTab === "health" && (
              <div className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Activity className="h-3.5 w-3.5" /> {t(m.deviceHealthHeading)}
                </h3>
                <DeviceTelemetryPanel
                  telemetry={telemetry}
                  loading={telemetryLoading}
                  error={telemetryError}
                />
              </div>
            )}

            {activeTab === "logs" && (
              <div className="rounded-md border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <FileText className="h-3.5 w-3.5" /> {t(lm.recentLogsHeading)}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={exportDeviceEventBundle}
                      disabled={visibleDeviceEvents.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" /> {t(lm.exportBundle)}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDeviceEvents("json")}
                      disabled={visibleDeviceEvents.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" /> {t(lm.exportJson)}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDeviceEvents("csv")}
                      disabled={visibleDeviceEvents.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" /> {t(lm.exportCsv)}
                    </button>
                    <button
                      type="button"
                      onClick={toggleDeviceEventAutoRefresh}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      {deviceEventAutoRefreshPaused ? t(lm.resumeSync) : t(lm.pauseSync)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        refreshDeviceLogPanel({
                          deviceCode: selectedDevice?.deviceCode ?? profile?.deviceCode ?? null,
                          resetPaging: true,
                          force: true,
                        });
                      }}
                      disabled={deviceEventsLoading}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                    >
                      {deviceEventsLoading ? t(lm.refreshing) : t(lm.refreshLog)}
                    </button>
                  </div>
                </div>
                {deviceEventAutoRefreshPaused ? (
                  <div className="mb-3 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {rich(lm.pausedNotice, {
                      button: <span className="font-semibold">{t(lm.refreshLog)}</span>,
                    })}
                  </div>
                ) : null}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {DEVICE_EVENT_PRESETS.map((preset) => {
                    const isActive = activeDeviceEventPreset?.id === preset.id;
                    const isErrorPreset = preset.severity === "error";

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyDeviceEventPreset(preset)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                          isActive
                            ? isErrorPreset
                              ? "border-destructive bg-destructive text-destructive-foreground"
                              : "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-accent"
                        }`}
                      >
                        {isErrorPreset ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                        <span>{t(preset.label)}</span>
                        <CountBadge
                          value={
                            preset.id === "error-latest"
                              ? pinnedErrorViewCount
                              : presetCounts[preset.id]
                          }
                          loading={deviceEventPresetServerCountsLoading}
                          className={
                            isActive
                              ? isErrorPreset
                                ? "bg-destructive-foreground/15 text-destructive-foreground"
                                : "bg-primary-foreground/15 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }
                        />
                      </button>
                    );
                  })}
                  {activeDeviceEventPreset ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceEventFilter("all");
                        setDeviceEventTypeFilter("all");
                        setDeviceEventTimeRange("all");
                        setDeviceEventSearchQuery("");
                        setDeviceEventCustomStart("");
                        setDeviceEventCustomEnd("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      {t(lm.resetFilter)}
                    </button>
                  ) : null}
                </div>
                <div className="mb-3 grid gap-2 xl:grid-cols-3">
                  {deviceEventSavedViews.map((view) => {
                    const isActive = activeDeviceSavedView?.id === view.id;

                    return (
                      <div
                        key={view.id}
                        className={`rounded-md border p-3 ${
                          isActive ? "border-primary bg-primary/5" : "bg-muted/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold">
                              {getDeviceEventSavedViewLabel(view, t)}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {t(DEVICE_EVENT_SAVED_VIEW_DESCRIPTIONS[view.id])}
                            </div>
                          </div>
                          <CountBadge
                            value={deviceEventSavedViewCounts[view.id]}
                            loading={deviceEventSavedViewServerCountsLoading}
                            className="bg-muted text-muted-foreground"
                          />
                        </div>
                        <div className="mt-2 min-h-[32px] text-[11px] text-muted-foreground">
                          {summarizeDeviceEventSavedView(view.state, t)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => applyDeviceEventSavedView(view.id)}
                            disabled={!view.state}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
                          >
                            {t(lm.use)}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveCurrentDeviceEventView(view.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                          >
                            {t(lm.saveCurrentFilter)}
                          </button>
                          <button
                            type="button"
                            onClick={() => renameDeviceEventSavedView(view.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                          >
                            {t(lm.rename)}
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateDeviceEventSavedView(view.id)}
                            disabled={!view.state}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
                          >
                            {t(lm.duplicateTo)}
                          </button>
                          <button
                            type="button"
                            onClick={() => clearDeviceEventSavedView(view.id)}
                            disabled={!view.state}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
                          >
                            {t(lm.clear)}
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {view.updatedAt
                            ? t(lm.updatedWhen, { when: formatRelativeTime(view.updatedAt, t) })
                            : t(lm.slotEmpty)}
                        </div>
                      </div>
                    );
                  })}
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
                      <span>{t(filter.label)}</span>
                      <CountBadge
                        value={eventCounts[filter.id]}
                        loading={deviceEventAggregatesLoading || isDeviceEventSearchDebouncing}
                        className={
                          deviceEventFilter === filter.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }
                      />
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
                      <span>{t(filter.label)}</span>
                      <CountBadge
                        value={eventTypeCounts[filter.id]}
                        loading={deviceEventAggregatesLoading || isDeviceEventSearchDebouncing}
                        className={
                          deviceEventTypeFilter === filter.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }
                      />
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {DEVICE_EVENT_TIME_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setDeviceEventTimeRange(filter.id);
                        if (
                          filter.id === "custom" &&
                          !deviceEventCustomStart &&
                          !deviceEventCustomEnd
                        ) {
                          const end = new Date();
                          const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
                          setDeviceEventCustomStart(formatDateTimeLocalValue(start));
                          setDeviceEventCustomEnd(formatDateTimeLocalValue(end));
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        deviceEventTimeRange === filter.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      <span>{t(filter.label)}</span>
                      <CountBadge
                        value={eventTimeCounts[filter.id]}
                        loading={deviceEventAggregatesLoading || isDeviceEventSearchDebouncing}
                        className={
                          deviceEventTimeRange === filter.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }
                      />
                    </button>
                  ))}
                </div>
                {deviceEventTimeRange === "custom" ? (
                  <div className="mb-3 grid gap-2 rounded-md border border-dashed bg-muted/20 p-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {t(lm.rangeFrom)}
                      </span>
                      <input
                        type="datetime-local"
                        value={deviceEventCustomStart}
                        onChange={(e) => setDeviceEventCustomStart(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {t(lm.rangeTo)}
                      </span>
                      <input
                        type="datetime-local"
                        value={deviceEventCustomEnd}
                        onChange={(e) => setDeviceEventCustomEnd(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <div className="md:col-span-2 text-[11px] text-muted-foreground">
                      {t(lm.auditActiveRange, { range: customRangeLabel })}
                    </div>
                  </div>
                ) : null}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={deviceEventSearchQuery}
                      onChange={(e) => setDeviceEventSearchQuery(e.target.value)}
                      placeholder={t(lm.searchLogPlaceholder)}
                      className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {isDeviceEventSearchDebouncing ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {t(lm.searchDebouncing)}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t(lm.showingSummary, {
                      shown: visibleDeviceEvents.length,
                      total: eventCounts[deviceEventFilter],
                      type: hasDeviceEventTypeFilter
                        ? t(lm.showingSummaryType, {
                            type: filterLabel(DEVICE_EVENT_TYPE_FILTERS, deviceEventTypeFilter, t),
                          })
                        : "",
                      range: hasDeviceEventTimeRangeFilter
                        ? t(lm.showingSummaryRange, {
                            range:
                              deviceEventTimeRange === "custom"
                                ? customRangeLabel
                                : filterLabel(DEVICE_EVENT_TIME_FILTERS, deviceEventTimeRange, t),
                          })
                        : "",
                      search: hasDeviceEventSearch
                        ? t(lm.showingSummarySearch, { query: deviceEventSearchQuery.trim() })
                        : "",
                    })}
                  </div>
                </div>
                {deviceEventsError ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                    {t(lm.logLoadErrorBanner, { reason: deviceEventsError })}
                  </div>
                ) : deviceEvents.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t(lm.logEmpty)}
                  </div>
                ) : visibleDeviceEvents.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t(hasDeviceEventSearch ? lm.logNoMatchWithSearch : lm.logNoMatch, {
                      severity:
                        deviceEventFilter !== "all"
                          ? t(lm.logNoMatchSeverity, { severity: deviceEventFilter.toUpperCase() })
                          : "",
                      type: hasDeviceEventTypeFilter
                        ? t(lm.logNoMatchType, {
                            type: filterLabel(DEVICE_EVENT_TYPE_FILTERS, deviceEventTypeFilter, t),
                          })
                        : "",
                      range: hasDeviceEventTimeRangeFilter
                        ? t(lm.logNoMatchRange, {
                            range:
                              deviceEventTimeRange === "custom"
                                ? customRangeLabel
                                : filterLabel(DEVICE_EVENT_TIME_FILTERS, deviceEventTimeRange, t),
                          })
                        : "",
                      query: deviceEventSearchQuery.trim(),
                    })}
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-[1.25fr_0.85fr]">
                    <div className="space-y-2">
                      <div className="sticky top-0 z-20 rounded-md border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t(lm.activeSummaryHeading)}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {t(lm.visibleOfTotal, {
                                shown: visibleDeviceEvents.length,
                                total: deviceEvents.length,
                              })}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {t(
                                canLoadMoreDeviceEvents
                                  ? lm.loadedSummaryMore
                                  : lm.loadedSummaryEnd,
                                { loaded: deviceEvents.length, step: DEVICE_EVENT_FETCH_STEP },
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 font-medium text-destructive">
                              {t(lm.severityErrorCount, {
                                count: visibleEventSeverityCounts.error,
                              })}
                            </span>
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 font-medium text-amber-700">
                              {t(lm.severityWarningCount, {
                                count: visibleEventSeverityCounts.warning,
                              })}
                            </span>
                            <span className="rounded-full border border-muted bg-muted/50 px-2.5 py-1 font-medium text-muted-foreground">
                              {t(lm.severityInfoCount, { count: visibleEventSeverityCounts.info })}
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
                              {t(lm.noExtraFilters)}
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
                                        formatDeviceEventLabel(event.eventType, t),
                                        deviceEventSearchQuery,
                                      )}
                                    </span>
                                    <StatusChip
                                      label={formatDeviceEventSeverity(event.severity, t)}
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
                                    {rich(lm.eventDevice, {
                                      name: highlightHistoryText(
                                        event.deviceName ?? event.deviceCode,
                                        deviceEventSearchQuery,
                                      ),
                                    })}
                                  </div>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDateTime(new Date(event.createdAt), locale)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        <span>
                          {canLoadMoreDeviceEvents ? t(lm.loadMoreHint) : t(lm.allLoaded)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleLoadMoreDeviceEvents()}
                          disabled={!canLoadMoreDeviceEvents || deviceEventsLoading}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                        >
                          {deviceEventsLoading ? t(lm.loadingShort) : t(lm.loadMore)}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                        {t(lm.eventDetailHeading)}
                      </h4>
                      {selectedDeviceEvent ? (
                        <div className="space-y-3 text-xs">
                          <div>
                            <div className="font-medium text-foreground">
                              {highlightHistoryText(
                                formatDeviceEventLabel(selectedDeviceEvent.eventType, t),
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
                            <dt className="text-muted-foreground">{t(lm.severityDt)}</dt>
                            <dd className="text-right">
                              <StatusChip
                                label={formatDeviceEventSeverity(selectedDeviceEvent.severity, t)}
                                tone={
                                  selectedDeviceEvent.severity === "error"
                                    ? "error"
                                    : selectedDeviceEvent.severity === "warning"
                                      ? "warning"
                                      : "muted"
                                }
                              />
                            </dd>
                            <dt className="text-muted-foreground">{t(lm.deviceDt)}</dt>
                            <dd className="text-right font-medium">
                              {highlightHistoryText(
                                selectedDeviceEvent.deviceName ?? selectedDeviceEvent.deviceCode,
                                deviceEventSearchQuery,
                              )}
                            </dd>
                            <dt className="text-muted-foreground">{t(lm.timeDt)}</dt>
                            <dd className="text-right font-medium">
                              {formatDateTime(new Date(selectedDeviceEvent.createdAt), locale)}
                            </dd>
                          </dl>
                          <div>
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t(lm.payloadHeading)}
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
                                        formatDeviceEventPayloadValue(value, t),
                                        deviceEventSearchQuery,
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : (
                              <div className="rounded-md border border-dashed bg-background px-3 py-2 text-muted-foreground">
                                {t(lm.payloadEmpty)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed bg-background px-3 py-8 text-center text-muted-foreground">
                          {t(lm.selectLogHint)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "configuration" && (
              <ConfigurationTab profile={profile} deviceId={selectedDevice?.id} />
            )}

            {activeTab === "fallback" && (
              <div className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <RotateCcw className="h-3.5 w-3.5" /> {t(m.tabFallback)}
                </h3>
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t(m.fallbackPrimary)}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{t(m.fallbackNote)}</p>
              </div>
            )}
          </div>

          {/* Live telemetry and camera settings remain separate from image QC. */}
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {t(m.deviceHealthHeading)}
              </h3>
              <DeviceTelemetryPanel
                telemetry={telemetry}
                loading={telemetryLoading}
                error={telemetryError}
              />
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {t(m.actualSettingsHeading)}
              </h3>
              <div className="space-y-1.5 text-xs">
                {(
                  [
                    [m.settingIso, "iso"],
                    [m.settingShutter, "shutterSpeed"],
                    [m.settingAperture, "aperture"],
                    [m.settingWhiteBalance, "whiteBalance"],
                    [m.settingFocusMode, "focusMode"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{t(label)}</span>
                    <span className="ml-2 text-right">
                      {cameraDetails?.settings
                        .find((setting) => setting.key === key)
                        ?.value?.toString() ?? missingCameraDetail}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t(m.actualSettingsNote)}</p>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {t(lm.latestLogHeading)}
              </h3>
              {deviceEventsError ? (
                <p className="text-xs text-muted-foreground">{t(lm.registryLogUnavailable)}</p>
              ) : latestDeviceEvent ? (
                <div className="space-y-1 text-xs">
                  <div className="font-medium text-foreground">
                    {formatDeviceEventLabel(latestDeviceEvent.eventType, t)}
                  </div>
                  <div className="text-muted-foreground">{latestDeviceEvent.message}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(new Date(latestDeviceEvent.createdAt).getTime(), t)}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t(lm.noRecentActivity)}</p>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground">
              {t(m.lastSyncColon, { when: lastSync ? formatDateTime(lastSync, locale) : "—" })}
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
  onOperationBusy,
  deviceId,
}: {
  deviceId?: number;
  profile: DeviceProfile | null;
  deviceStatus: DeviceStatus | null;
  onSaveProfile: (profile: DeviceProfile) => Promise<boolean>;
  onOperationBusy: (busy: boolean) => void;
}) {
  const t = useT();
  const rich = useRichT();
  const locale = useLocale();
  // Effect pemuat konfigurasi membaca penerjemah lewat ref, supaya berganti
  // bahasa tidak ikut membaca ulang konfigurasi kamera dari edge device.
  const translate = useRef(t);
  useEffect(() => {
    translate.current = t;
  }, [t]);
  const [templateId, setTemplateId] = useState(profile?.templateId ?? DEVICE_TEMPLATES[0].id);
  const [templateFilter, setTemplateFilter] = useState<PresetFilter>(PRESET_FILTERS[0]);
  const [compareTemplateId, setCompareTemplateId] = useState(
    DEVICE_TEMPLATES.find(
      (template) => template.id !== (profile?.templateId ?? DEVICE_TEMPLATES[0].id),
    )?.id ?? DEVICE_TEMPLATES[0].id,
  );
  const [schedule, setSchedule] = useState(profile?.schedule ?? DEVICE_SCHEDULES[1]);
  const [draft, setDraft] = useState<CameraSettings | null>(profile?.cameraSettings ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
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
      if (!deviceId || !deviceStatus?.online) {
        setEdgeConfigs([]);
        setEdgeConfigsLoading(false);
        setEdgeConfigsError(translate.current(cm.selectActiveDeviceForConfig));
        return;
      }
      setEdgeConfigsLoading(true);
      setEdgeConfigsError(null);
      const result = await listCameraConfigs({ data: { deviceId } });
      if (cancelled) return;
      if (!result.ok) {
        setEdgeConfigs([]);
        setEdgeConfigsError(failureText(translate.current, result));
      } else {
        setEdgeConfigs(result.items);
      }
      setEdgeConfigsLoading(false);
    }

    void loadEdgeConfigs().catch((error) => {
      if (!cancelled) {
        setEdgeConfigsError(
          error instanceof Error ? error.message : translate.current(cm.configLoadFailed),
        );
        setEdgeConfigsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deviceId, deviceStatus?.online]);

  if (!profile || !draft) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t(cm.registerFirstForProfile)}
      </div>
    );
  }

  function updateSetting<K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaveState("idle");
    setApplyState({ status: "idle", message: null });
  }

  function buildNextProfile() {
    if (!profile || !draft) return null;
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

  async function saveCameraProfile() {
    const next = buildNextProfile();
    return next ? saveSpecificCameraProfile(next) : null;
  }

  async function saveSpecificCameraProfile(nextProfile: DeviceProfile) {
    if (saveState === "saving") return null;
    setSaveState("saving");
    const saved = await onSaveProfile(nextProfile);
    setSaveState(saved ? "saved" : "idle");
    return saved ? nextProfile : null;
  }

  async function refreshEdgeConfigs() {
    setEdgeConfigsLoading(true);
    setEdgeConfigsError(null);
    const result = await listCameraConfigs({ data: { deviceId } });
    if (!result.ok) {
      setEdgeConfigs([]);
      setEdgeConfigsError(failureText(t, result));
    } else {
      setEdgeConfigs(result.items);
    }
    setEdgeConfigsLoading(false);
  }

  async function applyProfileToCamera(nextProfile: DeviceProfile) {
    onOperationBusy(true);
    try {
      await performProfileApply(nextProfile);
    } catch (error) {
      const message = error instanceof Error ? error.message : t(cm.applyFailedGeneric);
      setApplyState({ status: "failed", message });
      toast.error(message);
    } finally {
      onOperationBusy(false);
    }
  }

  async function performProfileApply(nextProfile: DeviceProfile) {
    setApplyState({
      status: "applying",
      message: t(cm.applyingStatus),
    });
    toast.message(t(cm.toastApplying), {
      description: t(cm.toastApplyingDesc),
    });

    const result = await upsertAndApplyEdgePreset({ data: { ...nextProfile, deviceId } });
    if (!result.ok) {
      setApplyState({
        status: "failed",
        message: failureText(t, result),
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
      toast.error(t(cm.toastApplyFailed), {
        description: failureText(t, result),
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
    const registrySaved = await onSaveProfile(syncedProfile);
    if (!registrySaved) {
      setApplyState({
        status: "failed",
        message: t(cm.appliedButRegistrySyncFailed),
      });
      return;
    }
    setApplyState({
      status: "applied",
      message: t(cm.appliedViaEdgeProfile, { name: result.edgeProfileName }),
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
    toast.success(t(cm.toastApplied), {
      description: t(cm.toastAppliedDesc, { name: result.edgeProfileName }),
    });
    await refreshEdgeConfigs();
  }

  async function applyPresetToCamera() {
    const nextProfile = await saveCameraProfile();
    if (!nextProfile) return;
    await applyProfileToCamera(nextProfile);
  }

  const configWriteSupported = !!deviceStatus?.capabilities.includes("configWrite");
  const canApplyPreset =
    saveState !== "saving" &&
    !!deviceStatus?.online &&
    !!deviceStatus.camera?.connected &&
    configWriteSupported &&
    applyState.status !== "applying";
  const applyActionHint =
    applyState.status === "applying"
      ? t(cm.hintApplying)
      : !deviceStatus?.online
        ? t(cm.hintEdgeUnreachable)
        : !deviceStatus.camera?.connected
          ? t(cm.hintCameraNotConnected)
          : !configWriteSupported
            ? t(cm.hintNoConfigWrite)
            : null;
  const applyStatusMeta =
    applyState.status === "applied"
      ? {
          label: t(cm.applyStatusApplied),
          detail: t(cm.applyStatusAppliedDetail),
          tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
          icon: CheckCircle2,
        }
      : applyState.status === "failed"
        ? {
            label: t(cm.applyStatusFailed),
            detail: applyState.message ?? t(cm.applyStatusFailedDetail),
            tone: "border-destructive/30 bg-destructive/10 text-destructive",
            icon: AlertTriangle,
          }
        : applyState.status === "applying"
          ? {
              label: t(cm.applyStatusApplying),
              detail: t(cm.applyStatusApplyingDetail),
              tone: "border-primary/30 bg-primary/10 text-primary",
              icon: RefreshCw,
            }
          : {
              label: canApplyPreset ? t(cm.applyStatusReady) : t(cm.applyStatusNotReady),
              detail: applyActionHint ?? t(cm.applyStatusIdleDetail),
              tone: canApplyPreset
                ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700",
              icon: canApplyPreset ? CheckCircle2 : AlertTriangle,
            };
  const applyChecklist = [
    {
      id: "edge",
      label: t(cm.checkEdgeReachable),
      done: !!deviceStatus?.online,
      detail: deviceStatus?.online ? t(cm.checkEdgeReachableDone) : t(cm.checkEdgeReachablePending),
    },
    {
      id: "camera",
      label: t(cm.checkCameraConnected),
      done: !!deviceStatus?.camera?.connected,
      detail: deviceStatus?.camera?.connected
        ? t(cm.checkCameraConnectedDone)
        : t(cm.checkCameraConnectedPending),
    },
    {
      id: "config-write",
      label: t(cm.checkConfigWrite),
      done: configWriteSupported,
      detail: configWriteSupported ? t(cm.checkConfigWriteDone) : t(cm.checkConfigWritePending),
    },
  ];
  const applyNextActions = [
    !deviceStatus?.online ? cm.nextRefreshStatus : null,
    deviceStatus?.online && !deviceStatus.camera?.connected ? cm.nextCheckCable : null,
    deviceStatus?.online && deviceStatus.camera?.connected && !configWriteSupported
      ? cm.nextConfigWriteMissing
      : null,
    canApplyPreset ? cm.nextReadyToApply : null,
  ].filter(Boolean) as Message[];
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
  const applyHistoryEmptyMessage = t(cm.historyNoMatch, {
    filter: t(APPLY_HISTORY_FILTER_LABELS[applyHistoryFilter]),
    quick: t(APPLY_HISTORY_QUICK_FILTER_LABELS[applyHistoryQuickFilter]),
  });
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
    { label: t(cm.fieldIso), localKey: "iso", edgeKey: "iso" },
    { label: t(cm.fieldShutterSpeed), localKey: "shutter", edgeKey: "shutterSpeed" },
    { label: t(cm.fieldAperture), localKey: "aperture", edgeKey: "aperture" },
    { label: t(cm.fieldWhiteBalance), localKey: "whiteBalance", edgeKey: "whiteBalance" },
    { label: t(cm.fieldFocusMode), localKey: "focusMode", edgeKey: "focusMode" },
    { label: t(cm.fieldPictureStyle), localKey: "pictureStyle", edgeKey: null },
  ];

  function getSupportLabel(edgeKey: string | null) {
    if (!edgeKey) return t(cm.supportNotMapped);
    const match = edgeConfigs.find((item) => item.key === edgeKey);
    if (!match) return t(cm.supportKeyNotExposed);
    if (!match.supported) return t(cm.supportReportedUnsupported);
    if (!match.writable) return t(cm.supportReadOnly);
    return t(cm.supportWritable);
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
    toast.success(t(cm.toastPresetChanged, { name: getTemplateLabel(nextTemplate, t) }), {
      description: t(cm.toastPresetChangedDesc),
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
    toast.success(t(cm.toastHistoryCleared), {
      description: t(cm.toastHistoryClearedDesc),
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

    toast.success(t(cm.toastHistoryExported, { format: format.toUpperCase() }), {
      description:
        scope === "all"
          ? t(cm.toastHistoryExportedAll, { count: entries.length })
          : t(cm.toastHistoryExportedFiltered, {
              filter: t(APPLY_HISTORY_FILTER_LABELS[applyHistoryFilter]),
              count: entries.length,
            }),
    });
  }

  async function applyTemplateImmediately(nextTemplateId: string) {
    if (!profile || !canApplyPreset) return;
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
    if (await saveSpecificCameraProfile(nextProfile)) await applyProfileToCamera(nextProfile);
  }

  return (
    <div className="rounded-md border p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Camera className="h-3.5 w-3.5" /> {t(cm.profileHeading)}
          </h3>
          <p className="text-xs text-muted-foreground">{t(cm.profileIntro)}</p>
        </div>
        <div className="flex max-w-md flex-col items-stretch gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void saveCameraProfile()}
              disabled={saveState === "saving"}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {t(cm.saveDeviceSettings)}
            </button>
            <button
              onClick={() => void applyPresetToCamera()}
              disabled={!canApplyPreset}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applyState.status === "applying" ? t(cm.applying) : t(cm.applyPresetToCamera)}
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
          <div className="font-medium text-foreground">{t(cm.edgeConfigWriteTitle)}</div>
          <div>{configWriteSupported ? t(cm.available) : t(cm.notAvailableYet)}</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{t(cm.cameraConnectionTitle)}</div>
          <div>
            {deviceStatus?.camera?.connected ? t(cm.usbConnected) : t(cm.cameraNotConnectedYet)}
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{t(cm.lastApplied)}</div>
          <div>
            {profile.edgeLastAppliedAt
              ? formatDateTime(new Date(profile.edgeLastAppliedAt), locale)
              : t(cm.neverApplied)}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t(cm.checklistHeading)}</h4>
          </div>
          <div className="space-y-2">
            {applyChecklist.map((item) => (
              <div key={item.id} className="rounded-md border bg-background px-3 py-2 text-xs">
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
            <h4 className="text-sm font-semibold">{t(cm.nextActionsHeading)}</h4>
          </div>
          <div className="space-y-2">
            {applyNextActions.map((item) => (
              <div
                key={item.id}
                className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
              >
                {t(item)}
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
          <label className="mb-1 block text-sm font-medium">{t(cm.templateLabel)}</label>
          <select
            value={templateId}
            onChange={(e) => {
              selectTemplate(e.target.value);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEVICE_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {getTemplateLabel(template, t)}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <PresetTemplatePreview template={activeTemplate} compact />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t(cm.captureScheduleLabel)}</label>
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
          <div>
            {t(cm.lastUpdated, { when: formatDateTime(new Date(profile.updatedAt), locale) })}
          </div>
        </div>
        <div className="md:col-span-3">
          <PresetTemplatePreview template={activeTemplate} />
        </div>
        <div className="md:col-span-3 rounded-md border bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t(cm.presetFilterHeading)}</div>
              <p className="text-xs text-muted-foreground">{t(cm.presetFilterIntro)}</p>
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
          <label className="mb-1 block text-sm font-medium">{t(cm.fieldShutterSpeed)}</label>
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
          <label className="mb-1 block text-sm font-medium">{t(cm.fieldAperture)}</label>
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
          <label className="mb-1 block text-sm font-medium">{t(cm.fieldWhiteBalance)}</label>
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
          <label className="mb-1 block text-sm font-medium">{t(cm.fieldPictureStyle)}</label>
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
          <label className="mb-1 block text-sm font-medium">{t(cm.fieldFocusMode)}</label>
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
          title={t(cm.presetComparisonTitle)}
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
            <h4 className="text-sm font-semibold">{t(cm.edgeSupportHeading)}</h4>
            <p className="text-xs text-muted-foreground">{t(cm.edgeSupportIntro)}</p>
          </div>
          <button
            onClick={() => void refreshEdgeConfigs()}
            disabled={edgeConfigsLoading}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
          >
            {edgeConfigsLoading ? t(cm.refreshing) : t(cm.refreshCameraConfig)}
          </button>
        </div>
        {edgeConfigsError && (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            {t(cm.edgeConfigReadFailed, { reason: edgeConfigsError })}
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {supportRows.map((row) => {
            const currentEdgeValue = row.edgeKey
              ? edgeConfigs.find((item) => item.key === row.edgeKey)?.value
              : null;
            return (
              <div key={row.localKey} className="rounded-md border bg-background px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{getSupportLabel(row.edgeKey)}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {rich(cm.supportTarget, {
                    value: (
                      <span className="font-medium text-foreground">
                        {String(draft[row.localKey])}
                      </span>
                    ),
                  })}
                </div>
                <div className="text-muted-foreground">
                  {rich(cm.supportCameraValue, {
                    value: (
                      <span className="font-medium text-foreground">
                        {currentEdgeValue === null || currentEdgeValue === undefined
                          ? "—"
                          : String(currentEdgeValue)}
                      </span>
                    ),
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-muted/20 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">{t(cm.historyHeading)}</h4>
            <p className="text-xs text-muted-foreground">{t(cm.historyIntro)}</p>
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
                  <span>{t(view.label)}</span>
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
              {t(activeSavedView?.description ?? cm.savedViewHint)}
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
                    <span>{t(APPLY_HISTORY_FILTER_LABELS[filter])}</span>
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
                  {t(cm.exportJson)}
                </button>
                <button
                  type="button"
                  onClick={() => exportApplyHistory("csv")}
                  disabled={visibleApplyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t(cm.exportCsv)}
                </button>
                <button
                  type="button"
                  onClick={() => exportApplyHistory("json", "all")}
                  disabled={applyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t(cm.exportAllJson)}
                </button>
                <button
                  type="button"
                  onClick={() => exportApplyHistory("csv", "all")}
                  disabled={applyHistory.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t(cm.exportAllCsv)}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={applyHistory.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t(cm.clearHistory)}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t(cm.clearHistoryTitle)}</AlertDialogTitle>
                      <AlertDialogDescription>{t(cm.clearHistoryBody)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t(cm.cancel)}</AlertDialogCancel>
                      <AlertDialogAction onClick={clearApplyHistoryEntries}>
                        {t(cm.clearHistoryConfirm)}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(cm.viewModeLabel)}
                </span>
                {isApplyHistoryCustomView ? (
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {t(cm.customView)}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    {t(cm.savedViewBadge)}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {isApplyHistoryCustomView
                    ? t(cm.customViewNote)
                    : t(cm.followsPreset, {
                        name: t(activeSavedView?.label ?? cm.historyViewAll),
                      })}
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
                      <span>{t(APPLY_HISTORY_QUICK_FILTER_LABELS[filter])}</span>
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
                    placeholder={t(cm.searchHistoryPlaceholder)}
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
                        {t(cm.sortBy, { order: t(APPLY_HISTORY_SORT_LABELS[option]) })}
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
            {t(cm.historyEmpty)}
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
                      {entry.status === "applied"
                        ? t(cm.historyFilterApplied)
                        : t(cm.historyFilterFailed)}
                    </span>
                  </div>
                  <span>{formatDateTime(new Date(entry.timestamp), locale)}</span>
                </div>
                <div className="mt-1">
                  {highlightHistoryText(entry.message, applyHistorySearch)}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    {rich(cm.historyEdgeProfile, {
                      value: (
                        <span className="font-medium text-foreground">
                          {entry.edgeProfileId
                            ? highlightHistoryText(entry.edgeProfileId, applyHistorySearch)
                            : "—"}
                        </span>
                      ),
                    })}
                  </span>
                  {entry.code && (
                    <span>
                      {rich(cm.historyCode, {
                        value: (
                          <span className="font-medium text-foreground">
                            {highlightHistoryText(entry.code, applyHistorySearch)}
                          </span>
                        ),
                      })}
                    </span>
                  )}
                  {entry.appliedKeys.length > 0 && (
                    <span>
                      {rich(cm.historyApplied, {
                        value: (
                          <span className="font-medium text-foreground">
                            {entry.appliedKeys.join(", ")}
                          </span>
                        ),
                      })}
                    </span>
                  )}
                  {entry.skippedKeys.length > 0 && (
                    <span>
                      {rich(cm.historySkipped, {
                        value: (
                          <span className="font-medium text-foreground">
                            {entry.skippedKeys.join(", ")}
                          </span>
                        ),
                      })}
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
            {saveState === "saved" ? t(cm.saveStatusSaved) : t(cm.saveStatusDirty)}
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
              {rich(cm.keysApplied, {
                value: (
                  <span className="font-medium text-foreground">
                    {applyState.appliedKeys.join(", ")}
                  </span>
                ),
              })}
            </div>
          )}
          {applyState.skippedKeys && applyState.skippedKeys.length > 0 && (
            <div className="text-muted-foreground">
              {rich(cm.keysSkipped, {
                value: (
                  <span className="font-medium text-foreground">
                    {applyState.skippedKeys.join(", ")}
                  </span>
                ),
              })}
            </div>
          )}
        </div>
        <Link
          to="/devices/register"
          search={{ deviceId }}
          className="rounded-md border border-input bg-background px-3 py-1.5 font-medium hover:bg-accent"
        >
          {t(cm.editRegistrationData)}
        </Link>
      </div>
    </div>
  );
}

function ConfigurationTab({
  profile,
  deviceId,
}: {
  profile: DeviceProfile | null;
  deviceId?: number;
}) {
  const t = useT();
  const [prefs, setPrefs] = useState<ReturnType<typeof loadPrefs> | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  return (
    <div className="rounded-md border p-4">
      <h3 className="mb-3 text-sm font-semibold">{t(m.configSummaryHeading)}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">{t(m.deviceProfileLabel)}</dt>
        <dd className="text-right font-medium">{profile?.deviceName ?? t(m.notRegisteredYet)}</dd>
        <dt className="text-muted-foreground">{t(m.plantBinLabel)}</dt>
        <dd className="text-right font-medium">
          {profile ? `${profile.plant} • ${profile.bin}` : "—"}
        </dd>
        <dt className="text-muted-foreground">{t(m.templateLabel)}</dt>
        <dd className="text-right font-medium">
          {profile ? getTemplateLabel(getTemplateById(profile.templateId), t) : "—"}
        </dd>
        <dt className="text-muted-foreground">{t(m.scheduleLabel)}</dt>
        <dd className="text-right font-medium">{profile?.schedule ?? "—"}</dd>
        <dt className="text-muted-foreground">{t(m.fileNameFormatLabel)}</dt>
        <dd className="text-right font-mono font-medium">{prefs?.pattern ?? "—"}</dd>
        <dt className="text-muted-foreground">{t(m.fileFormatLabel)}</dt>
        <dd className="text-right font-medium">{prefs?.ext?.toUpperCase() ?? "—"}</dd>
        <dt className="text-muted-foreground">{t(m.imageIndexLabel)}</dt>
        <dd className="text-right font-medium">
          {prefs ? String(prefs.counter).padStart(3, "0") : "—"}
        </dd>
        <dt className="text-muted-foreground">{t(m.saveFolderLabel)}</dt>
        <dd className="text-right font-medium">
          <NotAvailable />
        </dd>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">{t(m.configNote)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/devices/register"
          search={{ deviceId }}
          className="inline-block rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {t(m.editDeviceProfile)}
        </Link>
        <Link
          to="/capture"
          className="inline-block rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {t(m.editCapturePrefs)}
        </Link>
      </div>
    </div>
  );
}
