import { useState } from "react";
import { Loader2, UserPlus, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumButton } from "@/components/ui/premium";
import {
  useCreateCustomer,
  useAddCustomerAddress,
} from "@/features/customers-debts/hooks";
import { customersApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/i18n/ar";

interface AddCustomerDialogProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  addressText: "",
  addressLabel: "",
  region: "",
};

export function AddCustomerDialog({ open, onClose }: AddCustomerDialogProps) {
  const { toast } = useToast();
  const createCustomer = useCreateCustomer();
  const addAddress = useAddCustomerAddress();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const isSubmitting =
    createCustomer.isPending || addAddress.isPending || checkingPhone;

  const resetAndClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name) {
      setError(strings.customerProfiles.nameRequired);
      return;
    }
    if (!phone) {
      setError(strings.customerProfiles.phoneRequired);
      return;
    }

    setCheckingPhone(true);
    try {
      const existing = await customersApi.getByAnyPhone(phone);
      if (existing) {
        setError(strings.customerProfiles.phoneExists);
        setCheckingPhone(false);
        return;
      }
    } catch {
      // if lookup fails, proceed and let backend be the source of truth
    }
    setCheckingPhone(false);

    createCustomer.mutate(
      { name, phone, address: form.addressText.trim() || null },
      {
        onSuccess: (created) => {
          const addressText = form.addressText.trim();
          if (addressText) {
            addAddress.mutate({
              customerId: created.id,
              data: {
                addressText,
                label: form.addressLabel.trim() || null,
                region: form.region.trim() || null,
                isDefault: true,
              },
            });
          }
          toast({ description: strings.customerProfiles.customerCreated });
          resetAndClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : strings.common.error);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {strings.customerProfiles.newCustomerTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-semibold">
                {strings.onlineOrders.customerName} *
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={strings.onlineOrders.customerName}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">
                {strings.onlineOrders.customerPhone} *
              </Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/40">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {strings.customerProfiles.initialAddressOptional}
            </p>
            <div>
              <Label className="text-sm">
                {strings.customerProfiles.addressText}
              </Label>
              <Input
                value={form.addressText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, addressText: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">
                  {strings.customerProfiles.region}
                </Label>
                <Input
                  value={form.region}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, region: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm">
                  {strings.onlineOrders.addressLabel}
                </Label>
                <Input
                  value={form.addressLabel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressLabel: e.target.value }))
                  }
                  placeholder={strings.sales.addressLabelPlaceholder}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex gap-3">
            <PremiumButton
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : null}
              {strings.common.save}
            </PremiumButton>
            <Button
              variant="outline"
              className="sm:w-32"
              onClick={resetAndClose}
              disabled={isSubmitting}
            >
              {strings.common.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
