import { useCustomers, useDebts } from "@/features/customers-debts/hooks";
import { Loader2 } from "lucide-react";
import {
  groupDebtsByCustomer,
  type CustomerDebtGroup,
} from "./customerDebtsHelpers";
import { DebtStatsCards } from "./DebtStatsCards";
import { PaidDebtsTable } from "./PaidDebtsTable";
import { ActiveDebtsTable } from "./ActiveDebtsTable";
import { CustomerDebtDetailsDialog } from "./CustomerDebtDetailsDialog";
import { AddDebtDialog } from "./AddDebtDialog";
import { useState } from "react";
import { strings } from "@/lib/i18n/ar";

const CustomerDebts = () => {
  const { data: customers = [], isLoading: loadingCust } = useCustomers();
  const { data: debts = [], isLoading: loadingDebts } = useDebts();
  const loading = loadingCust || loadingDebts;

  const [selectedGroup, setSelectedGroup] = useState<CustomerDebtGroup | null>(
    null,
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const activeDebts = debts.filter((d) => d.remainingAmount > 0);
  const paidDebts = debts.filter((d) => d.remainingAmount === 0);
  const totalDebt = debts.reduce((s, d) => s + d.remainingAmount, 0);
  const debtorsCount = customers.filter((c) => c.totalDebt > 0).length;
  const activeGroups = groupDebtsByCustomer(activeDebts);
  const paidGroups = groupDebtsByCustomer(paidDebts);

  const openDetails = (group: CustomerDebtGroup) => {
    setSelectedGroup(group);
    setIsDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">
          {strings.common.loading}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DebtStatsCards
        totalDebt={totalDebt}
        debtorsCount={debtorsCount}
        pendingInvoicesCount={activeDebts.length}
      />
      <ActiveDebtsTable groups={activeGroups} onViewDetails={openDetails} />
      <PaidDebtsTable groups={paidGroups} onViewDetails={openDetails} />
      <CustomerDebtDetailsDialog
        group={selectedGroup}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedGroup(null);
        }}
      />
      <AddDebtDialog customers={customers} />
    </div>
  );
};

export default CustomerDebts;
