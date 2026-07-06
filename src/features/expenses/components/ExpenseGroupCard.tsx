import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/i18n/ar";
import { cards, typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import type { Expense } from "@/features/expenses/types";
import { fmt, fmtDateShort } from "./expensesHelpers";

interface ExpenseGroupCardProps {
  catName: string;
  items: Expense[];
  total: number;
  onDeleteItem: (id: string) => void;
}

export function ExpenseGroupCard({
  catName,
  items,
  total,
  onDeleteItem,
}: ExpenseGroupCardProps) {
  return (
    <Card
      className={cn(
        cards.base,
        "overflow-hidden transition-shadow duration-200",
      )}
    >
      <div className="flex items-center justify-between bg-muted/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-display font-semibold text-foreground">
            {catName}
          </span>
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {items.length}
          </span>
        </div>
        <span className="font-semibold tabular-nums text-destructive">
          -{fmt(total)} {strings.common.currencyEgp}
        </span>
      </div>
      <div className="divide-y divide-dashed divide-border">
        {items.map((ex) => (
          <div
            key={ex.id}
            className="group flex items-center justify-between px-5 py-3 transition-colors duration-150 hover:bg-accent/[0.04]"
          >
            <div className="flex flex-col gap-0.5">
              <span className={typography.caption}>
                {fmtDateShort(ex.date)}
              </span>
              {ex.description && (
                <span className="text-sm text-foreground">
                  {ex.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {fmt(ex.amount)} {strings.common.currencyEgp}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                onClick={() => onDeleteItem(ex.id)}
                title={strings.expenses.deleteExpense}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
