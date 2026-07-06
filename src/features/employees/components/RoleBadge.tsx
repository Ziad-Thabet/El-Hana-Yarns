import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/i18n/ar";

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant={role === "admin" ? "outline" : "secondary"}
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
    >
      {role === "admin"
        ? strings.employees.roleAdmin
        : strings.employees.roleStaff}
    </Badge>
  );
}
