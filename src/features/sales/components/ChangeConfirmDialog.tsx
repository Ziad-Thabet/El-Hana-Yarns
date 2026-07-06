import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Money } from "@/lib/domain";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";

interface ChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changeDue: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export const ChangeConfirmDialog = ({
  open,
  onOpenChange,
  changeDue,
  isProcessing,
  onConfirm,
}: ChangeConfirmDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{strings.salesInvoices.confirmChangeTitle}</DialogTitle>
        </DialogHeader>
        <div className="bg-secondary rounded-[var(--radius-lg)] p-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            {strings.salesInvoices.changeDueDesc}
          </p>
          <p className="text-2xl font-bold text-blue-600">
            {Money.from(changeDue).toString()}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {strings.sales.cancel}
          </Button>
          <PremiumButton onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin me-2" />
            ) : null}
            {strings.salesInvoices.changeReturnedButton}
          </PremiumButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
