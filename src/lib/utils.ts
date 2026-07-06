import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export type AppLanguage = "ar" | "en";

export function formatNumber(value: number, language: AppLanguage = "ar") {
  return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** @deprecated use formatNumber(value, language) once the language context is wired in */
import { getLanguage } from "@/lib/i18n/store";

export function formatArabicNumber(value: number) {
  const lang = getLanguage();
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
