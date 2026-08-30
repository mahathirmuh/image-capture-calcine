import { useMemo, useState } from "react";

import type { AuthSession } from "../lib/auth";
import { MobileAuthError } from "../lib/auth";
import {
  ensureCameraSession,
  getJob,
  triggerAutofocus,
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

function errorMessageOf(error: unknown) {
  if (error instanceof MobileAuthError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to complete the camera action.";
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
  const [busyAction, setBusyAction] = useState<"session" | "autofocus" | "capture" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSelectedSession = !!selectedSession;
  const contextTitle = hasSelectedSession
    ? `${selectedSession.location}`
    : "Select a session from Today Sessions";
  const contextMeta = hasSelectedSession
    ? `${selectedSession.plant} • ${selectedSession.displayTime} • Slot ${selectedSession.slot}`
    : "Choose a scheduled slot first so capture actions run in the right operator context.";
  const headerTitle = hasSelectedSession
    ? `${selectedSession.plant} | ${selectedSession.displayTime}`
    : "Capture Workflow";
  const jobLabel = useMemo(() => jobStatusLabel(job?.status ?? null), [job]);
  const progress = useMemo(() => jobProgress(job?.status ?? null), [job]);
  const sessionReady = !!lease;

  async function refreshLatestCapture(currentSession: AuthSession) {
    if (!selectedSession) return currentSession;

    const expectedBin = selectedSession.location.split(" • ")[0]?.trim().toLowerCase();

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

    try {
      const response = await ensureCameraSession(session, lease);
      onSessionUpdate(response.session);
      setLease(response.data);
      setJob(null);
    } catch (actionError) {
      setError(errorMessageOf(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  async function runJob(kind: "autofocus" | "capture") {
    if (!selectedSession) return;
    setBusyAction(kind);
    setError(null);

    try {
      const leaseResponse = await ensureCameraSession(session, lease);
      onSessionUpdate(leaseResponse.session);
      setLease(leaseResponse.data);

      const actionResponse =
        kind === "autofocus"
          ? await triggerAutofocus(leaseResponse.session, leaseResponse.data.session.leaseToken)
          : await triggerCapture(leaseResponse.session, leaseResponse.data.session.leaseToken);

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

      if (kind === "capture" && result.job.status === "succeeded") {
        await refreshLatestCapture(latestSession);
      }
    } catch (actionError) {
      setError(errorMessageOf(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="app-page-shell app-page-shell--with-nav capture-screen">
      <header className="top-app-bar">
        <div className="top-app-bar__side">
          <span
            className="material-symbols-outlined top-app-bar__avatar"
            aria-hidden="true"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            account_circle
          </span>
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
      </section>

      <section className="capture-session-bar">
        <div className="capture-session-bar__status">
          <span className="capture-session-bar__pulse" aria-hidden="true"></span>
          <span>{sessionReady ? "Camera session active" : sessionStatusCopy(selectedSession?.status ?? null)}</span>
        </div>

        <button
          className="capture-session-bar__button"
          type="button"
          onClick={sessionReady ? onOpenSessions : handleStartSession}
          disabled={busyAction === "session" || !selectedSession}
        >
          {busyAction === "session"
            ? "Starting..."
            : sessionReady
              ? "Change Session"
              : "Start Session"}
        </button>
      </section>

      <section className="capture-preview-grid">
        <div className="camera-feed-card" aria-label="Camera feed preview">
          <div className="camera-feed-card__image">
            <div className="camera-feed-card__crosshair">
              <span className="camera-feed-card__crosshair-dot"></span>
            </div>
          </div>
        </div>

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
            {latestCapture ? "Latest Result" : "Camera"}
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
                : "Run capture to fetch the newest record for this session."}
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
        </article>

        <div className="capture-action-grid">
          <button
            className="capture-action capture-action--secondary"
            type="button"
            onClick={() => void runJob("autofocus")}
            disabled={!selectedSession || busyAction !== null}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              center_focus_strong
            </span>
            <span>{busyAction === "autofocus" ? "Focusing..." : "Auto-Focus"}</span>
          </button>

          <button
            className="capture-action capture-action--primary"
            type="button"
            onClick={() => void runJob("capture")}
            disabled={!selectedSession || busyAction !== null}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              photo_camera
            </span>
            <span>{busyAction === "capture" ? "Capturing..." : "Capture"}</span>
          </button>
        </div>
      </section>
    </main>
  );
}
