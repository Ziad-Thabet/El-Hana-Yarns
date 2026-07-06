import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, Printer } from "lucide-react";
import { Money, CartItemModel } from "@/lib/domain";
import { PremiumButton } from "@/components/ui/premium";
import type { SaleInvoice } from "@/features/sales/types";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";
import { getInvoicePaymentBadgeInfo } from "@/features/sales/invoiceBadgeHelpers";
import { strings } from "@/lib/i18n/ar";

export function InvoiceDetailDialog({
  invoice,
  open,
  onClose,
  onPrint,
}: {
  invoice: SaleInvoice | null;
  open: boolean;
  onClose: () => void;
  onPrint: (inv: SaleInvoice) => void;
}) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  if (!invoice) return null;
  const { methodLabel, isFullyOnDebt } = getInvoicePaymentBadgeInfo(invoice);
  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {strings.salesInvoices.invoiceDetailTitle.replace(
                "{invoiceNumber}",
                invoice.invoiceNumber,
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-secondary rounded-xl">
              {[
                {
                  label: strings.salesInvoices.invoiceNumber,
                  value: invoice.invoiceNumber,
                },
                { label: strings.salesInvoices.date, value: invoice.date },
                { label: strings.salesInvoices.time, value: invoice.time },
                {
                  label: strings.salesInvoices.cashier,
                  value: invoice.cashier,
                },
              ].map((item) => (
                <div key={item.label} className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            {methodLabel && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {strings.sales.paymentMethodColon}
                </span>
                <Badge variant="secondary">{methodLabel}</Badge>
              </div>
            )}
            {isFullyOnDebt && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {strings.sales.paymentMethodColon}
                </span>
                <Badge variant="destructive">
                  {strings.sales.fullDebtNoPaymentBadge}
                </Badge>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {strings.salesInvoices.itemDetailsTitle}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">
                      {strings.common.product}
                    </TableHead>
                    <TableHead className="text-start">
                      {strings.common.quantity}
                    </TableHead>
                    <TableHead className="text-start">
                      {strings.common.price}
                    </TableHead>
                    <TableHead className="text-start">
                      {strings.common.total}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, idx) => {
                    const model = CartItemModel.from(item);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {model.measureLabel}
                        </TableCell>
                        <TableCell className="text-sm">
                          {Money.from(item.price).toString()}
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {model.totalLabel}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {strings.salesInvoices.paymentHistoryTitle}
                </h3>
                <div className="space-y-2">
                  {invoice.paymentHistory.map((p) => {
                    const pLabel =
                      PAYMENT_METHOD_LABELS[
                        p.method as keyof typeof PAYMENT_METHOD_LABELS
                      ] ?? p.method;
                    return (
                      <div
                        key={p.id}
                        className="flex justify-between items-center p-3 bg-secondary border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-semibold text-emerald-300">
                            {Money.from(p.amount).toString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {p.date} — {p.time} — {pLabel}
                          </p>
                        </div>
                        {p.receiptImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(p.receiptImage!)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-sky-400/50 text-sky-400 hover:bg-sky-400/10 transition-colors"
                          >
                            {strings.salesInvoices.viewReceiptButton}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold">
                  {strings.salesInvoices.totalAmountBig}
                </span>
                <span className="text-xl font-bold text-primary">
                  {Money.from(invoice.total).toString()}
                </span>
              </div>
              {invoice.remainingAmount !== undefined &&
                invoice.remainingAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        {strings.common.paid}
                      </span>
                      <span className="font-semibold text-emerald-500">
                        {Money.from(invoice.paidAmount ?? 0).toString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        {strings.common.remaining}
                      </span>
                      <span className="font-semibold text-rose-500">
                        {Money.from(invoice.remainingAmount).toString()}
                      </span>
                    </div>
                  </>
                )}
            </div>
            <div className="flex gap-2">
              <PremiumButton
                className="flex-1"
                onClick={() => {
                  onPrint(invoice);
                  onClose();
                }}
              >
                <Printer className="w-4 h-4 me-2" />
                {strings.salesInvoices.printInvoiceButton}
              </PremiumButton>
              <Button variant="outline" onClick={onClose}>
                {strings.common.close}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {strings.salesInvoices.receiptImageDialogTitle}
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt={strings.sales.receiptAlt}
              className="w-full max-h-[70vh] object-contain rounded-lg border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
