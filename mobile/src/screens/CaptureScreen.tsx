import type { CaptureRecord } from "../mockData";

const MOCK_JOB_PROGRESS = 60;

type CaptureScreenProps = {
  latestCapture?: CaptureRecord;
  onOpenLatest?: (capture: CaptureRecord) => void;
};

export function CaptureScreen({ latestCapture, onOpenLatest }: CaptureScreenProps) {
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
          <span className="top-app-bar__label">Operator Profile</span>
        </div>

        <div className="top-app-bar__title">Zone 04 | Calcine-Alpha</div>

        <button className="icon-button" type="button" aria-label="Open settings">
          <span className="material-symbols-outlined" aria-hidden="true">
            settings
          </span>
        </button>
      </header>

      <section className="capture-context-card">
        <p className="capture-context-card__kicker">Session Context</p>
        <h1 className="capture-context-card__title">Tank A1 - Sampling</h1>
        <div className="capture-context-card__meta">
          <span className="material-symbols-outlined" aria-hidden="true">
            precision_manufacturing
          </span>
          <span>Rig Alpha - Sector 7G</span>
        </div>
      </section>

      <section className="capture-session-bar">
        <div className="capture-session-bar__status">
          <span className="capture-session-bar__pulse" aria-hidden="true"></span>
          <span>Session Ready</span>
        </div>

        <button className="capture-session-bar__button" type="button">
          Start Session
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
          onClick={() => {
            if (latestCapture && onOpenLatest) {
              onOpenLatest(latestCapture);
            }
          }}
          disabled={!latestCapture || !onOpenLatest}
          aria-label="Open latest capture detail"
        >
          <span className="result-preview-card__label">Preview</span>
          <div className="result-preview-card__thumb">
            <div className="result-preview-card__badge">
              {latestCapture?.status === "retake" ? "RETAKE" : "OK"}
            </div>
          </div>
        </button>
      </section>

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
              <span>JOB_ID: 884-X</span>
            </div>
            <span className="job-progress-card__status">Running</span>
          </div>

          <div
            className="job-progress-card__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={MOCK_JOB_PROGRESS}
          >
            <span
              className="job-progress-card__bar-fill"
              style={{ width: `${MOCK_JOB_PROGRESS}%` }}
            ></span>
          </div>
        </article>

        <div className="capture-action-grid">
          <button className="capture-action capture-action--secondary" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">
              center_focus_strong
            </span>
            <span>Auto-Focus</span>
          </button>

          <button className="capture-action capture-action--primary" type="button">
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              photo_camera
            </span>
            <span>Capture</span>
          </button>
        </div>
      </section>
    </main>
  );
}
