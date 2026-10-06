import { Preferences } from "@capacitor/preferences";

import { DEFAULT_LANGUAGE, isLanguage, type Language } from "./i18n";

const STORAGE_KEY = "capture-calcine.mobile-preferences";

export type MobilePreferences = {
  lightMode: boolean;
  highContrastMode: boolean;
  historyWarmupEnabled: boolean;
  language: Language;
};

export const DEFAULT_MOBILE_PREFERENCES: MobilePreferences = {
  lightMode: false,
  highContrastMode: false,
  historyWarmupEnabled: true,
  language: DEFAULT_LANGUAGE,
};

function normalizePreferences(
  value: Partial<MobilePreferences> | null | undefined,
): MobilePreferences {
  return {
    lightMode:
      typeof value?.lightMode === "boolean"
        ? value.lightMode
        : DEFAULT_MOBILE_PREFERENCES.lightMode,
    highContrastMode:
      typeof value?.highContrastMode === "boolean"
        ? value.highContrastMode
        : DEFAULT_MOBILE_PREFERENCES.highContrastMode,
    historyWarmupEnabled:
      typeof value?.historyWarmupEnabled === "boolean"
        ? value.historyWarmupEnabled
        : DEFAULT_MOBILE_PREFERENCES.historyWarmupEnabled,
    // Preferences saved before the language switch existed have no language.
    language: isLanguage(value?.language) ? value.language : DEFAULT_MOBILE_PREFERENCES.language,
  };
}

export async function readMobilePreferences(): Promise<MobilePreferences> {
  const stored = await Preferences.get({ key: STORAGE_KEY });
  if (!stored.value) {
    return DEFAULT_MOBILE_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(stored.value) as Partial<MobilePreferences>;
    return normalizePreferences(parsed);
  } catch {
    await Preferences.remove({ key: STORAGE_KEY });
    return DEFAULT_MOBILE_PREFERENCES;
  }
}

export async function persistMobilePreferences(
  value: MobilePreferences,
): Promise<MobilePreferences> {
  const normalized = normalizePreferences(value);
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(normalized) });
  return normalized;
}

export async function updateMobilePreferences(
  patch: Partial<MobilePreferences>,
): Promise<MobilePreferences> {
  const current = await readMobilePreferences();
  return persistMobilePreferences({
    ...current,
    ...patch,
  });
}
