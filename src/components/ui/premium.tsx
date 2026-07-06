import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cards, buttons, premiumButtonClass } from "@/lib/theme/styles";

export function PremiumCard({
  className,
  interactive,
  ...props
}: React.ComponentProps<typeof Card> & { interactive?: boolean }) {
  return (
    <Card
      className={cn(interactive ? cards.interactive : cards.base, className)}
      {...props}
    />
  );
}

export function PremiumButton({ className, ...props }: ButtonProps) {
  return <Button className={cn(premiumButtonClass(), className)} {...props} />;
}

export function SuccessButton({ className, ...props }: ButtonProps) {
  return <Button className={cn(buttons.success, "rounded-[var(--radius-md)]", className)} {...props} />;
}

export function PageSection({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 animate-fade-in", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ message, className }: { message: string; className?: string }) {
  return (
    <p className={cn("text-center py-10 text-muted-foreground text-sm", className)}>{message}</p>
  );
}