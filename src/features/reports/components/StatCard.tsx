import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
  color = "text-foreground",
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <Card className="bg-card rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-border/30 dark:ring-white/[0.06]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
              {label}
            </p>
            <p
              className={`text-[1.55rem] font-bold leading-none tracking-tight ${color}`}
            >
              {value}
            </p>
            {sub && <div className="pt-0.5">{sub}</div>}
          </div>
          {Icon && (
            <div
              className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
                accent
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/80 text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
