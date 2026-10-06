import { useCallback, useEffect, useRef, useState } from "react";

import { BottomNav, type MobileTab } from "./components/BottomNav";
import {
  ensureFreshSession,
  login as loginWithApi,
  logout as logoutSession,
  msUntilRefresh,
  restoreSession,
  type AuthSession,
} from "./lib/auth";
import { prefetchCaptureThumbs, type CaptureHistoryItem } from "./lib/captures";
import { accountLanguage, describeError, setLanguage, useT, type Language } from "./lib/i18n";
import {
  DEFAULT_MOBILE_PREFERENCES,
  readMobilePreferences,
  updateMobilePreferences,
  type MobilePreferences,
} from "./lib/preferences";
import type { TodaySessionItem } from "./lib/sessionCoverage";
import { CaptureScreen } from "./screens/CaptureScreen";
import { CaptureDetailScreen } from "./screens/CaptureDetailScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MyDeviceScreen } from "./screens/MyDeviceScreen";
import { RecentCapturesScreen } from "./screens/RecentCapturesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodaySessionsScreen } from "./screens/TodaySessionsScreen";

function AuthBootstrapScreen() {
  const t = useT();

  return (
    <main className="app-shell">
      <section className="card login-card" aria-label={t("boot.aria")}>
        <p className="section-kicker">{t("boot.kicker")}</p>
        <h1 className="section-title">{t("boot.title")}</h1>
        <p className="section-copy">{t("boot.copy")}</p>
      </section>
    </main>
  );
}

function messageOf(error: unknown): string {
  return describeError(error, "common.unknownError");
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<MobilePreferences>(DEFAULT_MOBILE_PREFERENCES);
  const [activeTab, setActiveTab] = useState<MobileTab>("sessions");
  const [selectedCapture, setSelectedCapture] = useState<CaptureHistoryItem | null>(null);
  const [selectedSession, setSelectedSession] = useState<TodaySessionItem | null>(null);
  const warmedThumbScopesRef = useRef<Set<string>>(new Set());

  const handleLogout = useCallback(async () => {
    if (session) {
      await logoutSession(session);
    }
    setSession(null);
    setSelectedSession(null);
    setSelectedCapture(null);
    setActiveTab("sessions");
    setLoginError(null);
  }, [session]);

  const refreshIfNeeded = useCallback(async () => {
    if (!session) return;
    try {
      const fresh = await ensureFreshSession(session);
      if (fresh !== session) {
        setSession(fresh);
      }
    } catch (error) {
      await handleLogout();
      setLoginError(messageOf(error));
    }
  }, [handleLogout, session]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [restored, storedPreferences] = await Promise.all([
        restoreSession(),
        readMobilePreferences(),
      ]);
      if (cancelled) return;
      setSession(restored);
      setLanguage(storedPreferences.language);
      setPreferences(storedPreferences);
      setBooting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.dataset.mobileTheme = preferences.lightMode ? "light" : "dark";
    document.body.dataset.mobileContrast = preferences.highContrastMode ? "high" : "default";
    return () => {
      delete document.body.dataset.mobileTheme;
      delete document.body.dataset.mobileContrast;
    };
  }, [preferences.highContrastMode, preferences.lightMode]);

  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(() => {
      void refreshIfNeeded();
    }, msUntilRefresh(session.accessExpiresAt));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [refreshIfNeeded, session]);

  useEffect(() => {
    if (!session) return;

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void refreshIfNeeded();
      }
    }

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshIfNeeded, session]);

  useEffect(() => {
    if (!session || !preferences.historyWarmupEnabled) return;

    const plant = session.user.plant && session.user.plant !== "ALL" ? session.user.plant : "ALL";
    const warmupKey = `${session.user.id}:${plant}`;
    if (warmedThumbScopesRef.current.has(warmupKey)) {
      return;
    }

    warmedThumbScopesRef.current.add(warmupKey);
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const warmedSession = await prefetchCaptureThumbs(session, {
            plant: plant === "ALL" ? null : plant,
            pageSize: 50,
            maxRecords: 200,
            concurrency: 4,
          });
          if (!cancelled && warmedSession !== session) {
            setSession(warmedSession);
          }
        } catch {
          // Warm-up thumbnail sengaja diam; kalau gagal, kartu history tetap
          // akan memuat thumbnail saat dibuka.
        }
      })();
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [preferences.historyWarmupEnabled, session]);

  const handlePreferencesChange = useCallback(async (patch: Partial<MobilePreferences>) => {
    const next = await updateMobilePreferences(patch);
    setLanguage(next.language);
    setPreferences(next);
  }, []);

  // A message already on screen was written in the previous language.
  function handleLanguageChange(language: Language) {
    setLoginError(null);
    void handlePreferencesChange({ language });
  }

  async function handleLogin(credentials: { identifier: string; password: string }) {
    setLoginPending(true);
    setLoginError(null);
    try {
      const nextSession = await loginWithApi(credentials.identifier, credentials.password);
      // A shared phone follows whoever signs in, not the previous operator's
      // choice. The switch in Settings still works afterwards.
      const language = accountLanguage(nextSession.user.defaultLanguage);
      if (language) await handlePreferencesChange({ language });
      setSession(nextSession);
      setActiveTab("sessions");
      setSelectedSession(null);
      setSelectedCapture(null);
    } catch (error) {
      setLoginError(messageOf(error));
    } finally {
      setLoginPending(false);
    }
  }

  if (booting) {
    return <AuthBootstrapScreen />;
  }

  if (!session) {
    return (
      <LoginScreen
        onSignIn={handleLogin}
        onChangeLanguage={handleLanguageChange}
        submitting={loginPending}
        errorMessage={loginError}
      />
    );
  }

  return (
    <div className="mobile-app-shell">
      {selectedCapture ? (
        <CaptureDetailScreen
          session={session}
          captureId={selectedCapture.id}
          onSessionUpdate={setSession}
          onBack={() => setSelectedCapture(null)}
          onOpenCapture={() => {
            setSelectedCapture(null);
            setActiveTab("capture");
          }}
        />
      ) : null}
      {activeTab === "sessions" && !selectedCapture ? (
        <TodaySessionsScreen
          session={session}
          onSessionUpdate={setSession}
          onSelectSession={(item) => {
            setSelectedSession(item);
            setSelectedCapture(null);
            setActiveTab("capture");
          }}
        />
      ) : null}
      {activeTab === "capture" && !selectedCapture ? (
        <CaptureScreen
          session={session}
          operatorName={session.user.fullName}
          selectedSession={selectedSession}
          onSessionUpdate={setSession}
          onOpenSessions={() => setActiveTab("sessions")}
          onOpenLatestCapture={setSelectedCapture}
        />
      ) : null}
      {activeTab === "history" && !selectedCapture ? (
        <RecentCapturesScreen
          session={session}
          onSessionUpdate={setSession}
          onOpenDetail={setSelectedCapture}
        />
      ) : null}
      {activeTab === "device" && !selectedCapture ? (
        <MyDeviceScreen
          session={session}
          user={session.user}
          selectedPlant={selectedSession?.plant}
          onOpenSessions={() => setActiveTab("sessions")}
          onSessionUpdate={setSession}
          onSignOut={handleLogout}
        />
      ) : null}
      {activeTab === "settings" && !selectedCapture ? (
        <SettingsScreen
          session={session}
          preferences={preferences}
          onUpdatePreferences={handlePreferencesChange}
          onSignOut={handleLogout}
        />
      ) : null}

      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          setSelectedCapture(null);
          setActiveTab(tab);
        }}
      />
    </div>
  );
}
