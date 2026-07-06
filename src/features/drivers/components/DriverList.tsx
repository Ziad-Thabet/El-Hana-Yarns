import { Loader2, Truck } from "lucide-react";
import { strings } from "@/lib/i18n/ar";
import { DriverRow } from "./DriverRow";
import type { Driver } from "@/features/drivers/types";

export function DriverList({
  drivers,
  loading,
  onEdit,
  onViewLedger,
  canEdit = true,
}: {
  drivers: Driver[];
  loading: boolean;
  onEdit: (driver: Driver) => void;
  onViewLedger: (driver: Driver) => void;
  canEdit?: boolean;
}) {
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

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Truck className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {strings.drivers.noDrivers}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drivers.map((driver) => (
        <DriverRow
          key={driver.id}
          driver={driver}
          onEdit={() => onEdit(driver)}
          onViewLedger={() => onViewLedger(driver)}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
