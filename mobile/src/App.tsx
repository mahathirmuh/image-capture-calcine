import { useState } from "react";

import { BottomNav, type MobileTab } from "./components/BottomNav";
import { LoginScreen } from "./screens/LoginScreen";
import { TodaySessionsScreen } from "./screens/TodaySessionsScreen";

function PlaceholderScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="app-page-shell">
      <section className="page-card placeholder-card">
        <p className="section-kicker">Operator Module</p>
        <h1 className="page-title">{title}</h1>
        <p className="section-copy">{body}</p>
      </section>
    </main>
  );
}

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>("sessions");

  if (!signedIn) {
    return (
      <LoginScreen
        onSignIn={() => {
          setSignedIn(true);
          setActiveTab("sessions");
        }}
      />
    );
  }

  return (
    <div className="mobile-app-shell">
      {activeTab === "sessions" ? <TodaySessionsScreen /> : null}
      {activeTab === "capture" ? (
        <PlaceholderScreen
          title="Capture"
          body="Capture flow screen will live here. This tab is reserved for camera session, autofocus, capture trigger, and job progress."
        />
      ) : null}
      {activeTab === "history" ? (
        <PlaceholderScreen
          title="Recent Captures"
          body="Recent capture history will be added here for operators to verify the latest photos and review capture outcomes."
        />
      ) : null}
      {activeTab === "device" ? (
        <PlaceholderScreen
          title="My Device"
          body="Assigned device status will be shown here, including reachability, health state, and latest capture activity."
        />
      ) : null}
      {activeTab === "settings" ? (
        <PlaceholderScreen
          title="Settings"
          body="Operator settings will be kept minimal here: account context, plant assignment, preferences, and logout."
        />
      ) : null}

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
