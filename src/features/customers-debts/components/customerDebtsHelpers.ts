import type { CustomerDebt } from "@/features/customers-debts/types";

export interface CustomerDebtGroup {
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  invoices: CustomerDebt[];
}

export function groupDebtsByCustomer(
  debts: CustomerDebt[],
): CustomerDebtGroup[] {
  const map = new Map<string, CustomerDebtGroup>();
  for (const d of debts) {
    const existing = map.get(d.customerId);
    if (existing) {
      existing.totalAmount += d.totalAmount;
      existing.paidAmount += d.paidAmount;
      existing.remainingAmount += d.remainingAmount;
      existing.invoices.push(d);
      if (!existing.customerPhone && d.customerPhone) {
        existing.customerPhone = d.customerPhone;
      }
    } else {
      map.set(d.customerId, {
        customerId: d.customerId,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        totalAmount: d.totalAmount,
        paidAmount: d.paidAmount,
        remainingAmount: d.remainingAmount,
        invoices: [d],
      });
    }
  }
  return Array.from(map.values());
}
