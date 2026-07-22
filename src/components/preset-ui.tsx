import type { CameraSettings, DeviceTemplate, PresetFilter } from "@/lib/device-config";
import { PRESET_FILTERS, getPresetFilterLabel } from "@/lib/device-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SETTING_LABELS: Array<{ key: keyof CameraSettings; label: string }> = [
  { key: "iso", label: "ISO" },
  { key: "shutter", label: "Shutter" },
  { key: "aperture", label: "Aperture" },
  { key: "whiteBalance", label: "White Balance" },
  { key: "pictureStyle", label: "Picture Style" },
  { key: "focusMode", label: "Mode Fokus" },
];

function getBadgeClassName(badge: string) {
  const lower = badge.toLowerCase();

  if (lower.includes("outdoor") || lower.includes("day") || lower.includes("siang")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  if (lower.includes("night") || lower.includes("low light") || lower.includes("malam")) {
    return "border-indigo-500/30 bg-indigo-500/10 text-indigo-700";
  }
  if (lower.includes("lab") || lower.includes("macro")) {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700";
  }
  if (lower.includes("indoor") || lower.includes("conveyor")) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  }
  if (lower.includes("manual") || lower.includes("operator") || lower.includes("kontrol")) {
    return "border-slate-500/30 bg-slate-500/10 text-slate-700";
  }
  if (lower.includes("fast") || lower.includes("anti blur") || lower.includes("cepat")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700";
  }
  if (lower.includes("calcine")) {
    return "border-orange-500/30 bg-orange-500/10 text-orange-700";
  }
  if (lower.includes("autofocus") || lower.includes("seimbang")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }

  return "border-primary/20 bg-primary/5 text-primary";
}

function ApplyActionButton({
  disabled,
  hint,
  onClick,
}: {
  disabled: boolean;
  hint?: string | null;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Terapkan sekarang
    </button>
  );

  if (!disabled || !hint) return button;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PresetBadge({ badge }: { badge: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getBadgeClassName(
        badge,
      )}`}
    >
      {badge}
    </span>
  );
}

export function PresetFilterBar({
  value,
  onChange,
}: {
  value: PresetFilter;
  onChange: (value: PresetFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_FILTERS.map((filter) => {
        const active = filter === value;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent"
            }`}
          >
            {getPresetFilterLabel(filter)}
          </button>
        );
      })}
    </div>
  );
}

export function PresetTemplatePreview({
  template,
  compact = false,
}: {
  template: DeviceTemplate;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{template.label}</div>
          <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Direkomendasikan untuk: {template.recommendedFor}
          </p>
        </div>
        {!compact && (
          <div className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
            Tag: {template.filterTags.map((tag) => getPresetFilterLabel(tag)).join(", ")}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {template.badges.map((badge) => (
          <PresetBadge key={badge} badge={badge} />
        ))}
      </div>
    </div>
  );
}

export function PresetExplorerGrid({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onUseTemplate,
  onApplyTemplate,
  applyActionDisabled = false,
  applyActionHint,
}: {
  templates: DeviceTemplate[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  onUseTemplate?: (templateId: string) => void;
  onApplyTemplate?: (templateId: string) => void;
  applyActionDisabled?: boolean;
  applyActionHint?: string | null;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
        Tidak ada preset yang cocok dengan filter ini.
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {templates.map((template) => {
        const selected = template.id === selectedTemplateId;
        return (
          <div
            key={template.id}
            className={`rounded-md border p-3 text-left transition-colors ${
              selected
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:border-primary/40"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectTemplate(template.id)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{template.label}</div>
                <span className="text-[11px] text-muted-foreground">
                  {selected
                    ? "Dipilih"
                    : template.filterTags.map((tag) => getPresetFilterLabel(tag)).join(" / ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{template.recommendedFor}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {template.badges.map((badge) => (
                  <PresetBadge key={badge} badge={badge} />
                ))}
              </div>
            </button>
            {(onUseTemplate || onApplyTemplate) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                {onUseTemplate && (
                  <button
                    type="button"
                    onClick={() => onUseTemplate(template.id)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    {selected ? "Preset ini sedang dipakai" : "Pakai preset ini"}
                  </button>
                )}
                {onApplyTemplate && (
                  <ApplyActionButton
                    disabled={applyActionDisabled}
                    hint={applyActionHint}
                    onClick={() => onApplyTemplate(template.id)}
                  />
                )}
                {onApplyTemplate && applyActionDisabled && applyActionHint && (
                  <div className="w-full text-[11px] text-amber-700">{applyActionHint}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PresetCompareTable({
  title,
  baseTemplate,
  compareOptions,
  compareTemplateId,
  onCompareTemplateChange,
  onUseBaseTemplate,
  onApplyBaseTemplate,
  applyActionDisabled = false,
  applyActionHint,
}: {
  title: string;
  baseTemplate: DeviceTemplate;
  compareOptions: DeviceTemplate[];
  compareTemplateId: string;
  onCompareTemplateChange: (templateId: string) => void;
  onUseBaseTemplate?: () => void;
  onApplyBaseTemplate?: () => void;
  applyActionDisabled?: boolean;
  applyActionHint?: string | null;
}) {
  const compareTemplate =
    compareOptions.find((template) => template.id === compareTemplateId) ??
    compareOptions[0] ??
    null;

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">
            Bandingkan preset terpilih dengan template lain sebelum diterapkan.
          </p>
        </div>
        <div className="flex w-full max-w-xl flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium">Bandingkan dengan</label>
            <select
              value={compareTemplate?.id ?? ""}
              onChange={(e) => onCompareTemplateChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {compareOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>
          {onUseBaseTemplate && (
            <button
              type="button"
              onClick={onUseBaseTemplate}
              className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              Pakai preset ini
            </button>
          )}
          {onApplyBaseTemplate && (
            <ApplyActionButton
              disabled={applyActionDisabled}
              hint={applyActionHint}
              onClick={onApplyBaseTemplate}
            />
          )}
          {onApplyBaseTemplate && applyActionDisabled && applyActionHint && (
            <div className="w-full text-[11px] text-amber-700">{applyActionHint}</div>
          )}
        </div>
      </div>

      {!compareTemplate && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Tidak ada preset pembanding untuk filter ini.
        </div>
      )}

      {compareTemplate && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <PresetTemplatePreview template={baseTemplate} compact />
            <PresetTemplatePreview template={compareTemplate} compact />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {SETTING_LABELS.map((row) => {
              const baseValue = baseTemplate.cameraSettings[row.key];
              const compareValue = compareTemplate.cameraSettings[row.key];
              const same = baseValue === compareValue;
              return (
                <div key={row.key} className="rounded-md border bg-background px-3 py-2 text-xs">
                  <div className="font-medium">{row.label}</div>
                  <div className="mt-1 text-muted-foreground">
                    Dipilih: <span className="font-medium text-foreground">{baseValue}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Pembanding: <span className="font-medium text-foreground">{compareValue}</span>
                  </div>
                  <div className={same ? "mt-1 text-emerald-700" : "mt-1 text-amber-700"}>
                    {same ? "Nilainya sama" : "Nilainya berbeda"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
