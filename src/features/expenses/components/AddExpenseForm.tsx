import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
import { cards, typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { useAddExpense } from "@/features/expenses/hooks";
import type { ExpenseCategory } from "@/features/expenses/types";
import { today } from "./expensesHelpers";

interface AddExpenseFormProps {
  categories: ExpenseCategory[];
  onCancel: () => void;
  onSuccess: () => void;
}

export function AddExpenseForm({
  categories,
  onCancel,
  onSuccess,
}: AddExpenseFormProps) {
  const addExpense = useAddExpense();

  const [formCatId, setFormCatId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(today());
  const [formDesc, setFormDesc] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!formCatId && categories.length > 0) setFormCatId(categories[0].id);
  }, [categories, formCatId]);

  const handleAdd = async () => {
    setFormError("");
    if (!formCatId) return setFormError(strings.common.selectCategory);
    if (!formAmount || isNaN(+formAmount) || +formAmount <= 0)
      return setFormError(strings.common.enterValidAmount);
    if (!formDate) return setFormError(strings.common.selectDate);
    setFormSaving(true);
    try {
      await addExpense.mutateAsync({
        categoryId: formCatId,
        amount: parseFloat(formAmount),
        date: formDate,
        description: formDesc || undefined,
      });
      setFormAmount("");
      setFormDesc("");
      setFormDate(today());
      onSuccess();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : strings.common.genericError,
      );
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <Card className={cn(cards.elevated, "animate-fade-in overflow-hidden")}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3.5">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="font-display text-sm font-semibold text-foreground">
          {strings.expenses.addExpense}
        </span>
      </div>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className={typography.caption}>
              {strings.expenses.category}
            </Label>
            <Select value={formCatId} onValueChange={setFormCatId}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className={typography.caption}>
              {strings.expenses.amount}
            </Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="bg-background ps-10 font-semibold tabular-nums"
              />
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                {strings.common.currencyEgp}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={typography.caption}>
              {strings.expenses.date}
            </Label>
            <Input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className={typography.caption}>
              {strings.expenses.description}
            </Label>
            <Input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder={strings.expenses.descriptionPlaceholder}
              className="bg-background"
            />
          </div>
        </div>
        {formError && (
          <p className="text-sm font-medium text-destructive">{formError}</p>
        )}
        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              onCancel();
              setFormError("");
            }}
            className="sm:w-28"
          >
            {strings.common.cancel}
          </Button>
          <PremiumButton
            onClick={handleAdd}
            disabled={formSaving}
            className="sm:w-36"
          >
            {formSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {strings.common.save}
          </PremiumButton>
        </div>
      </CardContent>
    </Card>
  );
}
