import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Clock, ChevronDown, X } from "lucide-react";
import { DATE_PRESETS } from "./reportConstants";
import type { DatePreset } from "./reportConstants";
import { formatDateRange } from "./reportFormatters";
import { strings } from "@/lib/i18n/ar";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  disabled?: boolean;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const handlePreset = (preset: DatePreset) => {
    const v = preset.getValue();
    onChange(v.from, v.to);
    setOpen(false);
  };
  const activePreset = DATE_PRESETS.find((p) => {
    const v = p.getValue();
    return v.from === from && v.to === to;
  });
  const displayLabel = activePreset
    ? activePreset.label
    : from || to
      ? formatDateRange(from, to)
      : strings.reports.dateRangeLabel;
  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
          ${
            open
              ? "bg-primary/10 text-primary ring-1 ring-primary/30"
              : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted ring-1 ring-border/30 dark:ring-white/[0.07]"
          }`}
      >
        <Clock
          className={`w-3.5 h-3.5 shrink-0 ${open ? "text-primary" : "text-muted-foreground"}`}
        />
        <span className="truncate max-w-[150px]">{displayLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute top-[calc(100%+8px)] start-0 z-[999] rounded-2xl bg-popover text-popover-foreground overflow-hidden"
          style={{
            minWidth: 284,
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px hsl(var(--border) / 0.7)",
          }}
        >
          <div className="grid grid-cols-3 gap-1 p-3">
            {DATE_PRESETS.map((preset) => {
              const v = preset.getValue();
              const isActive = v.from === from && v.to === to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`text-[11.5px] px-2 py-2.5 rounded-xl text-center transition-all duration-150 font-semibold ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border/40 bg-muted/20 px-3 py-3 space-y-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {strings.reports.manualRange}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">
                  {strings.reports.rangeFrom}
                </p>
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => onChange(e.target.value, to)}
                  className="h-8 text-xs bg-background rounded-lg border-border/60"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">
                  {strings.reports.rangeTo}
                </p>
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => onChange(from, e.target.value)}
                  className="h-8 text-xs bg-background rounded-lg border-border/60"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              {from || to ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("", "");
                    setOpen(false);
                  }}
                  className="flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                  {strings.reports.clearRange}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 px-4 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-bold hover:opacity-90 transition-opacity"
              >
                {strings.reports.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
