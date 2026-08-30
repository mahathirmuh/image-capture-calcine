import type { AuthUser } from "../lib/auth";

const PREFERENCES = [
  { id: "haptic", icon: "vibration", label: "Haptic Feedback", enabled: true },
  { id: "contrast", icon: "contrast", label: "High-Contrast Mode", enabled: false },
  { id: "autosave", icon: "save", label: "Auto-Save Captures", enabled: true },
] as const;

type SettingsScreenProps = {
  user: AuthUser;
  onSignOut: () => void | Promise<void>;
};

export function SettingsScreen({ user, onSignOut }: SettingsScreenProps) {
  return (
    <main className="app-page-shell app-page-shell--with-nav settings-screen">
      <header className="top-app-bar top-app-bar--detail">
        <div className="top-app-bar__side">
          <button className="icon-button" type="button" aria-label="Go back">
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
          </button>
          <span className="top-app-bar__detail-title">Settings</span>
        </div>

        <div className="top-app-bar__title">Zone 04 | Calcine-Alpha</div>

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
              <h1 className="settings-info-card__title">{user.fullName}</h1>
            </div>
          </div>

          <div className="settings-info-card__foot">
            <span>Auth Level</span>
            <strong>
              {user.role.toUpperCase()} • {user.username}
            </strong>
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
              <h2 className="settings-info-card__title">{user.plant ?? "ALL"}</h2>
            </div>
          </div>

          <div className="settings-info-card__foot">
            <span>Zone</span>
            <strong>{user.email ?? "No email registered"}</strong>
          </div>
        </article>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title settings-section__title--primary">
          System Preferences
        </h2>

        <div className="settings-list-card">
          {PREFERENCES.map((item) => (
            <div key={item.id} className="settings-row">
              <div className="settings-row__label">
                <span className="material-symbols-outlined" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              <label className="settings-toggle" aria-label={item.label}>
                <input type="checkbox" defaultChecked={item.enabled} />
                <span className="settings-toggle__slider"></span>
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Diagnostics</h2>

        <div className="settings-diagnostics-grid">
          <article className="settings-diagnostic-card">
            <span>App Version</span>
            <strong>2.4.0</strong>
          </article>

          <article className="settings-diagnostic-card">
            <span>Session ID</span>
            <strong>SESS-9942</strong>
          </article>
        </div>
      </section>

      <button className="settings-logout-button" type="button" onClick={() => void onSignOut()}>
        <span className="material-symbols-outlined" aria-hidden="true">
          logout
        </span>
        Logout
      </button>
    </main>
  );
}
