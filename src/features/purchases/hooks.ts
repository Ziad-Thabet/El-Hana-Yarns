import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { PurchaseInvoice } from "./types";
import type { PaymentRecord } from "@/lib/types";

export function usePurchaseInvoices(enabled = true) {
  return useQuery({
    queryKey: QK.purchases,
    queryFn: () => purchaseApi.getAll(),
    staleTime: 1000 * 60 * 3,
    enabled,
  });
}

export function useSavePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PurchaseInvoice, "id">) => purchaseApi.save(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.purchases });
      qc.invalidateQueries({ queryKey: QK.products });
    },
  });
}

export function useAddPurchasePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      paymentData,
    }: {
      invoiceId: string;
      paymentData: Partial<PaymentRecord>;
    }) => purchaseApi.addPayment(invoiceId, paymentData),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.purchases }),
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.purchases }),
  });
}

export function useSetPurchaseInvoiceDueDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      dueDate,
    }: {
      invoiceId: string;
      dueDate: string;
    }) => window.api.alerts.setInvoiceDueDate(invoiceId, dueDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.purchases }),
  });
}
