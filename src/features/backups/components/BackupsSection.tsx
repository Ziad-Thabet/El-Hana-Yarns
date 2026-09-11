import { useState } from "react";
import { Database, FolderOpen, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/i18n/ar";
import { errorMessage } from "@/lib/errors";
import { surfaces, typography, tables } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import type { BackupEntry, BackupReason } from "@/lib/types";
import {
  useBackups,
  useCreateBackup,
  useRestoreBackup,
  useRevealBackups,
} from "../hooks";

const REASON_LABELS: Record<BackupReason, string> = {
  startup: strings.backups.reasonStartup,
  periodic: strings.backups.reasonPeriodic,
  manual: strings.backups.reasonManual,
  "pre-restore": strings.backups.reasonPreRestore,
  "pre-migration": strings.backups.reasonPreMigration,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCreatedAt(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return createdAt;
  return parsed.toLocaleString();
}

export function BackupsSection() {
  const { data, isLoading } = useBackups();
  const createBackup = useCreateBackup();
  const revealBackups = useRevealBackups();
  const restoreBackup = useRestoreBackup();
  const { toast } = useToast();
  const [pendingRestore, setPendingRestore] = useState<BackupEntry | null>(null);

  const entries = data?.entries ?? [];

  const handleCreate = async () => {
    try {
      await createBackup.mutateAsync();
      toast({ title: strings.backups.created });
    } catch (err) {
      toast({
        title: strings.backups.createFailed,
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    const target = pendingRestore;
    setPendingRestore(null);
    try {
      const result = await restoreBackup.mutateAsync(target.fileName);
      toast({
        title: strings.backups.restored,
        description: result.safetyBackup
          ? strings.backups.safetyBackupNote.replace(
              "{name}",
              result.safetyBackup,
            )
          : undefined,
      });
    } catch (err) {
      toast({
        title: strings.backups.restoreFailed,
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
            <Database className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h2 className={typography.pageTitle}>{strings.backups.title}</h2>
              <p className={cn(typography.caption, "mt-1 max-w-xl")}>
                {strings.backups.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-[var(--radius-md)]"
              onClick={() => revealBackups.mutate()}
            >
              <FolderOpen className="me-2 h-4 w-4" />
              {strings.backups.openFolder}
            </Button>
            <Button
              className="rounded-[var(--radius-md)]"
              onClick={handleCreate}
              disabled={createBackup.isPending}
            >
              {createBackup.isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {strings.backups.creating}
                </>
              ) : (
                strings.backups.createNow
              )}
            </Button>
          </div>
        </div>
        {data?.directory && (
          <p
            className={cn(typography.caption, "mt-4 break-all")}
            dir="ltr"
            style={{ textAlign: "start" }}
          >
            {strings.backups.folderLabel}: {data.directory}
          </p>
        )}
      </div>

      <div className={cn(surfaces.panel, "overflow-hidden")}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className={cn(typography.caption, "py-12 text-center")}>
            {strings.backups.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                    {strings.backups.columnDate}
                  </th>
                  <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                    {strings.backups.columnReason}
                  </th>
                  <th className={cn(tables.cellMuted, "px-4 py-3 text-start")}>
                    {strings.backups.columnSize}
                  </th>
                  <th className={cn(tables.cellMuted, "px-4 py-3 text-end")}>
                    {strings.backups.columnActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.fileName}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {formatCreatedAt(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="rounded-full">
                        {REASON_LABELS[entry.reason] ?? entry.reason}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatSize(entry.size)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-[var(--radius-md)]"
                        onClick={() => setPendingRestore(entry)}
                        disabled={restoreBackup.isPending}
                      >
                        <RotateCcw className="me-2 h-4 w-4" />
                        {strings.backups.restore}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingRestore}
        onOpenChange={(open) => !open && setPendingRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{strings.backups.restoreTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {strings.backups.restoreWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingRestore && (
            <p className={cn(typography.caption, "break-all")} dir="ltr">
              {pendingRestore.fileName}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{strings.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {restoreBackup.isPending
                ? strings.backups.restoring
                : strings.backups.restoreConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
