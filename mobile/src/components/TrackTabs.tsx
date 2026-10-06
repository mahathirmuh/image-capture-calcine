import type { CaptureTrack } from "../../../src/lib/capture-schedule";
import { useT, type TranslationKey } from "../lib/i18n";

const TABS: { track: CaptureTrack; label: TranslationKey }[] = [
  { track: "regular", label: "track.regular" },
  { track: "trial", label: "track.trial" },
];

type TrackTabsProps = {
  track: CaptureTrack;
  onChange: (track: CaptureTrack) => void;
  disabled?: boolean;
};

/** Switches between the regular plant schedule and the 2-hour trial track. */
export function TrackTabs({ track, onChange, disabled = false }: TrackTabsProps) {
  const t = useT();

  return (
    <div className="capture-slot-selector track-tabs" role="tablist" aria-label={t("track.aria")}>
      {TABS.map((tab) => (
        <button
          key={tab.track}
          type="button"
          role="tab"
          aria-selected={track === tab.track}
          className={`capture-slot-selector__button ${
            track === tab.track ? "capture-slot-selector__button--active" : ""
          }`}
          disabled={disabled}
          onClick={() => onChange(tab.track)}
        >
          {t(tab.label)}
        </button>
      ))}
    </div>
  );
}
