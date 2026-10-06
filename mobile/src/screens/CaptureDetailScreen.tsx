import { useEffect, useMemo, useState } from "react";

import type { AuthSession } from "../lib/auth";
import { describeError, translate, useT } from "../lib/i18n";
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
      return { label: translate("record.status.downloaded"), tone: "verified" as const };
    case "saved":
      return { label: translate("record.status.saved"), tone: "succeeded" as const };
    case "pending":
      return { label: translate("record.status.pending"), tone: "retake" as const };
  }
}

export function CaptureDetailScreen({
  session,
  captureId,
  onSessionUpdate,
  onBack,
  onOpenCapture,
}: CaptureDetailScreenProps) {
  const t = useT();
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
        setError(describeError(loadError, "detail.loadError"));
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
        setImageError(describeError(loadError, "detail.loadError"));
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
            <button
              className="icon-button"
              type="button"
              aria-label={t("common.goBack")}
              onClick={onBack}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <span className="top-app-bar__detail-title">{t("detail.title")}</span>
          </div>
        </header>

        <section className="page-card">
          <div className="data-state-card" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">
              hourglass_top
            </span>
            <div>
              <strong>{t("detail.loadingTitle")}</strong>
              <p>{t("detail.loadingBody")}</p>
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
            <button
              className="icon-button"
              type="button"
              aria-label={t("common.goBack")}
              onClick={onBack}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <span className="top-app-bar__detail-title">{t("detail.title")}</span>
          </div>
        </header>

        <section className="page-card">
          <div className="data-state-card data-state-card--error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <div>
              <strong>{t("detail.failedTitle")}</strong>
              <p>{error ?? t("detail.unavailable")}</p>
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
          <button
            className="icon-button"
            type="button"
            aria-label={t("common.goBack")}
            onClick={onBack}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
          </button>
          <span className="top-app-bar__detail-title">{t("detail.title")}</span>
        </div>

        <div className="top-app-bar__title">{historyItem.plant}</div>

        <button
          className="icon-button"
          type="button"
          aria-label={t("detail.openWorkflowAria")}
          onClick={onOpenCapture}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            photo_camera
          </span>
        </button>
      </header>

      <section className="capture-detail-header">
        <div>
          <p className="section-kicker">{t("detail.kicker")}</p>
          <h1 className="capture-detail-header__title">{historyItem.title}</h1>
        </div>

        <span className={`capture-detail-badge capture-detail-badge--${status.tone}`}>
          <span className="capture-detail-badge__dot" aria-hidden="true"></span>
          {status.label}
        </span>
      </section>

      <section className="capture-detail-image-card" aria-label={t("detail.imageAria")}>
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
              <strong>{t("detail.previewUnavailable")}</strong>
              <p>{imageError}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="capture-detail-meta-card">
        <h2 className="capture-detail-meta-card__title">{t("detail.metadata")}</h2>

        <dl className="capture-detail-meta-list">
          <div className="capture-detail-meta-row">
            <dt>{t("detail.capturedTime")}</dt>
            <dd>{historyItem.capturedDateTime}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.session")}</dt>
            <dd>{historyItem.session}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.plant")}</dt>
            <dd>{historyItem.plant}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.stationBin")}</dt>
            <dd>{historyItem.stationBin}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.status")}</dt>
            <dd
              className={`capture-detail-meta-row__status capture-detail-meta-row__status--${status.tone}`}
            >
              {status.label.toUpperCase()}
            </dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.fileName")}</dt>
            <dd>{capture.fileName}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.device")}</dt>
            <dd>{historyItem.device}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>{t("detail.capturedBy")}</dt>
            <dd>{capture.capturedBy ?? t("detail.unknownOperator")}</dd>
          </div>
        </dl>
      </section>

      <button className="btn btn-primary capture-detail-cta" type="button" onClick={onOpenCapture}>
        <span className="material-symbols-outlined" aria-hidden="true">
          replay
        </span>
        {t("detail.openCapture")}
      </button>
    </main>
  );
}
