import { useMemo, useState } from "react";

type FormState = {
  identifier: string;
  password: string;
};

type LoginScreenProps = {
  onSignIn?: () => void;
};

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [form, setForm] = useState<FormState>({ identifier: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errorMessage = useMemo(() => {
    if (!submitted) return null;
    if (!form.identifier.trim() || !form.password.trim()) {
      return "Username or password is required.";
    }
    return "Invalid credentials. Please try again.";
  }, [form.identifier, form.password, submitted]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (form.identifier.trim() && form.password.trim()) {
      onSignIn?.();
    }
  }

  return (
    <main className="app-shell">
      <section className="login-screen" aria-label="Operator sign in">
        <header className="brand-panel">
          <div className="brand-mark" aria-hidden="true">
            <span className="material-symbols-outlined">precision_manufacturing</span>
          </div>
          <p className="brand-kicker">Calcine Sampling Operator Tool</p>
          <h1 className="brand-title">Capture Calcine</h1>
          <p className="brand-subtitle">
            Sign in to continue your assigned sampling session and capture workflow.
          </p>
          <div className="status-row">
            <div className="status-chip">
              <span className="status-dot"></span>
              Zone 04
            </div>
            <div className="status-chip secure">
              <span className="status-dot"></span>
              Network Secure
            </div>
          </div>
        </header>

        <section className="card">
          <p className="section-kicker">Operator Access</p>
          <h2 className="section-title">Sign In</h2>
          <p className="section-copy">
            Use your operator account credentials to access today&apos;s sessions, capture flow,
            and recent results.
          </p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="identifier">Username or Email</label>
              <div className="input-shell">
                <span className="material-symbols-outlined" aria-hidden="true">
                  badge
                </span>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter username or email"
                  value={form.identifier}
                  onChange={(event) => updateField("identifier", event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-shell">
                <span className="material-symbols-outlined" aria-hidden="true">
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {errorMessage ? (
                <div className="helper-row error" role="status" aria-live="polite">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    error
                  </span>
                  <span>{errorMessage}</span>
                </div>
              ) : (
                <div className="helper-row" aria-live="polite">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <span>Sign in with your operator account credentials.</span>
                </div>
              )}
            </div>

            <div className="actions">
              <button className="btn btn-primary" type="submit">
                <span>Sign In</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  login
                </span>
              </button>

              <button className="btn btn-secondary" type="button">
                <span className="material-symbols-outlined" aria-hidden="true">
                  help
                </span>
                <span>Help / Support</span>
              </button>
            </div>
          </form>

          <aside className="support-card" aria-label="Support information">
            <span className="material-symbols-outlined" aria-hidden="true">
              shield
            </span>
            <div>
              <strong>Shift note</strong>
              <p>
                If access fails repeatedly, contact the shift supervisor or application admin to
                verify your operator account status.
              </p>
            </div>
          </aside>

          <footer className="footer-meta">
            <div className="meta-block">
              <span className="meta-label">System Version</span>
              <span className="meta-value">SYS_VER 4.2.1-BETA</span>
            </div>
            <div className="meta-block">
              <span className="meta-label">Security State</span>
              <span className="meta-value">SECURE LINK ACTIVE</span>
            </div>
          </footer>
        </section>
      </section>
    </main>
  );
}
