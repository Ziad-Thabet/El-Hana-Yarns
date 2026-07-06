import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  AlertTriangle,
  Boxes,
} from "lucide-react";
import type { InventoryReport } from "@/features/reports/types";
import { fmt } from "./reportFormatters";
import { T } from "./reportConstants";
import { StatCard } from "./StatCard";
import { SectionCard } from "./SectionCard";
import { EmptyRow } from "./EmptyRow";
import { strings } from "@/lib/i18n/ar";

export function InventoryReportView({ data }: { data: InventoryReport }) {
  const { products, lowStock, analytics } = data;
  const { totals, movement, overstockItems, health } = analytics;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={strings.reports.inventoryValueRetail}
          value={fmt(totals.inventoryValueRetail)}
          color={T.revenue}
          icon={Boxes}
          accent
        />
        <StatCard
          label={strings.reports.inventoryValueCost}
          value={
            totals.inventoryValueCost > 0 ? fmt(totals.inventoryValueCost) : "—"
          }
          color={totals.inventoryValueCost > 0 ? T.warning : T.neutral}
          icon={DollarSign}
          sub={
            totals.inventoryValueCost === 0 ? (
              <span className="text-[10.5px] text-muted-foreground/60">
                {strings.reports.noPurchaseInvoices}
              </span>
            ) : undefined
          }
        />
        <StatCard
          label={strings.reports.outOfStockProducts}
          value={totals.outOfStockCount}
          color={totals.outOfStockCount > 0 ? T.loss : T.neutral}
          icon={AlertTriangle}
          sub={
            <span className="text-[11px] text-muted-foreground">
              {strings.reports.catalogPercent.replace(
                "{percent}",
                health.outOfStockRate.toFixed(1),
              )}
            </span>
          }
        />
        <StatCard
          label={strings.reports.needsRestock}
          value={totals.lowStockCount}
          color={totals.lowStockCount > 0 ? T.warning : T.neutral}
          icon={Package}
          sub={
            <span className="text-[11px] text-muted-foreground">
              {strings.reports.catalogPercent.replace(
                "{percent}",
                health.lowStockRate.toFixed(1),
              )}
            </span>
          }
        />
      </div>
      {lowStock.length > 0 && (
        <Card className={`rounded-2xl overflow-hidden ${T.warningCard}`}>
          <CardHeader className="px-6 py-4 border-b border-[hsl(var(--accent))]/15">
            <div className="flex items-center justify-between">
              <CardTitle
                className={`flex items-center gap-2.5 text-sm font-bold ${T.warning}`}
              >
                <span className="w-7 h-7 rounded-xl bg-[hsl(var(--accent))]/10 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
                {strings.reports.lowStockProducts}
              </CardTitle>
              <Badge className="bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border-0 text-[11px] font-bold rounded-lg px-2.5">
                {lowStock.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 hover:bg-transparent">
                    {[
                      strings.common.product,
                      strings.common.category,
                      strings.common.stock,
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
                  {lowStock.slice(0, 20).map((p) => (
                    <TableRow
                      key={p.id}
                      className="border-border/15 hover:bg-muted/15 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {p.name}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3">
                        {p.category ?? "—"}
                      </TableCell>
                      <TableCell
                        className={`font-bold text-[13px] py-3 tabular-nums ${T.warning}`}
                      >
                        {p.stock}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.fastMoving90Days}
          icon={TrendingUp}
          badge={movement.fastMoving.length}
        >
          <div
            className="overflow-x-auto -mx-5 px-5"
            style={{ minHeight: 240 }}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.product,
                    strings.common.quantity,
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
                {movement.fastMoving.length === 0 ? (
                  <EmptyRow
                    cols={3}
                    message={strings.reports.noSalesInPeriod}
                  />
                ) : (
                  movement.fastMoving.map((p, i) => (
                    <TableRow
                      key={`fast-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell
                        className="font-semibold text-[12.5px] max-w-[160px] truncate py-3"
                        title={p.name}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell
                        className={`${T.revenue} font-bold text-[13px] py-3 tabular-nums`}
                      >
                        {p.quantity}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {fmt(p.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        <SectionCard
          title={strings.reports.slowMoving}
          icon={TrendingDown}
          badge={movement.slowMoving.length}
        >
          <div
            className="overflow-x-auto -mx-5 px-5"
            style={{ minHeight: 240 }}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.product,
                    strings.common.category,
                    strings.common.sales,
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
                {movement.slowMoving.length === 0 ? (
                  <EmptyRow cols={3} message={strings.reports.noSlowMoving} />
                ) : (
                  movement.slowMoving.map((p, i) => (
                    <TableRow
                      key={`slow-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell
                        className="font-semibold text-[12.5px] max-w-[160px] truncate py-3"
                        title={p.name}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3">
                        {p.category}
                      </TableCell>
                      <TableCell
                        className={`${T.loss} font-bold text-[13px] py-3 tabular-nums`}
                      >
                        {p.quantity}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
      {overstockItems.length > 0 && (
        <SectionCard
          title={strings.reports.overstockFrozenCapital}
          icon={Boxes}
          badge={overstockItems.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.product,
                    strings.common.category,
                    strings.common.stock,
                    strings.reports.inventoryCost,
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
                {overstockItems.map((p, i) => (
                  <TableRow
                    key={`over-${i}`}
                    className="border-border/20 hover:bg-muted/25 transition-colors"
                  >
                    <TableCell className="font-semibold text-[12.5px] py-3">
                      {p.name}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground py-3">
                      {p.category ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`${T.revenue} font-bold text-[13px] py-3 tabular-nums`}
                    >
                      {p.stock}
                    </TableCell>
                    <TableCell
                      className={`text-[12px] font-bold py-3 tabular-nums ${T.warning}`}
                    >
                      {p.estimatedCost > 0 ? (
                        fmt(p.estimatedCost)
                      ) : (
                        <span className="text-muted-foreground/40 font-normal">
                          —
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
      <SectionCard
        title={strings.reports.allProducts}
        icon={Package}
        badge={products.length}
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <Table>
            <TableHeader>
              <TableRow className="border-border/25 hover:bg-transparent">
                {[
                  strings.common.product,
                  strings.common.category,
                  strings.common.price,
                  strings.common.stock,
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
              {products.length === 0 ? (
                <EmptyRow cols={4} />
              ) : (
                products.map((p) => (
                  <TableRow
                    key={p.id}
                    className="border-border/20 hover:bg-muted/25 transition-colors"
                  >
                    <TableCell className="font-semibold text-[12.5px] py-3">
                      {p.name}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground py-3">
                      {p.category ?? "—"}
                    </TableCell>
                    <TableCell className="text-[12px] py-3 tabular-nums">
                      {fmt(p.price)}
                    </TableCell>
                    <TableCell
                      className={`font-bold text-[13px] py-3 tabular-nums ${p.stock <= 0 ? T.loss : p.stock < 10 ? T.warning : T.profit}`}
                    >
                      {p.stock}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
