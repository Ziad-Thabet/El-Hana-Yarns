import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type { DebtsReport } from "@/features/reports/types";
import { fmt } from "./reportFormatters";
import { T } from "./reportConstants";
import { StatCard } from "./StatCard";
import { SectionCard } from "./SectionCard";
import { EmptyRow } from "./EmptyRow";
import { strings } from "@/lib/i18n/ar";

export function DebtsReportView({ data }: { data: DebtsReport }) {
  const { debts, totalRemaining, analytics } = data;
  const { customerSummary, segments, topDebtors } = analytics;
  const segmentConfig = [
    {
      label: strings.reports.customerSegmentHighValueLabel,
      items: segments.highValue,
      cls: T.highValue,
      bg: T.highValCard,
      Icon: TrendingUp,
    },
    {
      label: strings.reports.segmentAtRiskShort,
      items: segments.atRisk,
      cls: T.loss,
      bg: T.dangerCard,
      Icon: AlertTriangle,
    },
    {
      label: strings.reports.segmentRegularShort,
      items: segments.regular,
      cls: T.profit,
      bg: T.successCard,
      Icon: Activity,
    },
    {
      label: strings.reports.segmentInactiveShort,
      items: segments.inactive,
      cls: T.neutral,
      bg: T.neutralCard,
      Icon: Users,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={strings.reports.totalRemainingDebt}
          value={fmt(totalRemaining)}
          color={totalRemaining > 0 ? T.loss : T.profit}
          icon={DollarSign}
          accent
        />
        <StatCard
          label={strings.reports.debtCountTotal}
          value={debts.length}
          icon={FileText}
        />
        <StatCard
          label={strings.reports.debtorCustomers}
          value={customerSummary.filter((c) => c.remainingAmount > 0).length}
          icon={Users}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {segmentConfig.map((seg) => (
          <div
            key={seg.label}
            className={`rounded-2xl border px-5 py-4 ${seg.bg}`}
          >
            <div className="flex items-center gap-2 mb-4">
              <seg.Icon className={`w-4 h-4 ${seg.cls}`} />
              <p className={`text-[11.5px] font-bold ${seg.cls}`}>
                {seg.label}
              </p>
            </div>
            <p className="text-[2rem] font-bold text-foreground leading-none tabular-nums">
              {seg.items.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
              {strings.common.customerUnit}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={strings.reports.topDebtors}
          icon={AlertTriangle}
          badge={topDebtors.length}
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/25 hover:bg-transparent">
                  {[
                    strings.common.customer,
                    strings.reports.totalDebtAmount,
                    strings.common.remaining,
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
                {topDebtors.length === 0 ? (
                  <EmptyRow cols={3} message={strings.common.noDebts} />
                ) : (
                  topDebtors.map((d, i) => (
                    <TableRow
                      key={`top-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {d.customerName}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground py-3 tabular-nums">
                        {fmt(d.totalAmount)}
                      </TableCell>
                      <TableCell
                        className={`${T.loss} font-bold text-[13px] py-3 tabular-nums`}
                      >
                        {fmt(d.remainingAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        <SectionCard
          title={strings.reports.debtSummary}
          icon={DollarSign}
          badge={customerSummary.length}
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
                {customerSummary.length === 0 ? (
                  <EmptyRow cols={3} message={strings.common.noDebts} />
                ) : (
                  customerSummary.slice(0, 10).map((c, i) => (
                    <TableRow
                      key={`sum-${i}`}
                      className="border-border/20 hover:bg-muted/25 transition-colors"
                    >
                      <TableCell className="font-semibold text-[12.5px] py-3">
                        {c.customerName}
                      </TableCell>
                      <TableCell
                        className={`font-bold text-[12px] py-3 tabular-nums ${c.remainingAmount > 0 ? T.loss : T.neutral}`}
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
      </div>
    </div>
  );
}
