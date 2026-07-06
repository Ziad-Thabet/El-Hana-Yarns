import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PremiumButton } from "@/components/ui/premium";
import { useCreateDriver, useUpdateDriver } from "@/features/drivers/hooks";
import { strings } from "@/lib/i18n/ar";
import type { Driver, DriverType } from "@/features/drivers/types";
import { DRIVER_TYPE_LABELS } from "@/features/drivers/driverHelpers";

export function AddEditDriverDialog({
  driver,
  open,
  onClose,
}: {
  driver: Driver | null;
  open: boolean;
  onClose: () => void;
}) {
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [driverType, setDriverType] = useState<DriverType>("driver");
  const [paysNextDay, setPaysNextDay] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!driver;

  useEffect(() => {
    if (open) {
      setName(driver?.name ?? "");
      setPhone(driver?.phone ?? "");
      setIsActive(driver?.isActive ?? true);
      setDriverType(driver?.driverType ?? "driver");
      setPaysNextDay(driver?.paysNextDay ?? false);
    }
  }, [open, driver]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({
        title: strings.common.missingData,
        description: strings.common.enterNameAndPhone,
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      if (isEdit && driver) {
        await updateDriver.mutateAsync({
          id: driver.id,
          data: {
            name: name.trim(),
            phone: phone.trim(),
            isActive,
            driverType,
            paysNextDay,
          },
        });
        toast({ title: strings.drivers.driverUpdated });
      } else {
        await createDriver.mutateAsync({
          name: name.trim(),
          phone: phone.trim(),
          driverType,
          paysNextDay: driverType === "company_next_day" ? paysNextDay : false,
        });
        toast({ title: strings.drivers.driverCreated });
      }
      onClose();
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? strings.drivers.editDriver : strings.drivers.addDriver}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{strings.drivers.name} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{strings.drivers.phone} *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">
              {strings.driversExtra.driverType}
            </Label>{" "}
            <div className="flex gap-2">
              {(
                ["driver", "company_next_day", "company_direct"] as DriverType[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDriverType(t)}
                  className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                    driverType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {DRIVER_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {driverType === "company_next_day" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="paysNextDay"
                checked={paysNextDay}
                onCheckedChange={(v) => setPaysNextDay(!!v)}
              />
              <Label htmlFor="paysNextDay" className="text-sm cursor-pointer">
                {strings.drivers.paysNextDay}
              </Label>
            </div>
          )}
          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="driverActive"
                checked={isActive}
                onCheckedChange={(v) => setIsActive(!!v)}
              />
              <Label htmlFor="driverActive" className="text-sm cursor-pointer">
                {strings.drivers.statusActive}
              </Label>
            </div>
          )}
          <div className="flex gap-2">
            <PremiumButton
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {strings.common.save}
            </PremiumButton>
            <Button variant="outline" onClick={onClose}>
              {strings.common.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
