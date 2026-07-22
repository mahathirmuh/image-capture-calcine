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
import { PLANTS } from "@/lib/locations";
import { getStorageConfigSummary } from "@/lib/storage-diagnostics";

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

function formatDateTime(ts: number) {
  const date = new Date(ts);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart}, ${timePart}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function NotAvailable() {
  return <span className="text-muted-foreground">Belum tersedia</span>;
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
    <div className="rounded-lg border bg-card p-4">
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
      className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
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
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {count} capture ({pct}%)
        </span>
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

function formatRelativeTime(date: Date | null) {
  if (!date) return "Belum dicek";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
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
  to: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "muted";
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-3 text-[11px] text-muted-foreground/80">{detail}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
        <span>{cta}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function WeekTrendChart({ days }: { days: DayBucket[] }) {
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
            {days[hover].date.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "2-digit",
              month: "short",
            })}
          </div>
          <div className="text-muted-foreground">{days[hover].count} capture</div>
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [storageConfig, setStorageConfig] = useState<StorageConfigSummary | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [items, deviceStatus, storageSummary] = await Promise.all([
        loadGallery(),
        getDeviceStatus(),
        getStorageConfigSummary(),
      ]);
      setGallery(items);
      setStatus(deviceStatus);
      setStorageConfig(storageSummary);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setHydrated(true);
    setToday(startOfDay(new Date()));
    setLoading(true);
    Promise.all([loadGallery(), getDeviceStatus(), getStorageConfigSummary()]).then(
      ([items, deviceStatus, storageSummary]) => {
        if (cancelled) return;
        setGallery(items);
        setStatus(deviceStatus);
        setStorageConfig(storageSummary);
        setLastRefreshed(new Date());
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveToday = today ?? SSR_SAFE_DAY;
  const capturesToday = today
    ? gallery.filter((item) => item.createdAt >= today.getTime()).length
    : 0;
  const totalBytes = gallery.reduce((sum, item) => sum + item.blob.size, 0);
  const cameraConnected = !!status?.camera?.connected;
  const cameraLabel = status?.camera
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") ||
      "Model tidak diketahui"
    : "Belum terdeteksi";

  // Location breakdown, in the app's fixed plant order (not sorted by count) so
  // the two rows/colors stay stable regardless of which plant has more captures.
  const locationCounts = PLANTS.map((plant) => ({
    label: plant,
    count: gallery.filter((item) => item.folder === plant).length,
  }));
  const otherLocationCount = gallery.filter(
    (item) => !PLANTS.includes(item.folder as (typeof PLANTS)[number]),
  ).length;

  const bin1Count = gallery.filter((item) => item.bin === "BIN1").length;
  const bin2Count = gallery.filter((item) => item.bin === "BIN2").length;
  const unspecifiedBinCount = gallery.length - bin1Count - bin2Count;

  // Last 7 days, oldest to newest (today last), counted by local calendar day.
  const days: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(effectiveToday);
    d.setDate(d.getDate() - (6 - i));
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = gallery.filter(
      (item) => item.createdAt >= d.getTime() && item.createdAt < next.getTime(),
    ).length;
    return { date: d, label: DAY_LABELS[d.getDay()], count };
  });
  const weekTotal = days.reduce((sum, d) => sum + d.count, 0);

  const recent = [...gallery].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const latestCapture = recent[0] ?? null;
  const latestCaptureDate = latestCapture ? new Date(latestCapture.createdAt) : null;
  const plantsCoveredToday = new Set(
    today
      ? gallery
          .filter((item) => item.createdAt >= today.getTime())
          .map((item) => item.folder)
          .filter(Boolean)
      : [],
  ).size;
  const readinessTone = !status?.online
    ? "text-destructive"
    : cameraConnected
      ? "text-emerald-600"
      : "text-amber-600";
  const readinessLabel = !status?.online
    ? "Perlu perhatian"
    : cameraConnected
      ? "Siap"
      : "Edge siap, kamera perlu dicek";
  const operationalNotes = [
    !status?.online
      ? "Edge device belum reachable. Cek Mini PC, jaringan LAN, atau service edge API."
      : null,
    status?.online && !cameraConnected
      ? "Edge API reachable, tetapi kamera belum terhubung atau sesi belum siap."
      : null,
    capturesToday === 0
      ? "Belum ada capture hari ini. Jika shift sudah berjalan, lakukan pengecekan alur capture."
      : null,
    gallery.length > 0 && latestCapture
      ? `Capture terakhir tersimpan pada ${formatDateTime(latestCapture.createdAt)}.`
      : "Belum ada data capture lokal di browser ini.",
  ].filter(Boolean) as string[];
  const freshnessCards = [
    {
      title: "Local gallery",
      status: latestCapture ? "Ada capture" : "Belum ada data lokal",
      description: latestCapture
        ? `Capture terakhir ${formatRelativeTime(latestCaptureDate)}.`
        : "Browser ini belum punya capture tersimpan.",
      detail: latestCapture
        ? `${recent.length} entri terbaru siap direview dari gallery lokal browser.`
        : "Mulai dari halaman Capture atau cek apakah operator memakai browser/profile yang berbeda.",
      to: "/gallery",
      cta: "Buka Gallery",
      icon: Images,
      tone: latestCapture ? ("success" as const) : ("warning" as const),
    },
    {
      title: "Edge device",
      status: status?.online ? "Terjangkau" : "Offline",
      description: status?.online
        ? `Status terakhir diperbarui ${formatRelativeTime(lastRefreshed)}.`
        : "Dashboard belum bisa menjangkau edge device saat refresh terakhir.",
      detail: status?.online
        ? `Status koneksi: ${status.connectionState ?? "unknown"}${cameraConnected ? " • kamera terhubung" : " • kamera belum siap"}.`
        : "Periksa Mini PC, jaringan LAN, service edge API, atau halaman Devices untuk diagnosa lanjutan.",
      to: "/devices",
      cta: "Buka Devices",
      icon: Wifi,
      tone: status?.online ? ("success" as const) : ("warning" as const),
    },
    {
      title: "Auto-save target",
      status: storageConfig?.configured ? "Sudah diisi" : "Perlu setup",
      description: storageConfig?.configured
        ? "App server sudah memuat path target untuk auto-save."
        : "NETWORK_SAVE_ROOT belum tersedia untuk app server ini.",
      detail: storageConfig?.targetRoot
        ? storageConfig.targetRoot
        : "Buka Storage untuk cek env target path dan kesiapan write probe.",
      to: "/storage",
      cta: "Buka Storage",
      icon: FolderOpen,
      tone: storageConfig?.configured ? ("success" as const) : ("warning" as const),
    },
  ];
  const attentionItems = [
    !status?.online
      ? {
          title: "Edge device sedang offline",
          detail:
            "Dashboard tidak bisa menjangkau edge device. Buka Devices untuk cek connection state dan identitas Mini PC.",
          to: "/devices",
          cta: "Buka Devices",
        }
      : null,
    status?.online && !cameraConnected
      ? {
          title: "Sesi kamera perlu perhatian",
          detail:
            "Edge API terjangkau, tetapi kamera belum terhubung atau belum siap untuk capture baru.",
          to: "/devices",
          cta: "Cek Status Kamera",
        }
      : null,
    !storageConfig?.configured
      ? {
          title: "Target auto-save belum dikonfigurasi",
          detail:
            "App server belum memuat NETWORK_SAVE_ROOT. Storage page akan membantu verifikasi env dan alur save.",
          to: "/storage",
          cta: "Konfigurasi Storage",
        }
      : null,
    capturesToday === 0
      ? {
          title: "Belum ada capture hari ini",
          detail:
            "Jika shift sudah berjalan, buka Capture untuk uji autofocus dan ambil sample baru.",
          to: "/capture",
          cta: "Buka Capture",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; to: string; cta: string }>;

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan capture, kamera, dan status device.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {lastRefreshed ? `Diperbarui ${formatDateTime(lastRefreshed.getTime())}` : ""}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh dashboard"
            className="rounded-md border border-input bg-background p-2 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Snapshot Operasional
              </div>
              <h2 className={`mt-1 text-xl font-semibold ${readinessTone}`}>{readinessLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {cameraConnected
                  ? "Kamera terhubung dan siap dipakai untuk capture berikutnya."
                  : status?.online
                    ? "Perangkat edge online, tetapi koneksi kamera masih perlu perhatian."
                    : "Dashboard belum bisa mengonfirmasi koneksi edge device saat ini."}
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-right text-xs">
              <div className="text-muted-foreground">Capture lokal terakhir</div>
              <div className="mt-1 font-medium text-foreground">
                {latestCapture ? formatDateTime(latestCapture.createdAt) : "—"}
              </div>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Capture minggu ini</div>
              <div className="mt-1 text-lg font-semibold">{weekTotal}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Plant tercakup hari ini</div>
              <div className="mt-1 text-lg font-semibold">{plantsCoveredToday}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Penyimpanan browser</div>
              <div className="mt-1 text-lg font-semibold">
                {hydrated ? formatBytes(totalBytes) : "—"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionCard
              to="/capture"
              title="Buka Capture"
              description="Mulai autofocus, ambil gambar, dan simpan hasil."
              icon={Camera}
            />
            <ActionCard
              to="/gallery"
              title="Tinjau Gallery"
              description="Audit hasil capture, compare, rename, atau download batch."
              icon={Images}
            />
            <ActionCard
              to="/storage"
              title="Cek Storage"
              description="Verifikasi share path, edge reachability, dan fallback save."
              icon={FolderOpen}
            />
            <ActionCard
              to="/settings"
              title="Settings Operator"
              description="Atur pattern filename, counter, dan akses folder simpan."
              icon={Settings2}
            />
          </div>
        </div>

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Perhatian & Tindakan Berikutnya</h2>
          </div>
          {attentionItems.length > 0 ? (
            <div className="space-y-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group block rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                    </div>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <span>{item.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-foreground">Siap secara operasional</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Edge device online, storage target terkonfigurasi, dan dashboard tidak melihat
                    blocker utama saat ini.
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
            Dashboard ini membaca status edge device dan gallery lokal browser. Jika operator
            berpindah browser/profile, angka gallery lokal bisa berbeda walau perangkat edge sama.
          </div>
        </section>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {freshnessCards.map((card) => (
          <InsightCard key={card.title} {...card} />
        ))}
      </section>

      {/* KPI row */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Images}
          label="Total Capture"
          value={hydrated ? gallery.length : "—"}
          sub="Semua waktu, browser ini"
          tone="primary"
        />
        <StatCard
          icon={Camera}
          label="Capture Hari Ini"
          value={hydrated ? capturesToday : "—"}
          sub={
            hydrated && today
              ? today.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Tanggal lokal operator"
          }
          tone="sky"
        />
        <StatCard
          icon={Wifi}
          label="Kamera"
          value={status?.online ? (cameraConnected ? "Terhubung" : "Sesi aktif") : "Offline"}
          sub={cameraLabel}
          tone={cameraConnected ? "emerald" : status?.online ? "amber" : "muted"}
        />
        <StatCard
          icon={Database}
          label="Storage Terpakai"
          value={hydrated ? formatBytes(totalBytes) : "—"}
          sub="Gambar hasil capture tersimpan di browser ini"
          tone="amber"
        />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Captures by Location */}
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Capture per Lokasi
          </h2>
          {gallery.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada capture.</p>
          ) : (
            <div className="space-y-3">
              {locationCounts.map((row, i) => (
                <CompareRow
                  key={row.label}
                  label={row.label}
                  count={row.count}
                  total={gallery.length}
                  color={i === 0 ? COLOR_A : COLOR_B}
                />
              ))}
              {otherLocationCount > 0 && (
                <CompareRow
                  label="Lainnya / belum ditentukan"
                  count={otherLocationCount}
                  total={gallery.length}
                  color="var(--color-muted-foreground)"
                />
              )}
            </div>
          )}
        </section>

        {/* Captures by Bin */}
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" /> Capture per Bin
          </h2>
          {gallery.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada capture.</p>
          ) : (
            <div className="space-y-3">
              <CompareRow label="BIN 1" count={bin1Count} total={gallery.length} color={COLOR_A} />
              <CompareRow label="BIN 2" count={bin2Count} total={gallery.length} color={COLOR_B} />
              {unspecifiedBinCount > 0 && (
                <CompareRow
                  label="Belum ditentukan"
                  count={unspecifiedBinCount}
                  total={gallery.length}
                  color="var(--color-muted-foreground)"
                />
              )}
            </div>
          )}
        </section>
      </div>

      {/* Last 7 days trend */}
      <section className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Capture — 7 Hari Terakhir</h2>
          <span className="text-xs text-muted-foreground">{weekTotal} capture minggu ini</span>
        </div>
        {gallery.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Belum ada capture.</p>
        ) : (
          <WeekTrendChart days={days} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent captures */}
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Capture Terbaru</h2>
            <Link to="/gallery" className="text-xs font-medium text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Hasil capture tersimpan akan muncul di sini.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-10 w-10 shrink-0 rounded-md border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{item.folder || "—"}</span>
                      <span>·</span>
                      <span>{item.bin ? item.bin.replace(/^BIN/, "BIN ") : "—"}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Device health */}
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Kesehatan Device</h2>
            <Link to="/devices" className="text-xs font-medium text-primary hover:underline">
              Kelola
            </Link>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Mini PC</dt>
            <dd className="text-right font-medium">{status?.deviceId ?? <NotAvailable />}</dd>
            <dt className="text-muted-foreground">Status koneksi</dt>
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
            <dt className="text-muted-foreground">Kamera</dt>
            <dd className="text-right font-medium">
              {status?.camera ? cameraLabel : <NotAvailable />}
            </dd>
            <dt className="text-muted-foreground">Versi Agent</dt>
            <dd className="text-right font-medium">{status?.agentVersion ?? <NotAvailable />}</dd>
            <dt className="text-muted-foreground">CPU / RAM / Disk</dt>
            <dd className="text-right">
              <NotAvailable />
            </dd>
            <dt className="text-muted-foreground">Uptime</dt>
            <dd className="text-right">
              <NotAvailable />
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
