import { useState } from "react";
import { TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { strings } from "@/lib/i18n/ar";
import {
  expensePresetToDateRange,
  type ExpensePeriodPreset,
} from "@/lib/constants/expenses";
import { useNetSummary } from "@/features/expenses/hooks";
import { cards, layout } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { fmt } from "./expensesHelpers";
import { PeriodBar } from "./PeriodBar";

export function NetPanel() {
  const [preset, setPreset] = useState<ExpensePeriodPreset>("this_month");
  const [from, setFrom] = useState(
    () => expensePresetToDateRange("this_month").from,
  );
  const [to, setTo] = useState(() => expensePresetToDateRange("this_month").to);
  const { data: summary, isLoading: loading } = useNetSummary(from, to);
  const isPositive = (summary?.net ?? 0) >= 0;
  const breakdownRows = summary
    ? [
        {
          key: "purchases",
          label: strings.expenses.purchasesPaid,
          value: summary.purchasesPaid,
        },
        {
          key: "salaries",
          label: strings.expenses.salaries,
          value: summary.salaries,
        },
        ...summary.expenses.map((line, i) => ({
          key: `cat_${i}`,
          label: line.category,
          value: line.total,
        })),
      ]
    : [];
  const maxOutflow = Math.max(1, ...breakdownRows.map((r) => r.value));

  return (
    <div className={layout.section}>
      <PeriodBar
        preset={preset}
        setPreset={setPreset}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
      />
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {strings.common.loading}
          </span>
        </div>
      ) : !summary ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border py-16 text-center">
          <TrendingDown className="mb-1 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium text-foreground">
            {strings.expensesExtra.noDataAvailable}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <Card
            className={cn(
              cards.elevated,
              "relative overflow-hidden lg:col-span-3",
            )}
          >
            <div className="h-1 w-full bg-gradient-to-l from-accent via-accent/40 to-transparent" />
            <div className="space-y-0.5 px-6 pb-1 pt-5">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                {strings.expensesExtra.periodSummary}
              </span>
              <h3 className="font-display text-base font-semibold text-foreground">
                {strings.expenses.netProfitTitle}
              </h3>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2.5 text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm">{strings.expenses.revenue}</span>
              </div>
              <span className="text-base font-semibold tabular-nums text-primary">
                +{fmt(summary.revenue)} {strings.common.currencyEgp}
              </span>
            </div>
            <div className="mx-6 border-t border-dashed border-border" />
            <div className="divide-y divide-dashed divide-border/70 px-6">
              {breakdownRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-2.5 text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="text-sm">{row.label}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-destructive">
                    -{fmt(row.value)} {strings.common.currencyEgp}
                  </span>
                </div>
              ))}
            </div>
            <div className="mx-6 border-t border-dashed border-border" />
            <div
              className={cn(
                "flex items-center justify-between px-6 py-5",
                isPositive ? "bg-primary/[0.06]" : "bg-destructive/[0.06]",
              )}
            >
              <div className="flex items-center gap-2.5 font-semibold text-foreground">
                {isPositive ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">
                  {strings.expensesExtra.netAfterExpenses}
                </span>
              </div>
              <span
                className={cn(
                  "font-display text-2xl font-bold tabular-nums",
                  isPositive ? "text-primary" : "text-destructive",
                )}
              >
                {isPositive ? "+" : ""}
                {fmt(summary.net)} {strings.common.currencyEgp}
              </span>
            </div>
          </Card>
          <Card className={cn(cards.base, "h-fit p-5 lg:col-span-2")}>
            <p className="mb-4 text-sm font-semibold text-foreground">
              {strings.expensesExtra.expenseDistribution}
            </p>
            <div className="space-y-3.5">
              {breakdownRows.map((row) => (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {fmt(row.value)} {strings.common.currencyEgp}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{
                        width: `${Math.max(2, (row.value / maxOutflow) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {breakdownRows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {strings.expensesExtra.noExpensesForPeriod}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
