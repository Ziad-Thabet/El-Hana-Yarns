import { formatDateYMD } from "../../../../shared/dateRules.mjs";
import { strings } from "@/lib/i18n/ar";
import { getLanguage } from "@/lib/i18n/store";

export function fmtCurrency(n: number) {
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
  return (
    n.toLocaleString(locale, { maximumFractionDigits: 2 }) +
    " " +
    strings.common.currencyShort
  );
}
export function today() {
  return formatDateYMD(new Date());
}

export function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
