import { useMemo, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import { getConfiguredApiBaseUrl, type AuthSession } from "../lib/auth";
import type { MobilePreferences } from "../lib/preferences";

type SettingsScreenProps = {
  session: AuthSession;
  preferences: MobilePreferences;
  onUpdatePreferences: (patch: Partial<MobilePreferences>) => Promise<void>;
  onSignOut: () => void | Promise<void>;
};

type PreferenceItem = {
  id: keyof MobilePreferences;
  icon: string;
  label: string;
  description: string;
};

const PREFERENCE_ITEMS: PreferenceItem[] = [
  {
    id: "highContrastMode",
    icon: "contrast",
    label: "High-Contrast Mode",
    description: "Boost interface contrast for better visibility on the plant floor.",
  },
  {
    id: "historyWarmupEnabled",
    icon: "imagesmode",
    label: "History Warm-Up",
    description: "Preload recent thumbnails in the background after login or session restore.",
  },
];

function formatDateTime(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function errorMessageOf(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to save the updated mobile preference.";
}

function apiSnapshot() {
  const baseUrl = getConfiguredApiBaseUrl();

  try {
    const parsed = new URL(baseUrl);
    return {
      path: parsed.pathname || "/",
    };
  } catch {
    return {
      path: "Custom URL",
    };
  }
}

export function SettingsScreen({
  session,
  preferences,
  onUpdatePreferences,
  onSignOut,
}: SettingsScreenProps) {
  const [pendingPreference, setPendingPreference] = useState<keyof MobilePreferences | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const runtime = useMemo(() => apiSnapshot(), []);

  async function handlePreferenceChange(
    key: keyof MobilePreferences,
    value: MobilePreferences[keyof MobilePreferences],
  ) {
    setPendingPreference(key);
    setSaveError(null);

    try {
      await onUpdatePreferences({ [key]: value });
    } catch (error) {
      setSaveError(errorMessageOf(error));
    } finally {
      setPendingPreference(null);
    }
  }

  return (
    <main className="app-page-shell app-page-shell--with-nav settings-screen">
      <header className="top-app-bar top-app-bar--detail">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__detail-title">Settings</span>
        </div>

        <div className="top-app-bar__title">
          {session.user.plant ?? "ALL"} | {session.user.role}
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label="Logout"
          onClick={() => void onSignOut()}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            logout
          </span>
        </button>
      </header>

      <section className="settings-profile-grid">
        <article className="settings-info-card">
          <div className="settings-info-card__head">
            <div className="settings-info-card__icon settings-info-card__icon--primary">
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                person
              </span>
            </div>
            <div>
              <p className="settings-info-card__kicker">Operator</p>
              <h1 className="settings-info-card__title">{session.user.fullName}</h1>
            </div>
          </div>

          <div className="settings-info-card__foot">
            <span>Identity</span>
            <strong>{session.user.username}</strong>
          </div>
        </article>

        <article className="settings-info-card">
          <div className="settings-info-card__head">
            <div className="settings-info-card__icon settings-info-card__icon--accent">
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                factory
              </span>
            </div>
            <div>
              <p className="settings-info-card__kicker">Assignment</p>
              <h2 className="settings-info-card__title">{session.user.plant ?? "ALL"}</h2>
            </div>
          </div>

          <div className="settings-info-card__foot">
            <span>Account</span>
            <strong>{session.user.email ?? "No email registered"}</strong>
          </div>
        </article>
      </section>

      {saveError ? (
        <section className="device-alert-card" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            warning
          </span>
          <div>
            <strong>Preference update failed</strong>
            <p>{saveError}</p>
          </div>
        </section>
      ) : null}

      <section className="settings-section">
        <h2 className="settings-section__title settings-section__title--primary">
          Operator Preferences
        </h2>

        <div className="settings-list-card">
          {PREFERENCE_ITEMS.map((item) => {
            const checked = preferences[item.id];
            const pending = pendingPreference === item.id;

            return (
              <div key={item.id} className="settings-row">
                <div className="settings-row__content">
                  <div className="settings-row__label">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <p className="settings-row__meta">{item.description}</p>
                </div>

                <label className="settings-toggle" aria-label={item.label}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pending}
                    onChange={(event) => {
                      void handlePreferenceChange(item.id, event.target.checked);
                    }}
                  />
                  <span className="settings-toggle__slider"></span>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Runtime Snapshot</h2>

        <div className="settings-runtime-grid">
          <article className="settings-runtime-card">
            <span>App Version</span>
            <strong>{__MOBILE_APP_VERSION__}</strong>
          </article>

          <article className="settings-runtime-card settings-runtime-card--wide">
            <span>API Path</span>
            <strong>{runtime.path}</strong>
          </article>

          <article className="settings-runtime-card settings-runtime-card--wide">
            <span>Access Expires</span>
            <strong>{formatDateTime(session.accessExpiresAt)}</strong>
          </article>

          <article className="settings-runtime-card settings-runtime-card--wide">
            <span>Refresh Expires</span>
            <strong>{formatDateTime(session.refreshExpiresAt)}</strong>
          </article>
        </div>
      </section>

      <button className="settings-logout-button" type="button" onClick={() => void onSignOut()}>
        <span className="material-symbols-outlined" aria-hidden="true">
          logout
        </span>
        Sign Out
      </button>
    </main>
  );
}
