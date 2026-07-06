import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Receipt } from "lucide-react";
import { Money } from "@/lib/domain";
import type { SaleInvoice } from "@/features/sales/types";
import { strings } from "@/lib/i18n/ar";
import { InvoiceRow } from "./InvoiceRow";

export function InvoiceList({
  invoices,
  loading,
  emptyTitle,
  emptyDesc,
  onSelect,
  onPrint,
}: {
  invoices: SaleInvoice[];
  loading: boolean;
  emptyTitle: string;
  emptyDesc?: string;
  onSelect: (inv: SaleInvoice) => void;
  onPrint: (inv: SaleInvoice) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          inv.cashier.toLowerCase().includes(search.toLowerCase()) ||
          inv.date.includes(search),
      ),
    [invoices, search],
  );
  const totalRevenue = useMemo(
    () => invoices.reduce((s, inv) => s + inv.total, 0),
    [invoices],
  );
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          {strings.common.loading}
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={strings.salesInvoices.searchPlaceholder}
            className="ps-10 h-9 text-sm"
          />
        </div>
        <div className="shrink-0 text-sm text-muted-foreground whitespace-nowrap">
          <span className="font-semibold text-foreground">
            {Money.from(totalRevenue).toString()}
          </span>
          {" · "}
          {filtered.length} {strings.salesInvoices.invoiceUnit}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Receipt className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          {emptyDesc && (
            <p className="text-xs text-muted-foreground max-w-xs">
              {emptyDesc}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              onClick={() => onSelect(inv)}
              onPrint={(e) => {
                e.stopPropagation();
                onPrint(inv);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
