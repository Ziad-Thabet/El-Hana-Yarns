import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SectionCard({
  title,
  icon: Icon,
  children,
  className = "",
  badge,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  badge?: string | number;
}) {
  return (
    <Card
      className={`bg-card rounded-2xl overflow-hidden ring-1 ring-border/30 dark:ring-white/[0.06] ${className}`}
    >
      <CardHeader className="px-6 py-4 border-b border-border/40 dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <span className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </span>
            {title}
          </CardTitle>
          {badge !== undefined && (
            <Badge
              variant="secondary"
              className="text-[11px] font-semibold px-2 rounded-lg bg-muted/80 text-muted-foreground border-0"
            >
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
