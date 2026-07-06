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
      accent: "text-emerald-500",
      bg: "bg-emerald-500/8",
      border: "border-emerald-500/20",
    },
    {
      key: "vodafone",
      label: PAYMENT_METHOD_LABELS.vodafone,
      value: totals.vodafone,
      icon: Smartphone,
      accent: "text-rose-500",
      bg: "bg-rose-500/8",
      border: "border-rose-500/20",
    },
    {
      key: "instapay",
      label: PAYMENT_METHOD_LABELS.instapay,
      value: totals.instapay,
      icon: Zap,
      accent: "text-violet-500",
      bg: "bg-violet-500/8",
      border: "border-violet-500/20",
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
