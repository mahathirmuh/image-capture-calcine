import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera, Database, Images, MapPin, Package, RefreshCw, Wifi } from "lucide-react";
import { type GalleryItem, loadGallery } from "@/lib/gallery-store";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { PLANTS } from "@/lib/locations";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Capture App" },
      { name: "description", content: "Overview of captures, camera, and device status." },
      { property: "og:title", content: "Dashboard — Capture App" },
      { property: "og:description", content: "Overview of captures, camera, and device status." },
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
  return <span className="text-muted-foreground">Not available</span>;
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
          {count} {count === 1 ? "capture" : "captures"} ({pct}%)
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
          <div className="text-muted-foreground">
            {days[hover].count} {days[hover].count === 1 ? "capture" : "captures"}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [items, deviceStatus] = await Promise.all([loadGallery(), getDeviceStatus()]);
      setGallery(items);
      setStatus(deviceStatus);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setHydrated(true);
    setLoading(true);
    Promise.all([loadGallery(), getDeviceStatus()]).then(([items, deviceStatus]) => {
      if (cancelled) return;
      setGallery(items);
      setStatus(deviceStatus);
      setLastRefreshed(new Date());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = startOfDay(new Date());
  const capturesToday = gallery.filter((item) => item.createdAt >= today.getTime()).length;
  const totalBytes = gallery.reduce((sum, item) => sum + item.blob.size, 0);
  const cameraConnected = !!status?.camera?.connected;
  const cameraLabel = status?.camera
    ? [status.camera.manufacturer, status.camera.model].filter(Boolean).join(" ") || "Unknown model"
    : "Not detected";

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
    const d = new Date(today);
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

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of captures, camera, and device status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {lastRefreshed ? `Updated ${formatDateTime(lastRefreshed.getTime())}` : ""}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            className="rounded-md border border-input bg-background p-2 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* KPI row */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Images}
          label="Total Captures"
          value={hydrated ? gallery.length : "—"}
          sub="All-time, this device"
          tone="primary"
        />
        <StatCard
          icon={Camera}
          label="Captures Today"
          value={hydrated ? capturesToday : "—"}
          sub={today.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          tone="sky"
        />
        <StatCard
          icon={Wifi}
          label="Camera"
          value={status?.online ? (cameraConnected ? "Connected" : "Session up") : "Offline"}
          sub={cameraLabel}
          tone={cameraConnected ? "emerald" : status?.online ? "amber" : "muted"}
        />
        <StatCard
          icon={Database}
          label="Storage Used"
          value={hydrated ? formatBytes(totalBytes) : "—"}
          sub="Captured images kept in this browser"
          tone="amber"
        />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Captures by Location */}
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Captures by Location
          </h2>
          {gallery.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No captures yet.</p>
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
                  label="Other / unspecified"
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
            <Package className="h-4 w-4 text-muted-foreground" /> Captures by Bin
          </h2>
          {gallery.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No captures yet.</p>
          ) : (
            <div className="space-y-3">
              <CompareRow label="BIN 1" count={bin1Count} total={gallery.length} color={COLOR_A} />
              <CompareRow label="BIN 2" count={bin2Count} total={gallery.length} color={COLOR_B} />
              {unspecifiedBinCount > 0 && (
                <CompareRow
                  label="Unspecified"
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
          <h2 className="text-sm font-semibold">Captures — Last 7 Days</h2>
          <span className="text-xs text-muted-foreground">
            {weekTotal} {weekTotal === 1 ? "capture" : "captures"} this week
          </span>
        </div>
        {gallery.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No captures yet.</p>
        ) : (
          <WeekTrendChart days={days} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent captures */}
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Captures</h2>
            <Link to="/gallery" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Saved captures will appear here.
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
            <h2 className="text-sm font-semibold">Device Health</h2>
            <Link to="/devices" className="text-xs font-medium text-primary hover:underline">
              Manage
            </Link>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Mini PC</dt>
            <dd className="text-right font-medium">{status?.deviceId ?? <NotAvailable />}</dd>
            <dt className="text-muted-foreground">Connection state</dt>
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
            <dt className="text-muted-foreground">Camera</dt>
            <dd className="text-right font-medium">
              {status?.camera ? cameraLabel : <NotAvailable />}
            </dd>
            <dt className="text-muted-foreground">Agent version</dt>
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
