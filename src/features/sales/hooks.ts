import {
  useMutation,
  useQuery,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { salesApi, onlineOrdersApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { SaleInvoice } from "./types";
import type { CartItem } from "@/lib/types";

export function useSalesInvoices(enabled = true) {
  return useQuery({
    queryKey: QK.sales,
    queryFn: () => salesApi.getAll(),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export function useSalesBySource(
  source: "online" | "pos",
  from?: string,
  to?: string,
  enabled = true,
) {
  return useQuery<SaleInvoice[]>({
    queryKey: QK.salesBySource(source, from, to),
    queryFn: () => salesApi.getBySource(source, from, to),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export function useSalesStats(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: QK.salesStats(from, to),
    queryFn: () => salesApi.getStats(from, to),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useCompleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      items: CartItem[];
      total: number;
      cashier: string;
      shiftId?: string | null;
      totalPaid?: number;
      paymentMethod?: string;
      paymentSplits?: {
        method: string;
        amount: number;
        receiptImage: string | null;
      }[];
      customerInfo?: { name?: string; phone?: string; notes?: string };
    }) => salesApi.complete(data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: QK.sales });
      qc.invalidateQueries({ queryKey: QK.products });
      if (variables.shiftId) {
        qc.invalidateQueries({
          queryKey: QK.shiftInvoices(variables.shiftId),
        });
      }
      qc.invalidateQueries({ queryKey: ["shifts", "all-invoices"] });
      qc.invalidateQueries({ queryKey: ["shifts", "summary"] });
      qc.invalidateQueries({ queryKey: QK.debts });
      qc.invalidateQueries({ queryKey: QK.customers });
    },
  });
}

export function useCreateOnlineOrderFromPOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: import("@/lib/types").OnlineOrderCreateInput) =>
      onlineOrdersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onlineOrders"] });
      qc.invalidateQueries({ queryKey: QK.products });
    },
  });
}

export function useShiftInvoices(shiftId: string | null, enabled = true) {
  return useQuery<SaleInvoice[]>({
    queryKey: QK.shiftInvoices(shiftId ?? ""),
    queryFn: async () => {
      if (!shiftId) return [];
      const res = await window.api.shifts.getInvoices(shiftId);
      if (!res.success) throw new Error(res.message);
      return res.data ?? [];
    },
    staleTime: 0,
    enabled: enabled && !!shiftId,
  });
}

type ShiftSummaryData = {
  cash: number;
  vodafone_cash: number;
  instapay: number;
  totalInvoices: number;
};

export function useMultiShiftSummaries(shiftIds: string[], enabled = true) {
  const results = useQueries({
    queries: shiftIds.map((shiftId) => ({
      queryKey: ["shifts", "summary", shiftId],
      queryFn: async () => {
        const res = await window.api.shifts.getSummary(shiftId);
        if (!res.success) throw new Error(res.message);
        return (res.data ?? null) as ShiftSummaryData | null;
      },
      staleTime: 0,
      enabled: enabled && !!shiftId,
    })),
  });
  const isLoading = results.some((r) => r.isLoading);
  const byShiftId = new Map<string, ShiftSummaryData | null>();
  shiftIds.forEach((id, i) => {
    byShiftId.set(id, results[i].data ?? null);
  });
  const aggregate = shiftIds.reduce(
    (acc, id) => {
      const s = byShiftId.get(id);
      if (s) {
        acc.cash += s.cash ?? 0;
        acc.vodafone_cash += s.vodafone_cash ?? 0;
        acc.instapay += s.instapay ?? 0;
      }
      return acc;
    },
    { cash: 0, vodafone_cash: 0, instapay: 0 },
  );
  return { byShiftId, aggregate, isLoading };
}

export function useShiftsByUserAndDate(
  userId: string | null,
  date: string,
  enabled = true,
) {
  return useQuery({
    queryKey: QK.shiftsByUserAndDate(userId ?? "", date),
    queryFn: async () => {
      if (!userId) return [];
      const res = await window.api.shifts.getByUserAndDate(userId, date);
      if (!res.success) throw new Error(res.message);
      return res.data ?? [];
    },
    staleTime: 1000 * 30,
    enabled: enabled && !!userId,
  });
}

export function useMultiShiftInvoices(shiftIds: string[], enabled = true) {
  const results = useQueries({
    queries: shiftIds.map((shiftId) => ({
      queryKey: QK.shiftInvoices(shiftId),
      queryFn: async () => {
        const res = await window.api.shifts.getInvoices(shiftId);
        if (!res.success) throw new Error(res.message);
        return res.data ?? [];
      },
      staleTime: 0,
      enabled: enabled && !!shiftId,
    })),
  });
  const isLoading = results.some((r) => r.isLoading);
  const data = results.flatMap((r) => r.data ?? []);
  return { data, isLoading };
}

export function useShiftSummary(shiftId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["shifts", "summary", shiftId ?? ""],
    queryFn: async () => {
      if (!shiftId) return null;
      const res = await window.api.shifts.getSummary(shiftId);
      if (!res.success) throw new Error(res.message);
      return res.data ?? null;
    },
    staleTime: 0,
    enabled: enabled && !!shiftId,
  });
}

export function useAllShiftInvoices(
  from?: string,
  to?: string,
  enabled = true,
) {
  return useQuery<SaleInvoice[]>({
    queryKey: QK.allShiftInvoices(from, to),
    queryFn: async () => {
      const res = await window.api.shifts.getAllInvoices(from, to);
      if (!res.success) throw new Error(res.message);
      return res.data ?? [];
    },
    staleTime: 1000 * 60,
    enabled,
  });
}
