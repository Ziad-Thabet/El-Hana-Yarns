import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/i18n/ar";
import { errorMessage } from "@/lib/errors";
import { surfaces, typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import type { SettingEntry, SettingGroup, SettingValue } from "@/lib/types";
import { useAllSettings, useResetSetting, useUpdateSettings } from "../hooks";

/** Rendering order for the groups; anything unlisted falls to the end. */
const GROUP_ORDER: SettingGroup[] = [
  "shop",
  "receipt",
  "inventory",
  "shift",
  "alerts",
  "security",
  "backup",
  "barcode",
];

function groupLabel(group: string): string {
  const labels = strings.settings.groups as Record<string, string>;
  return labels[group] ?? group;
}

function settingLabel(key: string): string {
  const labels = strings.settings.labels as Record<string, string>;
  return labels[key] ?? key;
}

function settingHint(key: string): string | null {
  const hints = strings.settings.hints as Record<string, string>;
  return hints[key] ?? null;
}

export function SettingsSection() {
  const { data: entries = [], isLoading } = useAllSettings();
  const updateSettings = useUpdateSettings();
  const resetSetting = useResetSetting();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const grouped = useMemo(() => {
    const byGroup = new Map<string, SettingEntry[]>();
    for (const entry of entries) {
      const bucket = byGroup.get(entry.group);
      if (bucket) bucket.push(entry);
      else byGroup.set(entry.group, [entry]);
    }
    const ordered = [...byGroup.entries()].sort(
      (a, b) =>
        (GROUP_ORDER.indexOf(a[0] as SettingGroup) + 1 || 99) -
        (GROUP_ORDER.indexOf(b[0] as SettingGroup) + 1 || 99),
    );
    return ordered;
  }, [entries]);

  const draftFor = (entry: SettingEntry) =>
    drafts[entry.key] ?? String(entry.value);

  const isDirty = (entry: SettingEntry) =>
    drafts[entry.key] !== undefined &&
    drafts[entry.key] !== String(entry.value);

  const dirtyEntries = entries.filter(isDirty);

  const handleSave = async () => {
    if (dirtyEntries.length === 0) return;
    const payload: Record<string, SettingValue> = {};
    for (const entry of dirtyEntries) {
      const raw = drafts[entry.key];
      payload[entry.key] = entry.type === "number" ? Number(raw) : raw;
    }
    try {
      await updateSettings.mutateAsync(payload);
      setDrafts({});
      toast({ title: strings.settings.saved });
    } catch (err) {
      toast({
        title: strings.settings.saveFailed,
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleReset = async (entry: SettingEntry) => {
    try {
      await resetSetting.mutateAsync(entry.key);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[entry.key];
        return next;
      });
      toast({ title: strings.settings.resetDone });
    } catch (err) {
      toast({
        title: strings.settings.saveFailed,
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn(surfaces.panel, "p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h2 className={typography.pageTitle}>{strings.settings.title}</h2>
              <p className={cn(typography.caption, "mt-1 max-w-2xl")}>
                {strings.settings.subtitle}
              </p>
            </div>
          </div>
          <Button
            className="rounded-[var(--radius-md)]"
            onClick={handleSave}
            disabled={dirtyEntries.length === 0 || updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {strings.settings.saving}
              </>
            ) : (
              <>
                <Save className="me-2 h-4 w-4" />
                {dirtyEntries.length > 0
                  ? strings.settings.saveCount.replace(
                      "{count}",
                      String(dirtyEntries.length),
                    )
                  : strings.settings.save}
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className={cn(surfaces.panel, "flex justify-center py-12")}>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        grouped.map(([group, groupEntries]) => (
          <div key={group} className={cn(surfaces.panel, "p-6 space-y-4")}>
            <h3 className="text-sm font-semibold text-foreground">
              {groupLabel(group)}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {groupEntries.map((entry) => {
                const hint = settingHint(entry.key);
                return (
                  <div key={entry.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={entry.key} className="text-xs">
                        {settingLabel(entry.key)}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        {entry.isCustomised && (
                          <Badge
                            variant="secondary"
                            className="rounded-full text-[10px]"
                          >
                            {strings.settings.customised}
                          </Badge>
                        )}
                        {entry.isCustomised && (
                          <button
                            type="button"
                            onClick={() => handleReset(entry)}
                            className="text-muted-foreground hover:text-foreground"
                            title={strings.settings.resetToDefault}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Input
                      id={entry.key}
                      type={entry.type === "number" ? "number" : "text"}
                      min={entry.min ?? undefined}
                      max={entry.max ?? undefined}
                      value={draftFor(entry)}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [entry.key]: e.target.value,
                        }))
                      }
                      className={cn(isDirty(entry) && "border-primary")}
                    />
                    <p className={typography.caption}>
                      {hint ? `${hint} — ` : ""}
                      {strings.settings.defaultIs.replace(
                        "{value}",
                        String(entry.defaultValue),
                      )}
                      {entry.min !== null && entry.max !== null
                        ? ` (${entry.min}–${entry.max})`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
