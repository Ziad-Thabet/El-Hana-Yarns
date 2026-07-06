import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Building } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import type { PurchaseInvoice } from "@/features/purchases/types";
import { statusLabel, statusBadgeVariant } from "./purchaseInvoiceHelpers";

interface PurchaseInvoiceRowProps {
  invoice: PurchaseInvoice;
  onClick: () => void;
}

export const PurchaseInvoiceRow = ({
  invoice,
  onClick,
}: PurchaseInvoiceRowProps) => {
  return (
    <Card
      className="border-border hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-sky-400 border-primary/50"
              >
                {invoice.invoiceNumber}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {invoice.items.length} {strings.common.productCountLabel}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {invoice.date}
              </span>
              <span className="flex items-center gap-1">
                <Building className="w-4 h-4" />
                {invoice.supplier}
              </span>
            </div>
          </div>
          <div className="text-end space-y-1">
            <Badge variant={statusBadgeVariant(invoice.status)}>
              {statusLabel(invoice.status)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {strings.purchases.paidLabel}{" "}
              {Money.from(invoice.paidAmount).toString()}
            </p>
            <p className="text-lg font-bold text-sky-400">
              {Money.from(invoice.total).toString()}
            </p>
            {invoice.total > invoice.paidAmount && (
              <p className="text-sm text-rose-400">
                {strings.purchases.remainingLabel}{" "}
                {Money.from(invoice.total - invoice.paidAmount).toString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
