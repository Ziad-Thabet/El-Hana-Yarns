import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Banknote, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { cashApi } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { Money } from "@/lib/domain";
import { QK } from "@/lib/queryKeys";
import { strings } from "@/lib/i18n/ar";
import { cn } from "@/lib/utils";
import type { CashMovement } from "@/lib/types";

/**
 * Recording money that enters or leaves the drawer without a sale.
 *
 * The shop pays a courier, settles the electricity, brings in change to start
 * the day. None of that is a sale, and none of it used to be recorded, so the
 * drawer came up short at closing by exactly the amount paid out and the
 * variance blamed whoever happened to be on the till.
 *
 * There is no edit and no delete. A mistake is corrected by an opposing
 * movement, which is how a cash book works: the error and its correction both
 * stay on the record.
 */
export function CashDrawerDialog({
  open,
  onClose,
  shiftId,
}: {
  open: boolean;
  onClose: () => void;
  shiftId: string | null;
}) {
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const movements = useQuery({
    queryKey: QK.cashByShift(shiftId ?? ""),
    queryFn: () => cashApi.getByShift(shiftId as string),
    enabled: open && !!shiftId,
  });

  const record = useMutation({
    mutationFn: () => cashApi.record(direction, Number(amount), reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.cash });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setAmount("");
      setReason("");
      toast({ title: strings.cashDrawer.recorded });
    },
    onError: (err) =>
      toast({
        title: strings.cashDrawer.failed,
        description: errorMessage(err),
        variant: "destructive",
      }),
  });

  const value = Number(amount);
  const canSubmit =
    amount.trim() !== "" && Number.isFinite(value) && value > 0 && reason.trim() !== "";

  const rows: CashMovement[] = movements.data ?? [];
  const net = rows.reduce((sum, m) => sum + m.signedAmount, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            {strings.cashDrawer.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {strings.cashDrawer.subtitle}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={direction === "out" ? "default" : "outline"}
            onClick={() => setDirection("out")}
            className="gap-2"
          >
            <ArrowUpRight className="h-4 w-4" />
            {strings.cashDrawer.takeOut}
          </Button>
          <Button
            type="button"
            variant={direction === "in" ? "default" : "outline"}
            onClick={() => setDirection("in")}
            className="gap-2"
          >
            <ArrowDownLeft className="h-4 w-4" />
            {strings.cashDrawer.putIn}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cash-amount">{strings.cashDrawer.amount}</Label>
            <Input
              id="cash-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-reason">{strings.cashDrawer.reason}</Label>
            <Input
              id="cash-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={strings.cashDrawer.reasonPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) record.mutate();
              }}
            />
          </div>
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h4 className="text-xs font-semibold">
                {strings.cashDrawer.todayTitle}
              </h4>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  net < 0 ? "text-destructive" : "text-emerald-500",
                )}
              >
                {strings.cashDrawer.net} {Money.from(net).toString()}
              </span>
            </div>
            <div className="max-h-44 space-y-1.5 overflow-auto">
              {rows.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px]">{m.reason}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.time} · {m.createdByName ?? ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      m.direction === "out" ? "text-destructive" : "text-emerald-500",
                    )}
                  >
                    {m.direction === "out" ? "−" : "+"}
                    {Money.from(m.amount).toString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row-reverse gap-2">
          <Button
            onClick={() => record.mutate()}
            disabled={!canSubmit || record.isPending}
            className="flex-1"
          >
            {record.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {strings.cashDrawer.record}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            {strings.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
