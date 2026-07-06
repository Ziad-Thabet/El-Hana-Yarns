import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogOut } from "lucide-react";
import { Money } from "@/lib/domain";
import type { SaleInvoice, Shift } from "@/features/sales/types";
import { strings } from "@/lib/i18n/ar";
import { getLanguage } from "@/lib/i18n/store";
import { SHIFT_STATUS } from "@/lib/constants/shifts";
import { InvoiceList } from "./InvoiceList";

export function AdminShiftBlock({
  shift,
  invoices,
  shiftTotal,
  onSelect,
  onPrint,
  onEndShift,
}: {
  shift: Shift;
  invoices: SaleInvoice[];
  shiftTotal: number;
  onSelect: (inv: SaleInvoice) => void;
  onPrint: (inv: SaleInvoice) => void;
  onEndShift: (shift: Shift) => void;
}) {
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
  const startTime = shift.startedAt
    ? new Date(shift.startedAt).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const endTime = shift.endedAt
    ? new Date(shift.endedAt).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="w-4 h-4 text-primary" />
            {startTime}
            {endTime ? ` — ${endTime}` : ""}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                shift.status === SHIFT_STATUS.OPEN ? "default" : "secondary"
              }
            >
              {shift.status === SHIFT_STATUS.OPEN
                ? strings.shifts.statusOpen
                : strings.shifts.statusClosed}
            </Badge>
            <span className="text-sm font-semibold text-primary">
              {Money.from(shiftTotal).toString()}
            </span>
            {shift.status === SHIFT_STATUS.OPEN && (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                onClick={() => onEndShift(shift)}
              >
                <LogOut className="w-4 h-4 me-1.5" />
                {strings.shifts.endShift}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <InvoiceList
          invoices={invoices}
          loading={false}
          emptyTitle={strings.salesInvoices.noInvoices}
          onSelect={onSelect}
          onPrint={onPrint}
        />
      </CardContent>
    </Card>
  );
}
