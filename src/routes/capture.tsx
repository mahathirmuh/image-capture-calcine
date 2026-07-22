import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  MapPin,
  RotateCcw,
  Wifi,
} from "lucide-react";
import { useCaptureCameraSession } from "@/hooks/use-capture-camera-session";
import {
  loadPrefs,
  savePrefs,
  loadDirHandle,
  saveDirHandle,
  clearDirHandle,
  verifyPermission,
  DEFAULT_PREFS,
} from "@/lib/capture-prefs";
import { addGalleryItem } from "@/lib/gallery-store";
import {
  triggerCapture,
  triggerAutofocus,
  pollJob,
  getMediaContent,
  exportMediaToNetwork,
} from "@/lib/camera-api";
import { recordCaptureResult, type CaptureSaveMethod } from "@/lib/capture-records";
import { loadDeviceProfile } from "@/lib/device-config";
import {
  describeCameraRuntimeIssue,
  getCaptureActionHint,
  getCaptureRuntimeActions,
  getCaptureSessionSummary,
  getRuntimeErrorCode,
} from "@/lib/camera-runtime";
import { PLANTS, toLocationToken } from "@/lib/locations";

export const Route = createFileRoute("/capture")({
  component: CapturePage,
  head: () => ({
    meta: [
      { title: "Capture — Capture App" },
      {
        name: "description",
        content:
          "Ambil gambar dari kamera, lihat preview, lalu simpan ke folder pilihan dengan format nama file kustom.",
      },
      { property: "og:title", content: "Capture — Capture App" },
      {
        property: "og:description",
        content:
          "Ambil gambar dari kamera, lihat preview, lalu simpan ke folder pilihan dengan format nama file kustom.",
      },
    ],
  }),
});

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;
type Bin = "BIN 1" | "BIN 2";
// assetId is kept around so Save can later ask the edge device to export the
// already-captured asset straight to its network share, without the browser
// re-uploading the bytes it already downloaded once for the preview.
type BinPreview = { blob: Blob; url: string; assetId: string; capturedAt: number };

