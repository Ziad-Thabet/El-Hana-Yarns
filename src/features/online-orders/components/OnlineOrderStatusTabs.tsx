import type { OrderStatusValue } from "@/lib/constants/onlineOrdersStatus";
import { ORDER_STATUS_LABELS } from "@/lib/constants/onlineOrdersStatus";
import { strings } from "@/lib/i18n/ar";

export type OrderStatusFilter = OrderStatusValue | "all";

const TABS: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: strings.common.all },
  { value: "new", label: ORDER_STATUS_LABELS.new },
  { value: "preparing", label: ORDER_STATUS_LABELS.preparing },
  { value: "ready", label: ORDER_STATUS_LABELS.ready },
  { value: "dispatched", label: ORDER_STATUS_LABELS.dispatched },
  { value: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
  { value: "not_received", label: ORDER_STATUS_LABELS.not_received },
];

export function OnlineOrderStatusTabs({
  active,
  onChange,
}: {
  active: OrderStatusFilter;
  onChange: (status: OrderStatusFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
            active === tab.value
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
