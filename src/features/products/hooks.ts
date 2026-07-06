import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { Product } from "./types";

export function useProducts(enabled = true) {
  return useQuery({
    queryKey: QK.products,
    queryFn: () => productsApi.getAll(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useProductsForSales(enabled = true) {
  return useQuery({
    queryKey: [...QK.products, "sales"],
    queryFn: () => productsApi.getForSales(),
    staleTime: 1000 * 60 * 2,
    enabled,
    select: (data) => data.filter((p) => p.stock > 0),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Product, "id">) => productsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.products }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.products }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.products }),
  });
}

export function useDeductStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      productsApi.deductStock(id, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.products }),
  });
}
