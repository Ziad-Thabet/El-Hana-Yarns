import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { DateFilterBar } from "@/features/sales/components/DateFilterBar";
import { type DatePreset, getPresetRange } from "@/lib/dateFilterPresets";
import {
  OnlineOrderStatusTabs,
  type OrderStatusFilter,
} from "./OnlineOrderStatusTabs";
import { OnlineOrderList } from "./OnlineOrderList";
import { OnlineOrderDetailDialog } from "./OnlineOrderDetailDialog";
import { useOnlineOrders } from "@/features/online-orders/hooks";
import { strings } from "@/lib/i18n/ar";
import type { AuthSession } from "@/lib/types";
import type { OnlineOrder } from "@/features/online-orders/types";

interface OnlineOrdersSectionProps {
  session: AuthSession;
}

export function OnlineOrdersSection({
  session: _session,
}: OnlineOrdersSectionProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { from: filterFrom, to: filterTo } = useMemo(() => {
    if (datePreset === "custom") {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    if (datePreset === "all") return { from: undefined, to: undefined };
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const { data: orders = [], isLoading } = useOnlineOrders({
    status: statusFilter === "all" ? undefined : statusFilter,
    from: filterFrom,
    to: filterTo,
  });

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const handleSelectOrder = (order: OnlineOrder) => {
    setSelectedOrderId(order.id);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <OnlineOrderDetailDialog
        order={selectedOrder}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          {strings.onlineOrders.title}
        </h2>
      </div>
      <OnlineOrderStatusTabs active={statusFilter} onChange={setStatusFilter} />
      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardContent className="pt-4 pb-3">
          <DateFilterBar
            preset={datePreset}
            onPreset={setDatePreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
          />
        </CardContent>
      </Card>
      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardContent className="pt-4">
          <OnlineOrderList
            orders={orders}
            loading={isLoading}
            onSelect={handleSelectOrder}
          />
        </CardContent>
      </Card>
    </div>
  );
}
