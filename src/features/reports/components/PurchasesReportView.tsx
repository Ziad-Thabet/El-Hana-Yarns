import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FileText,
  TrendingUp,
  ShoppingCart,
  Users,
  AlertTriangle,
  BarChart2,
  CreditCard,
} from "lucide-react";
import type {
  PurchasesReport,
  SupplierPerformance,
  PaymentMethodSummary,
  PurchasesTrendPoint,
} from "@/features/reports/types";
import {
  fmt,
  fmtAxis,
  formatPaymentMethod,
  fmtAxisDate,
} from "./reportFormatters";
import { C, CHART_STYLE, T } from "./reportConstants";
import { GrowthBadge } from "./GrowthBadge";
import { StatCard } from "./StatCard";
import { SectionCard } from "./SectionCard";
import { EmptyRow } from "./EmptyRow";
import { strings } from "@/lib/i18n/ar";

export function PurchasesReportView({ data }: { data: PurchasesReport }) {
  const { stats, analytics } = data;
  const { supplierPerformance, trend, comparison, paymentAnalytics } =
    analytics;
  const trendChartData = trend.map((p: PurchasesTrendPoint) => ({
    date: fmtAxisDate(p.date),
    spend: p.spend,
    invoices: p.invoices,
  }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.totalPurchases}
          value={fmt(stats.total)}
          color={T.revenue}
          icon={ShoppingCart}
          accent
          sub={comparison && <GrowthBadge value={comparison.spendChange} />}
        />
        <StatCard
          label={strings.reports.invoiceCount}
          value={stats.count}
          icon={FileText}
        />
        <StatCard
          label={strings.common.paid}
          value={fmt(stats.paid)}
          color={T.profit}
          icon={TrendingUp}
        />
        <StatCard
          label={strings.reports.remainingToPay}
          value={fmt(stats.unpaid)}
          color={stats.unpaid > 0 ? T.loss : T.neutral}
          icon={AlertTriangle}
        />
      </div>
      {trendChartData.length > 0 && (
        <SectionCard title={strings.reports.spendTrend} icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={trendChartData}
              margin={{ top: 6, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid {...CHART_STYLE.cartesian} />
              <XAxis
                dataKey="date"
                tick={CHART_STYLE.tick}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={CHART_STYLE.tick}
                width={48}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtAxis}
              />
              <Tooltip
                {...CHART_STYLE.tooltip}
                formatter={(v: unknown) => [
                  fmt(Number(v)),
                  strings.common.spend,
                ]}
              />
              <Bar
                dataKey="spend"
                fill={C.primary}
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}
      {comparison && (
        <SectionCard title={strings.reports.periodComparison} icon={BarChart2}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: strings.reports.currentPeriodSpend,
                value: fmt(comparison.currentPeriod.spend),
                color: T.revenue,
              },
              {
                label: strings.reports.previousPeriodSpend,
                value: fmt(comparison.previousPeriod.spend),
                color: "text-muted-foreground",
              },
              {
                label: strings.reports.spendChange,
                value: <GrowthBadge value={comparison.spendChange} />,
                color: "",
              },
              {
                label: strings.reports.invoiceChange,
                value: <GrowthBadge value={comparison.invoiceChange} />,
                color: "",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-muted/30 px-5 py-4 space-y-2"
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                  {item.label}
                </p>
                <p className={`text-sm font-bold ${item.color}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.supplierPerformance}
          icon={Users}
          badge={supplierPerformance.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.supplier,
                    strings.common.spend,
                    strings.reports.unpaid,
                    strings.common.invoices,
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierPerformance.length === 0 ? (
                  <EmptyRow cols={4} />
                ) : (
                  supplierPerformance.map((s: SupplierPerformance, i) => (
                    <TableRow
                      key={`${s.supplier}-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {s.supplier}
                      </TableCell>
                      <TableCell
                        className={`${T.revenue} text-[12px] font-bold py-3 tabular-nums`}
                      >
                        {fmt(s.spend)}
                      </TableCell>
                      <TableCell
                        className={`text-[12px] font-bold py-3 tabular-nums ${s.unpaid > 0 ? T.loss : T.neutral}`}
                      >
                        {fmt(s.unpaid)}
                      </TableCell>
                      <TableCell className="text-[12px] py-3 tabular-nums text-muted-foreground">
                        {s.invoices}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        <SectionCard title={strings.common.paymentMethods} icon={CreditCard}>
          <div className="space-y-2">
            {paymentAnalytics.methods.length === 0 ? (
              <div className="flex items-center justify-center py-14">
                <p className="text-sm text-muted-foreground/50 font-medium">
                  {strings.reports.noData}
                </p>
              </div>
            ) : (
              paymentAnalytics.methods.map((m: PaymentMethodSummary, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3.5"
                >
                  <div>
                    <p className="text-[13px] font-bold">
                      {formatPaymentMethod(m.method)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {m.count} {strings.common.transaction}
                    </p>
                  </div>
                  <div className="text-end">
                    <p
                      className={`text-[13px] font-bold ${T.revenue} tabular-nums`}
                    >
                      {fmt(m.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      {m.share.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
