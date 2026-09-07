import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backupApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";

export function useBackups(enabled = true) {
  return useQuery({
    queryKey: QK.backups,
    queryFn: () => backupApi.list(),
    staleTime: 1000 * 30,
    enabled,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => backupApi.create(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.backups }),
  });
}

export function useRevealBackups() {
  return useMutation({ mutationFn: () => backupApi.reveal() });
}

/**
 * The main process relaunches the app shortly after replying, so there is no
 * point invalidating caches here — the renderer is about to be torn down.
 */
export function useRestoreBackup() {
  return useMutation({
    mutationFn: (fileName: string) => backupApi.restore(fileName),
  });
}
