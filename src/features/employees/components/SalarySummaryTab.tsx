import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";
import { cards, typography, tables } from "@/lib/theme/styles";
import { PremiumButton } from "@/components/ui/premium";
import type { Employee } from "@/features/employees/types";
import { useSalarySummary } from "@/features/employees/hooks";
import {
  formatHours,
  getSalaryPeriodPresets,
  presetToDateRange,
  type SalaryPeriodPreset,
} from "@/lib/constants/employees";
import { fmtCurrency, today, monthStart } from "./employeeHelpers";

export function SalarySummaryTab({ employees }: { employees: Employee[] }) {
  const [summaryEmployee, setSummaryEmployee] = useState<string>("");
  const [summaryFrom, setSummaryFrom] = useState(monthStart());
  const [summaryTo, setSummaryTo] = useState(today());
  const [summaryPreset, setSummaryPreset] = useState<SalaryPeriodPreset | "">(
    "",
  );
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryHasError,
    refetch: refetchSummary,
  } = useSalarySummary(summaryEmployee, summaryFrom, summaryTo, false);
  const summaryError = summaryHasError
    ? strings.employeesExtra.summaryLoadError
    : "";

  const fetchSummary = () => {
    if (!summaryEmployee) return;
    refetchSummary();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className={cn(cards.elevated, "space-y-4 p-6")}>
        <div className="flex flex-wrap gap-2 pb-2">
          {getSalaryPeriodPresets().map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setSummaryPreset(p.value);
                const range = presetToDateRange(p.value);
                setSummaryFrom(range.from);
                setSummaryTo(range.to);
              }}
              className={cn(
                "rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-all duration-200",
                summaryPreset === p.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className={typography.caption}>
              {strings.employees.displayName}
            </Label>
            <Select value={summaryEmployee} onValueChange={setSummaryEmployee}>
              <SelectTrigger>
                <SelectValue
                  placeholder={strings.employeesExtra.selectEmployee}
                />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => e.role === "staff")
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className={typography.caption}>
              {strings.employees.from}
            </Label>
            <Input
              type="date"
              value={summaryFrom}
              onChange={(e) => {
                setSummaryFrom(e.target.value);
                setSummaryPreset("");
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={typography.caption}>{strings.employees.to}</Label>
            <Input
              type="date"
              value={summaryTo}
              onChange={(e) => {
                setSummaryTo(e.target.value);
                setSummaryPreset("");
              }}
            />
          </div>
        </div>
        <PremiumButton
          onClick={fetchSummary}
          disabled={!summaryEmployee || summaryLoading}
          className="gap-2"
        >
          {summaryLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {strings.employees.salarySummary}
        </PremiumButton>
      </div>
      {summaryError && (
        <p className="text-sm text-destructive">{summaryError}</p>
      )}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              {
                label: strings.employees.totalHours,
                value: formatHours(summary.totalHours),
              },
              {
                label: strings.employees.totalEarned,
                value: fmtCurrency(summary.totalEarned),
              },
              {
                label: strings.employees.salaryType,
                value:
                  summary.salaryType === "monthly"
                    ? strings.employees.salaryMonthly
                    : strings.employees.salaryWeekly,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={cn(cards.elevated, "space-y-1 p-5 text-center")}
              >
                <p className={typography.stat}>{kpi.value}</p>
                <p
                  className={cn(typography.caption, "uppercase tracking-wider")}
                >
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>
          {summary.shifts.length > 0 && (
            <div className={tables.wrapper}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn(tables.head, "text-start")}>
                    <th className="px-4 py-3.5 font-semibold">
                      {strings.employeesExtra.dateColumn}
                    </th>
                    <th className="px-4 py-3.5 font-semibold">
                      {strings.employees.totalHours}
                    </th>
                    <th className="px-4 py-3.5 font-semibold">
                      {strings.employees.currentSalary}
                    </th>
                    <th className="px-4 py-3.5 font-semibold">
                      {strings.employees.totalEarned}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.shifts.map((s) => (
                    <tr
                      key={s.shiftId}
                      className={cn(tables.row, "text-start")}
                    >
                      <td className={cn(tables.cell, "text-muted-foreground")}>
                        {s.date}
                      </td>
                      <td className={cn(tables.cell, "tabular-nums")}>
                        {formatHours(s.hours)}
                      </td>
                      <td className={cn(tables.cell, "tabular-nums")}>
                        {fmtCurrency(s.salary)}
                      </td>
                      <td
                        className={cn(
                          tables.cell,
                          "font-semibold tabular-nums text-primary",
                        )}
                      >
                        {fmtCurrency(s.earned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
