import { useState } from "react";

import { BottomNav, type MobileTab } from "./components/BottomNav";
import { MOCK_CAPTURES, type CaptureRecord } from "./mockData";
import { CaptureScreen } from "./screens/CaptureScreen";
import { CaptureDetailScreen } from "./screens/CaptureDetailScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MyDeviceScreen } from "./screens/MyDeviceScreen";
import { RecentCapturesScreen } from "./screens/RecentCapturesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodaySessionsScreen } from "./screens/TodaySessionsScreen";

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>("sessions");
  const [selectedCapture, setSelectedCapture] = useState<CaptureRecord | null>(null);

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
        <MyDeviceScreen />
      ) : null}
      {activeTab === "settings" && !selectedCapture ? (
        <SettingsScreen />
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
