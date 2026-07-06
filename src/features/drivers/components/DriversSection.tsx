import { useState } from "react";
import { Truck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrivers } from "@/features/drivers/hooks";
import { DriverList } from "./DriverList";
import { AddEditDriverDialog } from "./AddEditDriverDialog";
import { DriverLedgerDialog } from "./DriverLedgerDialog";
import { strings } from "@/lib/i18n/ar";
import type { Driver } from "@/features/drivers/types";

export function DriversSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: drivers = [], isLoading } = useDrivers();
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [ledgerTarget, setLedgerTarget] = useState<Driver | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          {strings.drivers.title}
        </h2>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            {strings.drivers.addDriver}
          </Button>
        )}
      </div>

      <DriverList
        drivers={drivers}
        loading={isLoading}
        onEdit={setEditTarget}
        onViewLedger={setLedgerTarget}
        canEdit={isAdmin}
      />

      {isAdmin && (
        <AddEditDriverDialog
          driver={null}
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
      )}
      {isAdmin && (
        <AddEditDriverDialog
          driver={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      <DriverLedgerDialog
        driver={ledgerTarget}
        open={!!ledgerTarget}
        onClose={() => setLedgerTarget(null)}
      />
    </div>
  );
}
