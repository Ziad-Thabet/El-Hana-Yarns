import { Button } from "@/components/ui/button";
import { strings } from "@/lib/i18n/ar";

type StatusFilter = "all" | "paid" | "partial" | "unpaid";

interface StatusFilterBarProps {
  statusFilter: StatusFilter;
  onChange: (status: StatusFilter) => void;
}

export const StatusFilterBar = ({
  statusFilter,
  onChange,
}: StatusFilterBarProps) => {
  const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: strings.common.all },
    { value: "paid", label: strings.purchases.statusPaid },
    { value: "partial", label: strings.purchases.paidPartialBadge },
    { value: "unpaid", label: strings.purchases.statusUnpaid },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <Button
          key={f.value}
          variant={statusFilter === f.value ? "default" : "outline"}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
};
