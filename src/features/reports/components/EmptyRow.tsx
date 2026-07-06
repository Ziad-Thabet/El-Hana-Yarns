import { TableRow, TableCell } from "@/components/ui/table";
import { strings } from "@/lib/i18n/ar";

export function EmptyRow({
  cols,
  message = strings.reports.noData,
}: {
  cols: number;
  message?: string;
}) {
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell
        colSpan={cols}
        className="text-center text-muted-foreground/50 py-12 text-sm font-medium"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}
