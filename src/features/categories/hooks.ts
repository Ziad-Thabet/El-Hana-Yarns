import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { Category } from "./types";

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: QK.categories,
    queryFn: () => categoriesApi.getAll(),
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Category, "id">) => categoriesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.categories });
      qc.invalidateQueries({ queryKey: QK.products });
    },
  });
}
