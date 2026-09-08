import { Fragment, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  ScrollText,
} from "lucide-react";
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
// Written by the audit serialiser in place of a password.
const REDACTED = "[redacted]";

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

type Change = { from: unknown; to: unknown };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A `{ from, to }` pair contributed by a repository, not an ordinary field. */
function isChange(value: unknown): value is Change {
  return isPlainObject(value) && "from" in value && "to" in value;
}

function fieldLabel(key: string) {
  const labels = strings.audit.fields as Record<string, string>;
  return labels[key] ?? key;
}

/**
 * The log is read by the shop owner, not by a developer, so values are shown
 * the way they appear elsewhere in the app — never as raw JSON.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value === REDACTED) return strings.audit.redacted;
  if (typeof value === "boolean")
    return value ? strings.audit.yes : strings.audit.no;
  if (typeof value === "number") return value.toLocaleString("ar-EG");
  return String(value);
}

/** Long base64 image payloads are noise; say what they are and move on. */
function isImagePayload(value: unknown) {
  return typeof value === "string" && value.startsWith("data:");
}

function FieldValue({ value }: { value: unknown }) {
  if (isImagePayload(value)) {
    return (
      <span className="text-muted-foreground">{strings.audit.imageValue}</span>
    );
  }
  if (isChange(value)) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground line-through">
          {formatValue(value.from)}
        </span>
        <ArrowLeft className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-medium">{formatValue(value.to)}</span>
      </span>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>—</span>;
    return (
      <div className="space-y-1.5">
        {value.map((item, i) => (
          <div
            key={i}
            className="rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5"
          >
            <p className={cn(typography.caption, "mb-1")}>
              {strings.audit.item.replace("{n}", String(i + 1))}
            </p>
            <FieldValue value={item} />
          </div>
        ))}
      </div>
    );
  }
  if (isPlainObject(value)) return <FieldList data={value} />;
  return <span>{formatValue(value)}</span>;
}

function FieldList({ data }: { data: Record<string, unknown> }) {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return (
      <p className={typography.caption}>{strings.audit.noDetails}</p>
    );
  }
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {keys.map((key) => (
        <div key={key} className="flex flex-wrap items-baseline gap-2">
          <dt className={cn(typography.caption, "shrink-0")}>
            {fieldLabel(key)}
          </dt>
          <dd className="min-w-0 text-[13px]">
            <FieldValue value={data[key]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailRow({ entry }: { entry: AuditEntry }) {
  const detail = isPlainObject(entry.detail) ? entry.detail : null;
  const payload = detail && isPlainObject(detail.payload) ? detail.payload : null;
  const changes = detail && isPlainObject(detail.changes) ? detail.changes : null;
  // A payload that is a bare value (an id string, say) still deserves a row.
  const bare =
    detail && !payload && detail.payload !== undefined && detail.payload !== null
      ? detail.payload
      : null;

  return (
    <tr className="bg-muted/30">
      <td colSpan={5} className="px-4 py-4">
        <div className="space-y-4">
          {entry.error && (
            <p className="text-xs text-destructive">{entry.error}</p>
          )}
          {changes && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold">
                {strings.audit.changesTitle}
              </h4>
              <FieldList data={changes} />
            </section>
          )}
          {(payload || bare !== null) && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold">
                {strings.audit.detailsTitle}
              </h4>
              {payload ? (
                <FieldList data={payload} />
              ) : (
                <p className="text-[13px]">{formatValue(bare)}</p>
              )}
            </section>
          )}
          {!changes && !payload && bare === null && !entry.error && (
            <p className={typography.caption}>{strings.audit.noDetails}</p>
          )}
        </div>
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
                    <Fragment key={entry.id}>
                      <tr
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
                        <DetailRow entry={entry} />
                      )}
                    </Fragment>
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
