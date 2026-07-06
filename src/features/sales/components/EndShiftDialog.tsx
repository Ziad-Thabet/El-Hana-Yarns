import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { strings } from "@/lib/i18n/ar";

export function EndShiftDialog({
  open,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {strings.shifts.endShiftConfirmTitle}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          {strings.shifts.endShiftConfirmDesc}
        </p>
        <DialogFooter className="flex gap-2 flex-row-reverse">
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin me-2" />
            ) : (
              <LogOut className="w-4 h-4 me-2" />
            )}
            {strings.shifts.endShiftConfirm}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            {strings.shifts.endShiftCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
