import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Package } from "lucide-react";
import { Money } from "@/lib/domain";
import type { OnlineOrder } from "@/features/online-orders/types";
import { strings } from "@/lib/i18n/ar";
import { OnlineOrderRow } from "./OnlineOrderRow";

export function OnlineOrderList({
  orders,
  loading,
  onSelect,
}: {
  orders: OnlineOrder[];
  loading: boolean;
  onSelect: (order: OnlineOrder) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
          o.customerName.toLowerCase().includes(search.toLowerCase()) ||
          o.customerPhone.includes(search),
      ),
    [orders, search],
  );
  const totalRevenue = useMemo(
    () => orders.reduce((s, o) => s + o.grandTotal, 0),
    [orders],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          {strings.common.loading}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={strings.onlineOrdersExtra.searchPlaceholder}
            className="ps-10 h-9 text-sm"
          />
        </div>
        <div className="shrink-0 text-sm text-muted-foreground whitespace-nowrap">
          <span className="font-semibold text-foreground">
            {Money.from(totalRevenue).toString()}
          </span>
          {" · "}
          {filtered.length} {strings.common.order}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {strings.onlineOrders.noOrders}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {strings.onlineOrders.noOrdersDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <OnlineOrderRow
              key={order.id}
              order={order}
              onClick={() => onSelect(order)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
