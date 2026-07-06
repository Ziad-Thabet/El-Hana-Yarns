import { strings as arStrings, type Strings as AppStrings } from "./ar.data";
import { strings as enStrings } from "./en";

export type AppLanguage = "ar" | "en";

const STORAGE_KEY = "el_hana_language";

const DATA: Record<AppLanguage, AppStrings> = {
  ar: arStrings,
  en: enStrings as unknown as AppStrings,
};

let currentLanguage: AppLanguage = "ar";

// الكائن الحي — بيتغير محتواه من جوه، مرجعه ثابت طول الوقت
export const strings: AppStrings = { ...arStrings };

function applyStrings(lang: AppLanguage) {
  Object.assign(strings as Record<string, unknown>, DATA[lang]);
}

export function getLanguage(): AppLanguage {
  return currentLanguage;
}

export function setLanguage(lang: AppLanguage) {
  currentLanguage = lang;
  applyStrings(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/** يتقرأ مرة واحدة وقت تشغيل التطبيق */
export function initLanguage(): AppLanguage {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const lang: AppLanguage = stored === "en" ? "en" : "ar";
  setLanguage(lang);
  return lang;
}

export function t<K extends keyof AppStrings>(
  section: K,
  key: keyof AppStrings[K],
): string {
  return strings[section][key] as string;
}

export type { AppStrings as Strings };
