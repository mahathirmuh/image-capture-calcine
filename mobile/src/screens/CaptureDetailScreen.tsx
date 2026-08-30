import type { CaptureRecord } from "../mockData";

type CaptureDetailScreenProps = {
  capture: CaptureRecord;
  onBack: () => void;
};

function detailStatusMeta(status: CaptureRecord["status"]) {
  switch (status) {
    case "verified":
      return { label: "Verified", tone: "verified" as const };
    case "succeeded":
      return { label: "Succeeded", tone: "succeeded" as const };
    case "retake":
      return { label: "Retake", tone: "retake" as const };
  }
}

export function CaptureDetailScreen({ capture, onBack }: CaptureDetailScreenProps) {
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

        <div className="top-app-bar__title">Zone 04 | Calcine-Alpha</div>

        <button className="icon-button" type="button" aria-label="Open settings">
          <span className="material-symbols-outlined" aria-hidden="true">
            settings
          </span>
        </button>
      </header>

      <section className="capture-detail-header">
        <div>
          <p className="section-kicker">Capture Record</p>
          <h1 className="capture-detail-header__title">Sample ID: {capture.sampleId}</h1>
        </div>

        <span className={`capture-detail-badge capture-detail-badge--${status.tone}`}>
          <span className="capture-detail-badge__dot" aria-hidden="true"></span>
          {status.label}
        </span>
      </section>

      <section className="capture-detail-image-card" aria-label="Captured image preview">
        <div className="capture-detail-image">
          <div className="capture-detail-image__overlay">
            <span>{capture.stationBin}</span>
            <span>{capture.capturedTime}</span>
          </div>
        </div>
      </section>

      <section className="capture-detail-meta-card">
        <h2 className="capture-detail-meta-card__title">Metadata</h2>

        <dl className="capture-detail-meta-list">
          <div className="capture-detail-meta-row">
            <dt>Captured Time</dt>
            <dd>{capture.capturedTime}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Session</dt>
            <dd>{capture.session}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Plant</dt>
            <dd>{capture.plant}</dd>
          </div>
          <div className="capture-detail-meta-row">
            <dt>Station/Bin</dt>
            <dd>{capture.stationBin}</dd>
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
            <dd>{capture.device}</dd>
          </div>
        </dl>
      </section>

      <button className="btn btn-primary capture-detail-cta" type="button">
        <span className="material-symbols-outlined" aria-hidden="true">
          replay
        </span>
        Re-Capture
      </button>
    </main>
  );
}
