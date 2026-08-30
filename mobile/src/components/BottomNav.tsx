const TABS = [
  { id: "sessions", label: "Sessions", icon: "assignment", filled: true },
  { id: "capture", label: "Capture", icon: "photo_camera" },
  { id: "history", label: "History", icon: "history" },
  { id: "device", label: "Device", icon: "settings_input_component" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

export type MobileTab = (typeof TABS)[number]["id"];

type BottomNavProps = {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
};

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Operator navigation">
      {TABS.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav__item${active ? " is-active" : ""}`}
            onClick={() => onChange(tab.id)}
            aria-current={active ? "page" : undefined}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={active && tab.filled ? { fontVariationSettings: '"FILL" 1' } : undefined}
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
