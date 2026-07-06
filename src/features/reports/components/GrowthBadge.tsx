import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { fmtPct } from "./reportFormatters";

export function GrowthBadge({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[hsl(152,60%,40%)]">
        <ArrowUpRight className="w-3 h-3" />
        {fmtPct(value)}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-destructive">
        <ArrowDownRight className="w-3 h-3" />
        {fmtPct(value)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="w-3 h-3" />
      0%
    </span>
  );
}
