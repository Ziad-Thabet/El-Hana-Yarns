import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Scale, Ruler } from "lucide-react";
import { ProductModel, Money } from "@/lib/domain";
import { PremiumButton } from "@/components/ui/premium";
import type { QuantityDialogState } from "./salesInterfaceTypes";
import { strings } from "@/lib/i18n/ar";

export function QuantityDialog({
  qtyDialog,
  onClose,
  onConfirm,
}: {
  qtyDialog: QuantityDialogState;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [qtyInput, setQtyInput] = useState("");
  const qtyInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (qtyDialog.open) {
      setTimeout(() => qtyInputRef.current?.focus(), 100);
      setQtyInput("");
    }
  }, [qtyDialog.open]);
  const handleConfirm = () => {
    const amount = parseFloat(qtyInput);
    if (!amount || amount <= 0) return;
    onConfirm(amount);
    setQtyInput("");
  };
  return (
    <Dialog open={qtyDialog.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {qtyDialog.product?.unit === "weight" ? (
              <Scale className="w-5 h-5 text-primary" />
            ) : (
              <Ruler className="w-5 h-5 text-primary" />
            )}
            {qtyDialog.product?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-base">
              {qtyDialog.product?.unit === "weight"
                ? strings.sales.weightLabel
                : strings.sales.lengthLabel}
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              {qtyDialog.product?.unit === "weight"
                ? strings.sales.weightHint
                : strings.sales.lengthHint}
            </p>
            <Input
              ref={qtyInputRef}
              type="number"
              step="0.01"
              min="0.01"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder={
                qtyDialog.product?.unit === "weight"
                  ? strings.sales.weightPlaceholder
                  : strings.sales.meterPlaceholder
              }
              className="text-center text-xl font-bold"
            />
          </div>
          {qtyDialog.product && qtyInput && parseFloat(qtyInput) > 0 && (
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">
                {strings.sales.total}
              </p>{" "}
              <p className="text-xl font-bold text-primary">
                {Money.from(
                  parseFloat(qtyInput) *
                    (qtyDialog.product.unit === "weight"
                      ? (qtyDialog.product.pricePerKg ??
                        qtyDialog.product.price)
                      : qtyDialog.product.price),
                ).toString()}
              </p>
            </div>
          )}
          <div className="text-sm text-muted-foreground text-center">
            {strings.sales.availableStock}:{" "}
            <span className="font-semibold text-foreground">
              {qtyDialog.product
                ? `${qtyDialog.product.stock} ${new ProductModel(qtyDialog.product).unitDisplay}`
                : ""}
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {strings.sales.cancel}
          </Button>
          <PremiumButton
            onClick={handleConfirm}
            disabled={!qtyInput || parseFloat(qtyInput) <= 0}
          >
            {strings.sales.addToCart}
          </PremiumButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
