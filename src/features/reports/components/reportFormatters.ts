import { Money } from "@/lib/domain";
import { formatDateYMD } from "../../../../shared/dateRules.mjs";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";
import { strings } from "@/lib/i18n/ar";

export function toIso(d: Date): string {
  return formatDateYMD(d);
}

export function fmt(n: number): string {
  return Money.from(n).toString();
}

export function fmtAxis(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}${strings.common.millionSuffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function fmtPct(n: number): string {
  const abs = Math.abs(n).toFixed(1);
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `-${abs}%`;
  return "0%";
}

export function formatPaymentMethod(method: string): string {
  return (
    PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ??
    method
  );
}

export function fmtAxisDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

export function formatDateRange(from: string, to: string): string {
  if (!from && !to) return strings.reports.datePresetAllTime;
  if (from && to && from === to) return from;
  if (from && to) return `${from} — ${to}`;
  if (from) return `${strings.reports.rangeFrom} ${from}`;
  return `${strings.reports.rangeTo} ${to}`;
}
