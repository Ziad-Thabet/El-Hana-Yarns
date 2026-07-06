import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Wallet } from "lucide-react";
import { Money } from "@/lib/domain";
import { useToast } from "@/hooks/use-toast";
import { SuccessButton } from "@/components/ui/premium";
import {
  useDriverBalance,
  useDriverLedger,
  useDriverSummary,
  useRegisterDriverPayment,
} from "@/features/drivers/hooks";
import { SETTLEMENT_TYPE_LABELS } from "@/lib/constants/onlineOrdersStatus";
import { strings } from "@/lib/i18n/ar";
import type { Driver } from "@/features/drivers/types";
import { formatDateYMD } from "../../../../shared/dateRules.mjs";
import { getDriverBalanceLabel } from "@/features/drivers/driverHelpers";

export function DriverLedgerDialog({
  driver,
  open,
  onClose,
}: {
  driver: Driver | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState<"today" | "last7" | "all">(
    "last7",
  );

  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateYMD(today);
    if (dateFilter === "today") return { from: todayStr, to: todayStr };
    if (dateFilter === "last7") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: formatDateYMD(d), to: todayStr };
    }
    return { from: undefined, to: undefined };
  }, [dateFilter]);

  const { data: balance = 0 } = useDriverBalance(driver?.id ?? "", !!driver);
  const { data: summary } = useDriverSummary(
    driver?.id ?? "",
    dateRange.from,
    dateRange.to,
    !!driver,
  );
  const { data: ledger = [], isLoading } = useDriverLedger(
    driver?.id ?? "",
    dateRange,
    !!driver,
  );
  const registerPayment = useRegisterDriverPayment();

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!driver) return null;

  const handleRegisterPayment = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast({ title: strings.common.invalidAmount, variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      await registerPayment.mutateAsync({
        driverId: driver.id,
        amount: value,
        notes: notes.trim() || undefined,
      });
      toast({ title: strings.drivers.paymentRegistered });
      setAmount("");
      setNotes("");
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const balanceLabel = getDriverBalanceLabel(balance);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {strings.drivers.settlementLedger} — {driver.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["today", "last7", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  dateFilter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "today"
                  ? strings.drivers.filterToday
                  : f === "last7"
                    ? strings.drivers.filterLast7
                    : strings.drivers.filterAll}
              </button>
            ))}
          </div>

          {summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                {
                  label: strings.drivers.summaryDeliveries,
                  value: String(summary.deliveriesCount),
                  mono: false,
                },
                {
                  label: strings.drivers.summaryCollected,
                  value: Money.from(summary.totalCollected).toString(),
                  mono: true,
                },
                {
                  label:
                    driver.driverType === "driver"
                      ? strings.drivers.summaryDriverFees
                      : strings.drivers.companyOwesShop,
                  value: Money.from(
                    driver.driverType === "driver"
                      ? summary.totalDriverFees
                      : summary.totalCollected,
                  ).toString(),
                  mono: true,
                },
                {
                  label: strings.drivers.summaryPaidBack,
                  value: Money.from(summary.totalPaidBack).toString(),
                  mono: true,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="p-3 bg-secondary/60 border border-border rounded-lg"
                >
                  <p className="text-[11px] text-muted-foreground">
                    {card.label}
                  </p>
                  <p
                    className={`text-sm font-bold text-foreground mt-0.5 ${card.mono ? "tabular-nums" : ""}`}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-secondary border border-border rounded-xl">
            <div>
              <p className="text-xs text-muted-foreground">{balanceLabel}</p>
              <p className="text-2xl font-bold text-foreground">
                {Money.from(Math.abs(balance)).toString()}
              </p>
            </div>
          </div>

          {balance !== 0 && (
            <div className="space-y-3 p-4 border border-border rounded-lg bg-card/40">
              <p className="text-sm font-semibold text-foreground">
                {strings.drivers.registerPayment}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">
                    {strings.drivers.paymentAmount}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    max={Math.abs(balance)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    {strings.onlineOrders.notes}
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={1}
                  />
                </div>
              </div>
              <SuccessButton
                onClick={handleRegisterPayment}
                disabled={saving}
                className="w-full"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                {strings.drivers.registerPayment}
              </SuccessButton>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-semibold block">
              {strings.drivers.settlementLedger}
            </Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {strings.common.loading}
                </span>
              </div>
            ) : ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {strings.common.noMovementsYet}
              </p>
            ) : (
              <div className="space-y-1.5">
                {ledger.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-xs bg-secondary/50 border border-border rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {SETTLEMENT_TYPE_LABELS[entry.type]}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.date} — {entry.time}
                        {entry.notes ? ` — ${entry.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p
                        className={`font-semibold ${
                          entry.amount > 0 ? "text-amber-600" : "text-rose-500"
                        }`}
                      >
                        {entry.amount > 0 ? "+" : ""}
                        {Money.from(entry.amount).toString()}
                      </p>
                      <p className="text-muted-foreground">
                        {strings.common.balanceLabel}{" "}
                        {Money.from(entry.balanceAfter).toString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              {strings.common.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
