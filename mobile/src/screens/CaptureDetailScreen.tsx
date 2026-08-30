import { useEffect, useMemo, useState } from "react";

import type { AuthSession } from "../lib/auth";
import { MobileAuthError } from "../lib/auth";
import {
  getCapture,
  getCaptureImage,
  mapCaptureRecordToHistoryItem,
  type ApiCaptureRecord,
} from "../lib/captures";

type CaptureDetailScreenProps = {
  session: AuthSession;
  captureId: number;
  onSessionUpdate: (session: AuthSession) => void;
  onBack: () => void;
  onOpenCapture: () => void;
};

function detailStatusMeta(status: ApiCaptureRecord["status"]) {
  switch (status) {
    case "downloaded":
      return { label: "Downloaded", tone: "verified" as const };
    case "saved":
      return { label: "Saved", tone: "succeeded" as const };
    case "pending":
      return { label: "Pending", tone: "retake" as const };
  }
}

function errorMessageOf(error: unknown) {
  if (error instanceof MobileAuthError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to load capture detail.";
}

export function CaptureDetailScreen({
  session,
  captureId,
  onSessionUpdate,
  onBack,
  onOpenCapture,
}: CaptureDetailScreenProps) {
  const [capture, setCapture] = useState<ApiCaptureRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getCapture(session, captureId);
        if (cancelled) return;
        onSessionUpdate(response.session);
        setCapture(response.data);
      } catch (loadError) {
        if (cancelled) return;
        setError(errorMessageOf(loadError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [captureId, onSessionUpdate, session]);

  useEffect(() => {
    if (!capture) return;

    let cancelled = false;
    setImageUrl(null);
    setImageError(null);

    void (async () => {
      try {
        const response = await getCaptureImage(session, capture.id);
        if (cancelled) {
          return;
        }
        onSessionUpdate(response.session);
        setImageUrl(response.objectUrl);
      } catch (loadError) {
        if (cancelled) return;
        setImageError(errorMessageOf(loadError));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [capture, onSessionUpdate, session]);

  const historyItem = useMemo(
    () => (capture ? mapCaptureRecordToHistoryItem(capture) : null),
    [capture],
  );

  if (loading) {
    return (
      <main className="app-page-shell app-page-shell--with-nav capture-detail-screen">
        <header className="top-app-bar top-app-bar--detail">
          <div className="top-app-bar__side">
            <button className="icon-button" type="button" aria-label="Go back" onClick={onBack}>
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <span className="top-app-bar__detail-title">Capture Detail</span>
          </div>
        </header>

        <section className="page-card">
          <div className="data-state-card" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">
              hourglass_top
            </span>
            <div>
              <strong>Loading capture detail</strong>
              <p>Fetching the selected capture record from the backend.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (error || !capture || !historyItem) {
    return (
      <main className="app-page-shell app-page-shell--with-nav capture-detail-screen">
        <header className="top-app-bar top-app-bar--detail">
          <div className="top-app-bar__side">
            <button className="icon-button" type="button" aria-label="Go back" onClick={onBack}>
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <span className="top-app-bar__detail-title">Capture Detail</span>
          </div>
        </header>

        <section className="page-card">
          <div className="data-state-card data-state-card--error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <div>
              <strong>Failed to load capture detail</strong>
              <p>{error ?? "The selected capture record is unavailable."}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const status = detailStatusMeta(capture.status);

  return (
    <main className="app-page-shell app-page-shell--with-nav capture-detail-screen">
      <header className="top-app-bar top-app-bar--detail">
        <div className="top-app-bar__side">
          <button className="icon-button" type="button" aria-label="Go back" onClick={onBack}>
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
          </button>
          <span className="top-app-bar__detail-title">Capture Detail</span>
        </div>

        <div className="top-app-bar__title">{historyItem.plant}</div>

        <button className="icon-button" type="button" aria-label="Open capture workflow" onClick={onOpenCapture}>
          <span className="material-symbols-outlined" aria-hidden="true">
            photo_camera
          </span>
        </button>
      </header>

      <section className="capture-detail-header">
        <div>
          <p className="section-kicker">Capture Record</p>
          <h1 className="capture-detail-header__title">{historyItem.title}</h1>
        </div>

        <span className={`capture-detail-badge capture-detail-badge--${status.tone}`}>
          <span className="capture-detail-badge__dot" aria-hidden="true"></span>
          {status.label}
        </span>
      </section>

      <section className="capture-detail-image-card" aria-label="Captured image preview">
        <div className="capture-detail-image">
          {imageUrl ? (
            <img className="capture-detail-image__img" src={imageUrl} alt={historyItem.fileName} />
          ) : null}
          <div className="capture-detail-image__overlay">
            <span>{historyItem.stationBin}</span>
            <span>{historyItem.capturedTime}</span>
          </div>
        </div>
      </section>

      {imageError ? (
        <section className="page-card">
          <div className="data-state-card">
            <span className="material-symbols-outlined" aria-hidden="true">
              image_not_supported
            </span>
            <div>
              <strong>Preview unavailable</strong>
              <p>{imageError}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="capture-detail-meta-card">
        <h2 className="capture-detail-meta-card__title">Metadata</h2>

        <dl className="capture-detail-meta-list">
          <div className="capture-detail-meta-row">
            <dt>Captured Time</dt>
            <dd>{historyItem.capturedDateTime}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Session</dt>
            <dd>{historyItem.session}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Plant</dt>
            <dd>{historyItem.plant}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Station/Bin</dt>
            <dd>{historyItem.stationBin}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Status</dt>
            <dd className={`capture-detail-meta-row__status capture-detail-meta-row__status--${status.tone}`}>
              {status.label.toUpperCase()}
            </dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>File Name</dt>
            <dd>{capture.fileName}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Device</dt>
            <dd>{historyItem.device}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Captured By</dt>
            <dd>{capture.capturedBy ?? "Unknown Operator"}</dd>
          </div>
        </dl>
      </section>

      <button className="btn btn-primary capture-detail-cta" type="button" onClick={onOpenCapture}>
        <span className="material-symbols-outlined" aria-hidden="true">
          replay
        </span>
        Open Capture
      </button>
    </main>
  );
}
