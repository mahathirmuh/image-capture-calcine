import type { CaptureTrack } from "../../../src/lib/capture-schedule";

const TABS: { track: CaptureTrack; label: string }[] = [
  { track: "regular", label: "3-Hour Sessions" },
  { track: "trial", label: "2-Hour Trial" },
];

type TrackTabsProps = {
  track: CaptureTrack;
  onChange: (track: CaptureTrack) => void;
  disabled?: boolean;
};

/** Switches between the regular plant schedule and the 2-hour trial track. */
export function TrackTabs({ track, onChange, disabled = false }: TrackTabsProps) {
  return (
    <div className="capture-slot-selector track-tabs" role="tablist" aria-label="Session track">
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
          {tab.label}
        </button>
      ))}
    </div>
  );
}
