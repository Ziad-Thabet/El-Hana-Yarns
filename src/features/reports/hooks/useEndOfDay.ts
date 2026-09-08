import { useMutation } from "@tanstack/react-query";
import { endOfDayApi } from "@/lib/api";

/**
 * Exports a day as a workbook.
 *
 * The main process opens the save dialog and builds the file in a child
 * process, so this resolves only once the file is actually on disk — or
 * immediately with `cancelled` if the dialog was dismissed.
 */
export function useExportEndOfDay() {
  return useMutation({
    mutationFn: (vars: { from: string; to?: string }) =>
      endOfDayApi.export(vars.from, vars.to ?? vars.from),
  });
}
