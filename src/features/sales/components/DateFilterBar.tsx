import { Input } from "@/components/ui/input";
import { ListFilter } from "lucide-react";
import { type DatePreset, getDatePresets } from "@/lib/dateFilterPresets";

export function DateFilterBar({
  preset,
  onPreset,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
}: {
  preset: DatePreset;
  onPreset: (p: DatePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="w-4 h-4 text-muted-foreground shrink-0" />
      {getDatePresets().map((p) => (
        <button
          key={p.value}
          onClick={() => onPreset(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            preset === p.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2 ms-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="text-muted-foreground text-xs">—</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
      )}
    </div>
  );
}
