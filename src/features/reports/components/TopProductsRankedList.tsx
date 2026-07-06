import { fmt } from "./reportFormatters";
import { T } from "./reportConstants";

interface TopProductsRankedListProps {
  items: { name: string; fullName: string; revenue: number }[];
}

export function TopProductsRankedList({ items }: TopProductsRankedListProps) {
  const maxRev = Math.max(...items.map((p) => p.revenue), 1);
  return (
    <div className="space-y-1.5">
      {items.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors"
        >
          <span
            className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold tabular-nums
              ${i === 0 ? "bg-primary text-primary-foreground" : i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {i + 1}
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p
              className="text-[12.5px] font-semibold text-foreground leading-none truncate"
              title={p.fullName}
            >
              {p.fullName}
            </p>
            <div className="w-full h-[3px] rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{
                  width: `${(p.revenue / maxRev) * 100}%`,
                  opacity: Math.max(0.35, 1 - i * 0.09),
                }}
              />
            </div>
          </div>
          <span
            className={`shrink-0 text-[12.5px] font-bold tabular-nums ${i === 0 ? T.revenue : "text-muted-foreground"}`}
          >
            {fmt(p.revenue)}
          </span>
        </div>
      ))}
    </div>
  );
}
