import { formatDateYMD } from "../../../../shared/dateRules.mjs";
import { getLanguage } from "@/lib/i18n/store";

export const fmt = (n: number) => {
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
  return n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const today = () => formatDateYMD(new Date());

export const fmtDateShort = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
};