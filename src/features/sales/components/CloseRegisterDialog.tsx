import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Check,
  Loader2,
  LogOut,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Money } from "@/lib/domain";
import { shiftCloseApi } from "@/lib/api";
import type { ShiftClosePreview } from "@/lib/types";
import { strings } from "@/lib/i18n/ar";
import { cn } from "@/lib/utils";

/**
 * Closing the register is a count, not a confirmation.
 *
 * The drawer is counted first and the expected figure is only revealed
 * afterwards — a cashier who can see the target before counting is not really
 * counting. Nothing is written until the difference has been seen and, when it
 * is large enough to matter, explained.
 */
export function CloseRegisterDialog({
  open,
  shiftId,
  onClosed,
  onCancel,
}: {
  open: boolean;
  shiftId: string | null;
  onClosed: () => void;
  onCancel: () => void;
}) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ShiftClosePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setCounted("");
    setNote("");
    setPreview(null);
    setBusy(false);
  };

  const countedValue = Number(counted);
  const countedIsValid =
    counted.trim() !== "" && Number.isFinite(countedValue) && countedValue >= 0;

  const handleCount = async () => {
    if (!shiftId || !countedIsValid) return;
    try {
      setBusy(true);
      setPreview(await shiftCloseApi.preview(shiftId, countedValue));
    } catch (err) {
      toast({
        title: strings.shifts.closeRegisterFailed,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const variance = preview?.variance ?? 0;
  const balanced = Math.abs(variance) < 0.01;
  const needsNote =
    !!preview && Math.abs(variance) > preview.noteThreshold && !note.trim();

  const handleConfirm = async () => {
    if (!shiftId || !preview || needsNote) return;
    try {
      setBusy(true);
      await shiftCloseApi.close(
        shiftId,
        preview.countedCash,
        note.trim() || null,
      );
      toast({ title: strings.shifts.shiftEnded });
      reset();
      onClosed();
    } catch (err) {
      toast({
        title: strings.shifts.closeRegisterFailed,
        description: (err as Error).message,
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  const cancel = () => {
    reset();
    onCancel();
  };

  const varianceText = balanced
    ? strings.shifts.varianceBalanced
    : (variance > 0
        ? strings.shifts.varianceOver
        : strings.shifts.varianceShort) +
      " " +
      Money.from(Math.abs(variance)).toString();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            {strings.shifts.closeRegisterTitle}
          </DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              {strings.shifts.countDrawerHint}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="counted-cash">
                {strings.shifts.countedCashLabel}
              </Label>
              <Input
                id="counted-cash"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                dir="ltr"
                autoFocus
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCount()}
                className="text-lg font-semibold"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <Figure
                label={strings.shifts.expectedCash}
                value={preview.expectedCash}
              />
              <Figure
                label={strings.shifts.countedCash}
                value={preview.countedCash}
              />
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-3",
                balanced
                  ? "bg-emerald-500/10 text-emerald-500"
                  : variance > 0
                    ? "bg-sky-500/10 text-sky-500"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {balanced ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : variance > 0 ? (
                <TrendingUp className="h-4 w-4 shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0" />
              )}
              <span className="text-sm font-semibold">{varianceText}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {strings.shifts.openingFloatNote.replace(
                "{amount}",
                Money.from(preview.openingFloat).toString(),
              )}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="close-note">
                {needsNote
                  ? strings.shifts.noteRequired
                  : strings.shifts.noteOptional}
              </Label>
              <Textarea
                id="close-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={strings.shifts.notePlaceholder}
              />
              {needsNote && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {strings.shifts.noteRequiredHint.replace(
                    "{amount}",
                    Money.from(preview.noteThreshold).toString(),
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row-reverse gap-2">
          {!preview ? (
            <Button
              onClick={handleCount}
              disabled={busy || !countedIsValid}
              className="flex-1"
            >
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {strings.shifts.reviewCount}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={busy || needsNote}
              className="flex-1"
            >
              {busy ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="me-2 h-4 w-4" />
              )}
              {strings.shifts.confirmClose}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={cancel}
            disabled={busy}
            className="flex-1"
          >
            {strings.shifts.endShiftCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums">
        {Money.from(value).toString()}
      </p>
    </div>
  );
}
