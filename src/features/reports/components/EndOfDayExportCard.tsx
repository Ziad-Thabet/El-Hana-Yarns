import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/i18n/ar";
import { typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { formatDateYMD } from "../../../../shared/dateRules.mjs";
import { useExportEndOfDay } from "../hooks/useEndOfDay";

/**
 * Exports a day (or a range) as a styled workbook.
 *
 * The date is chosen explicitly rather than assumed to be today, so a day can
 * be re-exported after the fact and produce exactly the same figures.
 */
export function EndOfDayExportCard() {
  const today: string = formatDateYMD(new Date());
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const exportReport = useExportEndOfDay();
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      const result = await exportReport.mutateAsync({ from, to });
      if (result.cancelled) return;
      toast({
        title: strings.endOfDay.exported,
        description: strings.endOfDay.exportedTo.replace(
          "{path}",
          result.filePath ?? "",
        ),
      });
    } catch (err) {
      toast({
        title: strings.endOfDay.exportFailed,
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-wrap items-end gap-4 p-5">
        <div className="flex items-start gap-3 me-auto">
          <FileSpreadsheet className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">{strings.endOfDay.title}</h3>
            <p className={cn(typography.caption, "mt-0.5 max-w-md")}>
              {strings.endOfDay.subtitle}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="eod-from" className="text-xs">
            {strings.endOfDay.from}
          </Label>
          <Input
            id="eod-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="eod-to" className="text-xs">
            {strings.endOfDay.to}
          </Label>
          <Input
            id="eod-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          onClick={handleExport}
          disabled={exportReport.isPending || !from || !to}
          className="rounded-[var(--radius-md)]"
        >
          {exportReport.isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {strings.endOfDay.exporting}
            </>
          ) : (
            strings.endOfDay.exportButton
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
