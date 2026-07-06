import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Hash, Printer } from "lucide-react";
import { Money } from "@/lib/domain";
import type { SaleInvoice } from "@/features/sales/types";
import { getInvoicePaymentBadgeInfo } from "@/features/sales/invoiceBadgeHelpers";
import { strings } from "@/lib/i18n/ar";

export function InvoiceRow({
  invoice,
  onClick,
  onPrint,
}: {
  invoice: SaleInvoice;
  onClick: () => void;
  onPrint: (e: React.MouseEvent) => void;
}) {
  const { methodLabel, isFullyOnDebt, isPartialDebt } =
    getInvoicePaymentBadgeInfo(invoice);
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3 cursor-pointer transition-all hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] hover:bg-card/90"
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-primary border-primary/40 text-[11px] px-2 shrink-0"
          >
            {invoice.invoiceNumber}
          </Badge>
          {methodLabel && (
            <Badge variant="secondary" className="text-[11px] px-2 shrink-0">
              {methodLabel}
            </Badge>
          )}
          {isFullyOnDebt && (
            <Badge variant="destructive" className="text-[11px] px-2 shrink-0">
              {strings.sales.fullDebtBadge}
            </Badge>
          )}
          {isPartialDebt && (
            <Badge
              variant="outline"
              className="text-[11px] px-2 shrink-0 border-amber-500/50 text-amber-500"
            >
              {strings.sales.partialDebtBadge}{" "}
              {Money.from(invoice.remainingAmount ?? 0).toString()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {invoice.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {invoice.time}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {invoice.cashier}
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {invoice.items.length} {strings.common.product}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-base font-bold text-primary">
          {Money.from(invoice.total).toString()}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onPrint}
        >
          <Printer className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
