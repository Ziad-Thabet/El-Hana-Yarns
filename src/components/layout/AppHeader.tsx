import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { layout, typography, surfaces, tables } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";
import { USER_ROLE_LABELS, CONNECTION_STATUS } from "@/lib/constants/status";
import type { AuthSession } from "@/lib/types";
import { AlertsBell } from "@/features/alerts/components/AlertsBell";
interface AppHeaderProps {
  session: AuthSession;
  isAdmin: boolean;
  onLogout: () => void;
  statItems: { label: string; value: string }[];
  brandIcon: ReactNode;
}
export function AppHeader({
  session,
  isAdmin,
  onLogout,
  statItems,
  brandIcon,
}: AppHeaderProps) {
  return (
    <header className={cn(surfaces.panel, "mx-6 mt-5 mb-0 border-b-0")}>
      <div className={layout.header}>
        <div className="flex items-center gap-3">
          {brandIcon}
          <div>
            <h1 className={typography.pageTitle}>{strings.app.title}</h1>
            <p className={typography.caption}>
              {strings.app.welcome}{" "}
              <span className="font-medium text-foreground">
                {session.displayName}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="rounded-full">
            {CONNECTION_STATUS.online}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {isAdmin ? USER_ROLE_LABELS.admin : USER_ROLE_LABELS.staff}
          </Badge>
          <AlertsBell isAdmin={isAdmin} />
          <LanguageToggle />
          <ThemeToggle />
          <Button
            variant="secondary"
            className="rounded-[var(--radius-md)]"
            onClick={onLogout}
          >
            {strings.app.logout}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 px-6 pb-6 sm:grid-cols-3 border-t border-border pt-5">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              tables.cellMuted,
              "rounded-[var(--radius-lg)] border border-border/60 bg-muted/25 px-4 py-4 shadow-card",
            )}
          >
            <p className={typography.caption}>{item.label}</p>
            <p className={cn(typography.stat, "mt-2 text-base")}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
}
