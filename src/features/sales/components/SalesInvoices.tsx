import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Receipt, FileText, Loader2, LogOut, Clock } from "lucide-react";

import { ShiftSummaryCards } from "./ShiftSummaryCards";

import { DateFilterBar } from "./DateFilterBar";
import { InvoiceList } from "./InvoiceList";
import { InvoiceDetailDialog } from "./InvoiceDetailDialog";
import { EndShiftDialog } from "./EndShiftDialog";
import { AdminShiftBlock } from "./AdminShiftBlock";
import { type DatePreset, getPresetRange } from "@/lib/dateFilterPresets";
import { InvoicePrint } from "@/components/InvoicePrint";

import type { SaleInvoice, Shift } from "@/features/sales/types";
import type { CartItem, AuthSession } from "@/lib/types";
import {
  useShiftInvoices,
  useShiftSummary,
  useAllShiftInvoices,
  useShiftsByUserAndDate,
  useMultiShiftInvoices,
  useMultiShiftSummaries,
  useSalesBySource,
} from "@/features/sales/hooks";

import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/i18n/ar";

import {
  SHIFT_STATUS,
  SALES_INVOICES_TAB,
  type SalesInvoicesTab,
} from "@/lib/constants/shifts";
import { formatDateYMD } from "../../../../shared/dateRules.mjs";
interface SalesInvoicesProps {
  session: AuthSession;
  activeShift: Shift | null;
  onShiftEnded?: () => void;
}

