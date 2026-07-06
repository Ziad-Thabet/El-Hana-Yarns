import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Pencil, History } from "lucide-react";
import { Money } from "@/lib/domain";
import { useDriverBalance } from "@/features/drivers/hooks";
import type { Driver } from "@/features/drivers/types";
import { strings } from "@/lib/i18n/ar";

import {
  DRIVER_TYPE_LABELS,
  getDriverBalanceLabel,
  getDriverBalanceColor,
} from "@/features/drivers/driverHelpers";

export function DriverRow({
  driver,
  onEdit,
  onViewLedger,
  canEdit = true,
}: {
  driver: Driver;
  onEdit: () => void;
  onViewLedger: () => void;
  canEdit?: boolean;
}) {
  const { data: balance = 0 } = useDriverBalance(driver.id);
  const balanceLabel = getDriverBalanceLabel(balance);
  const balanceColor = getDriverBalanceColor(balance);

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3 transition-all hover:border-primary/40 hover:bg-card/90">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{driver.name}</p>
          <Badge
            variant="outline"
            className={
              driver.isActive
                ? "text-emerald-600 border-emerald-500/30 text-[11px]"
                : "text-muted-foreground border-border text-[11px]"
            }
          >
            {driver.isActive
              ? strings.drivers.statusActive
              : strings.drivers.statusInactive}
          </Badge>
          <Badge
            variant="outline"
            className="text-[11px] text-muted-foreground border-border"
          >
            {DRIVER_TYPE_LABELS[driver.driverType] ?? driver.driverType}
          </Badge>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Phone className="w-3 h-3" />
          {driver.phone}
        </span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-end">
          <p className="text-[11px] text-muted-foreground">{balanceLabel}</p>
          <p className={`text-base font-bold ${balanceColor}`}>
            {Money.from(Math.abs(balance)).toString()}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={onViewLedger}
          >
            <History className="w-3.5 h-3.5" />
          </Button>
          {canEdit && (
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={onEdit}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
