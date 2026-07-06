import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { strings } from "@/lib/i18n/ar";
import { useDeleteExpense } from "@/features/expenses/hooks";

interface DeleteExpenseConfirmDialogProps {
  expenseId: string | null;
  onClose: () => void;
}

export function DeleteExpenseConfirmDialog({
  expenseId,
  onClose,
}: DeleteExpenseConfirmDialogProps) {
  const deleteExpense = useDeleteExpense();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!expenseId) return;
    setDeleting(true);
    try {
      await deleteExpense.mutateAsync(expenseId);
      onClose();
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!expenseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle className="text-center">
            {strings.expenses.confirmDelete}
          </DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">
          {strings.expenses.confirmDeleteDesc}
        </p>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={onClose} className="sm:w-28">
            {strings.common.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            className="sm:w-28"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {strings.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
