import { useState } from "react";
import { Plus, Layers, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/i18n/ar";
import { cards } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
} from "@/features/expenses/hooks";
import type { ExpenseCategory } from "@/features/expenses/types";

interface CategoryManagerPanelProps {
  categories: ExpenseCategory[];
}

export function CategoryManagerPanel({
  categories,
}: CategoryManagerPanelProps) {
  const createCategory = useCreateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");

  const handleAddCat = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    setCatError("");
    try {
      await createCategory.mutateAsync(newCatName.trim());
      setNewCatName("");
    } catch (e) {
      setCatError(e instanceof Error ? e.message : strings.common.genericError);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async (id: string) => {
    setCatError("");
    try {
      await deleteCategory.mutateAsync(id);
    } catch (e) {
      setCatError(
        e instanceof Error ? e.message : strings.expenses.categoryHasExpenses,
      );
    }
  };

  return (
    <Card className={cn(cards.inset, "animate-fade-in p-5")}>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Layers className="h-4 w-4 text-accent" />
        <span>{strings.expensesExtra.manageCategories}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <Badge
            key={c.id}
            variant="secondary"
            className="gap-1.5 rounded-full border border-border bg-background py-1.5 pe-1 ps-3 text-sm font-medium shadow-sm"
          >
            {c.name}
            {!c.is_default && (
              <button
                onClick={() => handleDeleteCat(c.id)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title={strings.expenses.deleteCategory}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder={strings.expenses.addCategory}
          className="h-9 max-w-xs bg-background"
          onKeyDown={(e) => e.key === "Enter" && handleAddCat()}
        />
        <Button
          size="sm"
          onClick={handleAddCat}
          disabled={catSaving || !newCatName.trim()}
          className="h-9 gap-1.5 rounded-[var(--radius-md)]"
        >
          {catSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {strings.common.add}
        </Button>
      </div>
      {catError && (
        <p className="mt-2 text-xs font-medium text-destructive">{catError}</p>
      )}
    </Card>
  );
}
