import { useEffect, useMemo, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import type { AuthSession } from "../lib/auth";
import { MobileAuthError } from "../lib/auth";
import { getSessionCoverage, mapSessionCoverageToView, type TodaySessionItem } from "../lib/sessionCoverage";

type TodaySessionsScreenProps = {
  session: AuthSession;
  onSessionUpdate: (session: AuthSession) => void;
  onSelectSession: (item: TodaySessionItem) => void;
};

function formatCoverageDate(isoDate: string) {
  const value = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(value.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(value);
}

function statusMeta(status: TodaySessionItem["status"]) {
  switch (status) {
    case "completed":
      return { label: "Completed", icon: "check_circle", tone: "completed" as const };
    case "missing":
      return { label: "Missing", icon: "warning", tone: "missing" as const };
    case "upcoming":
      return { label: "Upcoming", icon: "schedule", tone: "upcoming" as const };
  }
}

function errorMessageOf(error: unknown) {
  if (error instanceof MobileAuthError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to load today sessions.";
}

export function TodaySessionsScreen({
  session,
  onSessionUpdate,
  onSelectSession,
}: TodaySessionsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ReturnType<typeof mapSessionCoverageToView> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const plant = session.user.plant && session.user.plant !== "ALL" ? session.user.plant : null;
        const response = await getSessionCoverage(session, { plant });
        if (cancelled) return;
        onSessionUpdate(response.session);
        setView(mapSessionCoverageToView(response.data));
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

  const summaryItems = useMemo(() => {
    if (!view) return [];
    return [
      { label: "Completed", count: view.summary.completed, tone: "completed" as const },
      { label: "Missing", count: view.summary.missing, tone: "missing" as const },
      { label: "Upcoming", count: view.summary.upcoming, tone: "upcoming" as const },
    ];
  }, [view]);

  return (
    <main className="app-page-shell app-page-shell--with-nav">
      <header className="top-app-bar">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__label">{session.user.fullName}</span>
        </div>

        <div className="top-app-bar__title">{session.user.plant ?? "Operator Access"}</div>

        <button
          className="icon-button"
          type="button"
          aria-label="Refresh today sessions"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
        </button>
      </header>

      <section className="page-card">
        <div className="page-header">
          <div>
            <h1 className="page-title">Today Sessions</h1>
            <div className="page-meta">
              <span>{view ? formatCoverageDate(view.date) : "Loading..."}</span>
              <span className="page-meta__divider" aria-hidden="true">
                |
              </span>
              <span>Plant: {view?.plantLabel ?? session.user.plant ?? "Assigned"}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="data-state-card" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">
              hourglass_top
            </span>
            <div>
              <strong>Loading sessions</strong>
              <p>Fetching today coverage from the backend.</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="data-state-card data-state-card--error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <div>
              <strong>Failed to load sessions</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && view ? (
          <>
            <div className="summary-chips" aria-label="Session summary">
              {summaryItems.map((item) => (
                <span key={item.label} className={`summary-chip summary-chip--${item.tone}`}>
                  <span className="summary-chip__dot" aria-hidden="true">
                    ●
                  </span>
                  {item.label} ({item.count})
                </span>
              ))}
            </div>

            {view.items.length ? (
              <div className="session-list" aria-label="Today session checklist">
                {view.items.map((item) => {
                  const meta = statusMeta(item.status);

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`session-card session-card--${meta.tone}`}
                      onClick={() => onSelectSession(item)}
                    >
                      <div className="session-card__body">
                        <span className="session-card__time">{item.displayTime}</span>
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
                        <span className="material-symbols-outlined session-card__icon" aria-hidden="true">
                          {meta.icon}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="data-state-card">
                <span className="material-symbols-outlined" aria-hidden="true">
                  assignment_late
                </span>
                <div>
                  <strong>No sessions available</strong>
                  <p>No session coverage items were returned for the current operator scope.</p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
