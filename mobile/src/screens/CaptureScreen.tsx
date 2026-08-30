import { useEffect, useMemo, useRef, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import type { AuthSession } from "../lib/auth";
import { MobileAuthError } from "../lib/auth";
import {
  ensureCameraSession,
  finalizeCaptureResult,
  getPreviewFrame,
  getJob,
  releaseCameraSession,
  renewCameraSession,
  triggerCapture,
  type CameraJob,
  type CameraLease,
} from "../lib/camera";
import {
  listCaptures,
  mapCaptureRecordToHistoryItem,
  type CaptureHistoryItem,
} from "../lib/captures";
import type { TodaySessionItem } from "../lib/sessionCoverage";

type CaptureScreenProps = {
  session: AuthSession;
  operatorName: string;
  selectedSession: TodaySessionItem | null;
  onSessionUpdate: (session: AuthSession) => void;
  onOpenSessions?: () => void;
  onOpenLatestCapture?: (capture: CaptureHistoryItem) => void;
};

type BusyAction = "session" | "capture" | null;

function sessionStatusCopy(status: TodaySessionItem["status"] | null) {
  switch (status) {
    case "completed":
      return "Completed in coverage";
    case "missing":
      return "Ready for recovery";
    case "upcoming":
      return "Ready for schedule";
    default:
      return "Awaiting selection";
  }
}

function jobStatusLabel(status: CameraJob["status"] | null) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

function jobProgress(status: CameraJob["status"] | null) {
  switch (status) {
    case "queued":
      return 20;
    case "running":
      return 60;
    case "succeeded":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

function captureProcessLabel(status: CameraJob["status"] | null, busyAction: BusyAction) {
  if (busyAction !== "capture") return null;

  switch (status) {
    case "queued":
      return "Capture request sent to the camera.";
    case "running":
      return "Camera is capturing and saving the image.";
    case "succeeded":
      return "Finalizing captured image...";
    case "failed":
      return "Capture failed.";
    default:
      return "Keep this screen open while capture is in progress.";
  }
}

function errorMessageOf(error: unknown) {
  if (error instanceof MobileAuthError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to complete the camera action.";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function slotLabel(plant: string, slot: 1 | 2) {
  return `${plant === "Acid Plant" ? "Train" : "Bin"} ${slot}`;
}

function slotLabelUpper(plant: string, slot: 1 | 2) {
  return `${plant === "Acid Plant" ? "TRAIN" : "BIN"} ${slot}`;
}

function extractAssetId(job: CameraJob | null): string | null {
  const asset = job?.result?.asset;
  if (!asset || typeof asset !== "object") return null;
  const assetId = "assetId" in asset ? asset.assetId : null;
  return typeof assetId === "string" && assetId.trim() ? assetId.trim() : null;
}

async function waitForJobCompletion(
  currentSession: AuthSession,
  jobId: string,
  onSessionUpdate: (session: AuthSession) => void,
  onTick: (job: CameraJob) => void,
) {
  let latestSession = currentSession;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await getJob(latestSession, jobId);
    latestSession = response.session;
    onSessionUpdate(response.session);
    onTick(response.data);

    if (response.data.status === "succeeded" || response.data.status === "failed") {
      return { session: latestSession, job: response.data };
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }

  throw new Error("Camera job did not finish before the mobile polling timeout.");
}

export function CaptureScreen({
  session,
  operatorName,
  selectedSession,
  onSessionUpdate,
  onOpenSessions,
  onOpenLatestCapture,
}: CaptureScreenProps) {
  const [lease, setLease] = useState<CameraLease | null>(null);
  const [job, setJob] = useState<CameraJob | null>(null);
  const [latestCapture, setLatestCapture] = useState<CaptureHistoryItem | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<{
    tone: "info" | "success";
    title: string;
    body: string;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(selectedSession?.slot === 2 ? 2 : 1);
  const sessionRef = useRef(session);
  const leaseRef = useRef<CameraLease | null>(lease);
  const previewUrlRef = useRef<string | null>(null);

  const hasSelectedSession = !!selectedSession;
  const currentPlant = selectedSession?.plant ?? session.user.plant ?? "Acid Plant";
  const currentSlotLabel = hasSelectedSession ? slotLabel(currentPlant, activeSlot) : null;
  const contextTitle = hasSelectedSession
    ? currentSlotLabel ?? selectedSession.location
    : "Select a session from Today Sessions";
  const contextMeta = hasSelectedSession
    ? `${selectedSession.plant} • ${selectedSession.displayTime} • ${currentSlotLabel}`
    : "Choose a scheduled slot first so capture actions run in the right operator context.";
  const headerTitle = hasSelectedSession
    ? `${selectedSession.plant} | ${selectedSession.displayTime}`
    : "Capture Workflow";
  const jobLabel = useMemo(() => jobStatusLabel(job?.status ?? null), [job]);
  const progress = useMemo(() => jobProgress(job?.status ?? null), [job]);
  const sessionReady = !!lease;
  const captureBusy = busyAction === "capture";
  const captureProcess = captureProcessLabel(job?.status ?? null, busyAction);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    leaseRef.current = lease;
  }, [lease]);

  useEffect(() => {
    setActiveSlot(selectedSession?.slot === 2 ? 2 : 1);
  }, [selectedSession?.key, selectedSession?.slot]);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      const activeLease = leaseRef.current;
      const activePreviewUrl = previewUrlRef.current;
      if (activePreviewUrl) {
        URL.revokeObjectURL(activePreviewUrl);
      }
      if (activeLease) {
        void releaseCameraSession(sessionRef.current, activeLease).catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (lease) return;

    setPreviewBusy(false);
    setPreviewError(null);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, [lease]);

  useEffect(() => {
    if (!lease) return;
    const activeLease = lease;

    let cancelled = false;
    let loopRunning = false;

    async function pollPreview() {
      if (loopRunning) return;
      loopRunning = true;

      while (!cancelled) {
        if (document.visibilityState !== "visible") {
          await wait(800);
          continue;
        }

        setPreviewBusy(true);
        try {
          const response = await getPreviewFrame(sessionRef.current, activeLease);
          if (cancelled) break;
          onSessionUpdate(response.session);

          const blob = await response.response.blob();
          if (cancelled) break;

          setPreviewError(null);
          setPreviewUrl((previous) => {
            if (previous) {
              URL.revokeObjectURL(previous);
            }
            return URL.createObjectURL(blob);
          });
        } catch (previewLoadError) {
          if (cancelled) break;

          const message = errorMessageOf(previewLoadError);
          setPreviewError(message);

          if (
            previewLoadError instanceof MobileAuthError &&
            (previewLoadError.code === "INVALID_SESSION" ||
              previewLoadError.code === "SESSION_LOST")
          ) {
            setLease(null);
            setError(message);
            break;
          }
        } finally {
          if (!cancelled) {
            setPreviewBusy(false);
          }
        }

        await wait(1200);
      }

      loopRunning = false;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void pollPreview();
      }
    }

    void pollPreview();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [lease, onSessionUpdate]);

  useEffect(() => {
    if (!lease) return;
    const activeLease = lease;

    let cancelled = false;
    let timeoutId: number | null = null;

    async function renewLoop() {
      try {
        const response = await renewCameraSession(sessionRef.current, activeLease, {
          leaseSeconds: 120,
        });
        if (cancelled) return;
        onSessionUpdate(response.session);
        setLease(response.data);
      } catch (renewError) {
        if (cancelled) return;

        const message = errorMessageOf(renewError);
        setPreviewError(message);
        if (
          renewError instanceof MobileAuthError &&
          (renewError.code === "INVALID_SESSION" || renewError.code === "SESSION_LOST")
        ) {
          setLease(null);
          setError(message);
          return;
        }
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(() => {
            void renewLoop();
          }, 60_000);
        }
      }
    }

    timeoutId = window.setTimeout(() => {
      void renewLoop();
    }, 60_000);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [lease, onSessionUpdate]);

  useEffect(() => {
    if (!selectedSession) {
      setLatestCapture(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const latestSession = await refreshLatestCapture(sessionRef.current, activeSlot);
        if (cancelled) return;
        onSessionUpdate(latestSession);
      } catch {
        if (cancelled) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSlot, onSessionUpdate, selectedSession?.key]);

  async function refreshLatestCapture(currentSession: AuthSession, slot = activeSlot) {
    if (!selectedSession) return currentSession;

    const expectedBin = slotLabelUpper(selectedSession.plant, slot).trim().toLowerCase();

    const response = await listCaptures(currentSession, {
      plant: selectedSession.plant,
      session: selectedSession.session,
      limit: 10,
      offset: 0,
    });
    onSessionUpdate(response.session);
    const matchedRecord =
      response.data.items.find(
        (item) => item.captureBin?.trim().toLowerCase() === expectedBin,
      ) ?? null;

    setLatestCapture(matchedRecord ? mapCaptureRecordToHistoryItem(matchedRecord) : null);
    return response.session;
  }

  async function handleStartSession() {
    if (!selectedSession) return;
    setBusyAction("session");
    setError(null);
    setCaptureNotice(null);

    try {
      const response = await ensureCameraSession(session, lease);
      onSessionUpdate(response.session);
      setLease(response.data);
      setJob(null);
      setPreviewError(null);
    } catch (actionError) {
      setError(errorMessageOf(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStopSession() {
    if (!lease) return;
    setBusyAction("session");
    setError(null);
    setCaptureNotice(null);

    try {
      const response = await releaseCameraSession(session, lease);
      onSessionUpdate(response.session);
      setLease(null);
      setJob(null);
      setPreviewError(null);
    } catch (actionError) {
      setError(errorMessageOf(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  async function runJob(kind: "capture") {
    if (!selectedSession) return;
    setBusyAction(kind);
    setError(null);
    setCaptureNotice({
      tone: "info",
      title: "Process capturing",
      body: "Please wait. The camera is taking the image and saving the result.",
    });

    try {
      const leaseResponse = await ensureCameraSession(session, lease);
      onSessionUpdate(leaseResponse.session);
      setLease(leaseResponse.data);

      const actionResponse = await triggerCapture(
        leaseResponse.session,
        leaseResponse.data.session.leaseToken,
      );

      onSessionUpdate(actionResponse.session);
      setJob(actionResponse.data.job);

      const result = await waitForJobCompletion(
        actionResponse.session,
        actionResponse.data.job.jobId,
        onSessionUpdate,
        setJob,
      );
      const latestSession = result.session;
      onSessionUpdate(latestSession);

      if (result.job.status === "succeeded") {
        const assetId = extractAssetId(result.job);
        if (!assetId) {
          throw new Error("Capture succeeded but the edge did not return an asset id for saving.");
        }

        const finalized = await finalizeCaptureResult(latestSession, {
          assetId,
          capturedAt: Date.now(),
          plant: selectedSession.plant,
          captureSession: selectedSession.session,
          slot: activeSlot,
          deviceId: leaseResponse.data.deviceId ?? undefined,
        });
        onSessionUpdate(finalized.session);

        if (finalized.data.forwarded) {
          setPreviewError(null);
          setCaptureNotice({
            tone: "success",
            title: "Capture complete",
            body: "Image saved successfully and ready in history.",
          });
        } else {
          setPreviewError(`Saved on app server queue (${finalized.data.pending} pending).`);
          setCaptureNotice({
            tone: "success",
            title: "Capture queued",
            body: `Image reached the app server queue (${finalized.data.pending} pending).`,
          });
        }

        await refreshLatestCapture(finalized.session, activeSlot);
      } else {
        setCaptureNotice(null);
      }
    } catch (actionError) {
      setCaptureNotice(null);
      setError(errorMessageOf(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="app-page-shell app-page-shell--with-nav capture-screen">
      <header className="top-app-bar">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__label">{operatorName}</span>
        </div>

        <div className="top-app-bar__title">{headerTitle}</div>

        <button
          className="icon-button"
          type="button"
          aria-label="Open today sessions"
          onClick={onOpenSessions}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            calendar_month
          </span>
        </button>
      </header>

      <section className="capture-context-card">
        <p className="capture-context-card__kicker">Session Context</p>
        <h1 className="capture-context-card__title">{contextTitle}</h1>
        <div className="capture-context-card__meta">
          <span className="material-symbols-outlined" aria-hidden="true">
            precision_manufacturing
          </span>
          <span>{contextMeta}</span>
        </div>

        {hasSelectedSession ? (
          <div className="capture-slot-selector" role="group" aria-label="Capture target slot">
            {[1, 2].map((slot) => (
              <button
                key={slot}
                type="button"
                className={`capture-slot-selector__button ${
                  activeSlot === slot ? "capture-slot-selector__button--active" : ""
                }`}
                onClick={() => setActiveSlot(slot as 1 | 2)}
              >
                {slotLabel(selectedSession.plant, slot as 1 | 2)}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="capture-session-bar">
        <div className="capture-session-bar__status">
          <span className="capture-session-bar__pulse" aria-hidden="true"></span>
          <span>{sessionReady ? "Camera session active" : sessionStatusCopy(selectedSession?.status ?? null)}</span>
        </div>

        <div className="capture-session-bar__actions">
          <button
            className="capture-session-bar__button capture-session-bar__button--primary capture-session-bar__button--icon"
            type="button"
            onClick={() => void runJob("capture")}
            disabled={!selectedSession || busyAction !== null || !sessionReady}
            aria-label={captureBusy ? "Capturing image" : "Capture image"}
            title={captureBusy ? "Capturing image" : "Capture image"}
          >
            <span
              className={`material-symbols-outlined ${
                captureBusy ? "capture-session-bar__button-icon-spin" : ""
              }`}
              aria-hidden="true"
            >
              {captureBusy ? "progress_activity" : "photo_camera"}
            </span>
          </button>

          <button
            className="capture-session-bar__button"
            type="button"
            onClick={sessionReady ? () => void handleStopSession() : () => void handleStartSession()}
            disabled={busyAction === "session" || captureBusy || !selectedSession}
          >
            {busyAction === "session"
              ? sessionReady
                ? "Stopping..."
                : "Starting..."
              : sessionReady
                ? "Stop Session"
                : "Start Session"}
          </button>
        </div>
      </section>

      <section className="camera-feed-card" aria-label="Camera feed preview">
        <div className="camera-feed-card__header">
          <div>
            <p className="camera-feed-card__eyebrow">Live View</p>
            <h2 className="camera-feed-card__title">{currentSlotLabel ?? "Camera preview"}</h2>
          </div>
          <div className="camera-feed-card__header-badge">
            {sessionReady ? (previewBusy ? "Refreshing" : "Live") : "Standby"}
          </div>
        </div>

        <div className="camera-feed-card__image">
          {previewUrl ? (
            <img className="camera-feed-card__frame" src={previewUrl} alt="Live camera preview" />
          ) : null}
          <div className="camera-feed-card__crosshair">
            <span className="camera-feed-card__crosshair-dot"></span>
          </div>
          {captureBusy ? (
            <div className="camera-feed-card__overlay" role="status" aria-live="polite">
              <span
                className="material-symbols-outlined camera-feed-card__overlay-icon"
                aria-hidden="true"
              >
                progress_activity
              </span>
              <strong>Process capturing</strong>
              <span>{captureProcess ?? "Please wait while the capture is being processed."}</span>
            </div>
          ) : null}
        </div>
        <div className="camera-feed-card__status">
          {previewBusy
            ? "Loading live preview..."
            : previewError
              ? previewError
              : previewUrl
                ? "Live preview active"
                : sessionReady
                  ? "Waiting for first frame..."
                  : "Start session to load live preview."}
        </div>
      </section>

      {captureNotice ? (
        <section
          className={`capture-notice capture-notice--${captureNotice.tone}`}
          role="status"
          aria-live="polite"
        >
          <strong>{captureNotice.title}</strong>
          <span>{captureNotice.body}</span>
        </section>
      ) : null}

      <section className="result-preview-card-stack">
        <button
          type="button"
          className="result-preview-card result-preview-card--button"
          aria-label="Open latest capture detail"
          onClick={() => {
            if (latestCapture && onOpenLatestCapture) {
              onOpenLatestCapture(latestCapture);
            }
          }}
          disabled={!latestCapture || !onOpenLatestCapture}
        >
          <span className="result-preview-card__label">
            {latestCapture ? "Latest Saved Result" : "Latest Result"}
          </span>
          <div className="result-preview-card__thumb">
            <div className="result-preview-card__badge">
              {latestCapture?.statusLabel ?? lease?.deviceCode ?? "IDLE"}
            </div>
          </div>
          <div className="result-preview-card__content">
            <strong>{latestCapture?.title ?? "Awaiting capture result"}</strong>
            <span>
              {latestCapture
                ? `${latestCapture.plant} • ${latestCapture.capturedTime}`
                : "After capture completes, the newest saved image will appear here."}
            </span>
          </div>
        </button>
      </section>

      {error ? (
        <section className="page-card">
          <div className="data-state-card data-state-card--error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <div>
              <strong>Camera action failed</strong>
              <p>{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="capture-actions-stack">
        <article className="job-progress-card" aria-label="Capture job progress">
          <div className="job-progress-card__header">
            <div className="job-progress-card__meta">
              <span
                className="material-symbols-outlined job-progress-card__spin"
                aria-hidden="true"
              >
                settings
              </span>
              <span>JOB_ID: {job?.jobId ?? "—"}</span>
            </div>
            <span className="job-progress-card__status">{jobLabel}</span>
          </div>

          <div
            className="job-progress-card__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span
              className="job-progress-card__bar-fill"
              style={{ width: `${progress}%` }}
            ></span>
          </div>
          <p className="job-progress-card__helper">
            {captureProcess ??
              "Start a session, then use Capture to save the image for the selected slot."}
          </p>
        </article>
      </section>
    </main>
  );
}
