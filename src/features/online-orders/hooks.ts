import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { onlineOrdersApi, driversApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type {
  OnlineOrder,
  OnlineOrderCreateInput,
  OnlineOrderUpdateInput,
  OnlineOrderFilters,
} from "./types";

export function useOnlineOrders(filters?: OnlineOrderFilters, enabled = true) {
  return useQuery({
    queryKey: QK.onlineOrders(filters),
    queryFn: () => onlineOrdersApi.getAll(filters),
    staleTime: 1000 * 30,
    enabled,
  });
}

export function useOnlineOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: QK.onlineOrder(id),
    queryFn: () => onlineOrdersApi.getById(id),
    enabled: enabled && !!id,
  });
}

export function useCustomerTrustLevel(customerId: string, enabled = true) {
  return useQuery({
    queryKey: QK.customerTrustLevel(customerId),
    queryFn: () => onlineOrdersApi.calculateTrustLevel(customerId),
    enabled: enabled && !!customerId,
  });
}

export function useCreateOnlineOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OnlineOrderCreateInput) => onlineOrdersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.customers });
    },
  });
}

export function useUpdateOnlineOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OnlineOrderUpdateInput }) =>
      onlineOrdersApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.onlineOrder(id) });
    },
  });
}

export function useCancelOnlineOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => onlineOrdersApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.customers });
    },
  });
}

export function useUpdateOnlineOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: OnlineOrder["status"];
    }) => onlineOrdersApi.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.onlineOrder(id) });
    },
  });
}

export function useDispatchOnlineOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      driverId,
    }: {
      orderId: string;
      driverId: string;
    }) => onlineOrdersApi.dispatch(orderId, driverId),
    onSuccess: (_, { driverId }) => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.customers });
      qc.invalidateQueries({ queryKey: QK.products });
      qc.invalidateQueries({ queryKey: QK.driverBalance(driverId) });
    },
  });
}

export function useUploadBillOfLading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, image }: { orderId: string; image: string }) =>
      onlineOrdersApi.uploadBillOfLading(orderId, image),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.onlineOrder(orderId) });
    },
  });
}

export function useMarkOnlineOrderNotReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => onlineOrdersApi.markNotReceived(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: QK.customers });
      qc.invalidateQueries({ queryKey: QK.products });
      qc.invalidateQueries({ queryKey: ["drivers", "balance"] });
    },
  });
}
