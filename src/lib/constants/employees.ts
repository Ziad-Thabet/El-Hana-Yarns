import type { SalaryType, UserRole } from "@/lib/types";
import {
  countFridaysInMonth,
  workDaysInMonth,
  formatDateYMD as fmt,
} from "../../../shared/dateRules.mjs";
import { strings } from "@/lib/i18n/ar";
export function getSalaryTypes(): { value: SalaryType; label: string }[] {
  return [
    { value: "monthly", label: strings.employees.salaryMonthly },
    { value: "weekly", label: strings.employees.salaryWeekly },
  ];
}
export function getEmployeeRoles(): { value: UserRole; label: string }[] {
  return [
    { value: "staff", label: strings.employees.roleStaff },
    { value: "admin", label: strings.employees.roleAdmin },
  ];
}
export const DEFAULT_DAILY_HOURS = 8;

export { countFridaysInMonth, workDaysInMonth };
export function calcHourlyRate(
  salary: number,
  type: SalaryType,
  dailyHours: number,
  year?: number,
  month?: number,
): number {
  if (!salary || salary <= 0) return 0;
  if (type === "weekly") {
    return salary / (6 * dailyHours);
  }
  if (!year || !month) return 0;
  const workDays = workDaysInMonth(year, month);
  const workHours = workDays * dailyHours;
  return workHours > 0 ? salary / workHours : 0;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const hUnit = strings.employeesExtra.hoursUnit;
  const mUnit = strings.employeesExtra.minutesUnit;
  if (h === 0) return `${m} ${mUnit}`;
  if (m === 0) return `${h} ${hUnit}`;
  return `${h} ${hUnit} ${m} ${mUnit}`;
}
export function getSalaryPeriodPresets() {
  return [
    { label: strings.reports.datePresetToday, value: "today" },
    { label: strings.reports.datePresetThisWeek, value: "this_week" },
    { label: strings.reports.datePresetThisMonth, value: "this_month" },
    { label: strings.reports.datePresetLast30Days, value: "last_30_days" },
    { label: strings.reports.datePresetLast3Months, value: "last_3_months" },
    { label: strings.reports.datePresetThisYear, value: "this_year" },
    { label: strings.reports.datePresetAllTime, value: "all_time" },
  ] as const;
}
export type SalaryPeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "last_3_months"
  | "this_year"
  | "all_time";

export function presetToDateRange(preset: SalaryPeriodPreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = fmt(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this_week": {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay()); // Sunday start
      return { from: fmt(d), to: today };
    }
    case "this_month":
      return { from: fmt(new Date(y, m, 1)), to: today };
    case "last_30_days": {
      const d = new Date(now);
      d.setDate(now.getDate() - 29);
      return { from: fmt(d), to: today };
    }
    case "last_3_months": {
      const d = new Date(now);
      d.setMonth(now.getMonth() - 3);
      return { from: fmt(d), to: today };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: today };
    case "all_time":
      return { from: "2020-01-01", to: today };
    default:
      return { from: today, to: today };
  }
}
