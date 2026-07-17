import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapPin, RotateCcw, Crosshair } from "lucide-react";
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
  createSession,
  releaseSession,
  renewSession,
  getPreviewFrame,
  triggerCapture,
  triggerAutofocus,
  pollJob,
  getMediaContent,
  getDeviceStatus,
  type DeviceStatus,
} from "@/lib/camera-api";
import { PLANTS, toLocationToken } from "@/lib/locations";

export const Route = createFileRoute("/capture")({
  component: CapturePage,
  head: () => ({
    meta: [
      { title: "Capture — Capture App" },
      {
        name: "description",
        content:
          "Capture images from your camera, preview, and save to a chosen directory with custom filename formats.",
      },
      { property: "og:title", content: "Capture — Capture App" },
      {
        property: "og:description",
        content:
          "Capture images from your camera, preview, and save to a chosen directory with custom filename formats.",
      },
    ],
  }),
});

type DirHandle = any;
type FileHandle = any;
type CameraSessionRef = { sessionId: string; leaseToken: string };
type Bin = "BIN 1" | "BIN 2";
type BinPreview = { blob: Blob; url: string };

// Release with `keepalive: true` so the request survives page teardown —
// used both when the user clicks "Stop camera" (the UI updates optimistically
// right after this fires) and on tab close, where a plain fetch would
// otherwise get cancelled mid-flight and leak the session for the full lease.
function releaseSessionKeepalive(session: CameraSessionRef) {
  return releaseSession({
    data: session,
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, keepalive: true }),
  }).catch(() => {
    /* best effort */
  });
}

