import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeesApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { Employee, SalaryHistoryRecord, SalarySummary } from "./types";

export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: QK.employees,
    queryFn: () => employeesApi.getAll(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useSalaryHistory(userId: string | null, enabled = true) {
  return useQuery<SalaryHistoryRecord[]>({
    queryKey: QK.salaryHistory(userId ?? ""),
    queryFn: () => employeesApi.getSalaryHistory(userId as string),
    staleTime: 1000 * 60 * 2,
    enabled: enabled && !!userId,
  });
}

export function useSalarySummary(
  userId: string,
  from: string,
  to: string,
  enabled = false,
) {
  return useQuery<SalarySummary>({
    queryKey: QK.salarySummary(userId, from, to),
    queryFn: () => employeesApi.getSalarySummary(userId, from, to),
    staleTime: 1000 * 30,
    enabled: enabled && !!userId,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof employeesApi.create>[0]) =>
      employeesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.employees }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<Employee, "displayName" | "salaryType" | "dailyHours">>;
    }) => employeesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.employees }),
  });
}

export function useSetSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      amount,
      effectiveFrom,
      notes,
    }: {
      userId: string;
      amount: number;
      effectiveFrom: string;
      notes?: string;
    }) => employeesApi.setSalary(userId, amount, effectiveFrom, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.employees }),
  });
}

export function useChangeEmployeePassword() {
  return useMutation({
    mutationFn: ({
      userId,
      password,
    }: {
      userId: string;
      password: string;
    }) => employeesApi.changePassword(userId, password),
  });
}

export function useSetEmployeeActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => employeesApi.setActive(userId, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.employees }),
  });
}
