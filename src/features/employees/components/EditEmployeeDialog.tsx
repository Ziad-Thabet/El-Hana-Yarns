import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { strings } from "@/lib/i18n/ar";
import { PremiumButton } from "@/components/ui/premium";
import type { Employee } from "@/features/employees/types";
import { useUpdateEmployee } from "@/features/employees/hooks";
import { Field } from "./Field";

export function EditEmployeeDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateEmployee = useUpdateEmployee();
  const [form, setForm] = useState({
    displayName: employee.displayName,
    salaryType: employee.salaryType,
    dailyHours: String(employee.dailyHours),
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setError("");
    if (!form.displayName.trim()) {
      setError(strings.common.required);
      return;
    }
    setLoading(true);
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: {
          displayName: form.displayName.trim(),
          salaryType: form.salaryType,
          dailyHours: parseFloat(form.dailyHours) || 8,
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{strings.employees.editEmployee}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label={strings.employees.displayName} required>
            <Input
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={strings.employees.salaryType}>
              <Select
                value={form.salaryType}
                onValueChange={(v) =>
                  setForm({ ...form, salaryType: v as "monthly" | "weekly" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">
                    {strings.employees.salaryMonthly}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {strings.employees.salaryWeekly}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={strings.employees.dailyHours}>
              <Input
                type="number"
                min="1"
                max="24"
                value={form.dailyHours}
                onChange={(e) =>
                  setForm({ ...form, dailyHours: e.target.value })
                }
              />
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {strings.common.cancel}
          </Button>
          <PremiumButton onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {strings.common.save}
          </PremiumButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
