import { formatDateYMD as fmt } from "../../../shared/dateRules.mjs";
import { strings } from "@/lib/i18n/ar";
export function getExpensePeriodPresets() {
  return [
    { label: strings.reports.datePresetToday, value: "today" },
    { label: strings.reports.datePresetYesterday, value: "yesterday" },
    { label: strings.reports.datePresetThisMonth, value: "this_month" },
    { label: strings.reports.datePresetLastMonth, value: "last_month" },
    { label: strings.reports.datePresetLast7Days, value: "last_7" },
    { label: strings.reports.datePresetLast30Days, value: "last_30" },
    { label: strings.reports.datePresetCustomRange, value: "custom" },
  ] as const;
}
export type ExpensePeriodPreset =
  | "today"
  | "yesterday"
  | "this_month"
  | "last_month"
  | "last_7"
  | "last_30"
  | "custom";

export function expensePresetToDateRange(preset: ExpensePeriodPreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(now.getDate() - 1);
      return { from: fmt(d), to: fmt(d) };
    }
    case "this_month":
      return {
        from: fmt(new Date(y, m, 1)),
        to: fmt(new Date(y, m + 1, 0)),
      };
    case "last_month":
      return {
        from: fmt(new Date(y, m - 1, 1)),
        to: fmt(new Date(y, m, 0)),
      };
    case "last_7": {
      const d = new Date(now);
      d.setDate(now.getDate() - 6);
      return { from: fmt(d), to: fmt(now) };
    }
    case "last_30": {
      const d = new Date(now);
      d.setDate(now.getDate() - 29);
      return { from: fmt(d), to: fmt(now) };
    }
    default:
      return { from: fmt(now), to: fmt(now) };
  }
}
export const NET_SUMMARY_COLORS = {
  revenue: "var(--success)",
  expenses: "var(--destructive)",
  purchasesPaid: "var(--warning)",
  salaries: "var(--accent)",
  net_positive: "var(--success)",
  net_negative: "var(--destructive)",
} as const;
