import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/theme/styles";

export function PageHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="space-y-1.5">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </span>
        <h1 className={cn(typography.pageTitle, "rule-accent")}>{title}</h1>
      </div>
      {action}
    </div>
  );
}
