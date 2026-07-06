import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  Wallet,
  DollarSign,
  FileText,
  BarChart2,
  Package,
  AlertTriangle,
  Activity,
  CreditCard,
  Layers,
  Receipt,
  Users,
  HandCoins,
  Truck,
  ArrowUpCircle,
  RotateCcw,
  Info,
  Percent,
} from "lucide-react";
import type { DashboardReport, TopProduct } from "@/features/reports/types";
import {
  fmt,
  fmtAxis,
  fmtAxisDate,
  formatPaymentMethod,
} from "./reportFormatters";
import { C, CHART_STYLE, PIE_COLORS, T } from "./reportConstants";
import { GrowthBadge } from "./GrowthBadge";
import { StatCard } from "./StatCard";
import { SectionCard } from "./SectionCard";
import { TopProductsRankedList } from "./TopProductsRankedList";
import { strings } from "@/lib/i18n/ar";

function GroupHeader({
  icon: Icon,
  title,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone?: "default" | "warning" | "danger" | "muted";
}) {
  const toneColor =
    tone === "warning"
      ? "text-amber-500"
      : tone === "danger"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground/60"
          : "text-primary";
  return (
    <div className="flex items-center gap-2 px-1 pt-1">
      <Icon className={`w-4 h-4 ${toneColor}`} />
      <h3
        className={`text-[13px] font-bold ${tone === "muted" ? "text-muted-foreground/70" : "text-foreground"}`}
      >
        {title}
      </h3>
    </div>
  );
}

