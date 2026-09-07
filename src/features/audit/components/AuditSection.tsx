import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/lib/i18n/ar";
import { surfaces, typography, tables } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import type { AuditEntry, AuditQuery, AuditStatus } from "@/lib/types";
import { useAuditFilterOptions, useAuditLog } from "../hooks";

const PAGE_SIZE = 50;
const ANY = "__any__";

function statusVariant(status: AuditStatus) {
  if (status === "denied") return "destructive" as const;
  if (status === "failed") return "outline" as const;
  return "secondary" as const;
}

function statusLabel(status: AuditStatus) {
  const labels = strings.audit.status as Record<string, string>;
  return labels[status] ?? status;
}

function actionLabel(action: string) {
  const labels = strings.audit.actions as Record<string, string>;
  return labels[action] ?? action;
}

function formatWhen(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString();
}

function DetailRow({ entry }: { entry: AuditEntry }) {
  return (
    <tr className="bg-muted/30">
      <td colSpan={5} className="px-4 py-3">
        {entry.error && (
          <p className="mb-2 text-xs text-destructive">{entry.error}</p>
        )}
        <pre
          dir="ltr"
          className="max-h-64 overflow-auto rounded-md bg-background p-3 text-[11px] leading-relaxed"
        >
          {JSON.stringify(entry.detail, null, 2)}
        </pre>
      </td>
    </tr>
  );
}

export function AuditSection() {
  const [filters, setFilters] = useState<AuditQuery>({ limit: PAGE_SIZE, offset: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, isFetching } = useAuditLog(filters);
  const { data: options } = useAuditFilterOptions();

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const offset = filters.offset ?? 0;

  const patch = (next: Partial<AuditQuery>) =>
    setFilters((prev) => ({ ...prev, ...next, offset: 0 }));

  return (
    <div className="space-y-6">
      <div className={cn(surfaces.panel, "p-6 space-y-4")}>
        <div className="flex items-start gap-3">
          <ScrollText className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h2 className={typography.pageTitle}>{strings.audit.title}</h2>
            <p className={cn(typography.caption, "mt-1 max-w-2xl")}>
              {strings.audit.subtitle}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">{strings.audit.from}</Label>
            <Input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => patch({ from: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{strings.audit.to}</Label>
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => patch({ to: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{strings.audit.action}</Label>
            <Select
              value={filters.action ?? ANY}
              onValueChange={(v) => patch({ action: v === ANY ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={strings.audit.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{strings.audit.all}</SelectItem>
                {(options?.actions ?? []).map((action) => (
                  <SelectItem key={action} value={action}>
                    {actionLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{strings.audit.actor}</Label>
            <Select
              value={filters.actorUserId ?? ANY}
              onValueChange={(v) =>
                patch({ actorUserId: v === ANY ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={strings.audit.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{strings.audit.all}</SelectItem>
                {(options?.actors ?? []).map((actor) => (
                  <SelectItem key={actor.id} value={actor.id}>
                    {actor.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{strings.audit.statusLabel}</Label>
            <Select
              value={filters.status ?? ANY}
              onValueChange={(v) =>
                patch({ status: v === ANY ? undefined : (v as AuditStatus) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={strings.audit.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{strings.audit.all}</SelectItem>
                <SelectItem value="ok">{statusLabel("ok")}</SelectItem>
                <SelectItem value="failed">{statusLabel("failed")}</SelectItem>
                <SelectItem value="denied">{statusLabel("denied")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className={cn(surfaces.panel, "overflow-hidden")}>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className={cn(typography.caption, "py-12 text-center")}>
            {strings.audit.empty}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                      {strings.audit.when}
                    </th>
                    <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                      {strings.audit.actor}
                    </th>
                    <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                      {strings.audit.action}
                    </th>
                    <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                      {strings.audit.summary}
                    </th>
                    <th className={cn(tables.cellMuted, "px-4 py-3 text-end")}>
                      {strings.audit.statusLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <>
                      <tr
                        key={entry.id}
                        className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                        onClick={() =>
                          setExpanded(expanded === entry.id ? null : entry.id)
                        }
                      >
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          {formatWhen(entry.occurredAt)}
                        </td>
                        <td className="px-4 py-3">{entry.actorUsername}</td>
                        <td className="px-4 py-3">{actionLabel(entry.action)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {entry.summary ?? "—"}
                            {expanded === entry.id ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <Badge
                            variant={statusVariant(entry.status)}
                            className="rounded-full"
                          >
                            {statusLabel(entry.status)}
                          </Badge>
                        </td>
                      </tr>
                      {expanded === entry.id && (
                        <DetailRow key={`${entry.id}-detail`} entry={entry} />
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className={typography.caption}>
                {strings.audit.showing
                  .replace("{from}", String(offset + 1))
                  .replace("{to}", String(offset + entries.length))
                  .replace("{total}", String(total))}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || isFetching}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      offset: Math.max(0, (prev.offset ?? 0) - PAGE_SIZE),
                    }))
                  }
                >
                  {strings.audit.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + entries.length >= total || isFetching}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      offset: (prev.offset ?? 0) + PAGE_SIZE,
                    }))
                  }
                >
                  {strings.audit.next}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
