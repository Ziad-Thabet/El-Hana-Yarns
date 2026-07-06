import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { Expense, ExpenseCategory, NetSummary } from "./types";

export function useExpenseCategories(enabled = true) {
  return useQuery<ExpenseCategory[]>({
    queryKey: QK.expenseCategories,
    queryFn: () => expensesApi.getCategories(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useExpensesList(from?: string, to?: string, enabled = true) {
  return useQuery<Expense[]>({
    queryKey: QK.expensesList(from, to),
    queryFn: () => expensesApi.getAll(from, to),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export function useNetSummary(from: string, to: string, enabled = true) {
  return useQuery<NetSummary>({
    queryKey: QK.netSummary(from, to),
    queryFn: () => expensesApi.getNetSummary(from, to),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof expensesApi.add>[0]) =>
      expensesApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "list"] });
      qc.invalidateQueries({ queryKey: ["expenses", "net-summary"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "list"] });
      qc.invalidateQueries({ queryKey: ["expenses", "net-summary"] });
    },
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => expensesApi.createCategory(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.expenseCategories }),
  });
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.expenseCategories }),
  });
}
