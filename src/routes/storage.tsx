import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  getStorageConfigSummary,
  probeNetworkSaveRoot,
  type StorageProbeResult,
} from "@/lib/storage-diagnostics";

export const Route = createFileRoute("/storage")({
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

function formatDateTime(date: Date) {
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
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
    <div className="rounded-lg border bg-card p-4">
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

function getPathKind(targetRoot: string | null | undefined) {
  if (!targetRoot) return "Belum dikonfigurasi";
  return targetRoot.startsWith("\\\\") ? "UNC share" : "Path lokal";
}

function getProbeGuidance(result: StorageProbeResult): {
  headline: string;
  causes: string[];
  actions: string[];
} {
  if (result.ok) {
    return {
      headline: "App server sudah bisa menulis dan menghapus file uji di target root ini.",
      causes: [
        "Path target merespons operasi create/delete dari runtime aplikasi.",
        "Permission dasar untuk read/write terlihat tersedia pada proses app server saat probe dijalankan.",
      ],
      actions: [
        "Lanjutkan uji end-to-end dari halaman Capture untuk memastikan edge service juga berhasil export file final.",
        "Jika export nyata masih gagal, fokuskan pengecekan ke edge service, lease kamera, atau payload export.",
      ],
    };
  }

  const usesUncPath = !!result.targetRoot && result.targetRoot.startsWith("\\\\");

  switch (result.code) {
    case "NOT_CONFIGURED":
      return {
        headline: "Auto-save belum punya target path karena `NETWORK_SAVE_ROOT` belum diisi.",
        causes: [
          "Environment app server belum memuat `NETWORK_SAVE_ROOT`.",
          "File `.env` atau variable deployment belum diterapkan ke runtime yang aktif.",
        ],
        actions: [
          "Isi `NETWORK_SAVE_ROOT` dengan path target yang benar lalu restart app server.",
          "Setelah restart, buka halaman ini lagi dan jalankan probe ulang.",
        ],
      };
    case "NOT_DIRECTORY":
      return {
        headline: "Path yang dikonfigurasi ada, tetapi bukan folder yang bisa dipakai untuk save.",
        causes: [
          "Path menunjuk ke file, shortcut, atau target yang tidak resolve sebagai direktori.",
          "Nilai env mengandung typo atau mengarah ke level path yang salah.",
        ],
        actions: [
          "Perbarui `NETWORK_SAVE_ROOT` agar menunjuk langsung ke folder tujuan.",
          "Verifikasi path tersebut dengan Explorer atau PowerShell pada mesin app server.",
        ],
      };
    case "ENOENT":
      return {
        headline: "Target root tidak ditemukan dari sisi runtime aplikasi.",
        causes: [
          "Folder tujuan belum ada atau nama share/path salah.",
          usesUncPath
            ? "Host share atau nama folder UNC tidak bisa di-resolve dari mesin app server."
            : "Path lokal tidak ada pada mesin tempat app server berjalan.",
        ],
        actions: [
          "Cek ulang ejaan path, termasuk nama host share dan subfolder.",
          "Pastikan folder tujuan benar-benar ada lalu jalankan probe ulang.",
        ],
      };
    case "EACCES":
    case "EPERM":
      return {
        headline:
          "Runtime aplikasi bisa melihat path target, tetapi tidak punya izin tulis yang cukup.",
        causes: [
          "Akun proses app server tidak punya hak create/delete pada folder tujuan.",
          usesUncPath
            ? "UNC share meminta kredensial yang tidak dimiliki service account."
            : "ACL folder lokal menolak akses write/delete untuk user service.",
        ],
        actions: [
          "Jalankan service/app dengan akun yang memang punya akses ke folder tujuan.",
          "Uji create/delete file manual menggunakan akun runtime yang sama dengan app server.",
        ],
      };
    default:
      return {
        headline: usesUncPath
          ? "UNC share belum bisa dipakai andal dari runtime aplikasi ini."
          : "Probe gagal dengan error yang belum terklasifikasi otomatis.",
        causes: [
          usesUncPath
            ? "Share jaringan mungkin tidak reachable dari service account, walau terlihat benar dari sesi login biasa."
            : "Path target merespons tidak normal saat dicek oleh app server.",
          "Proses app server bisa berjalan pada konteks user/credential yang berbeda dari operator yang sedang login.",
        ],
        actions: [
          usesUncPath
            ? "Coba akses UNC path yang sama langsung dari mesin app server memakai akun runtime yang sama."
            : "Cek log runtime server dan uji create/delete file manual pada path target.",
          "Pastikan host share, kredensial, izin tulis, dan policy service account sudah sesuai.",
        ],
      };
  }
}

function StoragePage() {
  const [config, setConfig] = useState<StorageConfigSummary | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceCheckedAt, setDeviceCheckedAt] = useState<Date | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<StorageProbeResult | null>(null);
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
  }, []);

  const liveCaptureSaveReady = !!config?.configured && !!deviceStatus?.online;
  const lastProbeOk = probeResult?.ok ?? null;
  const recommendedSteps = [
    !config?.configured
      ? "Set `NETWORK_SAVE_ROOT` di environment app agar export otomatis punya target path."
      : null,
    config?.configured && !deviceStatus?.online
      ? "Pastikan edge camera service reachable dari aplikasi sebelum mencoba auto-save."
      : null,
    probeResult && !probeResult.ok
      ? `Perbaiki akses tulis app server ke target root. Error terakhir: ${probeResult.code}.`
      : null,
    liveCaptureSaveReady && lastProbeOk
      ? "Lanjutkan tes end-to-end dari halaman Capture untuk memverifikasi export final dari edge service."
      : null,
  ].filter(Boolean) as string[];
  const saveFlowSteps = [
    {
      title: "Network export",
      state: liveCaptureSaveReady ? "active" : "pending",
      description:
        "Aplikasi akan mencoba export ke NETWORK_SAVE_ROOT lewat edge service terlebih dulu.",
    },
    {
      title: "Folder handle",
      state: !liveCaptureSaveReady ? "active" : "pending",
      description:
        "Jika network export tidak bisa dipakai, operator dapat menyimpan ke folder yang dipilih di browser.",
    },
    {
      title: "Browser download",
      state: !liveCaptureSaveReady ? "active" : "pending",
      description:
        "Fallback terakhir adalah download biasa dari browser bila jalur lain tidak tersedia.",
    },
  ] as const;
  const readinessChecklist = [
    {
      label: "NETWORK_SAVE_ROOT terisi",
      done: !!config?.configured,
      detail: config?.configured
        ? "Target path sudah dimuat dari env."
        : "Env belum menyediakan target path.",
    },
    {
      label: "Edge API reachable",
      done: !!deviceStatus?.online,
      detail: deviceStatus?.online
        ? "Aplikasi berhasil membaca status edge device."
        : "Aplikasi belum bisa menjangkau edge device saat ini.",
    },
    {
      label: "Write probe berhasil",
      done: probeResult?.ok === true,
      detail:
        probeResult?.ok === true
          ? "App server berhasil create/delete file uji."
          : probeResult
            ? `Probe terakhir gagal dengan code ${probeResult.code}.`
            : "Belum ada hasil probe untuk memverifikasi akses tulis.",
    },
  ];
  const probeGuidance = probeResult ? getProbeGuidance(probeResult) : null;

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
          <p className="text-sm text-muted-foreground">
            Uji `NETWORK_SAVE_ROOT`, konfirmasi reachability edge API, dan pahami kapan Capture akan
            berpindah ke fallback browser download.
          </p>
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
            Refresh Status
          </button>
          <Link
            to="/capture"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Buka Capture
          </Link>
        </div>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Kesiapan Auto-Save"
          value={liveCaptureSaveReady ? "Siap" : "Perlu fallback"}
          description="Menilai apakah Capture bisa mencoba auto-save sebelum fallback browser."
          icon={HardDrive}
          tone={liveCaptureSaveReady ? "success" : "warning"}
        />
        <StatusCard
          title="Network Root"
          value={configLoading ? "Mengecek..." : config?.configured ? "Sudah diisi" : "Belum ada"}
          description={config?.targetRoot ?? "Belum ada target network root yang dimuat dari env."}
          icon={Network}
          tone={config?.configured ? "success" : "warning"}
        />
        <StatusCard
          title="Reachability Edge"
          value={deviceLoading ? "Mengecek..." : deviceStatus?.online ? "Terjangkau" : "Offline"}
          description={config?.cameraApiUrl ?? "Belum ada CAMERA_API_URL yang termuat."}
          icon={Server}
          tone={deviceStatus?.online ? "success" : "warning"}
        />
        <StatusCard
          title="Probe Terakhir"
          value={
            probeResult
              ? probeResult.ok
                ? "Write OK"
                : `Gagal (${probeResult.code})`
              : "Belum dijalankan"
          }
          description={
            probeResult
              ? `Dicek ${formatDateTime(new Date(probeResult.checkedAt))}`
              : "Jalankan write probe untuk menguji akses tulis app server."
          }
          icon={probeResult?.ok ? CheckCircle2 : AlertTriangle}
          tone={probeResult?.ok ? "success" : probeResult ? "warning" : "default"}
        />
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Network Save Root</h2>
          </div>
          <div className="text-sm font-medium">
            {configLoading
              ? "Mengecek..."
              : config?.configured
                ? "Sudah diisi"
                : "Belum dikonfigurasi"}
          </div>
          <p className="mt-2 break-all text-xs text-muted-foreground">
            {config?.targetRoot ??
              "Isi NETWORK_SAVE_ROOT di .env untuk mengaktifkan network save otomatis."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Jenis path: {getPathKind(config?.targetRoot)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Edge API</h2>
          </div>
          <div className="text-sm font-medium">
            {deviceLoading
              ? "Mengecek..."
              : deviceStatus?.online
                ? "Terjangkau"
                : "Offline / tidak terjangkau"}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {config?.cameraApiUrl ?? "Belum ada camera API URL yang termuat"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pengecekan terakhir: {deviceCheckedAt ? formatDateTime(deviceCheckedAt) : "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            {liveCaptureSaveReady ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <h2 className="font-semibold">Jalur Simpan Capture</h2>
          </div>
          <div className="text-sm font-medium">
            {liveCaptureSaveReady ? "Siap mencoba network export" : "Fallback mungkin dipakai"}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Simpan otomatis dari `/capture` membutuhkan save root yang sudah dikonfigurasi dan edge
            camera service yang bisa dijangkau.
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Tindakan Berikutnya</h2>
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
                Semua dependency utama terlihat siap. Lakukan tes nyata dari halaman Capture untuk
                memastikan edge service berhasil menulis file akhir ke target storage.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Urutan Alur Simpan</h2>
          </div>
          <div className="space-y-3">
            {saveFlowSteps.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3">
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
                    <span>{step.title}</span>
                    {step.state === "active" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        Jalur aktif
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Checklist Kesiapan</h2>
          </div>
          <div className="space-y-3">
            {readinessChecklist.map((item) => (
              <div key={item.label} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{item.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Panduan Probe</h2>
          </div>
          {probeGuidance ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                {probeGuidance.headline}
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Kemungkinan penyebab
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
                  Tindakan berikutnya
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
              Jalankan write probe dulu agar halaman ini bisa memberi arahan troubleshooting yang
              lebih spesifik berdasarkan error runtime yang aktual.
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Server className="h-4 w-4 text-primary" />
              Probe Storage App Server
            </h2>
            <p className="text-sm text-muted-foreground">
              Menjalankan probe write-delete yang aman dari app server ini ke `NETWORK_SAVE_ROOT`.
            </p>
          </div>
          <button
            onClick={() => void runProbe()}
            disabled={probeLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${probeLoading ? "animate-spin" : ""}`} />
            Jalankan Write Probe
          </button>
        </div>

        {!probeResult && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Belum ada hasil probe. Jalankan tes ini untuk memastikan app server bisa membuat dan
            menghapus file sementara di dalam root yang dikonfigurasi.
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
              {probeResult.ok ? "Probe berhasil" : `Probe gagal (${probeResult.code})`}
            </div>
            <dl className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div>
                <dt>Path target</dt>
                <dd className="break-all font-medium text-foreground">
                  {probeResult.targetRoot ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Waktu cek</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTime(new Date(probeResult.checkedAt))}
                </dd>
              </div>
              <div>
                <dt>Platform app server</dt>
                <dd className="font-medium text-foreground">{probeResult.platform}</dd>
              </div>
              {probeResult.ok && (
                <div>
                  <dt>File probe</dt>
                  <dd className="font-medium text-foreground">{probeResult.probeFile}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{probeResult.message}</p>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h2 className="font-semibold">Cara Membaca Halaman Ini</h2>
            <p className="text-sm text-muted-foreground">
              Halaman ini membantu diagnosis alur simpan, tetapi tidak menggantikan tes capture yang
              nyata.
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Jika `Network Save Root` belum dikonfigurasi, `/capture` akan langsung berpindah ke
            folder-picker atau fallback browser download.
          </li>
          <li>
            Jika `Edge API` sedang offline, aplikasi tidak bisa meminta camera service mengekspor
            aset hasil capture ke network share.
          </li>
          <li>
            Jika `Jalankan Write Probe` gagal, berarti app server ini sendiri belum bisa menulis ke
            path yang dikonfigurasi. Ini pertanda kuat bahwa auto-save tidak akan andal di runtime
            saat ini.
          </li>
          <li>
            Meski probe ini berhasil, export capture final tetap bergantung pada edge camera service
            untuk menyelesaikan request export-nya sendiri.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/capture"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Buka Capture
          </Link>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Tinjau Settings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
