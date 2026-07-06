import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, CreditCard } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import type { CustomerDebtGroup } from "./customerDebtsHelpers";

interface ActiveDebtsTableProps {
  groups: CustomerDebtGroup[];
  onViewDetails: (group: CustomerDebtGroup) => void;
}

export function ActiveDebtsTable({
  groups,
  onViewDetails,
}: ActiveDebtsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredGroups = groups.filter(
    (g) =>
      g.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.invoices.some((inv) =>
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          {strings.debts.manageDebtsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute end-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={strings.debts.searchInvoicesPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pe-10"
          />
        </div>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{strings.common.customer}</TableHead>
                <TableHead>{strings.debts.invoiceCountColumn}</TableHead>
                <TableHead>{strings.common.total}</TableHead>
                <TableHead>{strings.common.paid}</TableHead>
                <TableHead>{strings.common.remaining}</TableHead>
                <TableHead>{strings.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {strings.debts.noActiveDebts}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.customerId}>
                    <TableCell className="font-medium">
                      {group.customerName}
                    </TableCell>
                    <TableCell>{group.invoices.length}</TableCell>
                    <TableCell>
                      {Money.from(group.totalAmount).toString()}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {Money.from(group.paidAmount).toString()}
                    </TableCell>
                    <TableCell className="text-red-600 font-semibold">
                      {Money.from(group.remainingAmount).toString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(group)}
                      >
                        {strings.debts.viewDetailsButton}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
