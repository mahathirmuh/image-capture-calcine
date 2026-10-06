import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HardDrive,
  Info,
  Network,
  RefreshCw,
  Server,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { PageTitle } from "@/components/page-shell";
import { useIsAdmin } from "@/lib/use-session-user";
import {
  flushSpoolNow,
  getSpoolSummary,
  getStorageConfigSummary,
  probeNetworkSaveRoot,
  type SpoolSummary,
  type StorageProbeResult,
} from "@/lib/storage-diagnostics";
import { commonMessages as c } from "@/i18n/common";
import { failureText } from "@/i18n/errors";
import { deviceStatusText } from "@/i18n/device-status";
import { storageMessages as m } from "@/i18n/storage";
import { useLocale, useRichT, useT, type Translator } from "@/lib/i18n";

export const Route = createFileRoute("/storage")({
  // Registry kamera dan tujuan simpan itu konfigurasi yang berlaku untuk semua
  // orang, bukan pengaturan per operator. Penjaga tampilan; entri sidebarnya
  // ikut disaring, tapi keduanya tidak menghalangi siapa pun mengetik URL-nya.
  beforeLoad: ({ context }) => {
    if (context.user && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: StoragePage,
  head: () => ({
    meta: [
      { title: "Storage — Capture App" },
      {
        name: "description",
        content: "Uji konfigurasi network save dan pahami perilaku fallback penyimpanan.",
      },
      { property: "og:title", content: "Storage — Capture App" },
      {
        property: "og:description",
        content: "Uji konfigurasi network save dan pahami perilaku fallback penyimpanan.",
      },
    ],
  }),
});

type StorageConfigSummary = Awaited<ReturnType<typeof getStorageConfigSummary>>;

const OFFLINE_STATUS: DeviceStatus = {
  online: false,
  deviceId: null,
  agentVersion: null,
  connectionState: null,
  capabilities: [],
  camera: null,
};

function formatDateTime(date: Date, locale: string) {
  const datePart = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-primary/10 text-primary";
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function getPathKind(targetRoot: string | null | undefined, t: Translator) {
  if (!targetRoot) return t(m.notConfigured);
  return targetRoot.startsWith("\\\\") ? t(m.pathKindUnc) : t(m.pathKindLocal);
}

// Bentuk path harus cocok dengan OS app server, dan ketidakcocokannya adalah
// kesalahan yang paling mudah terjadi: nilai dari mesin dev Windows tinggal
// tersalin ke server produksi yang Linux. Gejalanya menyesatkan -- env-nya
// terisi, kartunya tampak beres, tapi container mengunyah backslash-nya jadi
// satu nama berkas lalu gagal ENOENT. Probe akan menangkapnya juga, tapi
// menyebut sebabnya di sini jauh lebih cepat dibaca daripada kode errornya.
function getPathFormMismatch(config: StorageConfigSummary | null, t: Translator): string | null {
  if (!config?.targetRoot) return null;
  const isUnc = config.targetRoot.startsWith("\\\\");
  if (isUnc && config.platform !== "win32") {
    return t(m.pathMismatchUnc, { platform: config.platform });
  }
  if (!isUnc && config.platform === "win32" && config.targetRoot.startsWith("/")) {
    return t(m.pathMismatchPosix);
  }
  return null;
}

// Ringkasan satu baris untuk kartu. "Sudah diisi" sengaja tidak dipakai lagi:
// itu hanya berarti env var-nya tidak kosong, dan kartunya jadi terlihat sehat
// padahal folder tujuannya belum tentu bisa disentuh sama sekali.
function getSaveRootStatus(
  config: StorageConfigSummary | null,
  configLoading: boolean,
  probeResult: StorageProbeResult | null,
  probeLoading: boolean,
  t: Translator,
): { label: string; tone: string } {
  if (configLoading) return { label: t(m.checking), tone: "text-muted-foreground" };
  if (!config?.configured) return { label: t(m.notConfigured), tone: "text-destructive" };
  if (probeLoading) return { label: t(m.testingConnection), tone: "text-muted-foreground" };
  if (!probeResult) return { label: t(m.notTested), tone: "text-muted-foreground" };
  return probeResult.ok
    ? { label: t(m.connectedWritable), tone: "text-emerald-700" }
    : { label: t(m.notAccessible), tone: "text-destructive" };
}

function getProbeGuidance(
  result: StorageProbeResult,
  t: Translator,
): {
  headline: string;
  causes: string[];
  actions: string[];
} {
  if (result.ok) {
    return {
      headline: t(m.guideOkHeadline),
      causes: [t(m.guideOkCauseResponds), t(m.guideOkCausePermission)],
      actions: [t(m.guideOkActionEndToEnd), t(m.guideOkActionIfFails)],
    };
  }

  const usesUncPath = !!result.targetRoot && result.targetRoot.startsWith("\\\\");

  switch (result.code) {
    case "NOT_CONFIGURED":
      return {
        headline: t(m.guideNotConfiguredHeadline),
        causes: [t(m.guideNotConfiguredCauseEnv), t(m.guideNotConfiguredCauseDeploy)],
        actions: [t(m.guideNotConfiguredActionSet), t(m.guideNotConfiguredActionRerun)],
      };
    case "NOT_DIRECTORY":
      return {
        headline: t(m.guideNotDirectoryHeadline),
        causes: [t(m.guideNotDirectoryCauseTarget), t(m.guideNotDirectoryCauseTypo)],
        actions: [t(m.guideNotDirectoryActionUpdate), t(m.guideNotDirectoryActionVerify)],
      };
    case "ENOENT":
      return {
        headline: t(m.guideEnoentHeadline),
        causes: [
          t(m.guideEnoentCauseMissing),
          usesUncPath ? t(m.guideEnoentCauseUnc) : t(m.guideEnoentCauseLocal),
        ],
        actions: [t(m.guideEnoentActionSpelling), t(m.guideEnoentActionExists)],
      };
    case "EACCES":
    case "EPERM":
      return {
        headline: t(m.guideAccessHeadline),
        causes: [
          t(m.guideAccessCauseAccount),
          usesUncPath ? t(m.guideAccessCauseUnc) : t(m.guideAccessCauseLocal),
        ],
        actions: [t(m.guideAccessActionAccount), t(m.guideAccessActionManual)],
      };
    default:
      return {
        headline: usesUncPath ? t(m.guideOtherHeadlineUnc) : t(m.guideOtherHeadline),
        causes: [
          usesUncPath ? t(m.guideOtherCauseUnc) : t(m.guideOtherCauseLocal),
          t(m.guideOtherCauseContext),
        ],
        actions: [
          usesUncPath ? t(m.guideOtherActionUnc) : t(m.guideOtherActionLocal),
          t(m.guideOtherActionVerify),
        ],
      };
  }
}

function StoragePage() {
  const isAdmin = useIsAdmin();
  const t = useT();
  const rich = useRichT();
  const locale = useLocale();
  const [config, setConfig] = useState<StorageConfigSummary | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceCheckedAt, setDeviceCheckedAt] = useState<Date | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<StorageProbeResult | null>(null);
  const [spool, setSpool] = useState<SpoolSummary | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);

  async function refreshConfig() {
    setConfigLoading(true);
    try {
      setConfig(await getStorageConfigSummary());
    } finally {
      setConfigLoading(false);
    }
  }

  async function refreshDeviceStatus() {
    setDeviceLoading(true);
    try {
      const status = await getDeviceStatus().catch(() => OFFLINE_STATUS);
      setDeviceStatus(status);
      setDeviceCheckedAt(new Date());
    } finally {
      setDeviceLoading(false);
    }
  }

  async function refreshSpool() {
    try {
      setSpool(await getSpoolSummary());
    } catch {
      setSpool(null);
    }
  }

  async function runFlush() {
    setFlushing(true);
    try {
      await flushSpoolNow();
      await refreshSpool();
    } finally {
      setFlushing(false);
    }
  }

  async function runProbe() {
    setProbeLoading(true);
    try {
      setProbeResult(await probeNetworkSaveRoot());
    } finally {
      setProbeLoading(false);
    }
  }

  useEffect(() => {
    void refreshConfig();
    void refreshDeviceStatus();
    // Probe ikut jalan saat halaman dibuka. Sebelumnya ia hanya berjalan kalau
    // ada yang menekan tombolnya di bagian bawah halaman, sehingga kartu di
    // atas melaporkan "sudah diisi" tanpa pernah benar-benar menyentuh folder
    // tujuan -- pertanyaan yang justru ingin dijawab orang saat membuka
    // halaman ini. Probe menulis lalu menghapus satu file uji; cukup murah
    // untuk dijalankan tiap kali halaman dibuka.
    void runProbe();
    void refreshSpool();
  }, []);

  const liveCaptureSaveReady = !!config?.configured && !!deviceStatus?.online;
  const lastProbeOk = probeResult?.ok ?? null;
  // OFFLINE_STATUS tidak membawa teksnya sendiri: pesannya diterjemahkan saat
  // render, supaya ikut berganti bersama bahasa antarmuka.
  const deviceStatusMessage =
    deviceStatus === OFFLINE_STATUS
      ? t(m.edgeServiceUnreachable)
      : deviceStatusText(t, deviceStatus);
  const saveRootStatus = getSaveRootStatus(config, configLoading, probeResult, probeLoading, t);
  const pathFormMismatch = getPathFormMismatch(config, t);
  const recommendedSteps = [
    !config?.configured ? t(m.stepSetRoot) : null,
    config?.configured && !deviceStatus?.online ? t(m.stepEdgeReachable) : null,
    probeResult && !probeResult.ok ? t(m.stepFixWriteAccess, { code: probeResult.code }) : null,
    liveCaptureSaveReady && lastProbeOk ? t(m.stepEndToEnd) : null,
  ].filter(Boolean) as string[];
  const saveFlowSteps = [
    {
      title: m.flowNetworkSave,
      state: liveCaptureSaveReady ? "active" : "pending",
      description: m.flowNetworkSaveDescription,
    },
    {
      title: m.flowFolderHandle,
      state: !liveCaptureSaveReady ? "active" : "pending",
      description: m.flowFolderHandleDescription,
    },
    {
      title: m.flowBrowserDownload,
      state: !liveCaptureSaveReady ? "active" : "pending",
      description: m.flowBrowserDownloadDescription,
    },
  ] as const;
  const readinessChecklist = [
    {
      label: m.checkRootSet,
      done: !!config?.configured,
      detail: config?.configured ? t(m.checkRootSetDone) : t(m.checkRootSetPending),
    },
    {
      label: m.checkEdgeReachable,
      done: !!deviceStatus?.online,
      detail: deviceStatus?.online ? t(m.checkEdgeReachableDone) : t(m.checkEdgeReachablePending),
    },
    {
      label: m.checkWriteProbe,
      done: probeResult?.ok === true,
      detail:
        probeResult?.ok === true
          ? t(m.checkWriteProbeDone)
          : probeResult
            ? t(m.checkWriteProbeFailed, { code: probeResult.code })
            : t(m.checkWriteProbePending),
    },
  ];
  const probeGuidance = probeResult ? getProbeGuidance(probeResult, t) : null;

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle title={t(c.navStorage)} description={t(m.pageDescription)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              void refreshConfig();
              void refreshDeviceStatus();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <RefreshCw
              className={`h-4 w-4 ${configLoading || deviceLoading ? "animate-spin" : ""}`}
            />
            {t(m.refreshStatus)}
          </button>
          <Link
            to="/capture"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t(m.openCapture)}
          </Link>
        </div>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title={t(m.cardAutoSaveTitle)}
          value={liveCaptureSaveReady ? t(m.ready) : t(m.needsFallback)}
          description={t(m.cardAutoSaveDescription)}
          icon={HardDrive}
          tone={liveCaptureSaveReady ? "success" : "warning"}
        />
        <StatusCard
          title={t(m.cardNetworkRootTitle)}
          value={
            configLoading ? t(m.checking) : config?.configured ? t(m.rootSet) : t(m.rootMissing)
          }
          description={config?.targetRoot ?? t(m.cardNetworkRootEmpty)}
          icon={Network}
          tone={config?.configured ? "success" : "warning"}
        />
        <StatusCard
          title={t(m.cardEdgeTitle)}
          value={
            deviceLoading ? t(m.checking) : deviceStatus?.online ? t(m.connected) : t(m.offline)
          }
          description={
            deviceStatus?.online
              ? (config?.cameraApiUrl ?? t(m.cameraApiUrlEnvMissing))
              : (deviceStatusMessage ?? t(m.cameraApiUrlEnvMissing))
          }
          icon={Server}
          tone={deviceStatus?.online ? "success" : "warning"}
        />
        <StatusCard
          title={t(m.cardLastProbeTitle)}
          value={
            probeResult
              ? probeResult.ok
                ? t(m.writeOk)
                : t(m.failedWithCode, { code: probeResult.code })
              : t(m.notRunYet)
          }
          description={
            probeResult
              ? t(m.checkedAt, { time: formatDateTime(new Date(probeResult.checkedAt), locale) })
              : t(m.cardLastProbeEmpty)
          }
          icon={probeResult?.ok ? CheckCircle2 : AlertTriangle}
          tone={probeResult?.ok ? "success" : probeResult ? "warning" : "default"}
        />
      </section>

      {/* Antrean yang tidak bisa ditulis. Lebih gawat daripada antrean yang
          menumpuk: di sini SETIAP capture gagal masuk antrean dan jatuh ke
          unduhan browser, jadi tidak ada satu pun foto yang sampai ke folder
          jaringan sampai izinnya dibetulkan. `pending` tetap 0 dalam keadaan
          ini -- itu sebabnya ia butuh peringatan sendiri, bukan menumpang
          kartu kuning di bawah. */}
      {spool?.configured && !spool.writable && (
        <section className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <div className="text-sm font-semibold text-destructive">{t(m.spoolUnwritableTitle)}</div>
          <p className="mt-1 text-xs text-destructive/90">
            {rich(m.spoolUnwritableBody, {
              root: <code>root</code>,
              node: <code>node</code>,
              chown: (
                <code>
                  docker compose run --rm --user root web chown -R node:node /var/lib/capture-spool
                </code>
              ),
              up: <code>docker compose up -d</code>,
            })}
          </p>
        </section>
      )}

      {/* Antrean kirim. Ditaruh SEBELUM kartu lain karena ia satu-satunya
          tanda bahwa share sedang bermasalah -- halaman Capture tidak lagi
          menunjukkan gejala apa pun sejak semua capture lewat antrean. */}
      {spool?.configured && spool.pending > 0 && (
        <section className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-800">
                {t(m.spoolPendingTitle, { count: spool.pending })}
              </div>
              <p className="mt-1 text-xs text-amber-700">
                {spool.oldestQueuedAt
                  ? t(m.spoolPendingBodyWithOldest, {
                      used: Math.round(spool.bytes / 1024 / 1024),
                      cap: Math.round(spool.capBytes / 1024 / 1024),
                      time: formatDateTime(new Date(spool.oldestQueuedAt), locale),
                    })
                  : t(m.spoolPendingBody, {
                      used: Math.round(spool.bytes / 1024 / 1024),
                      cap: Math.round(spool.capBytes / 1024 / 1024),
                    })}
              </p>
            </div>
            <button
              onClick={() => void runFlush()}
              disabled={flushing}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {flushing ? t(m.sending) : t(m.sendNow)}
            </button>
          </div>
        </section>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t(m.saveRootTitle)}</h2>
          </div>
          <div className={`text-sm font-medium ${saveRootStatus.tone}`}>{saveRootStatus.label}</div>
          <p className="mt-2 break-all text-xs text-muted-foreground">
            {config?.targetRoot ?? t(m.saveRootEmpty)}
          </p>
          {pathFormMismatch && (
            <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700">
              {pathFormMismatch}
            </p>
          )}
          {probeResult && !probeResult.ok && (
            <p className="mt-2 break-all text-xs text-destructive">
              {probeResult.code}: {failureText(t, probeResult)}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {config?.platform
              ? t(m.pathKindWithPlatform, {
                  kind: getPathKind(config?.targetRoot, t),
                  platform: config.platform,
                })
              : t(m.pathKind, { kind: getPathKind(config?.targetRoot, t) })}
          </p>
          <button
            onClick={() => void runProbe()}
            disabled={probeLoading || !config?.configured}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probeLoading ? "animate-spin" : ""}`} />
            {probeLoading ? t(m.testing) : t(m.testConnection)}
          </button>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Edge API</h2>
          </div>
          <div className="text-sm font-medium">
            {deviceLoading
              ? t(m.checking)
              : deviceStatus?.online
                ? t(m.connected)
                : t(m.offlineNotConnected)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {deviceStatus?.online
              ? (config?.cameraApiUrl ?? t(m.cameraApiUrlMissing))
              : (deviceStatusMessage ?? t(m.cameraApiUrlMissing))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(m.lastCheck, {
              time: deviceCheckedAt ? formatDateTime(deviceCheckedAt, locale) : "—",
            })}
          </p>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            {liveCaptureSaveReady ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <h2 className="font-semibold">{t(m.savePathTitle)}</h2>
          </div>
          <div className="text-sm font-medium">
            {liveCaptureSaveReady ? t(m.readyForNetworkExport) : t(m.fallbackMayBeUsed)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t(m.savePathHint)}</p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t(m.nextActionsTitle)}</h2>
          </div>
          <div className="space-y-3">
            {recommendedSteps.length > 0 ? (
              recommendedSteps.map((step) => (
                <div
                  key={step}
                  className="rounded-lg border bg-background p-3 text-sm text-muted-foreground"
                >
                  {step}
                </div>
              ))
            ) : (
              <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                {t(m.allDependenciesReady)}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t(m.saveFlowTitle)}</h2>
          </div>
          <div className="space-y-3">
            {saveFlowSteps.map((step, index) => (
              <div key={step.title.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      step.state === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {index < saveFlowSteps.length - 1 && (
                    <span className="mt-1 h-8 w-px bg-border" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{t(step.title)}</span>
                    {step.state === "active" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {t(m.activePath)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(step.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t(m.readinessTitle)}</h2>
          </div>
          <div className="space-y-3">
            {readinessChecklist.map((item) => (
              <div key={item.label.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{t(item.label)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t(m.probeGuideTitle)}</h2>
          </div>
          {probeGuidance ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                {probeGuidance.headline}
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(m.possibleCauses)}
                </div>
                <div className="space-y-2">
                  {probeGuidance.causes.map((cause) => (
                    <div
                      key={cause}
                      className="rounded-lg border bg-background p-3 text-sm text-muted-foreground"
                    >
                      {cause}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(m.nextActions)}
                </div>
                <div className="space-y-2">
                  {probeGuidance.actions.map((action) => (
                    <div
                      key={action}
                      className="rounded-lg border bg-background p-3 text-sm text-muted-foreground"
                    >
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
              {t(m.probeGuideEmpty)}
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-xl border bg-card shadow-sm p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Server className="h-4 w-4 text-primary" />
              {t(m.probeSectionTitle)}
            </h2>
            <p className="text-sm text-muted-foreground">{t(m.probeSectionHint)}</p>
          </div>
          <button
            onClick={() => void runProbe()}
            disabled={probeLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${probeLoading ? "animate-spin" : ""}`} />
            {t(m.runWriteProbe)}
          </button>
        </div>

        {!probeResult && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t(m.probeResultEmpty)}
          </div>
        )}

        {probeResult && (
          <div
            className={`rounded-md border p-4 text-sm ${
              probeResult.ok
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 font-medium">
              {probeResult.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              {probeResult.ok
                ? t(m.probeSucceeded)
                : t(m.probeFailedWithCode, { code: probeResult.code })}
            </div>
            <dl className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div>
                <dt>{t(m.targetPath)}</dt>
                <dd className="break-all font-medium text-foreground">
                  {probeResult.targetRoot ?? "—"}
                </dd>
              </div>
              <div>
                <dt>{t(m.checkTime)}</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTime(new Date(probeResult.checkedAt), locale)}
                </dd>
              </div>
              <div>
                <dt>{t(m.appServerPlatform)}</dt>
                <dd className="font-medium text-foreground">{probeResult.platform}</dd>
              </div>
              {probeResult.ok && (
                <div>
                  <dt>{t(m.probeFile)}</dt>
                  <dd className="font-medium text-foreground">{probeResult.probeFile}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              {probeResult.ok ? probeResult.message : failureText(t, probeResult)}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-sm p-4">
        <div className="mb-3 flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h2 className="font-semibold">{t(m.howToReadTitle)}</h2>
            <p className="text-sm text-muted-foreground">{t(m.howToReadHint)}</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>{t(m.howToReadSaveRoot)}</li>
          <li>{t(m.howToReadEdge)}</li>
          <li>{t(m.howToReadProbeFails)}</li>
          <li>{t(m.howToReadProbeSucceeds)}</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/capture"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t(m.openCapture)}
          </Link>
          {isAdmin && (
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t(m.reviewSettings)} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
