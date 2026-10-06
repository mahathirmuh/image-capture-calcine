import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Database,
  FolderOpen,
  Images,
  MapPin,
  Package,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import { type GalleryItem, loadGallery } from "@/lib/gallery-store";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import {
  getCaptureDashboardSummary,
  listDeviceEvents,
  type CaptureDashboardSummary,
  type DeviceEventView,
} from "@/lib/capture-records";
import { PLANTS, toBinSlot } from "@/lib/locations";
import { isAdminOnlyPath } from "@/lib/nav-items";
import { useIsAdmin } from "@/lib/use-session-user";
import { getStorageConfigSummary } from "@/lib/storage-diagnostics";
import { PageTitle } from "@/components/page-shell";
import { deviceStatusText } from "@/i18n/device-status";
import { dashboardMessages as m } from "@/i18n/dashboard";
import { failureText } from "@/i18n/errors";
import { useLocale, useT, type Message, type Translator } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Capture App" },
      {
        name: "description",
        content: "Ringkasan capture, status kamera, dan kesehatan device operasional.",
      },
      { property: "og:title", content: "Dashboard — Capture App" },
      {
        property: "og:description",
        content: "Ringkasan capture, status kamera, dan kesehatan device operasional.",
      },
    ],
  }),
});

// Fixed identity colors for the two-category comparisons below (location, bin).
// Validated against the dataviz skill's checks for the light chart surface:
// lightness band, chroma floor, CVD separation (deutan/protan ΔE 14.8-31.6,
// well above the 8 target), and contrast (both >=3:1). Matches this codebase's
// own precedent (gallery.tsx's HistogramChart) of fixed identity hex rather
// than theme-variable colors for small hand-rolled charts.
const COLOR_A = "#f54900";
const COLOR_B = "#009689";

const DAY_LABELS: Message[] = [
  m.daySun,
  m.dayMon,
  m.dayTue,
  m.dayWed,
  m.dayThu,
  m.dayFri,
  m.daySat,
];
const SSR_SAFE_DAY = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatDateTime(ts: number, locale: string) {
  const date = new Date(ts);
  const datePart = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart}, ${timePart}`;
}

function formatDashboardBin(bin?: string | null): string {
  if (!bin) return "—";
  const normalized = bin.trim().toUpperCase();
  if (normalized === "BIN1" || normalized === "BIN 1") return "BIN 1";
  if (normalized === "BIN2" || normalized === "BIN 2") return "BIN 2";
  if (normalized === "BIN 1 / BIN 2" || normalized === "BIN1/BIN2") return "BIN 1 / BIN 2";
  return bin;
}

function formatDeviceEventLabel(eventType: string, t: Translator): string {
  const labels: Record<string, Message> = {
    "metadata-finalized": m.eventMetadataFinalized,
    "capture-trigger-failed": m.eventCaptureTriggerFailed,
    "capture-job-failed": m.eventCaptureJobFailed,
    "capture-missing-asset": m.eventCaptureMissingAsset,
    "capture-exception": m.eventCaptureException,
    "autofocus-trigger-failed": m.eventAutofocusTriggerFailed,
    "autofocus-job-failed": m.eventAutofocusJobFailed,
    "autofocus-exception": m.eventAutofocusException,
    "network-save-fallback": m.eventNetworkSaveFallback,
    "folder-save-fallback": m.eventFolderSaveFallback,
    "browser-download-fallback": m.eventBrowserDownloadFallback,
    "capture-record-sync-failed": m.eventCaptureRecordSyncFailed,
  };
  const label = labels[eventType];
  return label ? t(label) : eventType;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function NotAvailable() {
  const t = useT();
  return <span className="text-muted-foreground">{t(m.notAvailable)}</span>;
}

// Metronic-style KPI tile: a colored icon box, not just an inline icon+label
// row. Tone is a deliberate signal, not decoration -- "muted" is the honest
// default for anything that isn't confirmed good, so a card never looks
// cheerfully colored while reporting bad/unknown status (see the Camera tile,
// which picks its tone from the real connection state below).
const STAT_TONES = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  muted: "bg-muted text-muted-foreground",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <span
        className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

function ActionCard({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border bg-card shadow-sm p-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

// Two-category comparison row (used for Location and Bin breakdowns): a
// direct-labeled proportion bar per category, scaled against whichever
// category has the higher count. Two categories are small enough that direct
// labels on every row is the right call, not a violation of "never label
// every point" (that rule targets dense point/line charts, not a 2-row
// breakdown).
function CompareRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const t = useT();
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{t(m.compareCount, { count, pct })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

type DayBucket = { date: Date; label: string; count: number };
type StorageConfigSummary = Awaited<ReturnType<typeof getStorageConfigSummary>>;
// Kegagalan server function disimpan utuh (kode + pesan), bukan teksnya saja,
// supaya teks yang tampil mengikuti bahasa yang sedang dipakai.
type ServerFailure = { code?: string | null; message?: string | null };

function formatRelativeTime(date: Date | null, t: Translator) {
  if (!date) return t(m.relativeNotChecked);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return t(m.relativeJustNow);
  if (diffMinutes < 60) return t(m.relativeMinutes, { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t(m.relativeHours, { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return t(m.relativeDays, { count: diffDays });
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${classes}`}>
      {children}
    </span>
  );
}

