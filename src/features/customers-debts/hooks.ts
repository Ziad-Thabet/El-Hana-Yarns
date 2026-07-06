import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi, debtsApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type {
  Customer,
  CustomerDebt,
  CustomerAddressInput,
  CustomerPhoneInput,
} from "./types";
import type { PaymentRecord } from "@/lib/types";

export function useCustomers(enabled = true) {
  return useQuery({
    queryKey: QK.customers,
    queryFn: () => customersApi.getAll(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Customer, "id" | "totalDebt">) =>
      customersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.customers }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      customersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.customers }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.customers });
      qc.invalidateQueries({ queryKey: QK.debts });
    },
  });
}

export function useAddDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CustomerDebt, "id" | "paymentHistory">) =>
      customersApi.addDebt(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.debts });
      qc.invalidateQueries({ queryKey: QK.customers });
    },
  });
}

export function useDebts(enabled = true) {
  return useQuery({
    queryKey: QK.debts,
    queryFn: () => debtsApi.getAll(),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export function useAddDebtPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      debtId,
      paymentData,
    }: {
      debtId: string;
      paymentData: Partial<PaymentRecord>;
    }) => debtsApi.addPayment(debtId, paymentData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.debts });
      qc.invalidateQueries({ queryKey: QK.customers });
      qc.invalidateQueries({ queryKey: ["shifts", "summary"] });
      qc.invalidateQueries({ queryKey: ["shifts", "all-invoices"] });
      qc.invalidateQueries({ queryKey: QK.sales });
    },
  });
}

export function useAddBulkDebtPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      amount,
      paymentData,
    }: {
      customerId: string;
      amount: number;
      paymentData: Partial<PaymentRecord>;
    }) => debtsApi.addBulkPayment(customerId, amount, paymentData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.debts });
      qc.invalidateQueries({ queryKey: QK.customers });
      qc.invalidateQueries({ queryKey: ["shifts", "summary"] });
      qc.invalidateQueries({ queryKey: ["shifts", "all-invoices"] });
      qc.invalidateQueries({ queryKey: QK.sales });
    },
  });
}

export function useCustomerProfile(customerId: string, enabled = true) {
  return useQuery({
    queryKey: QK.customerProfile(customerId),
    queryFn: () => customersApi.getProfile(customerId),
    enabled: enabled && !!customerId,
  });
}

export function useCustomerByAnyPhone(phone: string, enabled = true) {
  return useQuery({
    queryKey: ["customers", "by-any-phone", phone] as const,
    queryFn: () => customersApi.getByAnyPhone(phone),
    enabled: enabled && phone.length >= 6,
  });
}

export function useAddCustomerAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: CustomerAddressInput;
    }) => customersApi.addAddress(customerId, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}

export function useUpdateCustomerAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      addressId,
      data,
    }: {
      addressId: string;
      data: CustomerAddressInput;
      customerId: string;
    }) => customersApi.updateAddress(addressId, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}

export function useDeleteCustomerAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId }: { addressId: string; customerId: string }) =>
      customersApi.deleteAddress(addressId),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      addressId,
    }: {
      customerId: string;
      addressId: string;
    }) => customersApi.setDefaultAddress(customerId, addressId),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}

export function useAddCustomerPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: CustomerPhoneInput;
    }) => customersApi.addPhone(customerId, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}

export function useUpdateCustomerPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      phoneId,
      data,
    }: {
      phoneId: string;
      data: CustomerPhoneInput;
      customerId: string;
    }) => customersApi.updatePhone(phoneId, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}

export function useDeleteCustomerPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phoneId }: { phoneId: string; customerId: string }) =>
      customersApi.deletePhone(phoneId),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({
        queryKey: QK.customerProfile(variables.customerId),
      });
    },
  });
}
