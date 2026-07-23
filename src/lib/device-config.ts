import { z } from "zod";

import { PLANTS } from "./locations";

export const DEVICE_BINS = ["Bin 1 / Bin 2", "Bin 1", "Bin 2"] as const;
export const DEVICE_STATIONS = ["Main Area", "Secondary Area", "Loading Bay"] as const;
export const DEVICE_SCHEDULES = [
  "Every Hour",
  "Every 3 Hours",
  "Every 6 Hours",
  "Manual only",
] as const;
export const DEVICE_TIMEZONES = [
  "Asia/Makassar (WITA)",
  "Asia/Jakarta (WIB)",
  "Asia/Jayapura (WIT)",
] as const;

export const ISO_OPTIONS = ["Auto", "100", "200", "400", "800", "1600", "3200"] as const;
export const SHUTTER_OPTIONS = ["1/30", "1/60", "1/125", "1/250", "1/500", "1/1000"] as const;
export const APERTURE_OPTIONS = ["f/4", "f/5.6", "f/8", "f/11", "f/16"] as const;
export const WHITE_BALANCE_OPTIONS = [
  "Auto",
  "Daylight",
  "Cloudy",
  "Fluorescent",
  "Tungsten",
] as const;
export const PICTURE_STYLE_OPTIONS = [
  "Standard",
  "Neutral",
  "Faithful",
  "Portrait",
  "Landscape",
] as const;
export const FOCUS_MODE_OPTIONS = ["Autofocus", "Manual Focus"] as const;

export type CameraSettings = {
  iso: (typeof ISO_OPTIONS)[number];
  shutter: (typeof SHUTTER_OPTIONS)[number];
  aperture: (typeof APERTURE_OPTIONS)[number];
  whiteBalance: (typeof WHITE_BALANCE_OPTIONS)[number];
  pictureStyle: (typeof PICTURE_STYLE_OPTIONS)[number];
  focusMode: (typeof FOCUS_MODE_OPTIONS)[number];
};

export type DeviceTemplate = {
  id: string;
  label: string;
  description: string;
  recommendedFor: string;
  badges: string[];
  filterTags: PresetFilterTag[];
  cameraSettings: CameraSettings;
};

