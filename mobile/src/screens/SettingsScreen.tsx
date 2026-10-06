import { useMemo, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { getConfiguredApiBaseUrl, type AuthSession } from "../lib/auth";
import {
  dateLocale,
  describeError,
  plantLabel,
  roleLabel,
  useT,
  type TranslationKey,
} from "../lib/i18n";
import type { MobilePreferences } from "../lib/preferences";

type SettingsScreenProps = {
  session: AuthSession;
  preferences: MobilePreferences;
  onUpdatePreferences: (patch: Partial<MobilePreferences>) => Promise<void>;
  onSignOut: () => void | Promise<void>;
};

type TogglePreference = "lightMode" | "highContrastMode" | "historyWarmupEnabled";

type PreferenceItem = {
  id: TogglePreference;
  icon: string;
  label: TranslationKey;
  description: TranslationKey;
};

const PREFERENCE_ITEMS: PreferenceItem[] = [
  {
    id: "lightMode",
    icon: "light_mode",
    label: "pref.lightMode",
    description: "pref.lightModeDescription",
  },
  {
    id: "highContrastMode",
    icon: "contrast",
    label: "pref.highContrast",
    description: "pref.highContrastDescription",
  },
  {
    id: "historyWarmupEnabled",
    icon: "imagesmode",
    label: "pref.warmup",
    description: "pref.warmupDescription",
  },
];

function formatDateTime(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat(dateLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function apiPath(): string | null {
  try {
    return new URL(getConfiguredApiBaseUrl()).pathname || "/";
  } catch {
    return null;
  }
}

export function SettingsScreen({
  session,
  preferences,
  onUpdatePreferences,
  onSignOut,
}: SettingsScreenProps) {
  const t = useT();
  const [pendingPreference, setPendingPreference] = useState<keyof MobilePreferences | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const runtimePath = useMemo(() => apiPath(), []);

  async function handlePreferenceChange(patch: Partial<MobilePreferences>) {
    setPendingPreference(Object.keys(patch)[0] as keyof MobilePreferences);
    setSaveError(null);

    try {
      await onUpdatePreferences(patch);
    } catch (error) {
      setSaveError(describeError(error, "settings.saveError"));
    } finally {
      setPendingPreference(null);
    }
  }

  return (
    <main className="app-page-shell app-page-shell--with-nav settings-screen">
      <header className="top-app-bar top-app-bar--detail">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__detail-title">{t("settings.title")}</span>
        </div>

        <div className="top-app-bar__title">
          {plantLabel(session.user.plant)} | {roleLabel(session.user.role)}
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label={t("settings.logoutAria")}
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
              <p className="settings-info-card__kicker">{t("settings.operator")}</p>
              <h1 className="settings-info-card__title">{session.user.fullName}</h1>
            </div>
          </div>

          <div className="settings-info-card__foot">
            <span>{t("settings.identity")}</span>
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
              <p className="settings-info-card__kicker">{t("settings.assignment")}</p>
              <h2 className="settings-info-card__title">{plantLabel(session.user.plant)}</h2>
            </div>
          </div>

          <div className="settings-info-card__foot">
            <span>{t("settings.account")}</span>
            <strong>{session.user.email ?? t("settings.noEmail")}</strong>
          </div>
        </article>
      </section>

      {saveError ? (
        <section className="device-alert-card" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            warning
          </span>
          <div>
            <strong>{t("settings.saveFailedTitle")}</strong>
            <p>{saveError}</p>
          </div>
        </section>
      ) : null}

      <section className="settings-section">
        <h2 className="settings-section__title settings-section__title--primary">
          {t("settings.preferences")}
        </h2>

        <div className="settings-list-card">
          <div className="settings-row">
            <div className="settings-row__content">
              <div className="settings-row__label">
                <span className="material-symbols-outlined" aria-hidden="true">
                  translate
                </span>
                <span>{t("language.label")}</span>
              </div>
              <p className="settings-row__meta">{t("language.description")}</p>
            </div>

            <LanguageSwitch
              disabled={pendingPreference === "language"}
              onChange={(language) => {
                if (language !== preferences.language) void handlePreferenceChange({ language });
              }}
            />
          </div>

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
                    <span>{t(item.label)}</span>
                  </div>
                  <p className="settings-row__meta">{t(item.description)}</p>
                </div>

                <label className="settings-toggle" aria-label={t(item.label)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pending}
                    onChange={(event) => {
                      void handlePreferenceChange({ [item.id]: event.target.checked });
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
        <h2 className="settings-section__title">{t("settings.runtime")}</h2>

        <div className="settings-runtime-grid">
          <article className="settings-runtime-card">
            <span>{t("settings.appVersion")}</span>
            <strong>{__MOBILE_APP_VERSION__}</strong>
          </article>

          <article className="settings-runtime-card settings-runtime-card--wide">
            <span>{t("settings.apiPath")}</span>
            <strong>{runtimePath ?? t("settings.customUrl")}</strong>
          </article>

          <article className="settings-runtime-card settings-runtime-card--wide">
            <span>{t("settings.accessExpires")}</span>
            <strong>{formatDateTime(session.accessExpiresAt)}</strong>
          </article>

          <article className="settings-runtime-card settings-runtime-card--wide">
            <span>{t("settings.refreshExpires")}</span>
            <strong>{formatDateTime(session.refreshExpiresAt)}</strong>
          </article>
        </div>
      </section>

      <button className="settings-logout-button" type="button" onClick={() => void onSignOut()}>
        <span className="material-symbols-outlined" aria-hidden="true">
          logout
        </span>
        {t("common.signOut")}
      </button>
    </main>
  );
}
