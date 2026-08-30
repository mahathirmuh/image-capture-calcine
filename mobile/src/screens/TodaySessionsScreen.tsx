type SessionStatus = "completed" | "missing" | "retake" | "upcoming";

type SessionItem = {
  time: string;
  location: string;
  status: SessionStatus;
  trailing?: string;
};

const SUMMARY = [
  { label: "Completed", count: 4, tone: "completed" },
  { label: "Missing", count: 2, tone: "missing" },
  { label: "Upcoming", count: 2, tone: "upcoming" },
] as const;

const SESSION_ITEMS: SessionItem[] = [
  { time: "08:00", location: "Bin-A1", status: "completed", trailing: "08:42" },
  { time: "11:00", location: "Train-04", status: "missing" },
  { time: "14:00", location: "Bin-B2", status: "retake" },
  { time: "17:00", location: "Train-01", status: "upcoming" },
  { time: "20:00", location: "Bin-C3", status: "upcoming" },
  { time: "23:00", location: "Train-02", status: "upcoming" },
];

function statusMeta(status: SessionStatus) {
  switch (status) {
    case "completed":
      return { label: "Completed", icon: "check_circle", tone: "completed" as const };
    case "missing":
      return { label: "Missing", icon: "warning", tone: "missing" as const };
    case "retake":
      return { label: "Retake", icon: "refresh", tone: "missing" as const };
    case "upcoming":
      return { label: "Upcoming", icon: "schedule", tone: "upcoming" as const };
  }
}

export function TodaySessionsScreen() {
  return (
    <main className="app-page-shell app-page-shell--with-nav">
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

      <section className="page-card">
        <div className="page-header">
          <div>
            <h1 className="page-title">Today Sessions</h1>
            <div className="page-meta">
              <span>Oct 24, 2023</span>
              <span className="page-meta__divider" aria-hidden="true">
                |
              </span>
              <span>Plant: Calcine-Alpha</span>
            </div>
          </div>
        </div>

        <div className="summary-chips" aria-label="Session summary">
          {SUMMARY.map((item) => (
            <span key={item.label} className={`summary-chip summary-chip--${item.tone}`}>
              <span className="summary-chip__dot" aria-hidden="true">
                ●
              </span>
              {item.label} ({item.count})
            </span>
          ))}
        </div>

        <div className="session-list" aria-label="Today session checklist">
          {SESSION_ITEMS.map((item) => {
            const meta = statusMeta(item.status);

            return (
              <article
                key={`${item.time}-${item.location}`}
                className={`session-card session-card--${meta.tone}`}
              >
                <div className="session-card__body">
                  <span className="session-card__time">{item.time}</span>
                  <div className="session-card__content">
                    <h2 className="session-card__title">{item.location}</h2>
                    <span className={`session-card__status session-card__status--${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                <div className="session-card__tail">
                  {item.trailing ? (
                    <span className="session-card__trailing">{item.trailing}</span>
                  ) : null}
                  <span className={`material-symbols-outlined session-card__icon`} aria-hidden="true">
                    {meta.icon}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
