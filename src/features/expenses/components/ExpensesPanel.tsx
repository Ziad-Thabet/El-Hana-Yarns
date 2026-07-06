import { useState } from "react";
import { Plus, Tag, ReceiptText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
import {
  expensePresetToDateRange,
  type ExpensePeriodPreset,
} from "@/lib/constants/expenses";
import type { Expense } from "@/features/expenses/types";
import {
  useExpenseCategories,
  useExpensesList,
} from "@/features/expenses/hooks";
import { layout } from "@/lib/theme/styles";
import { fmt } from "./expensesHelpers";
import { PeriodBar } from "./PeriodBar";
import { AddExpenseForm } from "./AddExpenseForm";
import { CategoryManagerPanel } from "./CategoryManagerPanel";
import { ExpenseGroupCard } from "./ExpenseGroupCard";
import { DeleteExpenseConfirmDialog } from "./DeleteExpenseConfirmDialog";

export function ExpensesPanel() {
  const [preset, setPreset] = useState<ExpensePeriodPreset>("this_month");
  const [from, setFrom] = useState(
    () => expensePresetToDateRange("this_month").from,
  );
  const [to, setTo] = useState(() => expensePresetToDateRange("this_month").to);
  const { data: expenses = [], isLoading: loading } = useExpensesList(from, to);
  const { data: categories = [] } = useExpenseCategories();
  const [showForm, setShowForm] = useState(false);
  const [showCatPanel, setShowCatPanel] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const grouped = expenses.reduce<
    Record<string, { catName: string; items: Expense[]; total: number }>
  >((acc, ex) => {
    const key = ex.categoryId;
    if (!acc[key])
      acc[key] = { catName: ex.categoryName ?? "—", items: [], total: 0 };
    acc[key].items.push(ex);
    acc[key].total += ex.amount;
    return acc;
  }, {});
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className={layout.section}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodBar
          preset={preset}
          setPreset={setPreset}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCatPanel((v) => !v)}
            className="h-10 gap-2 rounded-[var(--radius-md)] transition-all duration-200"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">
              {strings.expensesExtra.categories}
            </span>
          </Button>
          <PremiumButton
            onClick={() => setShowForm((v) => !v)}
            className="h-10 gap-2"
          >
            <Plus className="h-4 w-4" />
            {strings.expenses.addExpense}
          </PremiumButton>
        </div>
      </div>
      {showCatPanel && <CategoryManagerPanel categories={categories} />}
      {showForm && (
        <AddExpenseForm
          categories={categories}
          onCancel={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
      {expenses.length > 0 && (
        <div className="relative flex items-center justify-between overflow-hidden rounded-[var(--radius-lg)] border border-dashed border-accent/40 bg-gradient-to-l from-destructive/[0.06] via-transparent to-transparent px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-sm font-medium text-muted-foreground">
              {strings.expensesExtra.periodTotal}
            </span>
          </div>
          <span className="font-display text-xl font-bold tabular-nums text-destructive">
            -{fmt(grandTotal)} {strings.common.currencyEgp}
          </span>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {strings.common.loading}
          </span>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border py-16 text-center">
          <ReceiptText className="mb-1 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium text-foreground">
            {strings.expenses.noExpenses}
          </p>
          <p className="text-sm text-muted-foreground">
            {strings.expensesExtra.startFirstExpense}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([catId, group]) => (
            <ExpenseGroupCard
              key={catId}
              catName={group.catName}
              items={group.items}
              total={group.total}
              onDeleteItem={setDeleteId}
            />
          ))}
        </div>
      )}
      <DeleteExpenseConfirmDialog
        expenseId={deleteId}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
