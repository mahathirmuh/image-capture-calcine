import { useMemo, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useT, type Language } from "../lib/i18n";

type FormState = {
  identifier: string;
  password: string;
};

type LoginScreenProps = {
  onSignIn?: (credentials: FormState) => Promise<void> | void;
  onChangeLanguage?: (language: Language) => void;
  submitting?: boolean;
  errorMessage?: string | null;
};

export function LoginScreen({
  onSignIn,
  onChangeLanguage,
  submitting = false,
  errorMessage,
}: LoginScreenProps) {
  const t = useT();
  const [form, setForm] = useState<FormState>({ identifier: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validationMessage = useMemo(() => {
    if (!submitted) return null;
    if (!form.identifier.trim() || !form.password.trim()) {
      return t("login.required");
    }
    return null;
  }, [form.identifier, form.password, submitted, t]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (form.identifier.trim() && form.password.trim()) {
      await onSignIn?.({
        identifier: form.identifier.trim(),
        password: form.password,
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="login-screen" aria-label={t("login.aria")}>
        <section className="card login-card">
          {onChangeLanguage ? (
            <div className="login-language">
              <LanguageSwitch onChange={onChangeLanguage} disabled={submitting} />
            </div>
          ) : null}

          <header className="login-hero">
            <div className="login-hero__top">
              <div className="brand-mark" aria-hidden="true">
                <AppLogo className="app-logo--brand" alt="" />
              </div>
              <div>
                <p className="brand-kicker">{t("login.kicker")}</p>
                <h1 className="brand-title">Capture Calcine</h1>
                <p className="brand-subtitle login-hero__copy">{t("login.subtitle")}</p>
              </div>
            </div>

            <div className="status-row">
              <div className="status-chip">
                <span className="status-dot"></span>
                {t("login.zone")}
              </div>
              <div className="status-chip secure">
                <span className="status-dot"></span>
                {t("login.networkSecure")}
              </div>
            </div>
          </header>

          <div className="login-divider" aria-hidden="true" />

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="identifier">{t("login.identifier")}</label>
              <div className="input-shell">
                <span className="material-symbols-outlined" aria-hidden="true">
                  badge
                </span>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder={t("login.identifierPlaceholder")}
                  value={form.identifier}
                  onChange={(event) => updateField("identifier", event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">{t("login.password")}</label>
              <div className="input-shell">
                <span className="material-symbols-outlined" aria-hidden="true">
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {(validationMessage ?? errorMessage) ? (
                <div className="helper-row error" role="status" aria-live="polite">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    error
                  </span>
                  <span>{validationMessage ?? errorMessage}</span>
                </div>
              ) : (
                <div className="helper-row" aria-live="polite">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <span>{t("login.helper")}</span>
                </div>
              )}
            </div>

            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                <span>{submitting ? t("login.signingIn") : t("login.signIn")}</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  login
                </span>
              </button>

              <button className="btn btn-secondary" type="button" disabled={submitting}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  help
                </span>
                <span>{t("login.help")}</span>
              </button>
            </div>
          </form>

          <aside className="support-card support-card--compact" aria-label={t("login.supportAria")}>
            <span className="material-symbols-outlined" aria-hidden="true">
              shield
            </span>
            <div>
              <strong>{t("login.shiftNote")}</strong>
              <p>{t("login.shiftNoteBody")}</p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