function InsightCard({
  title,
  status,
  description,
  detail,
  to,
  cta,
  icon: Icon,
  tone,
}: {
  title: string;
  status: string;
  description: string;
  detail: string;
  // Null berarti pembacanya tidak berhak membuka halaman tujuannya. Kartunya
  // tetap tampil -- "edge device offline" perlu diketahui operator juga -- yang
  // hilang cuma ajakan menuju halaman yang akan menolaknya.
  to: string | null;
  cta: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "muted";
}) {
  const isi = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-3 text-[11px] text-muted-foreground/80">{detail}</p>
      {to && cta && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
          <span>{cta}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </>
  );

  const kelas =
    "rounded-xl border bg-card shadow-sm p-4 transition-colors" +
    (to ? " group hover:border-primary/40 hover:bg-accent/20" : "");

  return to ? (
    <Link to={to} className={`group ${kelas}`}>
      {isi}
    </Link>
  ) : (
    <div className={kelas}>{isi}</div>
  );
}

function WeekTrendChart({ days }: { days: DayBucket[] }) {
  const t = useT();
  const locale = useLocale();
  const width = 560;
  const height = 140;
  const padBottom = 24;
  const padTop = 20;
  const plotH = height - padBottom - padTop;
  const gap = 12;
  const barW = (width - gap * (days.length - 1)) / days.length;
  const max = Math.max(1, ...days.map((d) => d.count));
  const [hover, setHover] = useState<number | null>(null);

  function barPath(x: number, y: number, w: number, h: number, r: number) {
    if (h <= 0) return "";
    const rad = Math.min(r, w / 2, h);
    return `M${x},${y + h} V${y + rad} Q${x},${y} ${x + rad},${y} H${x + w - rad} Q${x + w},${y} ${x + w},${y + rad} V${y + h} Z`;
  }

  const todayIdx = days.length - 1;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full overflow-visible">
        {/* baseline */}
        <line
          x1="0"
          y1={height - padBottom}
          x2={width}
          y2={height - padBottom}
          className="stroke-border"
          strokeWidth="1"
        />
        {days.map((d, i) => {
          const x = i * (barW + gap);
          const h = (d.count / max) * plotH;
          const y = height - padBottom - h;
          const isHover = hover === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h2) => (h2 === i ? null : h2))}
              className="cursor-default"
            >
              {/* invisible full-height hit target, taller than the bar itself */}
              <rect
                x={x}
                y={padTop}
                width={barW}
                height={height - padBottom - padTop}
                fill="transparent"
              />
              {d.count > 0 ? (
                <path
                  d={barPath(x, y, barW, h, 4)}
                  className="fill-primary"
                  opacity={isHover ? 1 : 0.85}
                />
              ) : (
                <rect
                  x={x}
                  y={height - padBottom - 2}
                  width={barW}
                  height={2}
                  className="fill-border"
                />
              )}
              {/* selective direct label: only today's bar, plus whichever bar is hovered */}
              {(i === todayIdx || isHover) && d.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-semibold"
                >
                  {d.count}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{
            left: `${((hover * (barW + gap) + barW / 2) / width) * 100}%`,
            // Center on the bar, except at the two edges where centering would
            // push the tooltip past the card's boundary -- the last bar is
            // always "today", the one visitors hover most, so this isn't a
            // rare edge case to shrug off.
            transform:
              hover === 0
                ? "translate(0, -100%)"
                : hover === days.length - 1
                  ? "translate(-100%, -100%)"
                  : "translate(-50%, -100%)",
          }}
        >
          <div className="font-medium">
            {days[hover].date.toLocaleDateString(locale, {
              weekday: "long",
              day: "2-digit",
              month: "short",
            })}
          </div>
          <div className="text-muted-foreground">
            {t(m.captureCount, { count: days[hover].count })}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const isAdmin = useIsAdmin();
  const t = useT();
  const locale = useLocale();

  /**
   * Tujuan tautan, atau null kalau pembacanya tidak berhak membukanya.
   *
   * Kartu peringatan di halaman ini menunjuk ke Devices dan Storage, dan
   * keduanya kini khusus Super Admin. Membiarkan tautannya berarti operator
   * menekan "Buka Devices" lalu dipantulkan kembali ke sini tanpa penjelasan --
   * isi peringatannya tetap berguna baginya, ajakan menekannya tidak.
   */
  const jalur = (to: string) => (isAdmin || !isAdminOnlyPath(to) ? to : null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [storageConfig, setStorageConfig] = useState<StorageConfigSummary | null>(null);
  const [captureDbSummary, setCaptureDbSummary] = useState<CaptureDashboardSummary | null>(null);
  const [captureDbFailure, setCaptureDbFailure] = useState<ServerFailure | null>(null);
  const [deviceEvents, setDeviceEvents] = useState<DeviceEventView[]>([]);
  const [deviceEventsFailure, setDeviceEventsFailure] = useState<ServerFailure | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const now = new Date();
      const dayStart = startOfDay(now);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const weekStart = new Date(dayStart);
      weekStart.setDate(weekStart.getDate() - 6);
      const [items, deviceStatus, storageSummary, dbSummaryResult, deviceEventsResult] =
        await Promise.all([
          loadGallery(),
          getDeviceStatus(),
          getStorageConfigSummary(),
          getCaptureDashboardSummary({
            data: {
              dayStart: dayStart.getTime(),
              dayEnd: dayEnd.getTime(),
              weekStart: weekStart.getTime(),
              recentLimit: 6,
            },
          }),
          listDeviceEvents({
            data: {
              limit: 5,
            },
          }),
        ]);
      setGallery(items);
      setStatus(deviceStatus);
      setStorageConfig(storageSummary);
      if (dbSummaryResult.ok) {
        setCaptureDbSummary(dbSummaryResult.summary);
        setCaptureDbFailure(null);
      } else {
        setCaptureDbSummary(null);
        setCaptureDbFailure(dbSummaryResult);
      }
      if (deviceEventsResult.ok) {
        setDeviceEvents(deviceEventsResult.events);
        setDeviceEventsFailure(null);
      } else {
        setDeviceEvents([]);
        setDeviceEventsFailure(deviceEventsResult);
      }
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setHydrated(true);
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    setToday(dayStart);
    setLoading(true);
    Promise.all([
      loadGallery(),
      getDeviceStatus(),
      getStorageConfigSummary(),
      getCaptureDashboardSummary({
        data: {
          dayStart: dayStart.getTime(),
          dayEnd: dayEnd.getTime(),
          weekStart: weekStart.getTime(),
          recentLimit: 6,
        },
      }),
      listDeviceEvents({
        data: {
          limit: 5,
        },
      }),
    ]).then(([items, deviceStatus, storageSummary, dbSummaryResult, deviceEventsResult]) => {
      if (cancelled) return;
      setGallery(items);
      setStatus(deviceStatus);
      setStorageConfig(storageSummary);
      if (dbSummaryResult.ok) {
        setCaptureDbSummary(dbSummaryResult.summary);
        setCaptureDbFailure(null);
      } else {
        setCaptureDbSummary(null);
        setCaptureDbFailure(dbSummaryResult);
      }
      if (deviceEventsResult.ok) {
        setDeviceEvents(deviceEventsResult.events);
        setDeviceEventsFailure(null);
      } else {
        setDeviceEvents([]);
        setDeviceEventsFailure(deviceEventsResult);
      }
      setLastRefreshed(new Date());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const captureDbError = captureDbFailure ? failureText(t, captureDbFailure) : null;
  const deviceEventsError = deviceEventsFailure ? failureText(t, deviceEventsFailure) : null;

  const effectiveToday = today ?? SSR_SAFE_DAY;

  // SEMUA hitungan capture kini berasal dari registry MSSQL, bukan dari
  // IndexedDB browser ini.
  //
  // Sebelumnya angka-angka di halaman ini dihitung dari `gallery` -- isi
  // penyimpanan browser yang sedang dipakai. Akibatnya dashboard yang sama
  // menunjukkan angka berbeda di tiap PC, dan bahkan menampilkan "Capture Hari
  // Ini" DUA KALI dengan nilai yang bisa berselisih: satu versi browser, satu
  // versi registry. Angka yang berubah tergantung siapa yang membukanya tidak
  // bisa dipakai mengambil keputusan.
  //
  // `gallery` masih dibaca, tapi kini hanya untuk apa adanya: berapa banyak
  // salinan yang menumpuk di browser ini. Itu keterangan diagnostik, bukan
  // ukuran produksi.
  const capturesToday = captureDbSummary?.todayCount ?? 0;
  const totalCaptures = captureDbSummary?.totalCount ?? 0;
  const totalBytes = captureDbSummary?.totalBytes ?? 0;
  const localCopyCount = gallery.length;
  const localCopyBytes = gallery.reduce((sum, item) => sum + item.blob.size, 0);
  const cameraConnected = !!status?.camera?.connected;
  const cameraLabel = status?.camera
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") ||
      t(m.modelUnknown)
    : t(m.notDetected);

  // Urutan plant tetap mengikuti daftar tetap aplikasi, bukan diurutkan menurut
  // jumlah: baris dan warnanya harus stabil supaya perubahan angka terbaca
  // sebagai perubahan angka, bukan sebagai baris yang berpindah tempat.
  const plantTally = new Map(captureDbSummary?.byPlant.map((row) => [row.plant, row.count]) ?? []);
  const locationCounts = PLANTS.map((plant) => ({
    label: plant,
    count: plantTally.get(plant) ?? 0,
  }));
  const otherLocationCount = [...plantTally.entries()]
    .filter(([plant]) => !PLANTS.includes(plant as (typeof PLANTS)[number]))
    .reduce((sum, [, count]) => sum + count, 0);

  // captureBin di registry tersimpan sebagai LABEL, bukan token: "BIN 1",
  // "TRAIN 1", "TRAIN 2" -- dan record lama Acid Plant masih memakai kosakata
  // BIN dari sebelum istilahnya dibetulkan. toBinSlot() mengerti keduanya, jadi
  // penjumlahannya dilakukan atas SLOT, bukan atas teksnya.
  let bin1Count = 0;
  let bin2Count = 0;
  for (const row of captureDbSummary?.byBin ?? []) {
    const slot = toBinSlot(row.bin);
    if (slot === 1) bin1Count += row.count;
    else if (slot === 2) bin2Count += row.count;
  }
  const unspecifiedBinCount = Math.max(0, totalCaptures - bin1Count - bin2Count);

  // Tujuh hari terakhir, terlama di kiri. Keranjangnya dihitung SQL relatif
  // terhadap tengah malam LOKAL yang dikirim halaman ini, jadi batas harinya
  // sama dengan yang dilihat operator -- bukan batas hari UTC, yang akan
  // menggeser sesi 02.00 WITA ke hari sebelumnya.
  const dailyTally = new Map(captureDbSummary?.daily.map((row) => [row.dayIndex, row.count]) ?? []);
  const days: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(effectiveToday);
    d.setDate(d.getDate() - (6 - i));
    return { date: d, label: t(DAY_LABELS[d.getDay()]), count: dailyTally.get(i) ?? 0 };
  });
  const weekTotal = captureDbSummary?.weekCount ?? 0;

  const recent = captureDbSummary?.recentRecords ?? [];
  const latestCapture = recent[0] ?? null;
  const latestCaptureDate = latestCapture ? new Date(latestCapture.capturedAt) : null;
  const latestDbCaptureDate = captureDbSummary?.lastCapturedAt
    ? new Date(captureDbSummary.lastCapturedAt)
    : null;
  const latestDeviceEvent = deviceEvents[0] ?? null;
  const latestDeviceEventDate = latestDeviceEvent ? new Date(latestDeviceEvent.createdAt) : null;
  // Plant yang sudah punya capture hari ini -- dibaca dari record terbaru
  // registry, bukan dari isi browser. Kalau dihitung dari browser, plant yang
  // di-capture operator LAIN tidak akan pernah terhitung tercakup.
  const plantsCoveredToday = new Set(
    today
      ? recent
          .filter((record) => new Date(record.capturedAt).getTime() >= today.getTime())
          .map((record) => record.plant)
          .filter(Boolean)
      : [],
  ).size;
  const readinessTone = !status?.online
    ? "text-destructive"
    : cameraConnected
      ? "text-emerald-600"
      : "text-amber-600";
  const readinessLabel = !status?.online
    ? t(m.readinessAttention)
    : cameraConnected
      ? t(m.readinessReady)
      : t(m.readinessCameraCheck);
  const operationalNotes = [
    !status?.online ? t(m.noteEdgeUnreachable) : null,
    status?.online && !cameraConnected ? t(m.noteCameraNotReady) : null,
    capturesToday === 0 ? t(m.noteNoCaptureToday) : null,
    latestCaptureDate
      ? t(m.noteLastCaptureSaved, { time: formatDateTime(latestCaptureDate.getTime(), locale) })
      : t(m.noteNoCaptureInRegistry),
    captureDbError
      ? t(m.noteRegistryLoadFailed, { reason: captureDbError })
      : captureDbSummary?.lastCapturedAt
        ? t(m.noteRegistryLastCapture, { when: formatRelativeTime(latestDbCaptureDate, t) })
        : t(m.noteNoMetadata),
    deviceEventsError
      ? t(m.noteDeviceLogLoadFailed, { reason: deviceEventsError })
      : latestDeviceEvent
        ? t(m.noteLatestDeviceEvent, {
            when: formatRelativeTime(latestDeviceEventDate, t),
            event: formatDeviceEventLabel(latestDeviceEvent.eventType, t),
          })
        : t(m.noteNoDeviceEvent),
  ].filter(Boolean) as string[];
  const freshnessCards = [
    {
      title: t(m.historyTitle),
      status: latestCapture ? t(m.historyHasCapture) : t(m.historyNoCapture),
      description: latestCapture
        ? t(m.historyLastCapture, { when: formatRelativeTime(latestCaptureDate, t) })
        : t(m.historyEmpty),
      detail: latestCapture
        ? t(m.historyRecordsReady, { count: recent.length })
        : t(m.historyStartHint),
      to: "/gallery",
      cta: t(m.openGallery),
      icon: Images,
      tone: latestCapture ? ("success" as const) : ("warning" as const),
    },
    {
      title: t(m.edgeTitle),
      status: status?.online ? t(m.connected) : t(m.offline),
      description: status?.online
        ? t(m.edgeStatusUpdated, { when: formatRelativeTime(lastRefreshed, t) })
        : (deviceStatusText(t, status) ?? t(m.edgeUnreachableAtRefresh)),
      detail: status?.online
        ? t(cameraConnected ? m.edgeStateCameraConnected : m.edgeStateCameraNotReady, {
            state: status.connectionState ?? "unknown",
          })
        : t(m.edgeOfflineHint),
      to: "/devices",
      cta: t(m.openDevices),
      icon: Wifi,
      tone: status?.online ? ("success" as const) : ("warning" as const),
    },
    {
      title: t(m.registryTitle),
      status: captureDbSummary?.lastCapturedAt
        ? t(m.registryRecorded)
        : captureDbError
          ? t(m.registryNeedsCheck)
          : t(m.registryNoLog),
      description: captureDbSummary?.lastCapturedAt
        ? t(m.registryLastCapture, { when: formatRelativeTime(latestDbCaptureDate, t) })
        : captureDbError
          ? t(m.registryLoadFailed)
          : t(m.registryNoMetadata),
      detail: captureDbSummary
        ? t(m.registryCounts, {
            today: captureDbSummary.todayCount,
            total: captureDbSummary.totalCount,
          })
        : captureDbError || t(m.registryPendingHint),
      to: "/gallery",
      cta: t(m.auditRegistry),
      icon: Database,
      tone: captureDbSummary?.lastCapturedAt
        ? ("success" as const)
        : captureDbError
          ? ("warning" as const)
          : ("muted" as const),
    },
    {
      title: t(m.autoSaveTitle),
      status: storageConfig?.configured ? t(m.autoSaveConfigured) : t(m.autoSaveNeedsSetup),
      description: storageConfig?.configured ? t(m.autoSaveLoaded) : t(m.autoSaveMissing),
      detail: storageConfig?.targetRoot ? storageConfig.targetRoot : t(m.autoSaveHint),
      to: "/storage",
      cta: t(m.openStorage),
      icon: FolderOpen,
      tone: storageConfig?.configured ? ("success" as const) : ("warning" as const),
    },
  ];
  const attentionItems = [
    !status?.online
      ? {
          title: t(m.attentionEdgeOfflineTitle),
          detail: t(m.attentionEdgeOfflineDetail),
          to: "/devices",
          cta: t(m.openDevices),
        }
      : null,
    status?.online && !cameraConnected
      ? {
          title: t(m.attentionCameraTitle),
          detail: t(m.attentionCameraDetail),
          to: "/devices",
          cta: t(m.checkCameraStatus),
        }
      : null,
    !storageConfig?.configured
      ? {
          title: t(m.attentionStorageTitle),
          detail: t(m.attentionStorageDetail),
          to: "/storage",
          cta: t(m.configureStorage),
        }
      : null,
    captureDbError
      ? {
          title: t(m.attentionRegistryTitle),
          detail: t(m.attentionRegistryDetail),
          to: "/gallery",
          cta: t(m.checkGallery),
        }
      : null,
    capturesToday === 0
      ? {
          title: t(m.attentionNoCaptureTitle),
          detail: t(m.attentionNoCaptureDetail),
          to: "/capture",
          cta: t(m.openCapture),
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; to: string; cta: string }>;

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle title={t(m.pageTitle)} description={t(m.pageDescription)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {lastRefreshed
              ? t(m.updatedAt, { time: formatDateTime(lastRefreshed.getTime(), locale) })
              : ""}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            title={t(m.refresh)}
            className="rounded-md border border-input bg-background p-2 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(m.snapshotEyebrow)}
              </div>
              <h2 className={`mt-1 text-xl font-semibold ${readinessTone}`}>{readinessLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {cameraConnected
                  ? t(m.snapshotCameraReady)
                  : status?.online
                    ? t(m.snapshotCameraAttention)
                    : t(m.snapshotEdgeUnconfirmed)}
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-right text-xs">
              <div className="text-muted-foreground">{t(m.lastCapture)}</div>
              <div className="mt-1 font-medium text-foreground">
                {latestCaptureDate ? formatDateTime(latestCaptureDate.getTime(), locale) : "—"}
              </div>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">{t(m.capturesThisWeek)}</div>
              <div className="mt-1 text-lg font-semibold">{weekTotal}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">{t(m.plantsCoveredToday)}</div>
              <div className="mt-1 text-lg font-semibold">{plantsCoveredToday}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              {/* Ini memang angka LOKAL, dan disebut begitu. Berguna karena
                  IndexedDB punya kuota; menyamarkannya sebagai ukuran produksi
                  justru yang keliru selama ini. */}
              <div className="text-xs text-muted-foreground">{t(m.localCopies)}</div>
              <div className="mt-1 text-lg font-semibold">
                {hydrated ? t(m.photoCount, { count: localCopyCount }) : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {hydrated ? formatBytes(localCopyBytes) : "—"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionCard
              to="/capture"
              title={t(m.openCapture)}
              description={t(m.actionCaptureDescription)}
              icon={Camera}
            />
            <ActionCard
              to="/gallery"
              title={t(m.reviewGallery)}
              description={t(m.actionGalleryDescription)}
              icon={Images}
            />
            {isAdmin && (
              <ActionCard
                to="/storage"
                title={t(m.checkStorage)}
                description={t(m.actionStorageDescription)}
                icon={FolderOpen}
              />
            )}
            {isAdmin && (
              <ActionCard
                to="/settings"
                title={t(m.operatorSettings)}
                description={t(m.actionSettingsDescription)}
                icon={Settings2}
              />
            )}
          </div>
        </div>

        <section className="rounded-xl border bg-card shadow-sm p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t(m.attentionHeading)}</h2>
          </div>
          {attentionItems.length > 0 ? (
            <div className="space-y-3">
              {attentionItems.map((item) => {
                const tujuan = jalur(item.to);
                const isi = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                      </div>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    </div>
                    {tujuan && (
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <span>{item.cta}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    )}
                  </>
                );

                return tujuan ? (
                  <Link
                    key={item.title}
                    to={tujuan}
                    className="group block rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/20"
                  >
                    {isi}
                  </Link>
                ) : (
                  <div key={item.title} className="block rounded-lg border bg-background p-3">
                    {isi}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {t(m.operationallyReady)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t(m.operationallyReadyDetail)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {operationalNotes.map((note) => (
              <div
                key={note}
                className="rounded-lg border bg-background p-3 text-sm text-muted-foreground"
              >
                {note}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {t(m.sourceNote)}
          </div>
        </section>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-4">
        {freshnessCards.map((card) => {
          const tujuan = jalur(card.to);
          return (
            <InsightCard key={card.title} {...card} to={tujuan} cta={tujuan ? card.cta : null} />
          );
        })}
      </section>

      {/* KPI row */}
      {/* Empat kartu, bukan lima. Dua di antaranya dulu menghitung hal yang
          sama dari dua sumber -- "Capture Hari Ini" versi browser berdampingan
          dengan "Capture DB Hari Ini" versi registry, dua angka untuk satu
          pertanyaan. Yang tersisa satu, dan sumbernya registry. */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Images}
          label={t(m.totalCaptures)}
          value={captureDbSummary ? totalCaptures : "—"}
          sub={
            captureDbError
              ? t(m.registryUnreadable)
              : captureDbSummary
                ? t(m.allTimeAllPlants)
                : t(m.waitingForRegistry)
          }
          tone={captureDbError ? "amber" : "primary"}
        />
        <StatCard
          icon={Camera}
          label={t(m.capturesToday)}
          value={captureDbSummary ? capturesToday : "—"}
          sub={
            hydrated && today
              ? today.toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : t(m.operatorLocalDate)
          }
          tone="sky"
        />
        <StatCard
          icon={Wifi}
          label={t(m.camera)}
          value={
            status?.online ? (cameraConnected ? t(m.connected) : t(m.sessionActive)) : t(m.offline)
          }
          sub={status?.online ? cameraLabel : (deviceStatusText(t, status) ?? cameraLabel)}
          tone={cameraConnected ? "emerald" : status?.online ? "amber" : "muted"}
        />
        <StatCard
          icon={Database}
          label={t(m.recordedSize)}
          value={captureDbSummary ? formatBytes(totalBytes) : "—"}
          sub={t(m.recordedSizeHint)}
          tone="emerald"
        />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Captures by Location */}
        <section className="rounded-xl border bg-card shadow-sm p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" /> {t(m.byLocation)}
          </h2>
          {totalCaptures === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(m.noCaptures)}</p>
          ) : (
            <div className="space-y-3">
              {locationCounts.map((row, i) => (
                <CompareRow
                  key={row.label}
                  label={row.label}
                  count={row.count}
                  total={totalCaptures}
                  color={i === 0 ? COLOR_A : COLOR_B}
                />
              ))}
              {otherLocationCount > 0 && (
                <CompareRow
                  label={t(m.otherLocation)}
                  count={otherLocationCount}
                  total={totalCaptures}
                  color="var(--color-muted-foreground)"
                />
              )}
            </div>
          )}
        </section>

        {/* Captures by Bin */}
        <section className="rounded-xl border bg-card shadow-sm p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" /> {t(m.byBin)}
          </h2>
          {totalCaptures === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(m.noCaptures)}</p>
          ) : (
            <div className="space-y-3">
              <CompareRow label="BIN 1" count={bin1Count} total={totalCaptures} color={COLOR_A} />
              <CompareRow label="BIN 2" count={bin2Count} total={totalCaptures} color={COLOR_B} />
              {unspecifiedBinCount > 0 && (
                <CompareRow
                  label={t(m.unspecified)}
                  count={unspecifiedBinCount}
                  total={totalCaptures}
                  color="var(--color-muted-foreground)"
                />
              )}
            </div>
          )}
        </section>
      </div>

      {/* Last 7 days trend */}
      <section className="mb-6 rounded-xl border bg-card shadow-sm p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t(m.last7Days)}</h2>
          <span className="text-xs text-muted-foreground">
            {t(m.capturesThisWeekCount, { count: weekTotal })}
          </span>
        </div>
        {totalCaptures === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t(m.noCaptures)}</p>
        ) : (
          <WeekTrendChart days={days} />
        )}
      </section>

      {/* Dulu ada DUA daftar berdampingan di sini: "Capture Terbaru" dari
          IndexedDB dan "Registry Capture Terbaru" dari MSSQL -- hal yang sama
          dari dua sumber, dengan isi yang bisa berselisih. Yang tersisa satu,
          dan sumbernya registry, karena itulah yang sama bagi semua orang. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t(m.latestCaptures)}</h2>
            <Link to="/gallery" className="text-xs font-medium text-primary hover:underline">
              {t(m.viewAll)}
            </Link>
          </div>
          {captureDbError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{captureDbError}</p>
          ) : !captureDbSummary || captureDbSummary.recentRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(m.latestCapturesEmpty)}
            </p>
          ) : (
            <ul className="space-y-2">
              {captureDbSummary.recentRecords.map((record) => (
                <li key={record.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium" title={record.fileName}>
                        {record.fileName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{record.plant ?? "—"}</span>
                        <span>·</span>
                        <span>{formatDashboardBin(record.captureBin)}</span>
                        <span>·</span>
                        <span>{record.deviceName ?? record.deviceCode ?? "—"}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDateTime(new Date(record.capturedAt).getTime(), locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {captureDbSummary
              ? t(m.saveBreakdown, {
                  saved: captureDbSummary.saveBreakdown.saved,
                  downloaded: captureDbSummary.saveBreakdown.downloaded,
                })
              : t(m.noSummary)}
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t(m.latestDeviceEvents)}</h2>
            {isAdmin && (
              <Link to="/devices" className="text-xs font-medium text-primary hover:underline">
                {t(m.openDevices)}
              </Link>
            )}
          </div>
          {deviceEventsError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{deviceEventsError}</p>
          ) : deviceEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(m.deviceEventsEmpty)}
            </p>
          ) : (
            <ul className="space-y-2">
              {deviceEvents.map((event) => (
                <li key={event.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">
                          {formatDeviceEventLabel(event.eventType, t)}
                        </span>
                        <StatusPill
                          tone={
                            event.severity === "error"
                              ? "warning"
                              : event.severity === "warning"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {event.severity}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{event.message}</p>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {event.deviceName ?? event.deviceCode}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDateTime(new Date(event.createdAt).getTime(), locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Device health */}
        <section className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t(m.deviceHealth)}</h2>
            {isAdmin && (
              <Link to="/devices" className="text-xs font-medium text-primary hover:underline">
                {t(m.manage)}
              </Link>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">{t(m.miniPc)}</dt>
            <dd className="text-right font-medium">{status?.deviceId ?? <NotAvailable />}</dd>
            <dt className="text-muted-foreground">{t(m.connectionState)}</dt>
            <dd className="text-right font-medium">
              {status?.connectionState ? (
                <span
                  className={
                    status.connectionState === "ready"
                      ? "text-emerald-600"
                      : status.connectionState === "disconnected"
                        ? "text-muted-foreground"
                        : "text-destructive"
                  }
                >
                  {status.connectionState}
                </span>
              ) : (
                <NotAvailable />
              )}
            </dd>
            <dt className="text-muted-foreground">{t(m.camera)}</dt>
            <dd className="text-right font-medium">
              {status?.camera ? cameraLabel : <NotAvailable />}
            </dd>
            <dt className="text-muted-foreground">{t(m.agentVersion)}</dt>
            <dd className="text-right font-medium">{status?.agentVersion ?? <NotAvailable />}</dd>
            <dt className="text-muted-foreground">{t(m.cpuRamDisk)}</dt>
            <dd className="text-right">
              <NotAvailable />
            </dd>
            <dt className="text-muted-foreground">{t(m.uptime)}</dt>
            <dd className="text-right">
              <NotAvailable />
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
