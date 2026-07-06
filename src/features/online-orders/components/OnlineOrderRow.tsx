import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Phone, MapPin, Hash } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import type { OnlineOrder } from "@/features/online-orders/types";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_SOURCE_LABELS,
} from "@/lib/constants/onlineOrdersStatus";

export function OnlineOrderRow({
  order,
  onClick,
}: {
  order: OnlineOrder;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3 cursor-pointer transition-all hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] hover:bg-card/90"
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-primary border-primary/40 text-[11px] px-2 shrink-0"
          >
            {order.orderNumber}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[11px] px-2 shrink-0 ${ORDER_STATUS_COLORS[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          <Badge variant="secondary" className="text-[11px] px-2 shrink-0">
            {ORDER_SOURCE_LABELS[order.source]}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {order.orderDate}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {order.customerPhone}
          </span>
          <span className="flex items-center gap-1 truncate max-w-[160px]">
            <MapPin className="w-3 h-3 shrink-0" />
            {order.addressText}
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {order.items.length} {strings.common.productCountLabel}
          </span>
        </div>
        <p className="text-xs font-medium text-foreground">
          {order.customerName}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-base font-bold text-primary">
          {Money.from(order.grandTotal).toString()}
        </p>
      </div>
    </div>
  );
}
