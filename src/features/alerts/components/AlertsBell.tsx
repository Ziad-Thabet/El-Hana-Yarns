import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  PackageX,
  PackageMinus,
  ReceiptText,
  CalendarClock,
  Clock,
  CheckCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/i18n/ar";
import type { Alert, AlertType } from "@/features/alerts/types";

const ALERT_ICONS: Record<AlertType, typeof PackageX> = {
  low_stock: PackageMinus,
  out_of_stock: PackageX,
  invoice_overdue: ReceiptText,
  invoice_due: CalendarClock,
  shift_open: Clock,
};
const ALERT_LABELS: Record<AlertType, string> = {
  low_stock: strings.alerts.lowStock,
  out_of_stock: strings.alerts.outOfStock,
  invoice_overdue: strings.alerts.invoiceOverdue,
  invoice_due: strings.alerts.invoiceDue,
  shift_open: strings.alerts.shiftOpen,
};

export function AlertsBell({ isAdmin }: { isAdmin: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await window.api.alerts.getAll();
      setAlerts(res.data ?? []);
    } catch {
      /* silent */
    }
  }, [isAdmin]);
  useEffect(() => {
    load();
    if (!isAdmin) return;
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load, isAdmin]);
  if (!isAdmin) return null;
  const unread = alerts.filter((a) => !a.is_read);
  const handleMarkRead = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: 1 } : a)),
    );
    try {
      await window.api.alerts.markRead(id);
    } catch {
      load();
    }
  };
  const handleMarkAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: 1 })));
    try {
      await window.api.alerts.markAllRead();
    } catch {
      load();
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
{unread.length > 0 && (
            <span className="absolute -start-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-none text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-[var(--radius-lg)] border-border bg-card p-0 shadow-elevated"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className={typography.sectionTitle}>{strings.alerts.title}</p>
          {unread.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {strings.alerts.markAllRead}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                {strings.alerts.noAlerts}
              </p>
              <p className={typography.caption}>
                {strings.alerts.noAlertsDesc}
              </p>
            </div>
          ) : (
            <ul>
              {alerts.map((alert) => {
                const Icon = ALERT_ICONS[alert.type] ?? Bell;
                return (
                  <li
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0",
                      alert.is_read ? "bg-card" : "bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                        alert.is_read
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={alert.is_read ? "secondary" : "default"}
                          className="text-[10px]"
                        >
                          {ALERT_LABELS[alert.type] ?? alert.type}
                        </Badge>
                        {alert.due_date && (
                          <span className={typography.caption}>
                            {alert.due_date}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{alert.message}</p>
                    </div>
                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        title={strings.alerts.markAsRead}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