export function DashboardReportView({ data }: { data: DashboardReport }) {
  const {
    kpis,
    comparison,
    combinedTrend,
    topProducts,
    categoryBreakdown,
    paymentMethods,
    topDebtors,
  } = data;
  const trendData = combinedTrend.map((p) => ({
    date: fmtAxisDate(p.date),
    revenue: p.revenue,
    spend: p.spend,
  }));
  const topBarData = topProducts.map((p: TopProduct) => ({
    name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
    fullName: p.name,
    revenue: p.revenue,
  }));
  const catPieData = categoryBreakdown.map((c) => ({
    name: c.category,
    value: c.revenue,
    share: c.share,
  }));
  const payPieData = paymentMethods.map((m) => ({
    name: formatPaymentMethod(m.method),
    value: m.amount,
    count: m.count,
  }));

  return (
    <div className="space-y-4">
      {/* ── Overview — the big picture ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.totalRevenue}
          value={fmt(kpis.revenue)}
          color={T.revenue}
          icon={TrendingUp}
          accent
          sub={
            <div className="flex flex-col gap-1">
              {comparison && <GrowthBadge value={comparison.revenueChange} />}
              {kpis.collectedFromDebtSettlement > 0 && (
                <span className="text-[10.5px] text-muted-foreground/60">
                  {strings.reports.debtCollectionIncluded.replace(
                    "{amount}",
                    fmt(kpis.collectedFromDebtSettlement),
                  )}
                </span>
              )}
            </div>
          }
        />
        <StatCard
          label={strings.reports.trueNetProfit}
          value={fmt(Math.abs(kpis.trueNetProfit))}
          color={kpis.trueNetProfit >= 0 ? T.profit : T.loss}
          icon={Wallet}
          accent
          sub={
            <span
              className={`text-xs font-semibold tabular-nums ${kpis.trueNetProfit >= 0 ? T.profit : T.loss}`}
            >
              {strings.reports.trueNetProfitDesc}
            </span>
          }
        />
        <StatCard
          label={strings.reports.invoiceCount}
          value={kpis.invoices}
          icon={FileText}
          sub={comparison && <GrowthBadge value={comparison.invoiceChange} />}
        />
        <StatCard
          label={strings.reports.avgInvoiceValue}
          value={fmt(kpis.averageTransactionValue)}
          icon={BarChart2}
        />
      </div>

      {/* ── Profitability — pricing health, independent of expenses ── */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={strings.reports.grossProfitLabel}
          value={fmt(kpis.grossProfit)}
          color={kpis.grossProfit >= 0 ? T.profit : T.loss}
          icon={DollarSign}
          sub={
            <span className="text-[10.5px] text-muted-foreground/60">
              {strings.reports.grossProfitDesc}
            </span>
          }
        />
        <StatCard
          label={strings.reports.grossMarginLabel}
          value={`${kpis.grossMargin.toFixed(1)}%`}
          color={
            kpis.grossMargin >= 30
              ? T.profit
              : kpis.grossMargin >= 15
                ? T.warning
                : T.loss
          }
          icon={Percent}
        />
      </div>

      {/* ── Money OUT — real cash leaving the shop ────────────── */}
      <GroupHeader
        icon={ArrowUpCircle}
        title={strings.reports.actualExpensesOut}
        tone="warning"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.operatingExpenses}
          value={fmt(kpis.expensesTotal)}
          color={T.warning}
          icon={Receipt}
          sub={
            <span className="text-[10.5px] text-muted-foreground/60">
              {strings.reports.operatingExpensesHint}
            </span>
          }
        />
        <StatCard
          label={strings.reports.employeeSalariesAccrued}
          value={fmt(kpis.salariesTotal)}
          color={T.warning}
          icon={Users}
          sub={
            <span className="text-[10.5px] text-muted-foreground/60">
              {strings.reports.employeeSalariesHint}
            </span>
          }
        />
        <StatCard
          label={strings.reports.purchasesPaidActual}
          value={fmt(kpis.purchasesPaidActual)}
          color={T.warning}
          icon={ShoppingCart}
        />
        <StatCard
          label={strings.reports.driverFeesPaid}
          value={fmt(kpis.driverFeesPaid)}
          color={T.warning}
          icon={Truck}
          sub={
            <span className="text-[10.5px] text-muted-foreground/60">
              {strings.reports.driverFeesPaidHint}
            </span>
          }
        />
      </div>

      {/* ── Alerts — needs attention ───────────────────────────── */}
      <GroupHeader
        icon={AlertTriangle}
        title={strings.reports.needsAttention}
        tone="danger"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.pendingRefunds}
          value={fmt(kpis.pendingRefunds)}
          color={kpis.pendingRefunds > 0 ? T.loss : T.neutral}
          icon={RotateCcw}
          sub={
            <span className="text-[11px] text-muted-foreground">
              {strings.reports.pendingRefundsCount.replace(
                "{count}",
                String(kpis.pendingRefundsCount),
              )}
            </span>
          }
        />
        <StatCard
          label={strings.reports.totalRemainingDebt}
          value={fmt(kpis.totalDebt)}
          color={kpis.totalDebt > 0 ? T.loss : T.neutral}
          icon={DollarSign}
          sub={
            <span className="text-[11px] text-muted-foreground">
              {strings.reports.activeDebtCount.replace(
                "{count}",
                String(kpis.debtCount),
              )}
            </span>
          }
        />
        <StatCard
          label={strings.reports.unpaidPurchases}
          value={fmt(kpis.unpaidPurchases)}
          color={kpis.unpaidPurchases > 0 ? T.warning : T.neutral}
          icon={AlertTriangle}
        />
        <StatCard
          label={strings.reports.needsRestock}
          value={kpis.lowStock}
          color={kpis.lowStock > 0 ? T.warning : T.neutral}
          icon={Package}
          sub={
            <span className="text-[11px] text-muted-foreground">
              {strings.reports.fullyOutOfStock.replace(
                "{count}",
                String(kpis.outOfStock),
              )}
            </span>
          }
        />
      </div>

      {/* ── Informational only — cash-timing, not part of net profit ── */}
      <GroupHeader
        icon={Info}
        title={strings.reports.extraCashFlowInfo}
        tone="muted"
      />
      <div className="grid grid-cols-1 gap-4">
        <StatCard
          label={strings.reports.driverCustodyCollected}
          value={fmt(kpis.driverCustodyCollected)}
          color="text-muted-foreground"
          icon={HandCoins}
          sub={
            <span className="text-[10.5px] text-muted-foreground/50">
              {strings.reports.driverCustodyHint}
            </span>
          }
        />
      </div>

      {/* ── Trend + payment methods ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title={strings.reports.revenueVsExpenses}
          icon={Activity}
          className="lg:col-span-2"
        >
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <p className="text-sm text-muted-foreground/50 font-medium">
                {strings.reports.noDataForPeriod}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={trendData}
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
                  formatter={(v: unknown, name: string) => [
                    fmt(Number(v)),
                    name === "revenue"
                      ? strings.common.revenue
                      : strings.common.expenses,
                  ]}
                  labelFormatter={(l) => `${strings.reports.dateLabel} ${l}`}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {value === "revenue"
                        ? strings.common.revenue
                        : strings.common.expenses}
                    </span>
                  )}
                />
                <Bar
                  dataKey="revenue"
                  fill={C.primary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="spend"
                  fill={C.indigo}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  opacity={0.7}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title={strings.common.paymentMethods} icon={CreditCard}>
          {payPieData.length === 0 ? (
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
                    data={payPieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {payPieData.map((_, i) => (
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
                {payPieData.map((item, i) => (
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
                    <span className="text-[12px] font-bold text-foreground tabular-nums">
                      {fmt(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Products + categories ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.topProductsByRevenue}
          icon={TrendingUp}
          badge={topBarData.length}
        >
          {topBarData.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <p className="text-sm text-muted-foreground/50 font-medium">
                {strings.reports.noData}
              </p>
            </div>
          ) : (
            <TopProductsRankedList items={topBarData} />
          )}
        </SectionCard>
        <SectionCard
          title={strings.reports.revenueByCategory}
          icon={Layers}
          badge={catPieData.length}
        >
          {catPieData.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <p className="text-sm text-muted-foreground/50 font-medium">
                {strings.reports.noData}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={catPieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {catPieData.map((_, i) => (
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
                      strings.common.revenue,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {catPieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-[12px] text-muted-foreground font-medium flex-1 truncate">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-semibold text-muted-foreground/60 tabular-nums w-10 text-end">
                        {item.share.toFixed(1)}%
                      </span>
                      <span className="text-[12px] font-bold text-foreground tabular-nums">
                        {fmt(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Top debtors ──────────────────────────────────────────── */}
      {topDebtors.length > 0 && (
        <SectionCard
          title={strings.reports.topDebtors}
          icon={AlertTriangle}
          badge={topDebtors.length}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topDebtors.map((d, i) => (
              <div
                key={i}
                className={`rounded-2xl border px-4 py-3.5 space-y-2 ${
                  i === 0 ? T.dangerCard : T.neutralCard
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0
                      ${i === 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}
                  >
                    {i + 1}
                  </span>
                  <p
                    className="text-[12.5px] font-bold text-foreground truncate flex-1"
                    title={d.name}
                  >
                    {d.name}
                  </p>
                </div>
                <p
                  className={`text-[1.1rem] font-bold tabular-nums leading-none ${i === 0 ? T.loss : "text-foreground"}`}
                >
                  {fmt(d.remaining)}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
