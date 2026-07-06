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
import { useSetSalary } from "@/features/employees/hooks";
import { Field } from "./Field";
import { today } from "./employeeHelpers";

export function SetSalaryDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const setSalary = useSetSalary();
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setError("");
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError(strings.employeesExtra.enterValidAmount);
      return;
    }
    setLoading(true);
    try {
      await setSalary.mutateAsync({
        userId: employee.id,
        amount: parsed,
        effectiveFrom,
        notes: notes || undefined,
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
          <DialogTitle>
            {strings.employees.setSalary} — {employee.displayName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label={strings.employees.currentSalary} required>
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={strings.employeesExtra.egyptianPoundPlaceholder}
            />
          </Field>
          <Field label={strings.employees.effectiveFrom}>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
          <Field label={strings.employees.notes}>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={strings.common.optional}
            />
          </Field>
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
