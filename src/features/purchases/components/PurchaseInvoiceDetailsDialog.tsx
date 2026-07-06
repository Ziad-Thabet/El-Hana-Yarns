import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarClock } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import { useToast } from "@/hooks/use-toast";
import { useSetPurchaseInvoiceDueDate } from "@/features/purchases/hooks";
import type { PurchaseInvoice } from "@/features/purchases/types";
import type { Category } from "@/lib/types";
import {
  getCategoryColor,
  statusLabel,
  statusBadgeVariant,
  unitLabel,
} from "./purchaseInvoiceHelpers";

interface PurchaseInvoiceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  categories: Category[];
  onAddPayment: () => void;
  onPreviewImage: (image: string) => void;
}

export const PurchaseInvoiceDetailsDialog = ({
  open,
  onOpenChange,
  invoice,
  categories,
  onAddPayment,
  onPreviewImage,
}: PurchaseInvoiceDetailsDialogProps) => {
  const { toast } = useToast();
  const setDueDate = useSetPurchaseInvoiceDueDate();
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState("");

  useEffect(() => {
    setEditingDueDate(false);
    setDueDateInput(invoice?.dueDate ?? "");
  }, [invoice?.id, invoice?.dueDate]);

  const handleSaveDueDate = async () => {
    if (!invoice || !dueDateInput) return;
    try {
      await setDueDate.mutateAsync({
        invoiceId: invoice.id,
        dueDate: dueDateInput,
      });
      toast({ title: strings.alerts.dueDateSet });
      setEditingDueDate(false);
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {strings.purchases.invoiceDetailsTitle.replace(
              "{invoiceNumber}",
              invoice?.invoiceNumber ?? "",
            )}
          </DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-secondary rounded-lg">
              {[
                {
                  label: strings.purchases.invoiceNumberLabel,
                  value: invoice.invoiceNumber,
                },
                { label: strings.common.date, value: invoice.date },
                { label: strings.salesInvoices.time, value: invoice.time },
                { label: strings.common.supplier, value: invoice.supplier },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  <p className="font-semibold text-foreground mt-1">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-secondary border border-border rounded-lg text-center">
                <span className="text-sm text-muted-foreground block">
                  {strings.common.status}
                </span>
                <Badge
                  variant={statusBadgeVariant(invoice.status)}
                  className="mt-2"
                >
                  {statusLabel(invoice.status)}
                </Badge>
              </div>
              <div className="p-4 bg-secondary border border-border rounded-lg text-center">
                <span className="text-sm text-muted-foreground block">
                  {strings.common.total}
                </span>
                <p className="font-semibold text-sky-400 mt-2">
                  {Money.from(invoice.total).toString()}
                </p>
              </div>
              <div className="p-4 bg-secondary border border-border rounded-lg text-center">
                <span className="text-sm text-muted-foreground block">
                  {strings.common.paid}
                </span>
                <p className="font-semibold text-emerald-400 mt-2">
                  {Money.from(invoice.paidAmount).toString()}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={invoice.status === "paid"}
                  onClick={onAddPayment}
                >
                  {strings.purchases.editPaymentButton}
                </Button>
                {invoice.status === "paid" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {strings.purchases.fullyPaid}
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 bg-secondary border border-border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {strings.alerts.dueDate}
                </span>
                {invoice.status !== "paid" && !editingDueDate && (
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setEditingDueDate(true)}
                  >
                    {strings.alerts.setDueDate}
                  </button>
                )}
              </div>
              {editingDueDate ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="bg-muted text-foreground border-border"
                  />
                  <Button
                    size="sm"
                    disabled={!dueDateInput || setDueDate.isPending}
                    onClick={handleSaveDueDate}
                  >
                    {strings.common.save}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDueDate(false);
                      setDueDateInput(invoice.dueDate ?? "");
                    }}
                  >
                    {strings.sales.cancel}
                  </Button>
                </div>
              ) : (
                <p className="font-semibold text-foreground">
                  {invoice.dueDate || strings.alerts.noDueDateSet}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">
                {strings.salesInvoices.itemDetailsTitle}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{strings.common.product}</TableHead>
                    <TableHead>{strings.common.category}</TableHead>
                    <TableHead>{strings.common.quantity}</TableHead>
                    <TableHead>{strings.purchases.unitLabel}</TableHead>
                    <TableHead>{strings.purchases.itemTotalPrice}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {item.productName}
                      </TableCell>
                      <TableCell>
                        {item.category && (
                          <Badge
                            className="text-foreground text-xs"
                            style={{
                              backgroundColor: getCategoryColor(
                                categories,
                                item.category,
                              ),
                            }}
                          >
                            {item.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {unitLabel(item.unit)}
                      </TableCell>
                      <TableCell className="font-semibold text-sky-400">
                        {Money.from(
                          item.itemTotal ?? item.purchasePrice * item.quantity,
                        ).toString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {invoice.paymentHistory.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {strings.salesInvoices.paymentHistoryTitle}
                </h3>
                <div className="space-y-2">
                  {invoice.paymentHistory.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-3 bg-secondary border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-emerald-300">
                          {Money.from(p.amount).toString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {p.date} — {p.time} — {p.method}
                        </p>
                      </div>
                      {p.receiptImage && (
                        <button
                          type="button"
                          onClick={() => onPreviewImage(p.receiptImage!)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-sky-400/50 text-sky-400 hover:bg-sky-400/10 transition-colors"
                        >
                          {strings.salesInvoices.viewReceiptButton}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t border-border pt-4 flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">
                {strings.purchases.totalColon}
              </span>
              <span className="text-xl font-bold text-sky-400">
                {Money.from(invoice.total).toString()}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              {strings.common.close}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