export type EdgeProfileSettings = Record<string, string | number | boolean>;
export const PRESET_FILTERS = [
  "All",
  "General",
  "Calcine",
  "Outdoor",
  "Indoor",
  "Lab",
  "Night",
  "Manual",
] as const;
export type PresetFilter = (typeof PRESET_FILTERS)[number];
export type PresetFilterTag = Exclude<PresetFilter, "All">;
export const PRESET_FILTER_LABELS: Record<PresetFilter, string> = {
  All: "Semua",
  General: "Umum",
  Calcine: "Calcine",
  Outdoor: "Outdoor",
  Indoor: "Indoor",
  Lab: "Lab",
  Night: "Malam",
  Manual: "Manual",
};
export const APPLY_HISTORY_SAVED_VIEW_OPTIONS = [
  "all-activity",
  "failures-only",
  "needs-review",
  "with-edge-profile",
] as const;
export type ApplyHistorySavedViewPreference = (typeof APPLY_HISTORY_SAVED_VIEW_OPTIONS)[number];
export const DEVICE_EVENT_SAVED_VIEW_OPTIONS = [
  "audit-slot-1",
  "audit-slot-2",
  "audit-slot-3",
] as const;
export type DeviceEventSavedViewPreference = (typeof DEVICE_EVENT_SAVED_VIEW_OPTIONS)[number];
export const DEVICE_EVENT_SEVERITY_OPTIONS = ["all", "info", "warning", "error"] as const;
export const DEVICE_EVENT_TYPE_OPTIONS = [
  "all",
  "capture",
  "autofocus",
  "fallback",
  "other",
] as const;
export const DEVICE_EVENT_TIME_RANGE_OPTIONS = ["all", "today", "7d", "30d", "custom"] as const;
export type DeviceEventSavedViewState = {
  severity: (typeof DEVICE_EVENT_SEVERITY_OPTIONS)[number];
  eventType: (typeof DEVICE_EVENT_TYPE_OPTIONS)[number];
  timeRange: (typeof DEVICE_EVENT_TIME_RANGE_OPTIONS)[number];
  searchQuery: string;
  customStart: string;
  customEnd: string;
};
export type DeviceEventSavedViewEntry = {
  id: DeviceEventSavedViewPreference;
  label: string;
  state: DeviceEventSavedViewState | null;
  updatedAt: number | null;
};

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  {
    id: "default-calcine-r50",
    label: "Default - Sampling Calcine (R50)",
    description: "Baseline seimbang untuk sampling calcine rutin dengan autofocus aktif.",
    recommendedFor: "Sampling calcine rutin dengan pencahayaan stabil dan framing umum.",
    badges: ["Seimbang", "Rutin", "Autofocus"],
    filterTags: ["General", "Calcine"],
    cameraSettings: {
      iso: "200",
      shutter: "1/125",
      aperture: "f/8",
      whiteBalance: "Daylight",
      pictureStyle: "Standard",
      focusMode: "Autofocus",
    },
  },
  {
    id: "high-res-sampling-r50",
    label: "Sampling Resolusi Tinggi (R50)",
    description:
      "Preset lebih tajam dan sedikit lebih lambat untuk sampel statis dengan cahaya kuat.",
    recommendedFor:
      "Sampel detail tinggi saat pencahayaan terkontrol dan ketajaman diprioritaskan.",
    badges: ["Detail Tinggi", "Cahaya Terkontrol", "Autofocus"],
    filterTags: ["General", "Lab"],
    cameraSettings: {
      iso: "100",
      shutter: "1/250",
      aperture: "f/11",
      whiteBalance: "Daylight",
      pictureStyle: "Neutral",
      focusMode: "Autofocus",
    },
  },
  {
    id: "low-light-inspection",
    label: "Inspeksi Minim Cahaya",
    description:
      "Profil eksposur lebih terang untuk area sampling yang redup dengan shutter lebih lambat.",
    recommendedFor: "Zona plant redup, station yang sedikit teduh, atau inspeksi sore hari.",
    badges: ["Minim Cahaya", "Eksposur Cerah", "Autofocus"],
    filterTags: ["General", "Night"],
    cameraSettings: {
      iso: "800",
      shutter: "1/60",
      aperture: "f/4",
      whiteBalance: "Auto",
      pictureStyle: "Standard",
      focusMode: "Autofocus",
    },
  },
  {
    id: "fast-capture-line",
    label: "Jalur Capture Cepat",
    description:
      "Profil shutter lebih cepat untuk siklus capture berulang dan workflow operator yang dinamis.",
    recommendedFor: "Capture throughput tinggi saat motion blur harus ditekan.",
    badges: ["Cepat", "Anti Blur", "Autofocus"],
    filterTags: ["General", "Indoor"],
    cameraSettings: {
      iso: "400",
      shutter: "1/500",
      aperture: "f/5.6",
      whiteBalance: "Daylight",
      pictureStyle: "Standard",
      focusMode: "Autofocus",
    },
  },
  {
    id: "high-detail-lab",
    label: "Lab Detail Tinggi",
    description:
      "Preset depth-of-field lebih dalam untuk pencahayaan terkontrol dan inspeksi permukaan detail.",
    recommendedFor: "Lab atau bench terkontrol saat tekstur dan depth-of-field sangat penting.",
    badges: ["Lab", "Fokus Dalam", "Fokus Manual"],
    filterTags: ["Lab", "Manual"],
    cameraSettings: {
      iso: "100",
      shutter: "1/125",
      aperture: "f/16",
      whiteBalance: "Daylight",
      pictureStyle: "Neutral",
      focusMode: "Manual Focus",
    },
  },
  {
    id: "manual-inspection-pro",
    label: "Inspeksi Manual",
    description: "Profil fokus manual untuk framing dan kontrol eksposur yang dipandu operator.",
    recommendedFor:
      "Inspeksi yang dipandu operator saat framing dan eksposur perlu penilaian manual.",
    badges: ["Manual", "Kontrol Operator", "Inspeksi"],
    filterTags: ["Manual", "General"],
    cameraSettings: {
      iso: "200",
      shutter: "1/125",
      aperture: "f/11",
      whiteBalance: "Cloudy",
      pictureStyle: "Faithful",
      focusMode: "Manual Focus",
    },
  },
  {
    id: "calcine-day-shift-outdoor",
    label: "Calcine Outdoor Shift Siang",
    description:
      "Preset daylight cerah untuk titik sampling calcine outdoor atau area dengan eksposur tinggi.",
    recommendedFor:
      "Bin outdoor, deck sampling terbuka, atau kondisi shift siang yang sangat terang.",
    badges: ["Calcine", "Outdoor", "Shift Siang"],
    filterTags: ["Calcine", "Outdoor"],
    cameraSettings: {
      iso: "100",
      shutter: "1/500",
      aperture: "f/11",
      whiteBalance: "Daylight",
      pictureStyle: "Landscape",
      focusMode: "Autofocus",
    },
  },
  {
    id: "calcine-indoor-conveyor",
    label: "Calcine Conveyor Indoor",
    description: "Preset cepat dan seimbang untuk conveyor indoor atau jalur transfer tertutup.",
    recommendedFor:
      "Sampling conveyor indoor, aliran material bergerak, dan pencahayaan plant fluorescent.",
    filterTags: ["Calcine", "Indoor"],
    badges: ["Calcine", "Indoor", "Conveyor"],
    cameraSettings: {
      iso: "400",
      shutter: "1/250",
      aperture: "f/5.6",
      whiteBalance: "Fluorescent",
      pictureStyle: "Standard",
      focusMode: "Autofocus",
    },
  },
  {
    id: "calcine-lab-macro",
    label: "Calcine Lab Macro",
    description:
      "Preset berorientasi detail untuk sampel lab close-up dan review tekstur permukaan.",
    recommendedFor: "Tray sampel jarak dekat, framing ala macro, dan bench inspeksi terkontrol.",
    filterTags: ["Calcine", "Lab"],
    badges: ["Calcine", "Lab", "Macro"],
    cameraSettings: {
      iso: "100",
      shutter: "1/60",
      aperture: "f/16",
      whiteBalance: "Daylight",
      pictureStyle: "Neutral",
      focusMode: "Manual Focus",
    },
  },
  {
    id: "calcine-night-shift",
    label: "Calcine Shift Malam",
    description:
      "Preset minim cahaya untuk zona sampling shift malam yang gelap atau dominan tungsten.",
    recommendedFor:
      "Pengecekan shift malam, lorong plant yang gelap, dan pencahayaan industri hangat.",
    badges: ["Calcine", "Shift Malam", "Minim Cahaya"],
    filterTags: ["Calcine", "Night"],
    cameraSettings: {
      iso: "1600",
      shutter: "1/60",
      aperture: "f/4",
      whiteBalance: "Tungsten",
      pictureStyle: "Standard",
      focusMode: "Autofocus",
    },
  },
  {
    id: "manual-only",
    label: "Manual Saja",
    description: "Gunakan saat operator ingin kontrol yang lebih ketat atas eksposur dan fokus.",
    recommendedFor: "Kasus khusus saat operator perlu override automasi dan menyetel langsung.",
    filterTags: ["Manual"],
    badges: ["Manual", "Fallback", "Kontrol Operator"],
    cameraSettings: {
      iso: "400",
      shutter: "1/125",
      aperture: "f/8",
      whiteBalance: "Auto",
      pictureStyle: "Faithful",
      focusMode: "Manual Focus",
    },
  },
];

