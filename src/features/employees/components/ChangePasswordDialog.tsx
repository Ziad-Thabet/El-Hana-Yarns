import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useChangeEmployeePassword } from "@/features/employees/hooks";
import { Field } from "./Field";

export function ChangePasswordDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const changePassword = useChangeEmployeePassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const handleSubmit = async () => {
    setError("");
    if (password.length < 8) {
      setError(strings.employees.passwordMinLength);
      return;
    }
    if (password !== confirm) {
      setError(strings.employeesExtra.passwordsMismatch);
      return;
    }
    setLoading(true);
    try {
      await changePassword.mutateAsync({ userId: employee.id, password });
      setDone(true);
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
          <DialogTitle>
            {strings.employees.changePassword} — {employee.displayName}
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="py-6 text-center">
            <p className="font-medium text-primary">
              {strings.common.success} ✓
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Field label={strings.employees.password} required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={strings.employeesExtra.passwordMinPlaceholder}
              />
            </Field>
            <Field label={strings.employeesExtra.confirmPassword} required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={strings.employeesExtra.confirmPasswordPlaceholder}
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {strings.common.cancel}
          </Button>
          {!done && (
            <PremiumButton onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {strings.common.save}
            </PremiumButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
