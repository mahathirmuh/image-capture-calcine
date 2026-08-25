import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
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
import { triggerCapture, triggerAutofocus, pollJob, getMediaContent } from "@/lib/camera-api";
import { saveMediaToNetwork } from "@/lib/network-save";
import {
  logDeviceEvent,
  recordCaptureResult,
  type CaptureSaveMethod,
  type DeviceEventSeverity,
} from "@/lib/capture-records";
import { loadDeviceProfile } from "@/lib/device-config";
import {
  describeCameraRuntimeIssue,
  getCaptureActionHint,
  getCaptureRuntimeActions,
  getCaptureSessionSummary,
  getRuntimeErrorCode,
} from "@/lib/camera-runtime";
import {
  BIN_SLOTS,
  PLANTS,
  toBinLabel,
  toBinToken,
  toLocationToken,
  type BinSlot,
} from "@/lib/locations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getOperatorPlant, type OperatorPlant } from "@/lib/operator-plant";
import { PageTitle } from "@/components/page-shell";

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
// Slot capture, disimpan sebagai angka. Teksnya ("BIN 1" / "TRAIN 1")
// diturunkan dari plant yang sedang dipilih lewat toBinLabel(), jadi tidak ada
// tempat di komponen ini yang membandingkan slot dengan kata "BIN".
type Bin = BinSlot;
// assetId is kept around so Save can later ask the edge device to export the
// already-captured asset straight to its network share, without the browser
// re-uploading the bytes it already downloaded once for the preview.
type BinPreview = { blob: Blob; url: string; assetId: string; capturedAt: number };

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
    <div className="rounded-xl border bg-card shadow-sm p-4">
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
  const [lastSource, setLastSource] = useState<Bin>(1);
  const [savingBin, setSavingBin] = useState<Bin | null>(null);
  // Bin yang sedang menunggu konfirmasi simpan. Dipisahkan dari `savingBin`
  // karena keduanya menandai fase berbeda: yang ini "operator belum memutuskan",
  // yang itu "penulisan sedang berjalan".
  const [confirmSaveBin, setConfirmSaveBin] = useState<Bin | null>(null);
  const [autofocusing, setAutofocusing] = useState(false);
  // Synchronous re-entrancy guard for saves. `savingBin` is state (async), so a
  // fast double-click could pass its check twice before re-render; this ref
  // closes that window and prevents the same still being written under the same
  // index twice (which would silently overwrite the first file).
  const savingRef = useRef(false);

  const [dirHandle, setDirHandle] = useState<DirHandle | null>(null);
  const [dirName, setDirName] = useState<string>("");
  const [location, setLocation] = useState<string>(DEFAULT_PREFS.location);
  const [operatorPlant, setOperatorPlant] = useState<OperatorPlant | null>(null);

  // Plant yang benar-benar dipakai capture ini. Operator yang terikat satu
  // plant memakai plant itu apa pun isi dropdown-nya; Super Admin memakai
  // pilihannya sendiri.
  //
  // Diturunkan, bukan disimpan ke state `location`, supaya tidak ada balapan
  // dengan pemuatan prefs -- prefs boleh menang atau kalah, hasilnya tetap
  // sama, dan nilai pilihan operator tidak ikut tertimpa di localStorage.
  const activePlant = operatorPlant?.locked && operatorPlant.plant ? operatorPlant.plant : location;
  const plantLocked = !!operatorPlant?.locked;

  // Satu sumber untuk label slot: apa yang dibaca operator, yang masuk ke nama
  // berkas, dan yang tersimpan sebagai captureBin semuanya turun dari sini.
  const binLabel = (slot: BinSlot) => toBinLabel(activePlant, slot);
  const [pattern, setPattern] = useState<string>(DEFAULT_PREFS.pattern);
  const [ext, setExt] = useState<"jpg">(DEFAULT_PREFS.ext);
  const [counter, setCounter] = useState<number>(DEFAULT_PREFS.counter);
  const [livePreview, setLivePreview] = useState<boolean>(DEFAULT_PREFS.livePreview);

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
    fetchPreviewOnce,
    leaseToken,
    previewFetching,
    sessionId,
    sessionStarting,
    sessionIssue,
    startCamera,
    stopCamera,
    cancelStart,
    waitingForCamera,
  } = useCaptureCameraSession({ setError, setStatus, previewEnabled: livePreview });

  function getActiveDeviceContext() {
    const profile = loadDeviceProfile();
    return {
      deviceCode: profile?.deviceCode || deviceStatus?.deviceId || "edge-camera-01",
      deviceName: profile?.deviceName || deviceStatus?.deviceId || null,
      station: profile?.station ?? null,
    };
  }

  async function logOperationalEvent(
    eventType: string,
    severity: DeviceEventSeverity,
    message: string,
    payload?: Record<string, unknown>,
  ) {
    const context = getActiveDeviceContext();
    await logDeviceEvent({
      data: {
        deviceCode: context.deviceCode,
        eventType,
        severity,
        message,
        payload: {
          source: "capture-page",
          deviceName: context.deviceName,
          station: context.station,
          plant: activePlant,
          sessionId: sessionId ?? null,
          hasLeaseToken: !!leaseToken,
          connectionState: deviceStatus?.connectionState ?? null,
          cameraConnected: !!deviceStatus?.camera?.connected,
          ...payload,
        },
      },
    });
  }

  // Load persisted preferences + directory handle after hydration.
  useEffect(() => {
    setHydrated(true);
    const supports = "showDirectoryPicker" in window;
    setSupportsFS(supports);

    // Plant pengikat dibaca dari server, bukan dari cookie sesi -- lihat
    // operator-plant.ts. Kegagalannya sengaja dibiarkan senyap: hasilnya
    // dropdown tetap bebas seperti sebelumnya, bukan halaman yang macet.
    void getOperatorPlant()
      .then(setOperatorPlant)
      .catch(() => setOperatorPlant(null));

    const prefs = loadPrefs();
    setLocation(prefs.location);
    setPattern(prefs.pattern);
    setExt(prefs.ext);
    setCounter(prefs.counter);
    setLivePreview(prefs.livePreview);
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
    savePrefs({ location, pattern, ext, counter, livePreview });
  }, [prefsLoaded, location, pattern, ext, counter, livePreview]);

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
        void logOperationalEvent("capture-trigger-failed", "warning", triggered.message, {
          bin,
        });
        setError(triggered.message);
        return;
      }
      const job = await pollJob(triggered.job.jobId);
      if (job.status === "failed") {
        void logOperationalEvent(
          "capture-job-failed",
          "error",
          job.error?.message ?? "Capture gagal",
          {
            bin,
            jobId: triggered.job.jobId,
          },
        );
        setError(job.error?.message ?? "Capture gagal");
        return;
      }
      const assetId = job.result?.asset.assetId;
      if (!assetId) {
        void logOperationalEvent(
          "capture-missing-asset",
          "error",
          "Capture berhasil, tetapi asset tidak tersedia.",
          {
            bin,
            jobId: triggered.job.jobId,
          },
        );
        setError("Capture berhasil, tetapi tidak ada gambar yang dikembalikan");
        return;
      }
      const capturedAt = Date.now();
      const res = await getMediaContent({ data: { assetId } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const setBin = bin === 1 ? setBin1 : setBin2;
      setBin((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url, assetId, capturedAt };
      });
      setLastSource(bin);
      setStatus(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Capture gagal");
      const issue = describeCameraRuntimeIssue(getRuntimeErrorCode(error), message);
      void logOperationalEvent("capture-exception", "error", message, {
        bin,
        runtimeCode: getRuntimeErrorCode(error) ?? null,
      });
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
        void logOperationalEvent("autofocus-trigger-failed", "warning", triggered.message);
        setError(triggered.message);
        return;
      }
      const job = await pollJob(triggered.job.jobId);
      if (job.status === "failed") {
        void logOperationalEvent(
          "autofocus-job-failed",
          "error",
          job.error?.message ?? "Autofocus gagal",
          {
            jobId: triggered.job.jobId,
          },
        );
        setError(job.error?.message ?? "Autofocus gagal");
        return;
      }
      setStatus("Fokus selesai");
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Autofocus gagal");
      const issue = describeCameraRuntimeIssue(getRuntimeErrorCode(error), message);
      void logOperationalEvent("autofocus-exception", "error", message, {
        runtimeCode: getRuntimeErrorCode(error) ?? null,
      });
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
    const setBin = bin === 1 ? setBin1 : setBin2;
    setBin((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  async function saveBin(bin: Bin) {
    const previewItem = bin === 1 ? bin1 : bin2;
    if (!previewItem || savingRef.current) return;
    savingRef.current = true;
    setSavingBin(bin);
    setError(null);
    const source = toBinToken(activePlant, bin);
    const base = formatFilename(pattern, counter, toLocationToken(activePlant), source);
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
      const fallbackReasons: string[] = [];

      // Tier 1: this app's own server pulls the asset bytes from the edge
      // device and writes them to NETWORK_SAVE_ROOT itself -- zero-click, no
      // File System Access picker involved, since a Node process on the app
      // server is doing a plain fs write, not the browser. This is the primary
      // path whenever NETWORK_SAVE_ROOT is set; ok:false (not configured,
      // unreachable, or the write itself failed) falls through to the
      // browser's own save flow below instead of failing the capture outright.
      //
      // No camera session is needed here, so this deliberately runs even when
      // the lease has already expired -- the edge's /content endpoint doesn't
      // ask for a session token, and a lapsed lease is no reason to push a
      // capture down to a browser download.
      {
        // Plant jadi folder pertama di bawah NETWORK_SAVE_ROOT, baru YYYY/MM/DD:
        //
        //   <NETWORK_SAVE_ROOT>/Chloride Plant/2026/08/25/<nama berkas>
        //
        // Nama plantnya sengaja tidak ikut masuk ke env. Satu nilai
        // NETWORK_SAVE_ROOT melayani semua plant dan berhenti di folder induk
        // bersama ("Foto Sampling"); kalau plantnya ikut di env, setiap plant
        // menuntut variabel dan deployment sendiri, padahal satu app server
        // melayani operator dari plant mana pun.
        //
        // Folder plant dan tanggalnya dibuat sendiri oleh saveMediaToNetwork --
        // hanya root-nya yang wajib sudah ada, karena root yang hilang adalah
        // tanda share tidak ter-mount.
        const relativePath = `${activePlant}/${datedPathSegment()}/${base}.${ext}`;
        const saved = await saveMediaToNetwork({
          data: { assetId: previewItem.assetId, relativePath },
        });
        if (saved.ok) {
          filename = saved.filename;
          savedNetworkPath = saved.savedTo;
          persistedPath = saved.savedTo;
          saveMethod = "app-network";
          saveConfirmed = true;
        } else if (saved.code !== "NETWORK_SAVE_NOT_CONFIGURED") {
          // NOT_CONFIGURED is the expected/common case (not every deployment
          // has a network share set up) and not worth alarming anyone about.
          // Anything else (unreachable, write failed) is a genuine anomaly --
          // still fall through to the folder/download tiers below so the
          // capture isn't lost, but say so, the same way the folder tier's
          // own failure gets a banner rather than failing silently.
          setError(
            `Network save dari app server gagal (${saved.message}) — mencoba jalur simpan fallback.`,
          );
          fallbackReasons.push(`app-network:${saved.code}`);
          void logOperationalEvent(
            "network-save-fallback",
            "warning",
            `Network save dari app server gagal: ${saved.message}`,
            {
              bin,
              assetId: previewItem.assetId,
              fallbackTo: "browser-folder-or-download",
              saveErrorCode: saved.code,
            },
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
            fallbackReasons.push("browser-folder:permission-not-granted");
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
          fallbackReasons.push("browser-folder:write-failed");
          void logOperationalEvent(
            "folder-save-fallback",
            "warning",
            `Folder fallback browser gagal dipakai: ${getErrorMessage(error, "error tidak diketahui")}`,
            {
              bin,
              fallbackTo: "browser-download",
              permissionAlreadyReported,
            },
          );
        }
      }

      // Konfirmasi lewat toast, bukan hanya banner. Bannernya ada di puncak
      // halaman sedangkan tombol Simpan jauh di bawah panel bin, jadi setelah
      // diklik konfirmasinya sering berada di luar layar -- operator tidak
      // tahu apakah tersimpan atau tidak.
      //
      // Nadanya sengaja dibedakan, bukan "berhasil" untuk semua: hanya jalur
      // jaringan yang benar-benar menaruh berkas di share. Dua jalur lainnya
      // tetap menyelamatkan foto, tapi masih menyisakan pekerjaan manual, dan
      // menyebut itu "berhasil" membuat orang berhenti memeriksanya.
      if (savedNetworkPath) {
        if (saveMethod === "app-network") {
          setStatus(`${binLabel(bin)} tersimpan ke folder jaringan: ${savedNetworkPath}`);
          toast.success(`${binLabel(bin)} tersimpan ke folder jaringan`, {
            description: savedNetworkPath,
            duration: 6000,
          });
        } else {
          setStatus(`${binLabel(bin)} tersimpan ke folder browser: ${savedNetworkPath}`);
          toast.warning(`${binLabel(bin)} tersimpan ke folder browser`, {
            description: `${savedNetworkPath} — belum masuk folder jaringan.`,
            duration: 8000,
          });
        }
      } else {
        const url = URL.createObjectURL(previewItem.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setStatus(`${binLabel(bin)} diunduh lokal: ${filename} — belum masuk folder jaringan.`);
        toast.warning(`${binLabel(bin)} diunduh lokal`, {
          description: `${filename} belum masuk folder jaringan. Pindahkan manual bila diperlukan.`,
          duration: 8000,
        });
        persistedPath = `browser-download/${filename}`;
        if (fallbackReasons.length > 0 || dirHandle || !supportsFS) {
          void logOperationalEvent(
            "browser-download-fallback",
            fallbackReasons.length > 0 ? "warning" : "info",
            `${filename} berakhir diunduh lokal sebagai jalur simpan akhir.`,
            {
              bin,
              fallbackReasons,
              supportsFS,
              hasDirHandle: !!dirHandle,
            },
          );
        }
      }

      const profile = loadDeviceProfile();
      const checksumSha256 = await sha256Hex(previewItem.blob);
      const captureRecord = await recordCaptureResult({
        data: {
          deviceCode: profile?.deviceCode || deviceStatus?.deviceId || "edge-camera-01",
          deviceName: profile?.deviceName || deviceStatus?.deviceId || null,
          plant: activePlant,
          captureBin: binLabel(bin),
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
        void logOperationalEvent(
          "capture-record-sync-failed",
          "warning",
          `Metadata capture gagal dicatat ke DB: ${captureRecord.message}`,
          {
            bin,
            fileName: filename,
            filePath: persistedPath ?? savedNetworkPath ?? `browser-download/${filename}`,
            saveMethod,
          },
        );
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
        folder: activePlant,
        bin: binLabel(bin),
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

  const nextFilename = `${formatFilename(pattern, counter, toLocationToken(activePlant), toBinToken(activePlant, lastSource))}.${ext}`;
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
          : (deviceStatus?.statusMessage ?? "Aplikasi belum bisa menjangkau edge camera service."),
      hint: !deviceStatusLoaded
        ? "Tunggu sampai aplikasi selesai membaca status edge runtime."
        : deviceStatus?.deviceId
          ? `Device ID: ${deviceStatus.deviceId}`
          : (deviceStatus?.statusMessage ?? "Periksa jaringan LAN dan status service edge device."),
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
          <PageTitle
            title="Capture"
            description="Ambil gambar dari kamera, lihat preview, lalu simpan ke folder pilihan dengan format nama file kustom."
          />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Lokasi:</span>
          <select
            value={activePlant}
            onChange={(e) => setLocation(e.target.value)}
            disabled={plantLocked}
            title={plantLocked ? "Akun Anda terpasang di plant ini" : undefined}
            className="bg-transparent font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-100"
          >
            {(plantLocked ? [activePlant] : PLANTS).map((plant) => (
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
        <div className="rounded-xl border bg-card shadow-sm p-5">
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

        <section className="rounded-xl border bg-card shadow-sm p-5">
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
        {BIN_SLOTS.map((bin) => {
          const preview = bin === 1 ? bin1 : bin2;
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
            <section key={bin} className="rounded-xl border bg-card shadow-sm p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{binLabel(bin)}</h2>
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
                      alt={`${binLabel(bin)} hasil capture`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      Hasil capture
                    </span>
                  </>
                ) : cameraFrame ? (
                  <img
                    src={cameraFrame}
                    alt={`${binLabel(bin)} preview live`}
                    className={`h-full w-full object-cover transition-opacity duration-150 ${previewFetching ? "opacity-70" : "opacity-100"}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {sessionStarting
                      ? "Menghubungkan ke kamera…"
                      : cameraAsleep
                        ? "Kamera tidak merespons…"
                        : !sessionId
                          ? "Kamera belum aktif"
                          : livePreview
                            ? "Menunggu preview…"
                            : "Live preview mati — capture tetap bisa dijalankan"}
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
                      : livePreview
                        ? "Preview langsung"
                        : "Preview mati"}
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
                      ? `Ambil ulang ${binLabel(bin)}`
                      : `Capture ${binLabel(bin)}`}
                </button>
                <button
                  onClick={() => setConfirmSaveBin(bin)}
                  disabled={!preview || isSaving}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan…" : `Simpan ${binLabel(bin)}`}
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
          onClick={() => setLivePreview((on) => !on)}
          disabled={!cameraUsable || capturingBin !== null}
          title={
            livePreview
              ? "Matikan preview agar kamera tidak bekerja terus-menerus"
              : "Nyalakan preview untuk melihat framing sebelum capture"
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${livePreview ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {livePreview ? "Matikan Live Preview" : "Live Preview"}
        </button>
        {!livePreview && (
          <button
            onClick={() => void fetchPreviewOnce()}
            disabled={!cameraUsable || capturingBin !== null || previewFetching}
            title="Ambil satu frame preview tanpa menyalakan polling terus-menerus"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {previewFetching ? "Mengambil…" : "Ambil 1 frame"}
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
      <section className="mt-6 rounded-xl border bg-card shadow-sm p-4">
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
              <span className="font-mono">{"\\\\10.1.1.44\\Data Analytics\\ML\\MTI"}</span>, lalu
              gambar akan dikirim ke sana dengan subfolder Tahun/Bulan/Hari yang sama, misalnya
              `2026/07/18`. Browser hanya menampilkan nama folder, bukan path jaringan penuh. Jika
              semua jalur simpan gagal diakses, hasil capture akan diunduh lokal agar tidak hilang.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Lokasi</label>
            <select
              value={activePlant}
              onChange={(e) => setLocation(e.target.value)}
              disabled={plantLocked}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(plantLocked ? [activePlant] : PLANTS).map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {plantLocked
                ? `Akun Anda terpasang di ${activePlant}, jadi lokasinya tidak bisa diubah dari sini.`
                : "Menentukan capture ini berasal dari plant yang mana."}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sumber</label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
              {binLabel(1)} / {binLabel(2)}
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

      {/* Konfirmasi sebelum menulis. Simpan tidak bisa dibatalkan dari sini --
          berkasnya langsung mendarat di folder jaringan dan indeks gambar ikut
          maju -- jadi nama berkas yang akan dipakai ditampilkan sekalian,
          supaya salah lokasi atau salah indeks ketahuan sebelum ditulis,
          bukan sesudah. */}
      <AlertDialog
        open={confirmSaveBin !== null}
        onOpenChange={(open) => !open && setConfirmSaveBin(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Simpan hasil capture {confirmSaveBin ? binLabel(confirmSaveBin) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Hasil capture dikirim ke folder jaringan dan dicatat ke registry. Setelah
                  tersimpan, berkasnya tidak bisa ditarik kembali dari halaman ini.
                </p>
                <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
                  {confirmSaveBin
                    ? `${formatFilename(pattern, counter, toLocationToken(activePlant), toBinToken(activePlant, confirmSaveBin))}.${ext}`
                    : "—"}
                </p>
                <p>
                  Lokasi: {activePlant}. Kalau folder jaringan sedang tidak bisa dipakai, hasil
                  capture diunduh lokal supaya tidak hilang.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                const bin = confirmSaveBin;
                setConfirmSaveBin(null);
                if (bin) void saveBin(bin);
              }}
            >
              Simpan {confirmSaveBin ? binLabel(confirmSaveBin) : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