function binToken(bin: Bin) {
  return bin.replace(" ", "");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function sha256Hex(blob: Blob): Promise<string | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  try {
    const hash = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(hash))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

// Fixed English month names so {MMMM} always renders "July", never a localized
// form like "Juli", regardless of the machine's locale.
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatFilename(pattern: string, index: number, location: string, source: string) {
  const now = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const map: Record<string, string> = {
    YYYY: String(now.getFullYear()),
    MMMM: MONTH_NAMES[now.getMonth()],
    MM: pad(now.getMonth() + 1),
    DD: pad(now.getDate()),
    HH: pad(now.getHours()),
    mm: pad(now.getMinutes()),
    ss: pad(now.getSeconds()),
    INDEX: pad(index, 3),
    TS: String(Date.now()),
    LOCATION: location || "UNKNOWN",
    SOURCE: source,
  };
  let out = pattern;
  for (const [k, v] of Object.entries(map)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

// The minute-resolution filename intentionally has no seconds/index, so two
// captures of the same bin within one minute would collide. Rather than let
// `getFileHandle(create:true)` silently overwrite the earlier file, disambiguate
// with a " (2)", " (3)" … suffix — the same thing Windows/Downloads would do.
async function resolveUniqueName(dir: DirHandle, base: string, ext: string): Promise<string> {
  const exists = async (name: string) => {
    try {
      await dir.getFileHandle(name, { create: false });
      return true;
    } catch {
      return false;
    }
  };
  let name = `${base}.${ext}`;
  if (!(await exists(name))) return name;
  for (let i = 2; i < 1000; i++) {
    name = `${base} (${i}).${ext}`;
    if (!(await exists(name))) return name;
  }
  return `${base} ${Date.now()}.${ext}`;
}

// Zero-padded Year/Month/Day path segment (e.g. "2026/07/18") -- sorts
// correctly in Explorer (which only sorts alphabetically -- month *names*
// would put April before January), used both for the browser's own nested
// folders below and for the relative path sent to the edge device's network
// export endpoint.
function datedPathSegment(date = new Date()): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

// Nested Year/Month/Day subfolders under whichever base folder the operator
// picked -- keeps years of captures browsable instead of one flat folder of
// thousands of files. Created on demand each save; no extra setup needed
// when a new day/month/year starts.
async function getDatedDirHandle(
  root: DirHandle,
  date = new Date(),
): Promise<{ dir: DirHandle; path: string }> {
  const path = datedPathSegment(date);
  const [yyyy, mm, dd] = path.split("/");
  const yearDir = await root.getDirectoryHandle(yyyy, { create: true });
  const monthDir = await yearDir.getDirectoryHandle(mm, { create: true });
  const dayDir = await monthDir.getDirectoryHandle(dd, { create: true });
  return { dir: dayDir, path };
}

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) return "Belum ada data";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

function RuntimeCard({
  title,
  status,
  detail,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  status: string;
  detail: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive"
        : "bg-amber-500/10 text-amber-700";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>
          {status}
        </span>
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      <p className="mt-3 text-[11px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}

function CapturePage() {
  const [capturingBin, setCapturingBin] = useState<Bin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [bin1, setBin1] = useState<BinPreview | null>(null);
  const [bin2, setBin2] = useState<BinPreview | null>(null);
  const [lastSource, setLastSource] = useState<Bin>("BIN 1");
  const [savingBin, setSavingBin] = useState<Bin | null>(null);
  const [autofocusing, setAutofocusing] = useState(false);
  // Synchronous re-entrancy guard for saves. `savingBin` is state (async), so a
  // fast double-click could pass its check twice before re-render; this ref
  // closes that window and prevents the same still being written under the same
  // index twice (which would silently overwrite the first file).
  const savingRef = useRef(false);

  const [dirHandle, setDirHandle] = useState<DirHandle | null>(null);
  const [dirName, setDirName] = useState<string>("");
  const [location, setLocation] = useState<string>(DEFAULT_PREFS.location);
  const [pattern, setPattern] = useState<string>(DEFAULT_PREFS.pattern);
  const [ext, setExt] = useState<"jpg">(DEFAULT_PREFS.ext);
  const [counter, setCounter] = useState<number>(DEFAULT_PREFS.counter);

  const [hydrated, setHydrated] = useState(false);
  const [supportsFS, setSupportsFS] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [pendingReconnect, setPendingReconnect] = useState(false);

  const {
    cameraAsleep,
    cameraBusyRef,
    cameraFrame,
    cameraUsable,
    deviceStatus,
    deviceStatusLoaded,
    leaseToken,
    previewFetching,
    sessionId,
    sessionStarting,
    sessionIssue,
    startCamera,
    stopCamera,
    cancelStart,
    waitingForCamera,
  } = useCaptureCameraSession({ setError, setStatus });

  // Load persisted preferences + directory handle after hydration.
  useEffect(() => {
    setHydrated(true);
    const supports = "showDirectoryPicker" in window;
    setSupportsFS(supports);

    const prefs = loadPrefs();
    setLocation(prefs.location);
    setPattern(prefs.pattern);
    setExt(prefs.ext);
    setCounter(prefs.counter);
    setPrefsLoaded(true);

    let cancelled = false;
    (async () => {
      // Yield one tick first: in dev, React (Strict Mode) mounts this
      // effect, tears it down, then mounts it again, all synchronously.
      // Without this yield, both the discarded and the real invocation
      // would race to POST /v1/sessions, and the edge API's single-writer
      // lock turns that into a spurious "camera is in use" error on the
      // instance that loses the race -- even though only this tab is really
      // using it.
      await Promise.resolve();
      if (cancelled) return;
      await startCamera();
    })();

    if (supports) {
      loadDirHandle().then(async (handle) => {
        if (!handle) return;
        const ok = await verifyPermission(handle, false);
        if (ok) {
          setDirHandle(handle);
          setDirName(handle.name);
        } else {
          // Permission dropped between sessions; keep the handle and let the
          // user re-grant via a click.
          setDirHandle(handle);
          setDirName(handle.name);
          setPendingReconnect(true);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [startCamera]);

  // Persist preferences whenever they change (after the initial load).
  useEffect(() => {
    if (!prefsLoaded) return;
    savePrefs({ location, pattern, ext, counter });
  }, [prefsLoaded, location, pattern, ext, counter]);

  async function captureToBin(bin: Bin) {
    if (!sessionId || !leaseToken) return;
    setError(null);
    setCapturingBin(bin);
    // Take the camera away from the preview loop, then let any preview frame
    // already in flight finish draining before we fire the capture sequence.
    cameraBusyRef.current = true;
    await new Promise((r) => setTimeout(r, 300));
    try {
      const triggered = await triggerCapture({ data: { sessionId, leaseToken } });
      if (!triggered.ok) {
        setError(triggered.message);
        return;
      }
      const job = await pollJob(triggered.job.jobId);
      if (job.status === "failed") {
        setError(job.error?.message ?? "Capture gagal");
        return;
      }
      const assetId = job.result?.asset.assetId;
      if (!assetId) {
        setError("Capture berhasil, tetapi tidak ada gambar yang dikembalikan");
        return;
      }
      const capturedAt = Date.now();
      const res = await getMediaContent({ data: { assetId } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const setBin = bin === "BIN 1" ? setBin1 : setBin2;
      setBin((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url, assetId, capturedAt };
      });
      setLastSource(bin);
      setStatus(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Capture gagal");
      const issue = describeCameraRuntimeIssue(getRuntimeErrorCode(error), message);
      setError(issue.detail);
    } finally {
      setCapturingBin(null);
      cameraBusyRef.current = false;
    }
  }

  async function runAutofocus() {
    if (!sessionId || !leaseToken) return;
    setError(null);
    setAutofocusing(true);
    cameraBusyRef.current = true;
    await new Promise((r) => setTimeout(r, 300));
    try {
      const triggered = await triggerAutofocus({ data: { sessionId, leaseToken } });
      if (!triggered.ok) {
        setError(triggered.message);
        return;
      }
      const job = await pollJob(triggered.job.jobId);
      if (job.status === "failed") {
        setError(job.error?.message ?? "Autofocus gagal");
        return;
      }
      setStatus("Fokus selesai");
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Autofocus gagal");
      const issue = describeCameraRuntimeIssue(getRuntimeErrorCode(error), message);
      setError(issue.detail);
    } finally {
      setAutofocusing(false);
      cameraBusyRef.current = false;
    }
  }

  async function pickDirectory() {
    setError(null);
    try {
      // @ts-expect-error - File System Access API
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(handle);
      setDirName(handle.name);
      setPendingReconnect(false);
      await saveDirHandle(handle);
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setError(getErrorMessage(error, "Gagal memilih folder"));
      }
    }
  }

  async function reconnectDirectory() {
    if (!dirHandle) return;
    const ok = await verifyPermission(dirHandle, true);
    if (ok) {
      setPendingReconnect(false);
      setStatus(`Folder ${dirName} berhasil tersambung ulang`);
    } else {
      setError("Izin folder ditolak, pilih ulang folder simpan");
    }
  }

  async function forgetDirectory() {
    setDirHandle(null);
    setDirName("");
    setPendingReconnect(false);
    await clearDirHandle();
  }

  async function ensurePermission(): Promise<boolean> {
    if (!dirHandle) return false;
    const ok = await verifyPermission(dirHandle, true);
    if (!ok) {
      setPendingReconnect(true);
      setError("Izin folder diperlukan, klik Sambungkan ulang");
    }
    return ok;
  }

  function clearBin(bin: Bin) {
    const setBin = bin === "BIN 1" ? setBin1 : setBin2;
    setBin((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  async function saveBin(bin: Bin) {
    const previewItem = bin === "BIN 1" ? bin1 : bin2;
    if (!previewItem || savingRef.current) return;
    savingRef.current = true;
    setSavingBin(bin);
    setError(null);
    const source = binToken(bin);
    const base = formatFilename(pattern, counter, toLocationToken(location), source);
    // Resolved to the actual on-disk name below (may gain a " (2)" suffix if a
    // same-minute capture already claimed the plain name).
    let filename = `${base}.${ext}`;

    let fileHandle: FileHandle | null = null;
    let parentDir: DirHandle | null = null;

    try {
      let savedNetworkPath: string | null = null;
      let persistedPath: string | null = null;
      let saveMethod: CaptureSaveMethod = "browser-download";
      let saveConfirmed = false;
      let permissionAlreadyReported = false;

      // Tier 1: ask the edge device to export the asset it already has to the
      // network share configured here (NETWORK_SAVE_ROOT, this app's own
      // env) -- zero-click, no File System Access picker involved, since the
      // edge device is a native process doing a plain fs write, not the
      // browser. This is the primary path whenever NETWORK_SAVE_ROOT is set;
      // ok:false (not configured, unreachable, or the write itself failed)
      // falls through to the browser's own save flow below instead of
      // failing the capture outright.
      if (sessionId && leaseToken) {
        const relativePath = `${datedPathSegment()}/${base}.${ext}`;
        const exported = await exportMediaToNetwork({
          data: { sessionId, leaseToken, assetId: previewItem.assetId, relativePath },
        });
        if (exported.ok) {
          filename = exported.filename;
          savedNetworkPath = exported.savedTo;
          persistedPath = exported.savedTo;
          saveMethod = "edge-network";
          saveConfirmed = true;
        } else if (exported.code !== "NETWORK_SAVE_NOT_CONFIGURED") {
          // NOT_CONFIGURED is the expected/common case (not every edge device
          // has a network share set up) and not worth alarming anyone about.
          // Anything else (unreachable, write failed) is a genuine anomaly --
          // still fall through to the folder/download tiers below so the
          // capture isn't lost, but say so, the same way the folder tier's
          // own failure gets a banner rather than failing silently.
          setError(
            `Network save dari edge device gagal (${exported.message}) — mencoba jalur simpan fallback.`,
          );
        }
      }

      if (!savedNetworkPath && dirHandle && supportsFS) {
        try {
          if (!(await ensurePermission())) {
            // ensurePermission() already surfaced its own "click Reconnect"
            // error and flipped pendingReconnect -- don't clobber that with
            // the generic message below, just fall through to the download.
            permissionAlreadyReported = true;
            throw new Error("Folder permission not granted");
          }
          const { dir: dayDir, path: datedPath } = await getDatedDirHandle(dirHandle);
          filename = await resolveUniqueName(dayDir, base, ext);
          fileHandle = await dayDir.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(previewItem.blob);
          await writable.close();
          parentDir = dayDir;
          savedNetworkPath = `${dirName}/${datedPath}/${filename}`;
          persistedPath = `${dirName}/${datedPath}/${filename}`;
          saveMethod = "browser-folder";
          saveConfirmed = true;
        } catch (error: unknown) {
          // Network share unreachable, permission lost, or write failed --
          // don't lose the capture, fall back to a local download. The
          // operator moves it to the shared folder by hand once it's back.
          fileHandle = null;
          parentDir = null;
          if (!permissionAlreadyReported) {
            setError(
              `Folder jaringan tidak tersedia (${getErrorMessage(error, "error tidak diketahui")}) — hasil capture diunduh lokal sebagai gantinya. Pindahkan manual ke shared folder bila diperlukan.`,
            );
          }
        }
      }

      if (savedNetworkPath) {
        setStatus(`Tersimpan ke ${savedNetworkPath}`);
      } else {
        const url = URL.createObjectURL(previewItem.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        const downloadStatus =
          dirHandle && supportsFS ? `${filename} diunduh lokal` : `${filename} berhasil diunduh`;
        setStatus(downloadStatus);
        persistedPath = `browser-download/${filename}`;
      }

      const profile = loadDeviceProfile();
      const checksumSha256 = await sha256Hex(previewItem.blob);
      const captureRecord = await recordCaptureResult({
        data: {
          deviceCode: profile?.deviceCode || deviceStatus?.deviceId || "edge-camera-01",
          deviceName: profile?.deviceName || deviceStatus?.deviceId || null,
          plant: location,
          captureBin: bin,
          station: profile?.station ?? null,
          fileName: filename,
          filePath: persistedPath ?? savedNetworkPath ?? `browser-download/${filename}`,
          saveMethod,
          capturedAt: previewItem.capturedAt,
          fileSizeBytes: previewItem.blob.size,
          checksumSha256,
          assetId: previewItem.assetId,
        },
      });
      if (!captureRecord.ok) {
        setStatus((prev) =>
          prev
            ? `${prev}. Metadata capture belum tercatat ke DB (${captureRecord.message}).`
            : `Metadata capture belum tercatat ke DB (${captureRecord.message}).`,
        );
      }

      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: filename,
        url: URL.createObjectURL(previewItem.blob),
        blob: previewItem.blob,
        folder: location,
        bin: source,
        fileHandle,
        parentDir,
        createdAt: previewItem.capturedAt,
        captureRecordId: captureRecord.ok ? captureRecord.recordId : null,
        persistedPath: persistedPath ?? savedNetworkPath ?? `browser-download/${filename}`,
        saveMethod,
      };
      await addGalleryItem(item);

      setCounter((c) => c + 1);
      // Only clear the frozen still when we know the save really completed.
      // A browser download triggered via <a download> gives no signal for
      // whether the user actually saved the file or cancelled the dialog, so
      // keep the preview visible on that fallback path.
      if (saveConfirmed) {
        clearBin(bin);
      }
    } finally {
      savingRef.current = false;
      setSavingBin(null);
    }
  }

  function resetCounter() {
    setCounter(1);
  }

  const nextFilename = `${formatFilename(pattern, counter, toLocationToken(location), binToken(lastSource))}.${ext}`;
  const fsUnsupportedNote = hydrated && !supportsFS;
  const currentOperationRunning =
    capturingBin !== null || autofocusing || savingBin !== null || previewFetching;
  const sessionIssueDetails = sessionIssue
    ? describeCameraRuntimeIssue(sessionIssue.code, sessionIssue.message)
    : null;
  const runtimeBootstrapping =
    !deviceStatusLoaded && !sessionIssue && !sessionId && !waitingForCamera && !sessionStarting;
  const sessionSummary = getCaptureSessionSummary({
    deviceStatus,
    sessionId,
    sessionStarting,
    waitingForCamera,
  });
  const prioritizedSessionIssue =
    sessionIssue?.code === "SESSION_CONFLICT" &&
    deviceStatusLoaded &&
    (!deviceStatus?.online || !deviceStatus.camera?.connected)
      ? null
      : sessionIssueDetails;
  const activeRuntimeIssue = runtimeBootstrapping
    ? null
    : (prioritizedSessionIssue ??
      (!deviceStatus?.online
        ? describeCameraRuntimeIssue(
            "UNREACHABLE",
            "Aplikasi belum bisa menjangkau service kamera pada edge device.",
          )
        : !deviceStatus.camera?.connected
          ? describeCameraRuntimeIssue(
              "CAMERA_DISCONNECTED",
              "Kamera belum terdeteksi oleh edge node.",
            )
          : cameraAsleep
            ? describeCameraRuntimeIssue(
                "PREVIEW_UNAVAILABLE",
                "Kamera tersambung tetapi belum memberi preview yang stabil.",
              )
            : null));
  const captureActionHint = getCaptureActionHint({
    sessionId,
    sessionStarting,
    waitingForCamera,
    cameraAsleep,
    deviceStatus,
    operationInProgress: currentOperationRunning,
  });
  const runtimeActions = getCaptureRuntimeActions({
    sessionId,
    sessionStarting,
    waitingForCamera,
    cameraAsleep,
    deviceStatus,
    operationInProgress: currentOperationRunning,
  });
  const runtimeCards = [
    {
      title: "Edge API",
      status: !deviceStatusLoaded
        ? "Sinkronisasi"
        : deviceStatus?.online
          ? "Terjangkau"
          : "Offline",
      detail: !deviceStatusLoaded
        ? "Status edge device sedang dimuat dari service kamera."
        : deviceStatus?.online
          ? `Status koneksi: ${deviceStatus.connectionState ?? "unknown"}.`
          : "Aplikasi belum bisa menjangkau edge camera service.",
      hint: !deviceStatusLoaded
        ? "Tunggu sampai aplikasi selesai membaca status edge runtime."
        : deviceStatus?.deviceId
          ? `Device ID: ${deviceStatus.deviceId}`
          : "Periksa jaringan LAN dan status service edge device.",
      icon: Wifi,
      tone: !deviceStatusLoaded
        ? ("warning" as const)
        : deviceStatus?.online
          ? ("success" as const)
          : ("danger" as const),
    },
    {
      title: "Camera USB",
      status: !deviceStatusLoaded
        ? "Menunggu"
        : deviceStatus?.camera?.connected
          ? "Terhubung"
          : "Terputus",
      detail: !deviceStatusLoaded
        ? "Deteksi kamera USB menunggu status edge pertama selesai dibaca."
        : deviceStatus?.camera?.connected
          ? `${deviceStatus.camera.manufacturer ?? "Camera"} ${deviceStatus.camera.model ?? ""}`.trim()
          : "Kamera belum terdeteksi oleh edge node.",
      hint: !deviceStatusLoaded
        ? "Status kabel USB dan model kamera akan tampil setelah sinkronisasi awal."
        : deviceStatus?.camera?.connected
          ? `Serial: ${deviceStatus.camera.serialNumber ?? "tidak tersedia"}`
          : "Pastikan kabel USB dan power kamera aktif.",
      icon: Camera,
      tone: !deviceStatusLoaded
        ? ("warning" as const)
        : deviceStatus?.camera?.connected
          ? ("success" as const)
          : ("danger" as const),
    },
    {
      title: "Session Lease",
      status: waitingForCamera
        ? "Menunggu"
        : sessionStarting
          ? "Menghubungkan"
          : sessionId
            ? "Aktif"
            : "Berhenti",
      detail: !deviceStatusLoaded
        ? "Aplikasi sedang menyelaraskan status edge dan session awal."
        : sessionSummary.detail,
      hint:
        prioritizedSessionIssue && sessionIssue
          ? `${prioritizedSessionIssue.title} · ${formatRelativeTime(sessionIssue.updatedAt)}`
          : "Lease akan diperbarui otomatis selama tab aktif.",
      icon: Activity,
      tone: sessionSummary.tone === "info" ? ("warning" as const) : sessionSummary.tone,
    },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capture</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ambil gambar dari kamera, lihat preview, lalu simpan ke folder pilihan dengan format
            nama file kustom.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Lokasi:</span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-transparent font-semibold outline-none"
          >
            {PLANTS.map((plant) => (
              <option key={plant} value={plant}>
                {plant}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {status && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {status}
        </div>
      )}
      {hydrated && supportsFS && !dirName && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span>
            Belum ada folder simpan yang dipilih. Hasil capture akan diunduh ke folder `Downloads`
            browser sebagai fallback.
          </span>
          <button
            onClick={pickDirectory}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Pilih folder
          </button>
        </div>
      )}
      {cameraAsleep && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Kamera tidak merespons{" "}
          {deviceStatus?.connectionState ? `(${deviceStatus.connectionState})` : ""}. Kamera Canon
          kemungkinan sleep. Bangunkan kamera dengan half-press shutter atau power-cycle; capture
          dijeda sampai koneksi kembali stabil.
        </div>
      )}
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Runtime Kamera
              </h2>
              <div className="mt-1 text-xl font-semibold">
                {runtimeBootstrapping
                  ? "Menyelaraskan status kamera"
                  : (activeRuntimeIssue?.title ?? sessionSummary.title)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Status ini membantu operator membedakan masalah edge API, koneksi kamera USB, dan
                lease session sebelum menjalankan capture.
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-right text-xs">
              <div className="text-muted-foreground">Hint tindakan</div>
              <div className="mt-1 max-w-64 font-medium text-foreground">{captureActionHint}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {runtimeCards.map((card) => (
              <RuntimeCard key={card.title} {...card} />
            ))}
          </div>
        </div>

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            {activeRuntimeIssue?.tone === "danger" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : activeRuntimeIssue ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            <h2 className="text-sm font-semibold">Tindakan Berikutnya</h2>
          </div>
          {activeRuntimeIssue ? (
            <div
              className={`rounded-lg border px-3 py-3 text-sm ${
                activeRuntimeIssue.tone === "danger"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-700"
              }`}
            >
              <div className="font-medium">{activeRuntimeIssue.title}</div>
              <div className="mt-1">{activeRuntimeIssue.detail}</div>
              <div className="mt-2 text-xs">{activeRuntimeIssue.nextAction}</div>
            </div>
          ) : runtimeBootstrapping ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm text-muted-foreground">
              Aplikasi sedang memuat status edge device dan mencoba menyelaraskan session kamera.
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 text-sm text-muted-foreground">
              Session, edge API, dan kamera tidak menunjukkan blocker utama saat ini.
            </div>
          )}
          <div className="mt-3 space-y-2">
            {runtimeActions.map((item) => (
              <div
                key={item}
                className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {(["BIN 1", "BIN 2"] as Bin[]).map((bin) => {
          const preview = bin === "BIN 1" ? bin1 : bin2;
          const isCapturing = capturingBin === bin;
          const isSaving = savingBin === bin;
          // Once this bin has a captured still, its panel freezes on that
          // image instead of the shared live feed -- so BIN 1 and BIN 2 each
          // hold their own photo and never visually overwrite each other.
          const showFrozen = !!preview;
          const tone = showFrozen
            ? {
                pill: "bg-amber-500/10 text-amber-600",
                dot: "bg-amber-500",
                label: "Sudah dicapture",
              }
            : !sessionId
              ? {
                  pill: "bg-muted text-muted-foreground",
                  dot: "bg-muted-foreground/40",
                  label: "Kamera Off",
                }
              : cameraAsleep
                ? {
                    pill: "bg-destructive/10 text-destructive",
                    dot: "bg-destructive",
                    label: "Kamera sleep",
                  }
                : {
                    pill: "bg-emerald-500/10 text-emerald-600",
                    dot: "bg-emerald-500",
                    label: "Live",
                  };
          return (
            <section key={bin} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{bin}</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tone.pill}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {tone.label}
                </span>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                {showFrozen ? (
                  <>
                    <img
                      src={preview.url}
                      alt={`${bin} hasil capture`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      Hasil capture
                    </span>
                  </>
                ) : cameraFrame ? (
                  <img
                    src={cameraFrame}
                    alt={`${bin} preview live`}
                    className={`h-full w-full object-cover transition-opacity duration-150 ${previewFetching ? "opacity-70" : "opacity-100"}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {sessionStarting
                      ? "Menghubungkan ke kamera…"
                      : cameraAsleep
                        ? "Kamera tidak merespons…"
                        : sessionId
                          ? "Menunggu preview…"
                          : "Kamera belum aktif"}
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {showFrozen
                    ? "Capture dibekukan"
                    : cameraAsleep
                      ? "Tidak ada sinyal"
                      : "Preview langsung"}
                </span>
                {showFrozen && <span className="text-emerald-600">Siap disimpan</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => captureToBin(bin)}
                  disabled={!cameraUsable || capturingBin !== null || isSaving || autofocusing}
                  title={captureActionHint}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCapturing
                    ? "Mengambil…"
                    : showFrozen
                      ? `Ambil ulang ${bin}`
                      : `Capture ${bin}`}
                </button>
                <button
                  onClick={() => saveBin(bin)}
                  disabled={!preview || isSaving}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan…" : `Simpan ${bin}`}
                </button>
                {showFrozen && (
                  <button
                    onClick={() => clearBin(bin)}
                    disabled={isSaving}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Buang
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!sessionId ? (
          waitingForCamera ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Kamera sedang dipakai station lain, menunggu giliran untuk terhubung…
              </span>
              <button
                onClick={cancelStart}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Hentikan tunggu
              </button>
            </>
          ) : (
            <button
              onClick={startCamera}
              disabled={sessionStarting}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {sessionStarting ? "Menghubungkan…" : "Mulai kamera"}
            </button>
          )
        ) : (
          <button
            onClick={stopCamera}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Hentikan session
          </button>
        )}
        <button
          onClick={runAutofocus}
          disabled={!cameraUsable || capturingBin !== null || autofocusing}
          title={captureActionHint}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <Crosshair className="h-3.5 w-3.5" />
          {autofocusing ? "Memfokuskan…" : "Autofocus"}
        </button>
      </div>

      {/* Settings */}
      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="mb-4 text-lg font-semibold">Pengaturan Simpan</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Folder simpan (Shared Folder)</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={pickDirectory}
                disabled={hydrated && !supportsFS}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {dirName ? "Ganti folder" : "Pilih folder"}
              </button>
              {pendingReconnect && (
                <button
                  onClick={reconnectDirectory}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Sambungkan ulang
                </button>
              )}
              {dirName && (
                <button
                  onClick={forgetDirectory}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                >
                  Lupakan
                </button>
              )}
              <span className="text-sm text-muted-foreground">
                {dirName
                  ? `${dirName}${pendingReconnect ? " (izin diperlukan)" : " · diingat"}`
                  : fsUnsupportedNote
                    ? "Tidak didukung — akan diunduh"
                    : "Belum ada folder dipilih"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Jika aplikasi ini sudah punya folder simpan jaringan yang dikonfigurasi, setiap
              capture akan otomatis disimpan ke sana sehingga folder di sini tidak wajib dipilih.
              Picker ini adalah fallback saat path tersebut belum tersedia: pilih folder, misalnya
              network share seperti{" "}
              <span className="font-mono">{"\\\\10.1.1.44\\Data Analythics\\ML\\MTI"}</span>, lalu
              gambar akan dikirim ke sana dengan subfolder Tahun/Bulan/Hari yang sama, misalnya
              `2026/07/18`. Browser hanya menampilkan nama folder, bukan path jaringan penuh. Jika
              semua jalur simpan gagal diakses, hasil capture akan diunduh lokal agar tidak hilang.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Lokasi</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PLANTS.map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Menentukan capture ini berasal dari plant yang mana.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sumber</label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
              BIN 1 / BIN 2
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ditentukan otomatis dari tombol Capture BIN yang dipakai.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Format file</label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">JPEG</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Disimpan langsung dari kamera sebagai JPEG (`.jpg`).
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Format nama file</label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tokens: {"{DD} {MMMM} {MM} {YYYY} {HH} {mm} {ss} {LOCATION} {SOURCE} {INDEX} {TS}"}
              <br />
              {"{MMMM}"} = nama bulan lengkap (July), {"{LOCATION}"} = kode plant (AP / CP)
              <br />
              {/* nextFilename embeds the current clock, so it must not be
                    rendered until after hydration -- the server's HH.mm and the
                    browser's would differ by the time hydration runs, and React
                    would throw a text-mismatch (#418) on this node. */}
              Contoh: <span className="font-mono">{hydrated ? nextFilename : "—"}</span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Indeks gambar</label>
            <div className="flex items-center gap-2">
              <input
                value={String(counter).padStart(3, "0")}
                readOnly
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={resetCounter}
                title="Reset ke 001"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Bertambah otomatis setelah setiap capture.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
          File berikutnya akan disimpan sebagai: {hydrated ? nextFilename : "—"}
        </div>
      </section>
    </div>
  );
}
