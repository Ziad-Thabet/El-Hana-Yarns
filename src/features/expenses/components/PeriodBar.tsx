import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/lib/i18n/ar";
import {
  getExpensePeriodPresets,
  expensePresetToDateRange,
  type ExpensePeriodPreset,
} from "@/lib/constants/expenses";
import { typography } from "@/lib/theme/styles";

interface PeriodBarProps {
  preset: ExpensePeriodPreset;
  setPreset: (v: ExpensePeriodPreset) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
}

export function PeriodBar({
  preset,
  setPreset,
  from,
  setFrom,
  to,
  setTo,
}: PeriodBarProps) {
  const handlePreset = (v: string) => {
    const p = v as ExpensePeriodPreset;
    setPreset(p);
    if (p !== "custom") {
      const r = expensePresetToDateRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-accent" />
        <Select value={preset} onValueChange={handlePreset}>
          <SelectTrigger className="h-9 w-44 bg-background font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getExpensePeriodPresets().map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 border-s border-border ps-3 sm:ms-1">
          <span className={typography.caption}>{strings.expenses.from}</span>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-36 bg-background/60"
          />
          <span className={typography.caption}>{strings.expenses.to}</span>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-36 bg-background/60"
          />
        </div>
      )}
    </div>
  );
}
