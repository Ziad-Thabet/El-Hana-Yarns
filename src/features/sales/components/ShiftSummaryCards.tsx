import { Banknote, Smartphone, Zap } from "lucide-react";
import { Money } from "@/lib/domain";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";

export function ShiftSummaryCards({
  summary,
}: {
  summary:
    | { cash: number; vodafone_cash: number; instapay: number }
    | null
    | undefined;
}) {
  const totals = {
    cash: summary?.cash ?? 0,
    vodafone: summary?.vodafone_cash ?? 0,
    instapay: summary?.instapay ?? 0,
  };
  const cards = [
    {
      key: "cash",
      label: PAYMENT_METHOD_LABELS.cash,
      value: totals.cash,
      icon: Banknote,
      accent: "text-success",
      bg: "bg-success-soft",
      border: "border-success/20",
    },
    {
      key: "vodafone",
      label: PAYMENT_METHOD_LABELS.vodafone,
      value: totals.vodafone,
      icon: Smartphone,
      accent: "text-destructive",
      bg: "bg-destructive-soft",
      border: "border-destructive/20",
    },
    {
      key: "instapay",
      label: PAYMENT_METHOD_LABELS.instapay,
      value: totals.instapay,
      icon: Zap,
      accent: "text-info",
      bg: "bg-info-soft",
      border: "border-info/20",
    },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(({ key, label, value, icon: Icon, accent, bg, border }) => (
        <div
          key={key}
          className={`rounded-xl border ${border} ${bg} p-4 flex flex-col gap-2`}
        >
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${accent}`} />
            <span className="text-xs text-muted-foreground font-medium">
              {label}
            </span>
          </div>
          <p className={`text-xl font-bold ${accent}`}>
            {Money.from(value).toString()}
          </p>
        </div>
      ))}
    </div>
  );
}
