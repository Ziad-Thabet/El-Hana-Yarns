import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant={isActive ? "default" : "destructive"}
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        !isActive &&
          "bg-destructive/15 text-destructive hover:bg-destructive/15",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-primary-foreground" : "bg-destructive",
        )}
      />
      {isActive
        ? strings.employees.statusActive
        : strings.employees.statusInactive}
    </Badge>
  );
}
