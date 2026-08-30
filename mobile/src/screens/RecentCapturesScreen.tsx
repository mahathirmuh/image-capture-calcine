import { useEffect, useState } from "react";

import type { AuthSession } from "../lib/auth";
import { MobileAuthError } from "../lib/auth";
import {
  getCaptureThumb,
  listCaptures,
  mapCaptureRecordToHistoryItem,
  type CaptureHistoryItem,
} from "../lib/captures";

type RecentCapturesScreenProps = {
  session: AuthSession;
  onSessionUpdate: (session: AuthSession) => void;
  onOpenDetail: (capture: CaptureHistoryItem) => void;
};

function statusLabel(capture: CaptureHistoryItem) {
  switch (capture.statusTone) {
    case "verified":
      return { text: capture.statusLabel, tone: "verified" as const, icon: "task_alt" };
    case "succeeded":
      return { text: capture.statusLabel, tone: "succeeded" as const, icon: "check_circle" };
    case "retake":
      return { text: capture.statusLabel, tone: "retake" as const, icon: "schedule" };
  }
}

function errorMessageOf(error: unknown) {
  if (error instanceof MobileAuthError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to load recent captures.";
}

function HistoryThumbnail({
  captureId,
  fileName,
  session,
  onSessionUpdate,
}: {
  captureId: number;
  fileName: string;
  session: AuthSession;
  onSessionUpdate: (session: AuthSession) => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await getCaptureThumb(session, captureId);
        if (cancelled) return;
        onSessionUpdate(response.session);
        setThumbUrl(response.objectUrl);
      } catch {
        if (cancelled) return;
        setThumbUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [captureId, onSessionUpdate, session]);

  return (
    <div className="history-card__thumb" aria-hidden="true">
      {thumbUrl ? (
        <img className="history-card__thumb-image" src={thumbUrl} alt={fileName} loading="lazy" />
      ) : (
        <span className="material-symbols-outlined">image</span>
      )}
    </div>
  );
}

export function RecentCapturesScreen({
  session,
  onSessionUpdate,
  onOpenDetail,
}: RecentCapturesScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [captures, setCaptures] = useState<CaptureHistoryItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const plant = session.user.plant && session.user.plant !== "ALL" ? session.user.plant : null;
        const response = await listCaptures(session, { plant, limit: 20, offset: 0 });
        if (cancelled) return;
        onSessionUpdate(response.session);
        setCaptures(response.data.items.map(mapCaptureRecordToHistoryItem));
        setTotal(response.data.pagination.total);
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
  }, [onSessionUpdate, reloadToken, session]);

  return (
    <main className="app-page-shell app-page-shell--with-nav">
      <section className="page-card">
        <div className="page-header">
          <div>
            <p className="section-kicker">Operator Archive</p>
            <h1 className="page-title">Recent Captures</h1>
            <p className="section-copy">
              Review the latest capture results and open a record to inspect image metadata.
            </p>
          </div>

          <button
            className="icon-button"
            type="button"
            aria-label="Refresh recent captures"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              refresh
            </span>
          </button>
        </div>

        {!loading && !error && total !== null ? (
          <div className="page-meta">
            <span>Showing latest {captures.length} records</span>
            <span className="page-meta__divider" aria-hidden="true">
              |
            </span>
            <span>Total matches: {total}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="data-state-card" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">
              hourglass_top
            </span>
            <div>
              <strong>Loading recent captures</strong>
              <p>Fetching the latest records from the backend.</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="data-state-card data-state-card--error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <div>
              <strong>Failed to load capture history</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && !captures.length ? (
          <div className="data-state-card">
            <span className="material-symbols-outlined" aria-hidden="true">
              image_not_supported
            </span>
            <div>
              <strong>No captures found</strong>
              <p>No recent capture records were returned for the current operator scope.</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && captures.length ? (
          <div className="history-list" aria-label="Recent capture records">
            {captures.map((capture) => {
              const status = statusLabel(capture);

              return (
                <button
                  key={capture.id}
                  type="button"
                  className={`history-card history-card--${status.tone}`}
                  onClick={() => onOpenDetail(capture)}
                >
                  <HistoryThumbnail
                    captureId={capture.id}
                    fileName={capture.fileName}
                    session={session}
                    onSessionUpdate={onSessionUpdate}
                  />

                  <div className="history-card__content">
                    <div className="history-card__head">
                      <h2>{capture.title}</h2>
                      <span className={`history-card__status history-card__status--${status.tone}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {status.icon}
                        </span>
                        {status.text}
                      </span>
                    </div>

                    <p className="history-card__meta">
                      {capture.plant} • {capture.capturedTime}
                    </p>
                    <p className="history-card__submeta">{capture.fileName}</p>
                  </div>

                  <span className="material-symbols-outlined history-card__chevron" aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
