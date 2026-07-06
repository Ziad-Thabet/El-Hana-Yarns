import { useState } from "react";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";
import { surfaces, typography } from "@/lib/theme/styles";
import { ExpensesPanel } from "./ExpensesPanel";
import { NetPanel } from "./NetPanel";

const TABS: { label: string; value: "expenses" | "net" }[] = [
  { label: strings.expenses.title, value: "expenses" },
  { label: strings.expenses.netProfitTitle, value: "net" },
];

export default function ExpensesSection() {
  const [tab, setTab] = useState<"expenses" | "net">("expenses");

  return (
    <div className={surfaces.content}>
      <div className="mb-8 space-y-1.5">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          {strings.expensesExtra.accounts}
        </span>
        <h1 className={cn(typography.pageTitle, "rule-accent")}>
          {strings.expenses.title}
        </h1>
      </div>
      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "px-4 py-2.5 text-sm transition-colors",
              tab === t.value
                ? "border-b-2 border-accent font-semibold text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "expenses" ? <ExpensesPanel /> : <NetPanel />}
    </div>
  );
}
