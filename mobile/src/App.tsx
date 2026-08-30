import { useCallback, useEffect, useState } from "react";

import { BottomNav, type MobileTab } from "./components/BottomNav";
import {
  ensureFreshSession,
  login as loginWithApi,
  logout as logoutSession,
  msUntilRefresh,
  restoreSession,
  type AuthSession,
} from "./lib/auth";
import { MOCK_CAPTURES, type CaptureRecord } from "./mockData";
import { CaptureScreen } from "./screens/CaptureScreen";
import { CaptureDetailScreen } from "./screens/CaptureDetailScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MyDeviceScreen } from "./screens/MyDeviceScreen";
import { RecentCapturesScreen } from "./screens/RecentCapturesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodaySessionsScreen } from "./screens/TodaySessionsScreen";

function AuthBootstrapScreen() {
  return (
    <main className="app-shell">
      <section className="card login-card" aria-label="Restoring mobile session">
        <p className="section-kicker">Mobile Session</p>
        <h1 className="section-title">Restoring Access</h1>
        <p className="section-copy">
          Reconnecting your operator session and checking token validity.
        </p>
      </section>
    </main>
  );
}

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Request gagal diproses.";
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>("sessions");
  const [selectedCapture, setSelectedCapture] = useState<CaptureRecord | null>(null);

  const handleLogout = useCallback(async () => {
    if (session) {
      await logoutSession(session);
    }
    setSession(null);
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

    (async () => {
      const restored = await restoreSession();
      if (cancelled) return;
      setSession(restored);
      setBooting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleLogin(credentials: { identifier: string; password: string }) {
    setLoginPending(true);
    setLoginError(null);
    try {
      const nextSession = await loginWithApi(credentials.identifier, credentials.password);
      setSession(nextSession);
      setActiveTab("sessions");
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
        submitting={loginPending}
        errorMessage={loginError}
      />
    );
  }

  return (
    <div className="mobile-app-shell">
      {selectedCapture ? <CaptureDetailScreen capture={selectedCapture} onBack={() => setSelectedCapture(null)} /> : null}
      {activeTab === "sessions" && !selectedCapture ? <TodaySessionsScreen /> : null}
      {activeTab === "capture" && !selectedCapture ? (
        <CaptureScreen
          latestCapture={MOCK_CAPTURES[0]}
          onOpenLatest={(capture) => {
            setActiveTab("history");
            setSelectedCapture(capture);
          }}
        />
      ) : null}
      {activeTab === "history" && !selectedCapture ? (
        <RecentCapturesScreen captures={MOCK_CAPTURES} onOpenDetail={setSelectedCapture} />
      ) : null}
      {activeTab === "device" && !selectedCapture ? (
        <MyDeviceScreen user={session.user} onSignOut={handleLogout} />
      ) : null}
      {activeTab === "settings" && !selectedCapture ? (
        <SettingsScreen user={session.user} onSignOut={handleLogout} />
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