export const DEFAULT_DEVICE_TEMPLATE_ID = DEVICE_TEMPLATES[0].id;
const DEVICE_PROFILE_KEY = "capture-system:device-profile:v1";
const PRESET_FILTER_KEY = "capture-system:preset-filter:v1";
const APPLY_HISTORY_KEY = "capture-system:apply-history:v1";
const APPLY_HISTORY_SAVED_VIEW_KEY = "capture-system:apply-history-saved-view:v1";
const DEVICE_EVENT_SAVED_VIEWS_KEY = "capture-system:device-event-saved-views:v1";
const DEFAULT_DEVICE_EVENT_SAVED_VIEWS: DeviceEventSavedViewEntry[] = [
  {
    id: "audit-slot-1",
    label: "Audit Harian",
    state: null,
    updatedAt: null,
  },
  {
    id: "audit-slot-2",
    label: "Insiden",
    state: null,
    updatedAt: null,
  },
  {
    id: "audit-slot-3",
    label: "Operator",
    state: null,
    updatedAt: null,
  },
];

const cameraSettingsSchema = z.object({
  iso: z.enum(ISO_OPTIONS),
  shutter: z.enum(SHUTTER_OPTIONS),
  aperture: z.enum(APERTURE_OPTIONS),
  whiteBalance: z.enum(WHITE_BALANCE_OPTIONS),
  pictureStyle: z.enum(PICTURE_STYLE_OPTIONS),
  focusMode: z.enum(FOCUS_MODE_OPTIONS),
});
const presetFilterSchema = z.enum(PRESET_FILTERS);
const applyHistorySavedViewSchema = z.enum(APPLY_HISTORY_SAVED_VIEW_OPTIONS);
const deviceEventSavedViewPreferenceSchema = z.enum(DEVICE_EVENT_SAVED_VIEW_OPTIONS);
const deviceEventSavedViewStateSchema = z.object({
  severity: z.enum(DEVICE_EVENT_SEVERITY_OPTIONS),
  eventType: z.enum(DEVICE_EVENT_TYPE_OPTIONS),
  timeRange: z.enum(DEVICE_EVENT_TIME_RANGE_OPTIONS),
  searchQuery: z.string(),
  customStart: z.string(),
  customEnd: z.string(),
});
const deviceEventSavedViewEntrySchema = z.object({
  id: deviceEventSavedViewPreferenceSchema,
  label: z.string(),
  state: deviceEventSavedViewStateSchema.nullable(),
  updatedAt: z.number().nullable(),
});
const deviceEventSavedViewsSchema = z.array(deviceEventSavedViewEntrySchema);

