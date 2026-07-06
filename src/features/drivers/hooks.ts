import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driversApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type {
  DriverCreateInput,
  DriverUpdateInput,
  DriverLedgerFilters,
} from "./types";

export function useDrivers(enabled = true) {
  return useQuery({
    queryKey: QK.drivers,
    queryFn: () => driversApi.getAll(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useActiveDrivers(enabled = true) {
  return useQuery({
    queryKey: QK.activeDrivers,
    queryFn: () => driversApi.getActive(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useDriverBalance(driverId: string, enabled = true) {
  return useQuery({
    queryKey: QK.driverBalance(driverId),
    queryFn: () => driversApi.getBalance(driverId),
    enabled: enabled && !!driverId,
  });
}

export function useDriverLedger(
  driverId: string,
  filters?: DriverLedgerFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: QK.driverLedger(driverId, filters?.from, filters?.to),
    queryFn: () => driversApi.getLedger(driverId, filters),
    enabled: enabled && !!driverId,
  });
}

export function useDriverSummary(
  driverId: string,
  from?: string,
  to?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["drivers", "summary", driverId, from, to],
    queryFn: () => driversApi.getSummary(driverId, from, to),
    enabled: enabled && !!driverId,
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DriverCreateInput) => driversApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.drivers });
      qc.invalidateQueries({ queryKey: QK.activeDrivers });
    },
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DriverUpdateInput }) =>
      driversApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.drivers });
      qc.invalidateQueries({ queryKey: QK.activeDrivers });
    },
  });
}

export function useRegisterDriverPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      driverId,
      amount,
      notes,
    }: {
      driverId: string;
      amount: number;
      notes?: string;
    }) => driversApi.registerManualPayment(driverId, amount, notes),
    onSuccess: (_, { driverId }) => {
      qc.invalidateQueries({ queryKey: QK.driverBalance(driverId) });
      qc.invalidateQueries({ queryKey: ["drivers", "ledger", driverId] });
    },
  });
}
