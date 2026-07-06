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
import { useCreateEmployee } from "@/features/employees/hooks";
import { Field } from "./Field";

export function AddEmployeeDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const createEmployee = useCreateEmployee();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    password: "",
    role: "staff" as "staff" | "admin",
    salaryType: "monthly" as "monthly" | "weekly",
    dailyHours: "8",
    salary: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const reset = () => {
    setForm({
      displayName: "",
      username: "",
      password: "",
      role: "staff",
      salaryType: "monthly",
      dailyHours: "8",
      salary: "",
    });
    setError("");
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSubmit = async () => {
    setError("");
    if (
      !form.displayName.trim() ||
      !form.username.trim() ||
      !form.password.trim()
    ) {
      setError(strings.common.required);
      return;
    }
    if (form.username.trim().length < 3) {
      setError(strings.employees.usernameMinLength);
      return;
    }
    if (form.password.length < 8) {
      setError(strings.employees.passwordMinLength);
      return;
    }
    setLoading(true);
    try {
      await createEmployee.mutateAsync({
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        salaryType: form.salaryType,
        dailyHours: parseFloat(form.dailyHours) || 8,
        salary: form.salary ? parseFloat(form.salary) : undefined,
      });
      onCreated();
      handleClose();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("username_already_exists"))
        setError(strings.employees.usernameExists);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{strings.employees.addEmployee}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label={strings.employees.displayName} required>
            <Input
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              placeholder={strings.employeesExtra.fullNamePlaceholder}
            />
          </Field>
          <Field label={strings.employees.username} required>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={strings.employeesExtra.usernamePlaceholder}
              dir="ltr"
            />
          </Field>
          <Field label={strings.employees.password} required>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={strings.employeesExtra.passwordMinPlaceholder}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={strings.employees.role}>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as "staff" | "admin" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">
                    {strings.employees.roleStaff}
                  </SelectItem>
                  <SelectItem value="admin">
                    {strings.employees.roleAdmin}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label={strings.employees.currentSalary}>
              <Input
                type="number"
                min="0"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder={strings.common.optional}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
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
