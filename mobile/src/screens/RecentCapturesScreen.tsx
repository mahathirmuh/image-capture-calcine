import type { CaptureRecord } from "../mockData";

type RecentCapturesScreenProps = {
  captures: CaptureRecord[];
  onOpenDetail: (capture: CaptureRecord) => void;
};

function statusLabel(status: CaptureRecord["status"]) {
  switch (status) {
    case "verified":
      return { text: "Verified", tone: "verified" as const, icon: "task_alt" };
    case "succeeded":
      return { text: "Succeeded", tone: "succeeded" as const, icon: "check_circle" };
    case "retake":
      return { text: "Retake", tone: "retake" as const, icon: "refresh" };
  }
}

export function RecentCapturesScreen({ captures, onOpenDetail }: RecentCapturesScreenProps) {
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
        </div>

        <div className="history-list" aria-label="Recent capture records">
          {captures.map((capture) => {
            const status = statusLabel(capture.status);

            return (
              <button
                key={capture.id}
                type="button"
                className={`history-card history-card--${status.tone}`}
                onClick={() => onOpenDetail(capture)}
              >
                <div className="history-card__thumb" aria-hidden="true">
                  <span className="material-symbols-outlined">image</span>
                </div>

                <div className="history-card__content">
                  <div className="history-card__head">
                    <h2>{capture.sampleId}</h2>
                    <span className={`history-card__status history-card__status--${status.tone}`}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {status.icon}
                      </span>
                      {status.text}
                    </span>
                  </div>

                  <p className="history-card__meta">
                    {capture.stationBin} • {capture.capturedTime}
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
      </section>
    </main>
  );
}