const deviceProfileSchema = z.object({
  deviceCode: z.string(),
  deviceName: z.string(),
  plant: z.string(),
  bin: z.string(),
  station: z.string(),
  description: z.string(),
  templateId: z.string(),
  schedule: z.string(),
  timezone: z.string(),
  cameraSettings: cameraSettingsSchema,
  edgeProfileId: z.string().nullable().default(null),
  edgeLastAppliedAt: z.number().nullable().default(null),
  registeredAt: z.number(),
  updatedAt: z.number(),
});
const applyHistoryEntrySchema = z.object({
  id: z.string(),
  status: z.enum(["applied", "failed"]),
  templateId: z.string(),
  templateLabel: z.string(),
  timestamp: z.number(),
  message: z.string(),
  edgeProfileId: z.string().nullable().default(null),
  appliedKeys: z.array(z.string()).default([]),
  skippedKeys: z.array(z.string()).default([]),
  code: z.string().nullable().default(null),
});
const applyHistorySchema = z.array(applyHistoryEntrySchema);

export type DeviceProfile = z.infer<typeof deviceProfileSchema>;
export type ApplyHistoryEntry = z.infer<typeof applyHistoryEntrySchema>;

export type DeviceProfileInput = Omit<DeviceProfile, "registeredAt" | "updatedAt"> & {
  registeredAt?: number;
  updatedAt?: number;
};

export function getTemplateById(templateId: string): DeviceTemplate {
  return DEVICE_TEMPLATES.find((template) => template.id === templateId) ?? DEVICE_TEMPLATES[0];
}

export function filterTemplatesByTag(filter: PresetFilter): DeviceTemplate[] {
  if (filter === "All") return DEVICE_TEMPLATES;
  return DEVICE_TEMPLATES.filter((template) => template.filterTags.includes(filter));
}

export function getPresetFilterLabel(filter: PresetFilter | PresetFilterTag): string {
  return PRESET_FILTER_LABELS[filter];
}

export function createProfileFromInput(input: DeviceProfileInput): DeviceProfile {
  const now = Date.now();
  return deviceProfileSchema.parse({
    ...input,
    templateId: getTemplateById(input.templateId).id,
    registeredAt: input.registeredAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

export function loadDeviceProfile(): DeviceProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return deviceProfileSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function saveDeviceProfile(profile: DeviceProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
}

export function clearDeviceProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEVICE_PROFILE_KEY);
}

export function loadPresetFilterPreference(): PresetFilter {
  if (typeof window === "undefined") return PRESET_FILTERS[0];
  try {
    const raw = window.localStorage.getItem(PRESET_FILTER_KEY);
    if (!raw) return PRESET_FILTERS[0];
    return presetFilterSchema.parse(raw);
  } catch {
    return PRESET_FILTERS[0];
  }
}

export function savePresetFilterPreference(filter: PresetFilter): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRESET_FILTER_KEY, filter);
}

