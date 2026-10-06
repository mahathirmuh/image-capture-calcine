import { useEffect, useMemo, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import type { AuthSession } from "../lib/auth";
import { dateLocale, describeError, plantLabel, useT, type TranslationKey } from "../lib/i18n";
import {
  getSessionCoverage,
  mapSessionCoverageToView,
  type TodaySessionItem,
} from "../lib/sessionCoverage";
import { TRIAL_PLANTS, type CaptureTrack } from "../../../src/lib/capture-schedule";
import { TrackTabs } from "../components/TrackTabs";

type TodaySessionsScreenProps = {
  session: AuthSession;
  onSessionUpdate: (session: AuthSession) => void;
  onSelectSession: (item: TodaySessionItem) => void;
};

function formatCoverageDate(isoDate: string) {
  const value = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(value.getTime())) return isoDate;
  return new Intl.DateTimeFormat(dateLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(value);
}

function statusMeta(status: TodaySessionItem["status"]): {
  label: TranslationKey;
  icon: string;
  tone: "upcoming" | "completed" | "missing";
} {
  switch (status) {
    case "open":
      return { label: "status.open", icon: "photo_camera", tone: "upcoming" };
    case "completed":
      return { label: "status.completed", icon: "check_circle", tone: "completed" };
    case "missing":
      return { label: "status.missing", icon: "warning", tone: "missing" };
    case "upcoming":
      return { label: "status.upcoming", icon: "schedule", tone: "upcoming" };
  }
}

export function TodaySessionsScreen({
  session,
  onSessionUpdate,
  onSelectSession,
}: TodaySessionsScreenProps) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ReturnType<typeof mapSessionCoverageToView> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [track, setTrack] = useState<CaptureTrack>("regular");
  const userPlant = session.user.plant;
  const trialAvailable = userPlant === "ALL" || (!!userPlant && TRIAL_PLANTS.includes(userPlant));
  const activeTrack: CaptureTrack = trialAvailable ? track : "regular";
  useEffect(() => {
    const timer = window.setInterval(() => setReloadToken((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const plant =
          session.user.plant && session.user.plant !== "ALL" ? session.user.plant : null;
        const response = await getSessionCoverage(session, {
          // Backend supplies the plant-local date.
          date: undefined,
          plant,
          track: activeTrack,
        });
        if (cancelled) return;
        onSessionUpdate(response.session);
        setView(mapSessionCoverageToView(response.data, activeTrack));
      } catch (loadError) {
        if (cancelled) return;
        setError(describeError(loadError, "sessions.loadError"));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTrack, onSessionUpdate, reloadToken, session]);

  const summaryItems = useMemo(() => {
    if (!view) return [];
    return [
      { label: t("status.open"), count: view.summary.open, tone: "upcoming" as const },
      { label: t("status.completed"), count: view.summary.completed, tone: "completed" as const },
      { label: t("status.missing"), count: view.summary.missing, tone: "missing" as const },
      { label: t("status.upcoming"), count: view.summary.upcoming, tone: "upcoming" as const },
    ];
  }, [t, view]);

  return (
    <main className="app-page-shell app-page-shell--with-nav">
      <header className="top-app-bar">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__label">{session.user.fullName}</span>
        </div>

        <div className="top-app-bar__title">
          {session.user.plant ? plantLabel(session.user.plant) : t("sessions.operatorAccess")}
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label={t("sessions.refreshAria")}
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
            <h1 className="page-title">{t("sessions.title")}</h1>
            <div className="page-meta">
              <span>{view ? formatCoverageDate(view.date) : t("sessions.loadingDate")}</span>
              <span className="page-meta__divider" aria-hidden="true">
                |
              </span>
              <span>
                {t("sessions.plant", {
                  plant: view?.plantLabel ?? session.user.plant ?? t("sessions.assigned"),
                })}
              </span>
            </div>
          </div>
        </div>

        {trialAvailable ? <TrackTabs track={activeTrack} onChange={setTrack} /> : null}

        {loading ? (
          <div className="data-state-card" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">
              hourglass_top
            </span>
            <div>
              <strong>{t("sessions.loadingTitle")}</strong>
              <p>{t("sessions.loadingBody")}</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="data-state-card data-state-card--error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <div>
              <strong>{t("sessions.failedTitle")}</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && view ? (
          <>
            <div className="summary-chips" aria-label={t("sessions.summaryAria")}>
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
              <div className="session-list" aria-label={t("sessions.listAria")}>
                {view.items.map((item) => {
                  const meta = statusMeta(item.status);

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`session-card session-card--${meta.tone}`}
                      onClick={() => onSelectSession(item)}
                      disabled={item.status === "upcoming"}
                      aria-label={`${item.displayTime} ${item.location}: ${t(meta.label)}`}
                    >
                      <div className="session-card__body">
                        <span className="session-card__time">{item.displayTime}</span>
                        <div className="session-card__content">
                          <h2 className="session-card__title">{item.location}</h2>
                          <span
                            className={`session-card__status session-card__status--${meta.tone}`}
                          >
                            {t(meta.label)}
                          </span>
                        </div>
                      </div>

                      <div className="session-card__tail">
                        {item.trailing ? (
                          <span className="session-card__trailing">{item.trailing}</span>
                        ) : null}
                        <span
                          className="material-symbols-outlined session-card__icon"
                          aria-hidden="true"
                        >
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
                  <strong>{t("sessions.emptyTitle")}</strong>
                  <p>{t("sessions.emptyBody")}</p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
