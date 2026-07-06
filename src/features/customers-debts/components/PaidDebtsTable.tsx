import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import type { CustomerDebtGroup } from "./customerDebtsHelpers";

interface PaidDebtsTableProps {
  groups: CustomerDebtGroup[];
  onViewDetails: (group: CustomerDebtGroup) => void;
}

export function PaidDebtsTable({ groups, onViewDetails }: PaidDebtsTableProps) {
  if (groups.length === 0) return null;

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Receipt className="w-5 h-5" />
          {strings.debts.paidInvoicesHistoryTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{strings.common.customer}</TableHead>
              <TableHead>{strings.debts.invoiceCountColumn}</TableHead>
              <TableHead>{strings.common.total}</TableHead>
              <TableHead>{strings.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.customerId}>
                <TableCell>{group.customerName}</TableCell>
                <TableCell>{group.invoices.length}</TableCell>
                <TableCell>
                  {Money.from(group.totalAmount).toString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(group)}
                  >
                    {strings.debts.viewButton}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
