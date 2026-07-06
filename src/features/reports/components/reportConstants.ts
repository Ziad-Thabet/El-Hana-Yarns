import type { ReportType } from "@/features/reports/types";
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  Truck,
} from "lucide-react";
import { toIso } from "./reportFormatters";
import { strings } from "@/lib/i18n/ar";

export interface DatePreset {
  label: string;
  getValue: () => { from: string; to: string };
}

export const DATE_PRESETS: DatePreset[] = [
  {
    label: strings.reports.datePresetToday,
    getValue: () => {
      const t = toIso(new Date());
      return { from: t, to: t };
    },
  },
  {
    label: strings.reports.datePresetYesterday,
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const t = toIso(d);
      return { from: t, to: t };
    },
  },
  {
    label: strings.reports.datePresetThisWeek,
    getValue: () => {
      const n = new Date(),
        s = new Date(n);
      s.setDate(n.getDate() - n.getDay());
      return { from: toIso(s), to: toIso(n) };
    },
  },
  {
    label: strings.reports.datePresetLast7Days,
    getValue: () => {
      const t = new Date(),
        f = new Date();
      f.setDate(f.getDate() - 6);
      return { from: toIso(f), to: toIso(t) };
    },
  },
  {
    label: strings.reports.datePresetThisMonth,
    getValue: () => {
      const n = new Date();
      return {
        from: toIso(new Date(n.getFullYear(), n.getMonth(), 1)),
        to: toIso(n),
      };
    },
  },
  {
    label: strings.reports.datePresetLast30Days,
    getValue: () => {
      const t = new Date(),
        f = new Date();
      f.setDate(f.getDate() - 29);
      return { from: toIso(f), to: toIso(t) };
    },
  },
  {
    label: strings.reports.datePresetLast3Months,
    getValue: () => {
      const t = new Date(),
        f = new Date();
      f.setMonth(f.getMonth() - 3);
      return { from: toIso(f), to: toIso(t) };
    },
  },
  {
    label: strings.reports.datePresetThisYear,
    getValue: () => {
      const n = new Date();
      return { from: toIso(new Date(n.getFullYear(), 0, 1)), to: toIso(n) };
    },
  },
  {
    label: strings.reports.datePresetAllTime,
    getValue: () => ({ from: "", to: "" }),
  },
];

export type AllReportType = "dashboard" | ReportType;

export const REPORT_TYPES: {
  value: AllReportType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "dashboard",
    label: strings.reports.reportTypeDashboard,
    icon: LayoutDashboard,
  },
  { value: "sales", label: strings.reports.reportTypeSales, icon: TrendingUp },
  {
    value: "purchases",
    label: strings.reports.reportTypePurchases,
    icon: ShoppingCart,
  },
  {
    value: "inventory",
    label: strings.reports.reportTypeInventory,
    icon: Package,
  },
  { value: "debts", label: strings.reports.reportTypeDebts, icon: DollarSign },
  {
    value: "online_orders",
    label: strings.reports.reportTypeOnlineOrders,
    icon: Truck,
  },
] as const;

export const DATE_SENSITIVE_REPORTS: AllReportType[] = [
  "dashboard",
  "sales",
  "purchases",
  "debts",
  "online_orders",
];
export const C = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "hsl(152 60% 40%)",
  danger: "hsl(var(--destructive))",
  indigo: "hsl(243 75% 62%)",
  rose: "hsl(340 75% 52%)",
  sky: "hsl(200 85% 52%)",
} as const;

export const PIE_COLORS = [
  C.primary,
  C.success,
  C.accent,
  C.indigo,
  C.rose,
  C.sky,
];

export const CHART_STYLE = {
  cartesian: {
    strokeDasharray: "1 4",
    stroke: "hsl(var(--border))",
    strokeOpacity: 0.6,
  },
  tick: {
    fill: "hsl(var(--muted-foreground))",
    fontSize: 10.5,
    fontFamily: "inherit",
  },
  tooltip: {
    contentStyle: {
      background: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 14,
      color: "hsl(var(--popover-foreground))",
      boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px hsl(var(--border))",
      padding: "10px 14px",
      fontSize: 12,
    },
    labelStyle: {
      color: "hsl(var(--muted-foreground))",
      fontSize: 10.5,
      marginBottom: 4,
    },
    itemStyle: {
      color: "hsl(var(--popover-foreground))",
      fontSize: 12,
      fontWeight: 600,
    },
    cursor: { fill: "hsl(var(--muted))", opacity: 0.4 },
  },
} as const;

export const MARGIN_THRESHOLDS = {
  good: 30,
  warning: 15,
} as const;

export const T = {
  revenue: "text-primary",
  profit: "text-[hsl(152,60%,40%)]",
  loss: "text-destructive",
  warning: "text-[hsl(var(--accent))]",
  neutral: "text-muted-foreground",
  highValue: "text-[hsl(243,75%,62%)]",
  dangerCard: "bg-destructive/[0.04]  border-destructive/[0.18]",
  successCard: "bg-[hsl(152,60%,40%)]/[0.04]  border-[hsl(152,60%,40%)]/[0.18]",
  warningCard:
    "bg-[hsl(var(--accent))]/[0.05] border-[hsl(var(--accent))]/[0.18]",
  neutralCard: "bg-muted/30 border-border/25",
  highValCard:
    "bg-[hsl(243,75%,62%)]/[0.05]   border-[hsl(243,75%,62%)]/[0.18]",
  profitBadge:
    "border-[hsl(152,60%,40%)]/30 text-[hsl(152,60%,40%)] bg-[hsl(152,60%,40%)]/[0.07]",
  warnBadge:
    "border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/[0.07]",
  lossBadge: "border-destructive/30 text-destructive bg-destructive/[0.07]",
} as const;
