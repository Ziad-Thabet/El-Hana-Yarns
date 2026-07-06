import { cn } from "@/lib/utils";
import { cards, typography } from "@/lib/theme/styles";
interface StatCardProps {
  label: string;
  value: string | number;
  className?: string;
}
export function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div className={cn(cards.inset, "p-4", className)}>
      <p className={typography.caption}>{label}</p>
      <p className={cn(typography.stat, "mt-2")}>{value}</p>
    </div>
  );
}
