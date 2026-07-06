import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import type { PurchaseInvoice } from "@/features/purchases/types";
import type { PaymentMethod } from "@/lib/types";

interface PaymentFormData {
  amount: number;
  receiptImage: string;
  method: PaymentMethod;
}

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentData: PaymentFormData;
  onPaymentDataChange: (updates: Partial<PaymentFormData>) => void;
  selectedInvoice: PurchaseInvoice | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const AddPaymentDialog = ({
  open,
  onOpenChange,
  paymentData,
  onPaymentDataChange,
  selectedInvoice,
  saving,
  onSubmit,
}: AddPaymentDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {strings.purchases.addPayment}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>{strings.purchases.paymentMethodRequired}</Label>
            <PaymentMethodSelect
              value={paymentData.method}
              onChange={(v) => onPaymentDataChange({ method: v })}
            />
          </div>
          <div>
            <Label>{strings.purchases.additionalAmountRequired}</Label>
            <Input
              type="number"
              step="0.01"
              value={paymentData.amount}
              onChange={(e) =>
                onPaymentDataChange({ amount: parseFloat(e.target.value) || 0 })
              }
              className="bg-secondary text-foreground border-border"
              required
            />
          </div>
          <div>
            <Label>{strings.purchases.receiptImageLabel}</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = (ev) =>
                  onPaymentDataChange({
                    receiptImage: ev.target?.result as string,
                  });
                r.readAsDataURL(f);
              }}
              className="bg-secondary text-foreground border-border"
            />
            {paymentData.receiptImage && (
              <img
                src={paymentData.receiptImage}
                alt={strings.sales.receiptAlt}
                className="mt-2 max-h-32 object-cover border rounded"
              />
            )}
          </div>
          {selectedInvoice && (
            <div className="bg-secondary p-3 rounded-lg border border-border space-y-1 text-sm text-muted-foreground">
              <p>
                {strings.purchases.totalColon}{" "}
                {Money.from(selectedInvoice.total).toString()}
              </p>
              <p>
                {strings.purchases.paidColon}{" "}
                {Money.from(selectedInvoice.paidAmount).toString()}
              </p>
              <p>
                {strings.purchases.remainingColon}{" "}
                {Money.from(
                  selectedInvoice.total - selectedInvoice.paidAmount,
                ).toString()}
              </p>
              <p className="text-foreground font-medium">
                {strings.purchases.statusAfterPayment}{" "}
                {selectedInvoice.paidAmount + paymentData.amount >=
                selectedInvoice.total
                  ? strings.purchases.paidFullBadge
                  : strings.purchases.paidPartialBadge}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : null}
              {strings.common.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {strings.sales.cancel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
