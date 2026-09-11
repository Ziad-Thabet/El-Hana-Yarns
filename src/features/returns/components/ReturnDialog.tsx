import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Money } from "@/lib/domain";
import { errorMessage } from "@/lib/errors";
import { strings } from "@/lib/i18n/ar";
import { typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";
import type { ReturnLineInput } from "../types";
import { useCreateReturn, useReturnableLines, useVoidInvoice } from "../hooks";

interface ReturnDialogProps {
  invoiceId: string | null;
  invoiceNumber: string;
  open: boolean;
  onClose: () => void;
}

interface LineDraft {
  quantity: string;
  restock: boolean;
}

export function ReturnDialog({
  invoiceId,
  invoiceNumber,
  open,
  onClose,
}: ReturnDialogProps) {
  const { data: lines = [], isLoading } = useReturnableLines(invoiceId, open);
  const createReturn = useCreateReturn();
  const voidInvoice = useVoidInvoice();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [reason, setReason] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);

  const draftFor = (id: string): LineDraft =>
    drafts[id] ?? { quantity: "", restock: true };

  const setDraft = (id: string, patch: Partial<LineDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }));

  const selected = useMemo(() => {
    return lines
      .map((line) => {
        const quantity = parseFloat(draftFor(line.invoiceItemId).quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        const capped = Math.min(quantity, line.returnableQuantity);
        return {
          line,
          quantity: capped,
          restock: draftFor(line.invoiceItemId).restock,
          value: capped * line.unitValue,
        };
      })
      .filter(Boolean) as {
      line: (typeof lines)[number];
      quantity: number;
      restock: boolean;
      value: number;
    }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, drafts]);

  const refundTotal = selected.reduce((sum, s) => sum + s.value, 0);
  const anythingReturnable = lines.some((l) => l.returnableQuantity > 0);

  const reset = () => {
    setDrafts({});
    setReason("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const describeResult = (result: {
    refundedCash: number;
    debtReduced: number;
    refundSplits: { method: string; amount: number }[];
  }) => {
    const parts: string[] = [];
    if (result.refundedCash > 0) {
      const split = result.refundSplits
        .map(
          (s) =>
            `${Money.from(s.amount).toString()} ${
              PAYMENT_METHOD_LABELS[
                s.method as keyof typeof PAYMENT_METHOD_LABELS
              ] ?? s.method
            }`,
        )
        .join(" + ");
      parts.push(`${strings.returns.refundCash}: ${split}`);
    }
    if (result.debtReduced > 0) {
      parts.push(
        `${strings.returns.refundDebt}: ${Money.from(result.debtReduced).toString()}`,
      );
    }
    return parts.join(" — ") || undefined;
  };

  const handleSubmit = async () => {
    if (!invoiceId || selected.length === 0) return;
    const payload: ReturnLineInput[] = selected.map((s) => ({
      invoiceItemId: s.line.invoiceItemId,
      quantity: s.quantity,
      restock: s.restock,
    }));
    try {
      const result = await createReturn.mutateAsync({
        invoiceId,
        lines: payload,
        reason: reason.trim() || undefined,
      });
      toast({
        title: strings.returns.success,
        description: describeResult(result),
      });
      handleClose();
    } catch (err) {
      toast({
        title: strings.returns.failed,
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleVoid = async () => {
    if (!invoiceId) return;
    setConfirmVoid(false);
    try {
      const result = await voidInvoice.mutateAsync({
        invoiceId,
        reason: reason.trim() || undefined,
      });
      toast({
        title: strings.returns.success,
        description: describeResult(result),
      });
      handleClose();
    } catch (err) {
      toast({
        title: strings.returns.failed,
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  };

  const isBusy = createReturn.isPending || voidInvoice.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-primary" />
              {strings.returns.title} — {invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !anythingReturnable ? (
            <p className={cn(typography.caption, "py-8 text-center")}>
              {strings.returns.fullyReturned}
            </p>
          ) : (
            <div className="space-y-5">
              <p className={typography.caption}>{strings.returns.subtitle}</p>

              <div className="space-y-3">
                {lines.map((line) => {
                  const draft = draftFor(line.invoiceItemId);
                  const exhausted = line.returnableQuantity <= 0;
                  return (
                    <div
                      key={line.invoiceItemId}
                      className={cn(
                        "rounded-lg border border-border p-3 space-y-3",
                        exhausted && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{line.name}</p>
                          <p className={typography.caption}>
                            {strings.returns.columnSold}: {line.soldQuantity}
                            {line.measureUnit ? ` ${line.measureUnit}` : ""}
                            {line.returnedQuantity > 0 &&
                              ` — ${strings.returns.columnReturned}: ${line.returnedQuantity}`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          {Money.from(line.lineTotal).toString()}
                        </span>
                      </div>
                      {!exhausted && (
                        <div className="flex flex-wrap items-end gap-4">
                          <div className="space-y-1">
                            <Label
                              className="text-xs"
                              htmlFor={`qty-${line.invoiceItemId}`}
                            >
                              {strings.returns.columnQuantity}
                            </Label>
                            <Input
                              id={`qty-${line.invoiceItemId}`}
                              type="number"
                              min={0}
                              max={line.returnableQuantity}
                              step={line.isWeighted ? 0.01 : 1}
                              value={draft.quantity}
                              onChange={(e) =>
                                setDraft(line.invoiceItemId, {
                                  quantity: e.target.value,
                                })
                              }
                              className="w-32"
                              placeholder={`0 / ${line.returnableQuantity}`}
                            />
                          </div>
                          <div className="flex items-center gap-2 pb-2">
                            <Switch
                              id={`restock-${line.invoiceItemId}`}
                              checked={draft.restock}
                              onCheckedChange={(checked) =>
                                setDraft(line.invoiceItemId, {
                                  restock: checked,
                                })
                              }
                            />
                            <Label
                              htmlFor={`restock-${line.invoiceItemId}`}
                              className="text-xs"
                            >
                              {strings.returns.columnRestock}
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1">
                <Label htmlFor="return-reason" className="text-xs">
                  {strings.returns.reasonLabel}
                </Label>
                <Textarea
                  id="return-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={strings.returns.reasonPlaceholder}
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm font-semibold">
                  {strings.returns.refundSummary}
                </span>
                <span className="text-lg font-bold text-primary">
                  {Money.from(refundTotal).toString()}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={isBusy || selected.length === 0}
                >
                  {createReturn.isPending ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {strings.returns.submitting}
                    </>
                  ) : (
                    strings.returns.submitButton
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmVoid(true)}
                  disabled={isBusy}
                >
                  <RotateCcw className="me-2 h-4 w-4" />
                  {strings.returns.returnAllButton}
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  {strings.common.close}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmVoid} onOpenChange={setConfirmVoid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{strings.returns.voidTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {strings.returns.voidWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{strings.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid}>
              {strings.returns.voidConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
