import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, User, Receipt } from "lucide-react";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";

interface DebtStatsCardsProps {
  totalDebt: number;
  debtorsCount: number;
  pendingInvoicesCount: number;
}

export function DebtStatsCards({
  totalDebt,
  debtorsCount,
  pendingInvoicesCount,
}: DebtStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-secondary/50">
        <CardContent className="p-6 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-red-600" />
          <div>
            <p className="text-sm text-muted-foreground">
              {strings.debts.totalDebt}
            </p>
            <p className="text-2xl font-bold text-red-600">
              {Money.from(totalDebt).toString()}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-secondary/50">
        <CardContent className="p-6 flex items-center gap-3">
          <User className="w-8 h-8 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">
              {strings.debts.debtorsCount}
            </p>
            <p className="text-2xl font-bold text-primary">{debtorsCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-secondary/50">
        <CardContent className="p-6 flex items-center gap-3">
          <Receipt className="w-8 h-8 text-green-600" />
          <div>
            <p className="text-sm text-muted-foreground">
              {strings.debts.pendingInvoices}
            </p>
            <p className="text-2xl font-bold text-green-600">
              {pendingInvoicesCount}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