const SalesInvoices = ({
  session,
  activeShift,
  onShiftEnded,
}: SalesInvoicesProps) => {
  const isAdmin = session.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<SalesInvoicesTab>(
    SALES_INVOICES_TAB.MY_SHIFT,
  );
  const [sourceFilter, setSourceFilter] = useState<"all" | "online" | "pos">(
    "all",
  );
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { from: filterFrom, to: filterTo } = useMemo(() => {
    if (datePreset === "custom") {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    if (datePreset === "all") return { from: undefined, to: undefined };
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);
  const shiftId = activeShift?.id ?? null;
  const { data: shiftInvoices = [], isLoading: shiftLoading } =
    useShiftInvoices(shiftId, !isAdmin);
  const { data: shiftSummary } = useShiftSummary(shiftId, !isAdmin);
  const today = formatDateYMD(new Date());
  const { data: adminShiftsToday = [], isLoading: adminShiftsLoading } =
    useShiftsByUserAndDate(
      session.userId,
      today,
      isAdmin && activeTab === SALES_INVOICES_TAB.MY_SHIFT,
    );
  const adminShiftIds = useMemo(
    () => adminShiftsToday.map((s) => s.id),
    [adminShiftsToday],
  );
  const { data: adminShiftInvoicesFlat = [], isLoading: adminInvoicesLoading } =
    useMultiShiftInvoices(
      adminShiftIds,
      isAdmin && activeTab === SALES_INVOICES_TAB.MY_SHIFT,
    );
  const {
    byShiftId: adminSummaryByShift,
    aggregate: adminSummaryAggregate,
    isLoading: adminSummaryLoading,
  } = useMultiShiftSummaries(
    adminShiftIds,
    isAdmin && activeTab === SALES_INVOICES_TAB.MY_SHIFT,
  );
  const adminInvoicesByShift = useMemo(() => {
    const map = new Map<string, SaleInvoice[]>();
    for (const inv of adminShiftInvoicesFlat) {
      const key = inv.shiftId ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    }
    return map;
  }, [adminShiftInvoicesFlat]);
  const { data: allInvoicesRaw = [], isLoading: allLoading } =
    useAllShiftInvoices(
      filterFrom,
      filterTo,
      isAdmin &&
        activeTab === SALES_INVOICES_TAB.ALL_SALES &&
        sourceFilter === "all",
    );
  const { data: sourceInvoices = [], isLoading: sourceLoading } =
    useSalesBySource(
      sourceFilter as "online" | "pos",
      filterFrom,
      filterTo,
      isAdmin &&
        activeTab === SALES_INVOICES_TAB.ALL_SALES &&
        sourceFilter !== "all",
    );
  const allInvoices = sourceFilter === "all" ? allInvoicesRaw : sourceInvoices;
  const allLoadingFinal = sourceFilter === "all" ? allLoading : sourceLoading;
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    invoiceNumber: string;
    date: string;
    time: string;
    cashier: string;
    items: CartItem[];
    total: number;
    paidAmount?: number;
    remainingAmount?: number;
  } | null>(null);
  const openPrint = useCallback((inv: SaleInvoice) => {
    setPrintData({
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      time: inv.time,
      cashier: inv.cashier,
      items: inv.items as CartItem[],
      total: inv.total,
      paidAmount: inv.paidAmount,
      remainingAmount: inv.remainingAmount,
    });
  }, []);
  const [endShiftOpen, setEndShiftOpen] = useState(false);
  const [endingShift, setEndingShift] = useState(false);
  const [shiftToEnd, setShiftToEnd] = useState<Shift | null>(null);
  const handleEndShift = async () => {
    const target = shiftToEnd ?? activeShift;
    if (!target) return;
    try {
      setEndingShift(true);
      const res = await window.api.shifts.end(
        target.id,
        new Date().toISOString(),
      );
      if (!res.success) throw new Error(res.message);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast({
        title: strings.shifts.shiftEnded,
        variant: "default",
      });
      setEndShiftOpen(false);
      setShiftToEnd(null);
      onShiftEnded?.();
    } catch (err) {
      toast({
        title: strings.shifts.shiftEndError,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setEndingShift(false);
    }
  };
  const openEndShiftFor = (shift: Shift) => {
    setShiftToEnd(shift);
    setEndShiftOpen(true);
  };
  const hasActiveShift =
    !!activeShift && activeShift.status === SHIFT_STATUS.OPEN;

  return (
    <div className="space-y-6">
      {printData && (
        <InvoicePrint
          open={!!printData}
          onClose={() => setPrintData(null)}
          invoiceNumber={printData.invoiceNumber}
          date={printData.date}
          time={printData.time}
          cashier={printData.cashier}
          items={printData.items}
          total={printData.total}
          paidAmount={printData.paidAmount}
          remainingAmount={printData.remainingAmount}
        />
      )}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onPrint={openPrint}
      />
      <EndShiftDialog
        open={endShiftOpen}
        loading={endingShift}
        onConfirm={handleEndShift}
        onCancel={() => setEndShiftOpen(false)}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {strings.salesInvoices.title}
          </h2>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {hasActiveShift
                ? strings.salesInvoices.activeShiftLabel.replace(
                    "{date}",
                    activeShift.date,
                  )
                : strings.shifts.noActiveShift}
            </p>
          )}
        </div>
        {!isAdmin && hasActiveShift && (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive shrink-0 transition-all"
            onClick={() => setEndShiftOpen(true)}
          >
            <LogOut className="w-4 h-4 me-1.5" />
            {strings.shifts.endShift}
          </Button>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 border-b border-border pb-0">
          {[
            {
              value: SALES_INVOICES_TAB.MY_SHIFT,
              label: strings.salesInvoices.myShiftTab,
            },
            {
              value: SALES_INVOICES_TAB.ALL_SALES,
              label: strings.salesInvoices.allSalesTab,
            },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {!isAdmin && !hasActiveShift && (
        <Card className="bg-card/60 backdrop-blur-sm border-border">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {strings.shifts.noActiveShift}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {strings.shifts.noActiveShiftDesc}
            </p>
          </CardContent>
        </Card>
      )}
      {!isAdmin && hasActiveShift && (
        <div className="space-y-4">
          <ShiftSummaryCards summary={shiftSummary} />
          <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <Receipt className="w-4 h-4" />
                {strings.salesInvoices.currentShiftInvoices}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceList
                invoices={shiftInvoices}
                loading={shiftLoading}
                emptyTitle={strings.salesInvoices.noInvoices}
                emptyDesc={strings.salesInvoices.noInvoicesDesc}
                onSelect={(inv) => {
                  setSelectedInvoice(inv);
                  setDetailOpen(true);
                }}
                onPrint={openPrint}
              />
            </CardContent>
          </Card>
        </div>
      )}
      {isAdmin && activeTab === SALES_INVOICES_TAB.MY_SHIFT && (
        <div className="space-y-4">
          {adminShiftsLoading || adminInvoicesLoading || adminSummaryLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {strings.common.loading}
              </span>
            </div>
          ) : adminShiftsToday.length === 0 ? (
            <Card className="bg-card/60 backdrop-blur-sm border-border">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {strings.shifts.noActiveShift}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {strings.shifts.noActiveShiftDesc}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <ShiftSummaryCards summary={adminSummaryAggregate} />
              <div className="space-y-3">
                {[...adminShiftsToday]
                  .sort((a, b) => {
                    if (a.status === "open" && b.status !== "open") return -1;
                    if (a.status !== "open" && b.status === "open") return 1;
                    return 0;
                  })
                  .map((shift) => {
                    const shiftSummaryForBlock = adminSummaryByShift.get(
                      shift.id,
                    );
                    const shiftTotal = shiftSummaryForBlock
                      ? shiftSummaryForBlock.cash +
                        shiftSummaryForBlock.vodafone_cash +
                        shiftSummaryForBlock.instapay
                      : 0;
                    return (
                      <AdminShiftBlock
                        key={shift.id}
                        shift={shift}
                        invoices={adminInvoicesByShift.get(shift.id) ?? []}
                        shiftTotal={shiftTotal}
                        onSelect={(inv) => {
                          setSelectedInvoice(inv);
                          setDetailOpen(true);
                        }}
                        onPrint={openPrint}
                        onEndShift={openEndShiftFor}
                      />
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}
      {isAdmin && activeTab === SALES_INVOICES_TAB.ALL_SALES && (
        <div className="space-y-4">
          <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardContent className="pt-4 pb-3">
              <DateFilterBar
                preset={datePreset}
                onPreset={setDatePreset}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFrom={setCustomFrom}
                onCustomTo={setCustomTo}
              />
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <Receipt className="w-4 h-4" />
                  {strings.salesInvoices.allSalesTitle}
                </CardTitle>
                <div className="flex items-center gap-1 text-xs">
                  {(["all", "pos", "online"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSourceFilter(s)}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        sourceFilter === s
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s === "all"
                        ? strings.salesInvoices.sourceFilterAll
                        : s === "online"
                          ? strings.salesInvoices.sourceFilterOnline
                          : strings.salesInvoices.sourceFilterPos}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <InvoiceList
                invoices={allInvoices}
                loading={allLoadingFinal}
                emptyTitle={strings.salesInvoices.noInvoicesInPeriod}
                onSelect={(inv) => {
                  setSelectedInvoice(inv);
                  setDetailOpen(true);
                }}
                onPrint={openPrint}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
export default SalesInvoices;
