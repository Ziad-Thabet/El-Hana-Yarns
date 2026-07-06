import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, Truck, AlertTriangle, Users } from "lucide-react";
import type { OnlineOrdersReport } from "@/features/reports/types";
import { fmt } from "./reportFormatters";
import { T } from "./reportConstants";
import { StatCard } from "./StatCard";
import { SectionCard } from "./SectionCard";
import { EmptyRow } from "./EmptyRow";
import {
  ORDER_STATUS_LABELS,
  ORDER_SOURCE_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  TRUST_LEVEL_LABELS,
  TRUST_LEVEL_COLORS,
  type OrderStatusValue,
  type OrderSourceValue,
  type OrderPaymentMethodValue,
  type TrustLevelValue,
} from "@/lib/constants/onlineOrdersStatus";
import { strings } from "@/lib/i18n/ar";

export function OnlineOrdersReportView({ data }: { data: OnlineOrdersReport }) {
  const { stats, analytics } = data;
  const {
    statusBreakdown,
    sourceBreakdown,
    paymentMethodBreakdown,
    topCustomers,
    driverPerformance,
    customerDistribution,
    topAreas,
    driverSettlementTotals,
  } = analytics;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.onlineRevenue}
          value={fmt(stats.revenue)}
          color={T.revenue}
          icon={DollarSign}
          accent
        />
        <StatCard
          label={strings.onlineOrders.totalOnlineOrders}
          value={stats.totalOrders}
          icon={Package}
        />
        <StatCard
          label={strings.reports.delivered}
          value={stats.dispatchedCount}
          color={T.profit}
          icon={Truck}
        />
        <StatCard
          label={strings.reports.cancelledOrNotReceived}
          value={stats.cancelledCount + stats.notReceivedCount}
          color={T.loss}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.avgOrderValue}
          value={fmt(stats.averageOrderValue)}
          icon={DollarSign}
        />
        <StatCard
          label={strings.reports.successRate}
          value={`${stats.successRate}%`}
          color={T.profit}
          icon={Truck}
        />
        <StatCard
          label={strings.reports.cancellationRate}
          value={`${stats.cancellationRate}%`}
          color={T.warning}
          icon={AlertTriangle}
        />
        <StatCard
          label={strings.reports.notReceivedRate}
          value={`${stats.notReceivedRate}%`}
          color={T.loss}
          icon={AlertTriangle}
        />
      </div>

      <SectionCard
        title={strings.reports.customerDistributionByTrust}
        icon={Users}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-1">
          {(["vip", "regular", "warning", "high_risk"] as const).map((key) => (
            <div
              key={key}
              className="rounded-xl border border-border/40 bg-card/60 p-3 text-center"
            >
              <p className="text-[11px] text-muted-foreground mb-1">
                {TRUST_LEVEL_LABELS[key]}
              </p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {customerDistribution?.[key] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.topAreas}
          icon={Truck}
          badge={topAreas.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.region,
                    strings.common.count,
                    strings.common.revenue,
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
                {topAreas.length === 0 ? (
                  <EmptyRow cols={3} message={strings.reports.noData} />
                ) : (
                  topAreas.map((row, i) => (
                    <TableRow
                      key={`${row.area}-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3 max-w-[220px] truncate">
                        {row.area}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {row.count}
                      </TableCell>
                      <TableCell className="font-bold text-[13px] py-3 tabular-nums">
                        {fmt(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard
          title={strings.reports.driverSettlementTotals}
          icon={DollarSign}
        >
          <div className="grid grid-cols-2 gap-3 p-1">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[11px] text-muted-foreground mb-1">
                {strings.reports.owedToShopFromDrivers}
              </p>
              <p className="text-lg font-bold text-amber-600 tabular-nums">
                {fmt(driverSettlementTotals?.totalOwedToShop ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-[11px] text-muted-foreground mb-1">
                {strings.reports.owedToDriversFromShop}
              </p>
              <p className="text-lg font-bold text-rose-500 tabular-nums">
                {fmt(driverSettlementTotals?.totalOwedToDrivers ?? 0)}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.ordersByStatus}
          icon={Package}
          badge={statusBreakdown.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.status,
                    strings.common.count,
                    strings.common.revenue,
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
                {statusBreakdown.length === 0 ? (
                  <EmptyRow cols={3} message={strings.common.noOrders} />
                ) : (
                  statusBreakdown.map((row) => (
                    <TableRow
                      key={row.status}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {ORDER_STATUS_LABELS[row.status as OrderStatusValue] ??
                          row.status}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {row.count}
                      </TableCell>
                      <TableCell className="font-bold text-[13px] py-3 tabular-nums">
                        {fmt(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard
          title={strings.reports.ordersBySource}
          icon={Users}
          badge={sourceBreakdown.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.source,
                    strings.common.count,
                    strings.common.revenue,
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
                {sourceBreakdown.length === 0 ? (
                  <EmptyRow cols={3} message={strings.common.noOrders} />
                ) : (
                  sourceBreakdown.map((row) => (
                    <TableRow
                      key={row.source}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {ORDER_SOURCE_LABELS[row.source as OrderSourceValue] ??
                          row.source}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {row.count}
                      </TableCell>
                      <TableCell className="font-bold text-[13px] py-3 tabular-nums">
                        {fmt(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title={strings.reports.ordersByPaymentMethod}
        icon={DollarSign}
        badge={paymentMethodBreakdown.length}
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <Table>
            <TableHeader>
              <TableRow className="border-border/25 hover:bg-transparent">
                {[
                  strings.common.paymentMethod,
                  strings.common.count,
                  strings.common.revenue,
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
              {paymentMethodBreakdown.length === 0 ? (
                <EmptyRow cols={3} message={strings.common.noOrders} />
              ) : (
                paymentMethodBreakdown.map((row) => (
                  <TableRow
                    key={row.paymentMethod}
                    className="border-border/20 hover:bg-muted/25 transition-colors"
                  >
                    <TableCell className="font-semibold text-[12.5px] py-3">
                      {ORDER_PAYMENT_METHOD_LABELS[
                        row.paymentMethod as OrderPaymentMethodValue
                      ] ?? row.paymentMethod}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                      {row.count}
                    </TableCell>
                    <TableCell className="font-bold text-[13px] py-3 tabular-nums">
                      {fmt(row.revenue)}
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
          title={strings.reports.topCustomers}
          icon={Users}
          badge={topCustomers.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.customer,
                    strings.common.orders,
                    strings.common.total,
                    strings.common.classification,
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
                {topCustomers.length === 0 ? (
                  <EmptyRow cols={4} message={strings.common.noCustomers} />
                ) : (
                  topCustomers.map((c, i) => (
                    <TableRow
                      key={c.customerId ?? `guest-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {c.customerName}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {c.orderCount}
                      </TableCell>
                      <TableCell className="font-bold text-[13px] py-3 tabular-nums">
                        {fmt(c.totalSpent)}
                      </TableCell>
                      <TableCell className="py-3">
                        {c.trustLevel ? (
                          <Badge
                            variant="outline"
                            className={
                              TRUST_LEVEL_COLORS[
                                c.trustLevel as TrustLevelValue
                              ]
                            }
                          >
                            {
                              TRUST_LEVEL_LABELS[
                                c.trustLevel as TrustLevelValue
                              ]
                            }
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard
          title={strings.reports.driverPerformance}
          icon={Truck}
          badge={driverPerformance.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.driver,
                    strings.common.deliveries,
                    strings.common.revenue,
                    strings.common.balance,
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
                {driverPerformance.length === 0 ? (
                  <EmptyRow cols={4} message={strings.common.noDrivers} />
                ) : (
                  driverPerformance.map((d) => (
                    <TableRow
                      key={d.driverId}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {d.driverName}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {d.deliveries}
                      </TableCell>
                      <TableCell className="font-bold text-[13px] py-3 tabular-nums">
                        {fmt(d.revenue)}
                      </TableCell>
                      <TableCell
                        className={`font-bold text-[12px] py-3 tabular-nums ${
                          d.currentBalance > 0
                            ? T.warning
                            : d.currentBalance < 0
                              ? T.loss
                              : T.neutral
                        }`}
                      >
                        {fmt(Math.abs(d.currentBalance))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
