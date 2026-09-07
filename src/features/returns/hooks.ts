import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { returnsApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { ReturnLineInput } from "./types";

export function useReturnableLines(invoiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: QK.returnableLines(invoiceId ?? ""),
    queryFn: () => returnsApi.getReturnableLines(invoiceId as string),
    enabled: enabled && !!invoiceId,
    staleTime: 0,
  });
}

export function useInvoiceReturns(invoiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: QK.invoiceReturns(invoiceId ?? ""),
    queryFn: () => returnsApi.getForInvoice(invoiceId as string),
    enabled: enabled && !!invoiceId,
    staleTime: 0,
  });
}

/**
 * A return moves money, stock and possibly a debt, so it invalidates rather
 * more than most mutations: the invoice list, the products the goods went back
 * into, the shift totals that the refund reduced, and the debt ledger.
 */
function useInvalidateAfterReturn() {
  const qc = useQueryClient();
  return (invoiceId: string) => {
    qc.invalidateQueries({ queryKey: QK.returns });
    qc.invalidateQueries({ queryKey: QK.returnableLines(invoiceId) });
    qc.invalidateQueries({ queryKey: QK.invoiceReturns(invoiceId) });
    qc.invalidateQueries({ queryKey: QK.sales });
    qc.invalidateQueries({ queryKey: QK.products });
    qc.invalidateQueries({ queryKey: QK.debts });
    qc.invalidateQueries({ queryKey: QK.customers });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };
}

export function useCreateReturn() {
  const invalidate = useInvalidateAfterReturn();
  return useMutation({
    mutationFn: (vars: {
      invoiceId: string;
      lines: ReturnLineInput[];
      reason?: string;
    }) => returnsApi.create(vars.invoiceId, vars.lines, vars.reason),
    onSuccess: (_result, vars) => invalidate(vars.invoiceId),
  });
}

export function useVoidInvoice() {
  const invalidate = useInvalidateAfterReturn();
  return useMutation({
    mutationFn: (vars: { invoiceId: string; reason?: string }) =>
      returnsApi.void(vars.invoiceId, vars.reason),
    onSuccess: (_result, vars) => invalidate(vars.invoiceId),
  });
}
