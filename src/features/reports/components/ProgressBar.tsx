export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1 rounded-full bg-border/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground w-10 shrink-0 tabular-nums">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
