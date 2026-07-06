import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";
import { surfaces } from "@/lib/theme/styles";
import { PremiumButton } from "@/components/ui/premium";
import type { Employee } from "@/features/employees/types";
import { useEmployees, useSetEmployeeActive } from "@/features/employees/hooks";
import { QK } from "@/lib/queryKeys";
import { PageHeading } from "./PageHeading";
import { EmployeeListTab } from "./EmployeeListTab";
import { SalarySummaryTab } from "./SalarySummaryTab";
import { AddEmployeeDialog } from "./AddEmployeeDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { SetSalaryDialog } from "./SetSalaryDialog";

export default function EmployeeManagement() {
  const qc = useQueryClient();
  const setActiveMutation = useSetEmployeeActive();
  const [tab, setTab] = useState<"list" | "salary">("list");
  const {
    data: employees = [],
    isLoading: loading,
    refetch: fetchEmployees,
  } = useEmployees();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Employee | null>(null);
  const [salaryTarget, setSalaryTarget] = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(
    null,
  );
  const invalidateSalaryHistory = (empId: string) => {
    qc.invalidateQueries({ queryKey: QK.salaryHistory(empId) });
  };
  const handleSetActive = async (emp: Employee, isActive: boolean) => {
    await setActiveMutation.mutateAsync({ userId: emp.id, isActive });
  };
  return (
    <div className={surfaces.content}>
      <PageHeading
        eyebrow={strings.employeesExtra.teamManagement}
        title={strings.employees.title}
        action={
          tab === "list" ? (
            <PremiumButton
              onClick={() => setShowAddDialog(true)}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {strings.employees.addEmployee}
            </PremiumButton>
          ) : undefined
        }
      />
      <div className="mb-7 inline-flex gap-1 rounded-[var(--radius-md)] border border-border bg-muted/40 p-1">
        {(
          [
            { id: "list", label: strings.employees.title },
            { id: "salary", label: strings.employees.salarySummary },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-[var(--radius-sm)] px-5 py-2 text-sm font-semibold transition-all duration-200",
              tab === t.id
                ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "list" && (
        <EmployeeListTab
          employees={employees}
          loading={loading}
          onSetSalary={setSalaryTarget}
          onChangePassword={setPasswordTarget}
          onEdit={setEditTarget}
          onDeactivate={setDeactivateTarget}
          onActivate={(emp) => handleSetActive(emp, true)}
        />
      )}
      {tab === "salary" && <SalarySummaryTab employees={employees} />}
      <AddEmployeeDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={fetchEmployees}
      />
      {editTarget && (
        <EditEmployeeDialog
          employee={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={fetchEmployees}
        />
      )}
      {passwordTarget && (
        <ChangePasswordDialog
          employee={passwordTarget}
          onClose={() => setPasswordTarget(null)}
        />
      )}
      {salaryTarget && (
        <SetSalaryDialog
          employee={salaryTarget}
          onClose={() => setSalaryTarget(null)}
          onSaved={() => {
            invalidateSalaryHistory(salaryTarget.id);
            fetchEmployees();
          }}
        />
      )}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => {
          if (!o) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {strings.employees.confirmDeactivate}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {strings.employees.confirmDeactivateDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeactivateTarget(null)}>
              {strings.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deactivateTarget) {
                  await handleSetActive(deactivateTarget, false);
                  setDeactivateTarget(null);
                }
              }}
            >
              {strings.employees.deactivate}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
