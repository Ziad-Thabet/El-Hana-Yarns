import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Clock, X, RefreshCw } from "lucide-react";
import { reportsApi } from "@/lib/api";
import type { ReportType, ReportResult } from "@/features/reports/types";

import {
  AllReportType,
  REPORT_TYPES,
  DATE_SENSITIVE_REPORTS,
  T,
} from "./reportConstants";
import { DateRangePicker } from "./DateRangePicker";
import { DashboardReportView } from "./DashboardReportView";
import { SalesReportView } from "./SalesReportView";
import { PurchasesReportView } from "./PurchasesReportView";
import { InventoryReportView } from "./InventoryReportView";
import { DebtsReportView } from "./DebtsReportView";
import { OnlineOrdersReportView } from "./OnlineOrdersReportView";
import { strings } from "@/lib/i18n/ar";
type AnyReport = ReportResult;
interface ReportsSectionProps {
  isAdmin: boolean;
}

const ReportsSection = ({ isAdmin }: ReportsSectionProps) => {
  const [selectedReport, setSelectedReport] =
    useState<AllReportType>("dashboard");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<AnyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDateSensitive = DATE_SENSITIVE_REPORTS.includes(selectedReport);
  const fetchReport = useCallback(
    async (type: AllReportType, from: string, to: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await reportsApi.generate({
          type,
          from:
            DATE_SENSITIVE_REPORTS.includes(type) && from ? from : undefined,
          to: DATE_SENSITIVE_REPORTS.includes(type) && to ? to : undefined,
        });
        setReportData(data as AnyReport);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : strings.reports.generateError,
        );
        setReportData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );
  useEffect(() => {
    fetchReport(selectedReport, dateFrom, dateTo);
  }, [selectedReport]);
  const handleReportChange = useCallback((type: AllReportType) => {
    setSelectedReport(type);
    setReportData(null);
    setError(null);
    if (!DATE_SENSITIVE_REPORTS.includes(type)) {
      setDateFrom("");
      setDateTo("");
    }
  }, []);
  const handleDateChange = useCallback(
    (from: string, to: string) => {
      setDateFrom(from);
      setDateTo(to);
      fetchReport(selectedReport, from, to);
    },
    [selectedReport, fetchReport],
  );
  const handleRefresh = useCallback(() => {
    fetchReport(selectedReport, dateFrom, dateTo);
  }, [selectedReport, dateFrom, dateTo, fetchReport]);
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
          <p className="text-[13px] text-muted-foreground font-medium">
            {strings.reports.loadingReport}
          </p>
        </div>
      );
    }
    if (error) {
      return (
        <Card className={`rounded-2xl overflow-hidden ${T.dangerCard}`}>
          <CardContent className="text-center py-16 px-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-destructive text-[13px] font-semibold">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="rounded-xl border-border/40 text-[12.5px] font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5 me-1.5" />
              {strings.common.retry}
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (!reportData) return null;
    if (reportData.type === "dashboard")
      return <DashboardReportView data={reportData} />;
    if (reportData.type === "sales")
      return <SalesReportView data={reportData} />;
    if (reportData.type === "purchases")
      return <PurchasesReportView data={reportData} />;
    if (reportData.type === "inventory")
      return <InventoryReportView data={reportData} />;
    if (reportData.type === "debts")
      return <DebtsReportView data={reportData} />;
    if (reportData.type === "online_orders")
      return <OnlineOrdersReportView data={reportData} />;
    return null;
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          {strings.reports.title}
        </h2>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground gap-2 rounded-xl text-[12.5px] font-semibold h-9 px-3.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            {strings.common.refresh}
          </Button>
        )}
      </div>
      {isAdmin && (
        <Card className="bg-card rounded-2xl ring-1 ring-border/30 dark:ring-white/[0.06]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/80 dark:bg-black/30 overflow-x-auto">
                {REPORT_TYPES.map((r) => {
                  const isActive = selectedReport === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => handleReportChange(r.value)}
                      disabled={loading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 disabled:pointer-events-none whitespace-nowrap ${
                        isActive
                          ? "bg-card text-foreground shadow-sm ring-1 ring-border/30 dark:ring-white/[0.09]"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                      }`}
                    >
                      <r.icon
                        className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : ""}`}
                      />
                      {r.label}
                    </button>
                  );
                })}
              </div>
              {isDateSensitive && (
                <div className="flex items-center gap-2.5">
                  <DateRangePicker
                    from={dateFrom}
                    to={dateTo}
                    onChange={handleDateChange}
                    disabled={loading}
                  />
                  {(dateFrom || dateTo) && (
                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary/[0.08] ring-1 ring-primary/20 text-[12px] text-primary font-semibold whitespace-nowrap">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="tabular-nums">
                        {dateFrom && dateTo && dateFrom === dateTo
                          ? dateFrom
                          : dateFrom && dateTo
                            ? `${dateFrom} — ${dateTo}`
                            : dateFrom
                              ? `${strings.reports.rangeFrom} ${dateFrom}`
                              : `${strings.common.until} ${dateTo}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDateChange("", "")}
                        className="ms-0.5 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {isAdmin && renderContent()}
    </div>
  );
};
export default ReportsSection;
