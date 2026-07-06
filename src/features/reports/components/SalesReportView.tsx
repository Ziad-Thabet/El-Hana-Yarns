import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FileText,
  TrendingUp,
  BarChart2,
  Activity,
  CreditCard,
  Layers,
  AlertTriangle,
  Users,
} from "lucide-react";
import type {
  SalesReport,
  SalesTrendPoint,
  PaymentMethodSummary,
  ProductPerformance,
  CategoryPerformance,
  ReportCustomerRow,
  TopProduct,
} from "@/features/reports/types";
import {
  fmt,
  fmtAxis,
  formatPaymentMethod,
  fmtAxisDate,
} from "./reportFormatters";
import {
  C,
  CHART_STYLE,
  PIE_COLORS,
  T,
  MARGIN_THRESHOLDS,
} from "./reportConstants";
import { GrowthBadge } from "./GrowthBadge";
import { StatCard } from "./StatCard";
import { SectionCard } from "./SectionCard";
import { EmptyRow } from "./EmptyRow";
import { ProgressBar } from "./ProgressBar";
import { TopProductsRankedList } from "./TopProductsRankedList";
import { strings } from "@/lib/i18n/ar";
export function SalesReportView({ data }: { data: SalesReport }) {
  const { stats, topProducts, analytics } = data;
  const {
    invoiceAnalytics,
    productPerformance,
    categoryPerformance,
    paymentAnalytics,
    customerAnalytics,
    trend,
    comparisons,
    businessHealth,
  } = analytics;
  const trendChartData = trend.map((p: SalesTrendPoint) => ({
    date: fmtAxisDate(p.date),
    revenue: p.revenue,
    invoices: p.invoices,
  }));
  const topChartData = topProducts.slice(0, 8).map((p: TopProduct) => ({
    name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
    fullName: p.name,
    revenue: p.revenue,
  }));
  const paymentPieData = paymentAnalytics.methods.map(
    (m: PaymentMethodSummary) => ({
      name: formatPaymentMethod(m.method),
      value: m.amount,
      share: m.share,
      count: m.count,
    }),
  );
  const hasCostData = productPerformance.some((p) => p.estimatedCost > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.totalRevenue}
          value={fmt(stats.total)}
          color={T.revenue}
          icon={TrendingUp}
          accent
          sub={comparisons && <GrowthBadge value={comparisons.revenueChange} />}
        />
        <StatCard
          label={strings.reports.invoiceCount}
          value={stats.count}
          icon={FileText}
          sub={comparisons && <GrowthBadge value={comparisons.invoiceChange} />}
        />
        <StatCard
          label={strings.reports.avgInvoiceValue}
          value={fmt(invoiceAnalytics.averageTransactionValue)}
          icon={BarChart2}
        />
        <StatCard
          label={strings.reports.avgMargin}
          value={
            hasCostData ? `${businessHealth.averageMargin.toFixed(1)}%` : "—"
          }
          color={
            hasCostData
              ? businessHealth.averageMargin >= MARGIN_THRESHOLDS.good
                ? T.profit
                : businessHealth.averageMargin >= MARGIN_THRESHOLDS.warning
                  ? T.warning
                  : T.loss
              : T.neutral
          }
          icon={Activity}
          sub={
            !hasCostData && (
              <span className="text-[10.5px] text-muted-foreground/60">
                {strings.reports.needsPurchaseData}
              </span>
            )
          }
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title={strings.reports.revenueTrend}
          icon={TrendingUp}
          className="lg:col-span-2"
        >
          {trendChartData.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <p className="text-sm text-muted-foreground/50 font-medium">
                {strings.reports.noDataForPeriod}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart
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
                    strings.common.revenue,
                  ]}
                  labelFormatter={(l) => `${strings.reports.dateLabel} ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={C.primary}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: C.primary,
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title={strings.common.paymentMethods} icon={CreditCard}>
          {paymentPieData.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <p className="text-sm text-muted-foreground/50 font-medium">
                {strings.reports.noData}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={156}>
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {paymentPieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        strokeWidth={0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_STYLE.tooltip}
                    formatter={(v: unknown) => [
                      fmt(Number(v)),
                      strings.common.amount,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5">
                {paymentPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="text-[12px] text-muted-foreground font-medium">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground/60">
                        {item.count} {strings.common.transaction}
                      </span>
                      <span className="text-[12px] font-bold text-foreground tabular-nums">
                        {item.share.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
      {comparisons && (
        <SectionCard title={strings.reports.periodComparison} icon={BarChart2}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: strings.reports.currentPeriodRevenue,
                value: fmt(comparisons.currentPeriod.revenue),
                color: T.revenue,
              },
              {
                label: strings.reports.previousPeriodRevenue,
                value: fmt(comparisons.previousPeriod.revenue),
                color: "text-muted-foreground",
              },
              {
                label: strings.reports.revenueChange,
                value: <GrowthBadge value={comparisons.revenueChange} />,
                color: "",
              },
              {
                label: strings.reports.invoiceChange,
                value: <GrowthBadge value={comparisons.invoiceChange} />,
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
          title={strings.reports.topSellingProducts}
          icon={TrendingUp}
          badge={topChartData.length}
        >
          {topChartData.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <p className="text-sm text-muted-foreground/50 font-medium">
                {strings.reports.noData}
              </p>
            </div>
          ) : (
            <TopProductsRankedList items={topChartData} />
          )}
        </SectionCard>
        <SectionCard
          title={strings.reports.detailedProductPerformance}
          icon={Layers}
          badge={productPerformance.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            {!hasCostData && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-muted/40 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <p className="text-[11px] text-muted-foreground/70">
                  {strings.reports.profitMarginAfterPurchase}
                </p>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3">
                    {strings.common.product}
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3">
                    {strings.common.category}
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3">
                    {strings.common.revenue}
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3">
                    {strings.common.quantity}
                  </TableHead>
                  {hasCostData && (
                    <>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3">
                        {strings.common.profit}
                      </TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-3">
                        {strings.common.margin}
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {productPerformance.length === 0 ? (
                  <EmptyRow cols={hasCostData ? 6 : 4} />
                ) : (
                  productPerformance
                    .slice(0, 12)
                    .map((p: ProductPerformance, i) => (
                      <TableRow
                        key={`${p.name}-${i}`}
                        className="border-border/20 hover:bg-muted/25 transition-colors"
                      >
                        <TableCell
                          className="font-semibold text-[12.5px] max-w-[130px] truncate py-3"
                          title={p.name}
                        >
                          {p.name}
                        </TableCell>
                        <TableCell className="text-[11.5px] text-muted-foreground py-3 max-w-[80px] truncate">
                          {p.category || "—"}
                        </TableCell>
                        <TableCell
                          className={`${T.revenue} text-[12px] font-bold py-3 tabular-nums`}
                        >
                          {fmt(p.revenue)}
                        </TableCell>
                        <TableCell className="text-[12px] py-3 tabular-nums text-muted-foreground">
                          {p.quantity}
                        </TableCell>
                        {hasCostData && (
                          <>
                            <TableCell
                              className={`text-[12px] font-bold py-3 tabular-nums ${p.grossProfit >= 0 ? T.profit : T.loss}`}
                            >
                              {p.estimatedCost === 0 ? (
                                <span className="text-muted-foreground/40">
                                  —
                                </span>
                              ) : (
                                fmt(p.grossProfit)
                              )}
                            </TableCell>
                            <TableCell className="py-3">
                              {p.estimatedCost === 0 ? (
                                <span className="text-muted-foreground/40 text-[11px]">
                                  —
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-bold rounded-lg px-2 ${
                                    p.grossMargin >= MARGIN_THRESHOLDS.good
                                      ? T.profitBadge
                                      : p.grossMargin >=
                                          MARGIN_THRESHOLDS.warning
                                        ? T.warnBadge
                                        : T.lossBadge
                                  }`}
                                >
                                  {p.grossMargin.toFixed(1)}%
                                </Badge>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
      <SectionCard
        title={strings.reports.categoryPerformance}
        icon={Layers}
        badge={categoryPerformance.length}
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <Table>
            <TableHeader>
              <TableRow className="border-border/25 hover:bg-transparent">
                {[
                  strings.common.category,
                  strings.common.revenue,
                  strings.common.quantity,
                  strings.common.invoices,
                  strings.common.share,
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
              {categoryPerformance.length === 0 ? (
                <EmptyRow cols={5} />
              ) : (
                categoryPerformance.map((c: CategoryPerformance, i) => (
                  <TableRow
                    key={`${c.category}-${i}`}
                    className="border-border/20 hover:bg-muted/25 transition-colors"
                  >
                    <TableCell className="font-semibold text-[12.5px] py-3">
                      {c.category}
                    </TableCell>
                    <TableCell
                      className={`${T.revenue} text-[12px] font-bold py-3 tabular-nums`}
                    >
                      {fmt(c.revenue)}
                    </TableCell>
                    <TableCell className="text-[12px] py-3 tabular-nums text-muted-foreground">
                      {c.quantity}
                    </TableCell>
                    <TableCell className="text-[12px] py-3 tabular-nums text-muted-foreground">
                      {c.invoices}
                    </TableCell>
                    <TableCell className="py-3 min-w-[140px]">
                      <ProgressBar value={c.revenueShare} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.topDebtCustomers}
          icon={Users}
          badge={customerAnalytics.customers.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.customer,
                    strings.common.remaining,
                    strings.reports.debtCount,
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
                {customerAnalytics.customers.length === 0 ? (
                  <EmptyRow cols={3} message={strings.common.noCustomers} />
                ) : (
                  customerAnalytics.customers
                    .slice(0, 8)
                    .map((c: ReportCustomerRow) => (
                      <TableRow
                        key={c.id}
                        className="border-border/20 hover:bg-muted/25 transition-colors"
                      >
                        <TableCell className="font-semibold text-[12.5px] py-3">
                          {c.name}
                        </TableCell>
                        <TableCell
                          className={`font-bold text-[12px] py-3 tabular-nums ${c.remainingAmount > 0 ? T.loss : T.profit}`}
                        >
                          {fmt(c.remainingAmount)}
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                          {c.debtCount}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        <SectionCard title={strings.reports.customerSegmentation} icon={Users}>
          <div className="space-y-2.5">
            {[
              {
                label: strings.reports.customerSegmentHighValueLabel,
                desc: strings.reports.customerSegmentHighValueDesc,
                items: customerAnalytics.segments.highValue,
                cls: T.highValue,
                bg: T.highValCard,
                Icon: TrendingUp,
              },
              {
                label: strings.reports.customerSegmentAtRiskLabel,
                desc: strings.reports.customerSegmentAtRiskDesc,
                items: customerAnalytics.segments.atRisk,
                cls: T.loss,
                bg: T.dangerCard,
                Icon: AlertTriangle,
              },
              {
                label: strings.reports.customerSegmentRegularLabel,
                desc: strings.reports.customerSegmentRegularDesc,
                items: customerAnalytics.segments.regular,
                cls: T.profit,
                bg: T.successCard,
                Icon: Activity,
              },
              {
                label: strings.reports.customerSegmentInactiveLabel,
                desc: strings.reports.customerSegmentInactiveDesc,
                items: customerAnalytics.segments.inactive,
                cls: T.neutral,
                bg: T.neutralCard,
                Icon: Users,
              },
            ].map((seg) => (
              <div
                key={seg.label}
                className={`rounded-2xl border px-4 py-3.5 ${seg.bg}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <seg.Icon className={`w-4 h-4 shrink-0 ${seg.cls}`} />
                    <div>
                      <p className={`text-[12.5px] font-bold ${seg.cls}`}>
                        {seg.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {seg.desc}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`border-current font-bold text-[13px] rounded-xl px-2.5 ${seg.cls}`}
                  >
                    {seg.items.length}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