export function loadApplyHistorySavedViewPreference(): ApplyHistorySavedViewPreference {
  if (typeof window === "undefined") return APPLY_HISTORY_SAVED_VIEW_OPTIONS[0];
  try {
    const raw = window.localStorage.getItem(APPLY_HISTORY_SAVED_VIEW_KEY);
    if (!raw) return APPLY_HISTORY_SAVED_VIEW_OPTIONS[0];
    return applyHistorySavedViewSchema.parse(raw);
  } catch {
    return APPLY_HISTORY_SAVED_VIEW_OPTIONS[0];
  }
}

export function saveApplyHistorySavedViewPreference(
  savedView: ApplyHistorySavedViewPreference,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLY_HISTORY_SAVED_VIEW_KEY, savedView);
}

export function loadApplyHistory(): ApplyHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(APPLY_HISTORY_KEY);
    if (!raw) return [];
    return applyHistorySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function loadDeviceEventSavedViews(): DeviceEventSavedViewEntry[] {
  if (typeof window === "undefined") return DEFAULT_DEVICE_EVENT_SAVED_VIEWS;
  try {
    const raw = window.localStorage.getItem(DEVICE_EVENT_SAVED_VIEWS_KEY);
    if (!raw) return DEFAULT_DEVICE_EVENT_SAVED_VIEWS;

    const parsed = deviceEventSavedViewsSchema.parse(JSON.parse(raw));
    return DEFAULT_DEVICE_EVENT_SAVED_VIEWS.map((defaultView) => {
      const savedView = parsed.find((entry) => entry.id === defaultView.id);
      return savedView ?? defaultView;
    });
  } catch {
    return DEFAULT_DEVICE_EVENT_SAVED_VIEWS;
  }
}

export function saveDeviceEventSavedViews(views: DeviceEventSavedViewEntry[]): void {
  if (typeof window === "undefined") return;
  const normalizedViews = DEFAULT_DEVICE_EVENT_SAVED_VIEWS.map((defaultView) => {
    const view = views.find((entry) => entry.id === defaultView.id);
    return view ?? defaultView;
  });
  window.localStorage.setItem(DEVICE_EVENT_SAVED_VIEWS_KEY, JSON.stringify(normalizedViews));
}

export function saveApplyHistory(entries: ApplyHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLY_HISTORY_KEY, JSON.stringify(entries.slice(0, 10)));
}

export function clearApplyHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(APPLY_HISTORY_KEY);
}

export function appendApplyHistory(entry: ApplyHistoryEntry): ApplyHistoryEntry[] {
  const nextEntries = [entry, ...loadApplyHistory()].slice(0, 10);
  saveApplyHistory(nextEntries);
  return nextEntries;
}

export function getTemplateCameraSettings(templateId: string): CameraSettings {
  return structuredClone(getTemplateById(templateId).cameraSettings);
}

export function createDefaultDeviceProfile(): DeviceProfile {
  return createProfileFromInput({
    deviceCode: "",
    deviceName: "",
    plant: PLANTS[0],
    bin: DEVICE_BINS[0],
    station: DEVICE_STATIONS[0],
    description: "",
    templateId: DEFAULT_DEVICE_TEMPLATE_ID,
    schedule: DEVICE_SCHEDULES[1],
    timezone: DEVICE_TIMEZONES[0],
    cameraSettings: getTemplateCameraSettings(DEFAULT_DEVICE_TEMPLATE_ID),
    edgeProfileId: null,
    edgeLastAppliedAt: null,
  });
}

const EDGE_CONFIG_KEY_BY_CAMERA_SETTING: Record<keyof CameraSettings, string | null> = {
  iso: "iso",
  shutter: "shutterSpeed",
  aperture: "aperture",
  whiteBalance: "whiteBalance",
  pictureStyle: null,
  focusMode: "focusMode",
};

export function toEdgeProfileSettings(cameraSettings: CameraSettings): {
  settings: EdgeProfileSettings;
  skippedKeys: Array<keyof CameraSettings>;
} {
  const settings: EdgeProfileSettings = {};
  const skippedKeys: Array<keyof CameraSettings> = [];

  (Object.keys(EDGE_CONFIG_KEY_BY_CAMERA_SETTING) as Array<keyof CameraSettings>).forEach((key) => {
    const edgeKey = EDGE_CONFIG_KEY_BY_CAMERA_SETTING[key];
    if (!edgeKey) {
      skippedKeys.push(key);
      return;
    }
    settings[edgeKey] = cameraSettings[key];
  });

  return { settings, skippedKeys };
}
