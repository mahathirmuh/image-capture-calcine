import { describe, expect, it } from "vitest";

import {
  appendApplyHistory,
  clearApplyHistory,
  DEFAULT_DEVICE_TEMPLATE_ID,
  DEVICE_TEMPLATES,
  loadApplyHistorySavedViewPreference,
  createDefaultDeviceProfile,
  createProfileFromInput,
  filterTemplatesByTag,
  getTemplateById,
  getTemplateCameraSettings,
  loadApplyHistory,
  loadPresetFilterPreference,
  saveApplyHistorySavedViewPreference,
  savePresetFilterPreference,
  toEdgeProfileSettings,
} from "./device-config";

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("device-config", () => {
  it("returns the default template when an unknown template id is requested", () => {
    const template = getTemplateById("missing-template");

    expect(template.id).toBe(DEFAULT_DEVICE_TEMPLATE_ID);
  });

  it("clones template camera settings for new drafts", () => {
    const defaults = getTemplateCameraSettings(DEFAULT_DEVICE_TEMPLATE_ID);
    defaults.iso = "800";

    expect(getTemplateCameraSettings(DEFAULT_DEVICE_TEMPLATE_ID).iso).not.toBe("800");
  });

  it("creates a valid profile with normalized timestamps", () => {
    const profile = createProfileFromInput({
      deviceCode: "A72F-8812",
      deviceName: "MINIPC-004",
      plant: "Calcine Plant",
      bin: "Bin 1",
      station: "Main Area",
      description: "Sampling station",
      templateId: DEFAULT_DEVICE_TEMPLATE_ID,
      schedule: "Every Hour",
      timezone: "Asia/Makassar (WITA)",
      cameraSettings: getTemplateCameraSettings(DEFAULT_DEVICE_TEMPLATE_ID),
    });

    expect(profile.registeredAt).toBeTypeOf("number");
    expect(profile.updatedAt).toBeTypeOf("number");
    expect(profile.templateId).toBe(DEFAULT_DEVICE_TEMPLATE_ID);
  });

  it("provides a usable default device profile", () => {
    const profile = createDefaultDeviceProfile();

    expect(profile.templateId).toBe(DEFAULT_DEVICE_TEMPLATE_ID);
    expect(profile.cameraSettings.iso).toBeDefined();
    expect(profile.deviceName).toBe("");
    expect(profile.edgeProfileId).toBeNull();
    expect(profile.edgeLastAppliedAt).toBeNull();
  });

  it("includes the full operational preset catalog", () => {
    expect(DEVICE_TEMPLATES.map((template) => template.id)).toEqual([
      "default-calcine-r50",
      "high-res-sampling-r50",
      "low-light-inspection",
      "fast-capture-line",
      "high-detail-lab",
      "manual-inspection-pro",
      "calcine-day-shift-outdoor",
      "calcine-indoor-conveyor",
      "calcine-lab-macro",
      "calcine-night-shift",
      "manual-only",
    ]);
  });

  it("stores preset guidance metadata for UI preview badges", () => {
    const template = getTemplateById("calcine-night-shift");

    expect(template.recommendedFor).toContain("Night shift");
    expect(template.badges).toEqual(["Calcine", "Night Shift", "Low Light"]);
    expect(template.filterTags).toEqual(["Calcine", "Night"]);
  });

  it("filters presets by scenario tag", () => {
    expect(filterTemplatesByTag("Night").map((template) => template.id)).toEqual([
      "low-light-inspection",
      "calcine-night-shift",
    ]);
    expect(filterTemplatesByTag("Outdoor").map((template) => template.id)).toEqual([
      "calcine-day-shift-outdoor",
    ]);
  });

  it("persists the last selected preset filter", () => {
    const localStorage = createStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    savePresetFilterPreference("Calcine");

    expect(loadPresetFilterPreference()).toBe("Calcine");
  });

  it("falls back to All when the stored preset filter is invalid", () => {
    const localStorage = createStorageMock();
    localStorage.setItem("capture-system:preset-filter:v1", "Invalid");
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    expect(loadPresetFilterPreference()).toBe("All");
  });

  it("persists the last selected apply history saved view", () => {
    const localStorage = createStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    saveApplyHistorySavedViewPreference("needs-review");

    expect(loadApplyHistorySavedViewPreference()).toBe("needs-review");
  });

  it("falls back to all-activity when the stored saved view is invalid", () => {
    const localStorage = createStorageMock();
    localStorage.setItem("capture-system:apply-history-saved-view:v1", "invalid-view");
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    expect(loadApplyHistorySavedViewPreference()).toBe("all-activity");
  });

  it("appends and loads apply history entries", () => {
    const localStorage = createStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    const entries = appendApplyHistory({
      id: "history-1",
      status: "applied",
      templateId: "default-calcine-r50",
      templateLabel: "Default - Calcine Sampling (R50)",
      timestamp: 123456789,
      message: "Preset applied.",
      edgeProfileId: "edge-profile-1",
      appliedKeys: ["iso", "shutterSpeed"],
      skippedKeys: ["pictureStyle"],
      code: null,
    });

    expect(entries).toHaveLength(1);
    expect(loadApplyHistory()[0]).toMatchObject({
      id: "history-1",
      status: "applied",
      templateId: "default-calcine-r50",
      templateLabel: "Default - Calcine Sampling (R50)",
    });
  });

  it("clears apply history entries", () => {
    const localStorage = createStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    appendApplyHistory({
      id: "history-2",
      status: "failed",
      templateId: "manual-only",
      templateLabel: "Manual Only",
      timestamp: 223456789,
      message: "Preset failed.",
      edgeProfileId: null,
      appliedKeys: [],
      skippedKeys: [],
      code: "REQUEST_FAILED",
    });
    clearApplyHistory();

    expect(loadApplyHistory()).toEqual([]);
  });

  it("maps local camera settings into supported edge profile keys", () => {
    const { settings, skippedKeys } = toEdgeProfileSettings({
      iso: "200",
      shutter: "1/125",
      aperture: "f/8",
      whiteBalance: "Daylight",
      pictureStyle: "Standard",
      focusMode: "Autofocus",
    });

    expect(settings).toEqual({
      iso: "200",
      shutterSpeed: "1/125",
      aperture: "f/8",
      whiteBalance: "Daylight",
      focusMode: "Autofocus",
    });
    expect(skippedKeys).toEqual(["pictureStyle"]);
  });
});
