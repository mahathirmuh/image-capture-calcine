import { useT } from "../lib/i18n";

const TABS = [
  { id: "sessions", label: "nav.sessions", icon: "assignment", filled: true },
  { id: "capture", label: "nav.capture", icon: "photo_camera" },
  { id: "history", label: "nav.history", icon: "history" },
  { id: "device", label: "nav.device", icon: "settings_input_component" },
  { id: "settings", label: "nav.settings", icon: "settings" },
] as const;

export type MobileTab = (typeof TABS)[number]["id"];

type BottomNavProps = {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
};

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const t = useT();

  return (
    <nav className="bottom-nav" aria-label={t("nav.aria")}>
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
              style={
                active && "filled" in tab && tab.filled
                  ? { fontVariationSettings: '"FILL" 1' }
                  : undefined
              }
            >
              {tab.icon}
            </span>
            <span>{t(tab.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
