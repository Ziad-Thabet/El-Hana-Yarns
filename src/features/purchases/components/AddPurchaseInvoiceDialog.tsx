import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { Money } from "@/lib/domain";
import { PremiumButton, SuccessButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { InvoiceItemRow } from "./InvoiceItemRow";
import type { InvoiceFormData } from "./purchaseInvoiceHelpers";
import type { InvoiceItem, Category } from "@/lib/types";

interface AddPurchaseInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceData: InvoiceFormData;
  onInvoiceDataChange: (updates: Partial<InvoiceFormData>) => void;
  invoiceItems: InvoiceItem[];
  onUpdateItem: (
    idx: number,
    field: keyof InvoiceItem,
    value: string | number,
  ) => void;
  onAddItemRow: () => void;
  onRemoveItemRow: (idx: number) => void;
  categories: Category[];
  calcTotal: () => number;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const AddPurchaseInvoiceDialog = ({
  open,
  onOpenChange,
  invoiceData,
  onInvoiceDataChange,
  invoiceItems,
  onUpdateItem,
  onAddItemRow,
  onRemoveItemRow,
  categories,
  calcTotal,
  saving,
  onSubmit,
}: AddPurchaseInvoiceDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <PremiumButton>
          <Plus className="w-4 h-4 me-2" />
          {strings.purchases.addPurchaseInvoiceButton}
        </PremiumButton>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {strings.purchases.addPurchaseInvoiceTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "invoiceNumber",
                label: strings.purchases.invoiceNumberLabel,
                placeholder: strings.purchases.invoiceNumberLabel,
                type: "text",
                value: invoiceData.invoiceNumber,
                onChange: (v: string) =>
                  onInvoiceDataChange({ invoiceNumber: v }),
              },
              {
                id: "supplier",
                label: strings.purchases.supplierRequired,
                placeholder: strings.purchases.supplierPlaceholder,
                type: "text",
                value: invoiceData.supplier,
                onChange: (v: string) => onInvoiceDataChange({ supplier: v }),
              },
              {
                id: "date",
                label: strings.purchases.invoiceDateRequired,
                placeholder: "",
                type: "date",
                value: invoiceData.date,
                onChange: (v: string) => onInvoiceDataChange({ date: v }),
              },
              {
                id: "paidAmount",
                label: strings.purchases.paidAmountLabel,
                placeholder: strings.purchases.amountPlaceholder,
                type: "number",
                value: invoiceData.paidAmount,
                onChange: (v: string) =>
                  onInvoiceDataChange({ paidAmount: parseFloat(v) || 0 }),
              },
            ].map((field) => (
              <div key={field.id}>
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="bg-secondary text-foreground border-border placeholder:text-muted-foreground"
                />
              </div>
            ))}
          </div>
          <div>
            <Label>{strings.purchases.paymentMethodRequired}</Label>
            <PaymentMethodSelect
              value={invoiceData.method}
              onChange={(v) => onInvoiceDataChange({ method: v })}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label className="text-lg font-semibold">
                {strings.purchases.invoiceItemsTitle}
              </Label>
              <Button type="button" variant="outline" onClick={onAddItemRow}>
                <Plus className="w-4 h-4 me-2" />
                {strings.purchases.addItemRow}
              </Button>
            </div>
            <div className="space-y-4">
              {invoiceItems.map((item, idx) => (
                <InvoiceItemRow
                  key={idx}
                  item={item}
                  categories={categories}
                  canRemove={invoiceItems.length > 1}
                  onUpdate={(field, value) => onUpdateItem(idx, field, value)}
                  onRemove={() => onRemoveItemRow(idx)}
                />
              ))}
            </div>
            <div className="mt-3 text-end text-muted-foreground text-sm">
              {strings.purchases.itemsTotalLabel}{" "}
              <span className="font-bold text-sky-400">
                {Money.from(calcTotal()).toString()}
              </span>
            </div>
          </div>
          {invoiceData.method !== "cash" && (
            <div>
              <Label>
                {strings.purchases.receiptImageLabel}{" "}
                {invoiceData.paidAmount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {strings.purchases.electronicPaymentReceiptHint}
                  </span>
                )}
              </Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = (ev) =>
                    onInvoiceDataChange({
                      receiptImage: ev.target?.result as string,
                    });
                  r.readAsDataURL(f);
                }}
                className="bg-secondary text-foreground border-border"
              />
              {invoiceData.receiptImage && (
                <img
                  src={invoiceData.receiptImage}
                  alt={strings.sales.receiptAlt}
                  className="mt-2 max-h-32 object-cover border rounded"
                />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <SuccessButton type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : null}
              {strings.purchases.saveInvoiceButton}
            </SuccessButton>
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
