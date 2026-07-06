import { formatDateYMD } from "../../shared/dateRules.mjs";
import { strings } from "@/lib/i18n/ar";

export type DatePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "custom"
  | "all";

export function getPresetRange(preset: DatePreset): {
  from?: string;
  to?: string;
} {
  const today = new Date();
  const fmt = formatDateYMD;
  const sub = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() - n);
    return x;
  };
  switch (preset) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "yesterday": {
      const y = fmt(sub(today, 1));
      return { from: y, to: y };
    }
    case "last7":
      return { from: fmt(sub(today, 6)), to: fmt(today) };
    case "last30":
      return { from: fmt(sub(today, 29)), to: fmt(today) };
    default:
      return {};
  }
}

export function getDatePresets(): { value: DatePreset; label: string }[] {
  return [
    { value: "all", label: strings.dateFilter.all },
    { value: "today", label: strings.dateFilter.today },
    { value: "yesterday", label: strings.dateFilter.yesterday },
    { value: "last7", label: strings.dateFilter.last7 },
    { value: "last30", label: strings.dateFilter.last30 },
    { value: "custom", label: strings.dateFilter.custom },
  ];
}