function binToken(bin: Bin) {
  return bin.replace(" ", "");
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

function CapturePage() {
  const [cameraFrame, setCameraFrame] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leaseToken, setLeaseToken] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [capturingBin, setCapturingBin] = useState<Bin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [previewFetching, setPreviewFetching] = useState(false);

  const [bin1, setBin1] = useState<BinPreview | null>(null);
  const [bin2, setBin2] = useState<BinPreview | null>(null);
  const [lastSource, setLastSource] = useState<Bin>("BIN 1");
  const [savingBin, setSavingBin] = useState<Bin | null>(null);
  const [autofocusing, setAutofocusing] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  // True while we're blocked on another station holding the single-camera lock
  // and are auto-retrying to grab it once it frees.
  const [waitingForCamera, setWaitingForCamera] = useState(false);
  // Bumped on every start/cancel so a stale retry loop can detect it's been
  // superseded (also cleanly cancels the Strict Mode double-mount's first run).
  const startAttemptRef = useRef(0);

  const sessionRef = useRef<{ sessionId: string; leaseToken: string } | null>(null);
  // Synchronous re-entrancy guard for saves. `savingBin` is state (async), so a
  // fast double-click could pass its check twice before re-render; this ref
  // closes that window and prevents the same still being written under the same
  // index twice (which would silently overwrite the first file).
  const savingRef = useRef(false);
  // While true, the preview loop yields the camera. A still capture is a
  // multi-step gphoto2 sequence (set target → set capture → full-press); if the
  // preview poll interleaves a `--capture-preview` (liveview) between those
  // steps, the Canon rejects the full-press with "PTP Device Busy". Pausing
  // preview for the duration keeps the camera to the capture alone.
  const cameraBusyRef = useRef(false);

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
  }, []);

  // Persist preferences whenever they change (after the initial load).
  useEffect(() => {
    if (!prefsLoaded) return;
    savePrefs({ location, pattern, ext, counter });
  }, [prefsLoaded, location, pattern, ext, counter]);

  // Release the camera session on tab close / navigation away, best-effort.
  // Deliberately NOT tied to visibilitychange="hidden" -- that fires on
  // ordinary tab-switching too, which would kill the session (and its
  // leaseToken) every time the user looks away, while the preview loop below
  // expects to pause and resume against that same still-live session.
  useEffect(() => {
    function releaseOnExit() {
      const session = sessionRef.current;
      if (!session) return;
      releaseSessionKeepalive(session);
    }
    window.addEventListener("beforeunload", releaseOnExit);
    return () => {
      window.removeEventListener("beforeunload", releaseOnExit);
      releaseOnExit();
    };
  }, []);

  // Sequential preview polling: GET /v1/camera/preview does a real
  // gphoto2 --capture-preview round-trip over USB, measured at ~1.0-1.2s per
  // call against real hardware — well under 1fps. A fixed-tick setInterval
  // would stack up overlapping in-flight requests queued behind gphoto2 on
  // the edge node, so this awaits each call before scheduling the next one.
  // Shared by both bin panels, since there's one physical camera used
  // alternately between bins. Paused while the tab is hidden.
  useEffect(() => {
    if (!sessionId || !leaseToken) return;
    const session = { sessionId, leaseToken };
    let cancelled = false;
    let loopRunning = false;

    async function pollLoop() {
      if (loopRunning) return;
      loopRunning = true;
      while (!cancelled && document.visibilityState === "visible") {
        // Stand down while a capture/autofocus owns the camera.
        if (cameraBusyRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        setPreviewFetching(true);
        try {
          const res = await getPreviewFrame({ data: session });
          const blob = await res.blob();
          if (!cancelled) {
            setCameraFrame((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          }
        } catch {
          // Preview can be transiently unavailable (mid-capture, or a
          // camera-state 422) — one failed frame shouldn't kill the loop.
        } finally {
          setPreviewFetching(false);
        }
        if (cancelled || document.visibilityState !== "visible") break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      loopRunning = false;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") pollLoop();
    }

    pollLoop();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sessionId, leaseToken]);

  // Poll real device/camera connectivity independently of the session lock.
  // A session can stay "active" while the Canon has gone to sleep or dropped off
  // USB, so this drives an honest "is the camera actually there?" signal for the
  // badges and Capture buttons instead of trusting the session alone.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await getDeviceStatus();
        if (!cancelled) setDeviceStatus(s);
      } catch {
        /* keep last known status */
      }
    }
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Heartbeat: the edge API fixes a lease at creation and never extends it on
  // activity, so a continuously-open station must renew or its session dies
  // after ~120s and the camera drops out mid-use.
  //
  // Crucially, renew ONLY while this tab is visible. The camera is a single
  // shared resource: if a hidden/forgotten tab kept heartbeating it would hold
  // the camera hostage forever and every other station would be permanently
  // stuck on "Camera is in use". By pausing while hidden, a backgrounded tab
  // lets its lease lapse (≤120s) so the tab actually being used can take over
  // (its startCamera auto-retry grabs it as soon as it frees). Returning to a
  // tab renews immediately, or re-establishes if the lease already lapsed.
  useEffect(() => {
    if (!sessionId || !leaseToken) return;
    const sid = sessionId;
    const tok = leaseToken;
    let cancelled = false;

    async function beat() {
      if (cancelled || document.visibilityState !== "visible") return;
      const r = await renewSession({
        data: { sessionId: sid, leaseToken: tok, leaseSeconds: 120 },
      });
      if (cancelled) return;
      if (!r.ok) {
        sessionRef.current = null;
        setSessionId(null);
        setLeaseToken(null);
        startCamera();
      }
    }

    const id = setInterval(beat, 60000);
    function onVisible() {
      if (document.visibilityState === "visible") beat();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, leaseToken]);

  async function startCamera() {
    const attempt = ++startAttemptRef.current;
    setError(null);
    setSessionStarting(true);
    setWaitingForCamera(false);
    try {
      // The camera is a single-writer resource: only one station/tab can hold
      // the session at a time. If another one has it, don't just fail — keep
      // retrying so this station grabs the camera automatically the moment the
      // other releases it (or its lease expires), instead of getting stuck on a
      // "Camera is in use" error that never clears.
      for (;;) {
        if (startAttemptRef.current !== attempt) return; // superseded / cancelled
        let result;
        try {
          const ownerId = `web-${Math.random().toString(36).slice(2, 10)}`;
          // Short lease: normal exits (Stop camera / unmount / tab close) always
          // release explicitly below, and the heartbeat renews it while in use,
          // so this only bounds the damage from a hard crash.
          result = await createSession({ data: { ownerId, leaseSeconds: 120 } });
        } catch (e: any) {
          setError(e?.message ?? "Failed to reach the camera service");
          return;
        }
        if (startAttemptRef.current !== attempt) return;
        if (result.ok) {
          const session = {
            sessionId: result.session.sessionId,
            leaseToken: result.session.leaseToken,
          };
          sessionRef.current = session;
          setSessionId(session.sessionId);
          setLeaseToken(session.leaseToken);
          setWaitingForCamera(false);
          return;
        }
        if (result.code === "SESSION_CONFLICT") {
          setWaitingForCamera(true);
          setError(null);
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        setError(result.message);
        return;
      }
    } finally {
      if (startAttemptRef.current === attempt) setSessionStarting(false);
    }
  }

  // Give up waiting for another station to release the camera.
  function cancelStart() {
    startAttemptRef.current++;
    setSessionStarting(false);
    setWaitingForCamera(false);
    setStatus(null);
    setError(null);
  }

  async function stopCamera() {
    const session = sessionRef.current;
    sessionRef.current = null;
    setSessionId(null);
    setLeaseToken(null);
    setCameraFrame((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (session) {
      await releaseSessionKeepalive(session);
    }
  }

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
        setError(job.error?.message ?? "Capture failed");
        return;
      }
      const assetId = job.result?.asset.assetId;
      if (!assetId) {
        setError("Capture succeeded but no image was returned");
        return;
      }
      const res = await getMediaContent({ data: { assetId } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const setBin = bin === "BIN 1" ? setBin1 : setBin2;
      setBin((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url };
      });
      setLastSource(bin);
      setStatus(null);
    } catch (e: any) {
      setError(e?.message ?? "Capture failed");
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
        setError(job.error?.message ?? "Autofocus failed");
        return;
      }
      setStatus("Focused");
    } catch (e: any) {
      setError(e?.message ?? "Autofocus failed");
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
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Failed to pick directory");
    }
  }

  async function reconnectDirectory() {
    if (!dirHandle) return;
    const ok = await verifyPermission(dirHandle, true);
    if (ok) {
      setPendingReconnect(false);
      setStatus(`Reconnected to ${dirName}`);
    } else {
      setError("Permission denied — pick the folder again");
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
      setError("Folder permission required — click Reconnect");
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
      if (dirHandle && supportsFS) {
        if (!(await ensurePermission())) return;
        try {
          filename = await resolveUniqueName(dirHandle, base, ext);
          fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(previewItem.blob);
          await writable.close();
          parentDir = dirHandle;
          setStatus(`Saved to ${dirName}/${filename}`);
        } catch (e: any) {
          setError(e?.message ?? "Failed to save to directory");
          return;
        }
      } else {
        const url = URL.createObjectURL(previewItem.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setStatus(`Downloaded ${filename}`);
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
        createdAt: Date.now(),
      };
      await addGalleryItem(item);
      setCounter((c) => c + 1);
      // Saved successfully -> drop this bin's frozen still so the panel returns
      // to the live preview, ready to frame the next sample. This also disables
      // its Save button, so the same file can't be written twice.
      clearBin(bin);
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

  // The camera is only truly usable when the edge node reports the Canon
  // connected and ready. A live session alone isn't enough — the camera can
  // sleep or drop off USB while the session lock is still held.
  const cameraOnline = !!(
    deviceStatus?.online &&
    deviceStatus.camera?.connected &&
    deviceStatus.connectionState === "ready"
  );
  const sessionActive = !!sessionId;
  // Only gate on connectivity once we actually have a device reading, so the
  // first second before the first poll doesn't flash a false "disconnected".
  const cameraUsable = sessionActive && (deviceStatus === null || cameraOnline);
  const cameraAsleep = sessionActive && deviceStatus !== null && !cameraOnline;

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capture</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture from camera, preview, and save to a chosen directory with a custom filename
            format.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Location:</span>
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
            No save folder chosen yet — captures will download to your browser's Downloads folder
            instead.
          </span>
          <button
            onClick={pickDirectory}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Choose folder
          </button>
        </div>
      )}
      {cameraAsleep && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Camera not responding{" "}
          {deviceStatus?.connectionState ? `(${deviceStatus.connectionState})` : ""} — the Canon may
          have gone to sleep. Wake it (half-press the shutter or power-cycle); capture is paused
          until it reconnects.
        </div>
      )}

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
            ? { pill: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500", label: "Captured" }
            : !sessionId
              ? {
                  pill: "bg-muted text-muted-foreground",
                  dot: "bg-muted-foreground/40",
                  label: "Camera Off",
                }
              : cameraAsleep
                ? {
                    pill: "bg-destructive/10 text-destructive",
                    dot: "bg-destructive",
                    label: "Sleeping",
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
                      alt={`${bin} captured image`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      Captured still
                    </span>
                  </>
                ) : cameraFrame ? (
                  <img
                    src={cameraFrame}
                    alt={`${bin} live preview`}
                    className={`h-full w-full object-cover transition-opacity duration-150 ${previewFetching ? "opacity-70" : "opacity-100"}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {sessionStarting
                      ? "Connecting to camera…"
                      : cameraAsleep
                        ? "Camera not responding…"
                        : sessionId
                          ? "Waiting for preview…"
                          : "Camera is off"}
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {showFrozen ? "Frozen capture" : cameraAsleep ? "No signal" : "Live preview"}
                </span>
                {showFrozen && <span className="text-emerald-600">Ready to save</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => captureToBin(bin)}
                  disabled={!cameraUsable || capturingBin !== null || isSaving || autofocusing}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCapturing ? "Capturing…" : showFrozen ? `Recapture ${bin}` : `Capture ${bin}`}
                </button>
                <button
                  onClick={() => saveBin(bin)}
                  disabled={!preview || isSaving}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save image"}
                </button>
                {showFrozen && (
                  <button
                    onClick={() => clearBin(bin)}
                    disabled={isSaving}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Discard
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
                Camera in use by another station — waiting to connect…
              </span>
              <button
                onClick={cancelStart}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startCamera}
              disabled={sessionStarting}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {sessionStarting ? "Connecting…" : "Start camera"}
            </button>
          )
        ) : (
          <button
            onClick={stopCamera}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Stop camera
          </button>
        )}
        <button
          onClick={runAutofocus}
          disabled={!cameraUsable || capturingBin !== null || autofocusing}
          title="Tell the camera to autofocus (one physical camera, shared by both bins)"
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <Crosshair className="h-3.5 w-3.5" />
          {autofocusing ? "Focusing…" : "Autofocus"}
        </button>
      </div>

      {/* Settings */}
      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="mb-4 text-lg font-semibold">Save settings</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Save directory (Shared Folder)</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={pickDirectory}
                disabled={hydrated && !supportsFS}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {dirName ? "Change folder" : "Choose folder"}
              </button>
              {pendingReconnect && (
                <button
                  onClick={reconnectDirectory}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Reconnect
                </button>
              )}
              {dirName && (
                <button
                  onClick={forgetDirectory}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                >
                  Forget
                </button>
              )}
              <span className="text-sm text-muted-foreground">
                {dirName
                  ? `${dirName}${pendingReconnect ? " (permission needed)" : " · remembered"}`
                  : fsUnsupportedNote
                    ? "Not supported — will download"
                    : "No folder selected"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Images will be saved directly to the selected shared folder. Browsers only expose the
              folder name, not the full network path.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Location</label>
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
              Which plant this capture belongs to.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Source</label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
              BIN 1 / BIN 2
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Set by whichever bin's Capture button you use.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">File format</label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">JPEG</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved straight from the camera as JPEG (.jpg).
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Filename format</label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tokens: {"{DD} {MMMM} {MM} {YYYY} {HH} {mm} {ss} {LOCATION} {SOURCE} {INDEX} {TS}"}
              <br />
              {"{MMMM}"} = full month name (July), {"{LOCATION}"} = plant code (AP / CP)
              <br />
              {/* nextFilename embeds the current clock, so it must not be
                    rendered until after hydration -- the server's HH.mm and the
                    browser's would differ by the time hydration runs, and React
                    would throw a text-mismatch (#418) on this node. */}
              Example: <span className="font-mono">{hydrated ? nextFilename : "—"}</span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Image index</label>
            <div className="flex items-center gap-2">
              <input
                value={String(counter).padStart(3, "0")}
                readOnly
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={resetCounter}
                title="Reset to 001"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Auto-increment after each capture.</p>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
          Next file will be saved as: {hydrated ? nextFilename : "—"}
        </div>
      </section>
    </div>
  );
}
