import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserX,
  UserCheck,
  KeyRound,
  Wallet,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";
import { tables, layout } from "@/lib/theme/styles";
import type { Employee } from "@/features/employees/types";
import { useSalaryHistory } from "@/features/employees/hooks";
import { fmtCurrency } from "./employeeHelpers";
import { StatusBadge } from "./StatusBadge";
import { RoleBadge } from "./RoleBadge";

export function EmployeeListTab({
  employees,
  loading,
  onSetSalary,
  onChangePassword,
  onEdit,
  onDeactivate,
  onActivate,
}: {
  employees: Employee[];
  loading: boolean;
  onSetSalary: (emp: Employee) => void;
  onChangePassword: (emp: Employee) => void;
  onEdit: (emp: Employee) => void;
  onDeactivate: (emp: Employee) => void;
  onActivate: (emp: Employee) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const { data: salaryHistoryData, isLoading: salaryHistoryLoading } =
    useSalaryHistory(expandedHistory);

  const filtered = employees.filter(
    (e) => e.displayName.includes(search) || e.username.includes(search),
  );

  const toggleHistory = (empId: string) => {
    setExpandedHistory((prev) => (prev === empId ? null : empId));
  };

  return (
    <div className={layout.section}>
      <div className="relative max-w-xs">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={strings.employees.search}
          className="ps-9"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={tables.empty}>
          <UserX className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
          <p>{strings.employees.noEmployees}</p>
        </div>
      ) : (
        <div className={tables.wrapper}>
          <table className="w-full text-sm">
            <thead>
              <tr className={cn(tables.head, "text-start")}>
                <th className="px-4 py-3.5 font-semibold">
                  {strings.employees.displayName}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {strings.employees.username}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {strings.employees.role}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {strings.employees.currentSalary}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {strings.employees.isActive}
                </th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <Fragment key={emp.id}>
                  <tr className={tables.row}>
                    <td className={cn(tables.cell, "font-semibold")}>
                      {emp.displayName}
                    </td>
                    <td className={cn(tables.cellMuted, "font-mono text-xs")}>
                      {emp.username}
                    </td>
                    <td className={tables.cell}>
                      <RoleBadge role={emp.role} />
                    </td>
                    <td className={cn(tables.cell, "tabular-nums")}>
                      {emp.currentSalary != null ? (
                        fmtCurrency(emp.currentSalary)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={tables.cell}>
                      <StatusBadge isActive={emp.isActive} />
                    </td>
                    <td className={tables.cell}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={strings.employees.salaryHistory}
                          onClick={() => toggleHistory(emp.id)}
                        >
                          {expandedHistory === emp.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:bg-accent/15 hover:text-accent-foreground"
                          title={strings.employees.setSalary}
                          onClick={() => onSetSalary(emp)}
                        >
                          <Wallet className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title={strings.employees.changePassword}
                          onClick={() => onChangePassword(emp)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(emp)}
                        >
                          {strings.common.edit}
                        </Button>
                        {emp.isActive ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title={strings.employees.deactivate}
                            onClick={() => onDeactivate(emp)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title={strings.employees.activate}
                            onClick={() => onActivate(emp)}
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedHistory === emp.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-6 py-4">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
                          {strings.employees.salaryHistory}
                        </p>
                        {salaryHistoryLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : !salaryHistoryData ||
                          salaryHistoryData.length === 0 ? (
                          <p className="text-xs text-muted-foreground">—</p>
                        ) : (
                          <div className="space-y-1">
                            {salaryHistoryData.map((h) => (
                              <div
                                key={h.id}
                                className="flex items-center gap-4 text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {h.effectiveFrom}
                                </span>
                                <span className="font-semibold tabular-nums text-primary">
                                  {fmtCurrency(h.amount)}
                                </span>
                                {h.notes && (
                                  <span className="text-muted-foreground">
                                    {h.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
