import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { PaymentSplit } from "./salesInterfaceTypes";
import { strings } from "@/lib/i18n/ar";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";

interface PaymentSplitEditorProps {
  split: PaymentSplit;
  index: number;
  canRemove: boolean;
  onUpdate: (id: string, updates: Partial<PaymentSplit>) => void;
  onRemove: (id: string) => void;
}

export const PaymentSplitEditor = ({
  split,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: PaymentSplitEditorProps) => {
  return (
    <div className="border border-border rounded-[var(--radius-lg)] p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {strings.sales.paymentMethodIndex.replace(
            "{index}",
            String(index + 1),
          )}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(split.id)}
            className="text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-sm font-semibold">
            {strings.onlineOrders.paymentMethod}
          </Label>
          <Select
            value={split.method}
            onValueChange={(v: "cash" | "vodafone" | "instapay") =>
              onUpdate(split.id, { method: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{PAYMENT_METHOD_LABELS.cash}</SelectItem>
              <SelectItem value="vodafone">
                {PAYMENT_METHOD_LABELS.vodafone}
              </SelectItem>
              <SelectItem value="instapay">
                {PAYMENT_METHOD_LABELS.instapay}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-semibold">
            {strings.sales.amountLabel}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={split.amount}
            onChange={(e) =>
              onUpdate(split.id, { amount: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
      </div>
      {(split.method === "vodafone" || split.method === "instapay") && (
        <div>
          <Label className="text-sm font-semibold">
            {strings.sales.receiptImageLabel}
          </Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) =>
                onUpdate(split.id, {
                  receiptImage: ev.target?.result as string,
                });
              reader.readAsDataURL(file);
            }}
          />
          {split.receiptImage && (
            <img
              src={split.receiptImage}
              alt={strings.sales.receiptAlt}
              className="mt-2 max-h-24 object-cover border rounded"
            />
          )}
        </div>
      )}
    </div>
  );
};
