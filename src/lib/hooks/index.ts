export { QK } from "@/lib/queryKeys";
export {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/features/categories/hooks";
export {
  useProducts,
  useProductsForSales,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useDeductStock,
} from "@/features/products/hooks";
export {
  usePurchaseInvoices,
  useSavePurchase,
  useAddPurchasePayment,
  useDeletePurchase,
} from "@/features/purchases/hooks";
export {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAddDebt,
  useDebts,
  useAddDebtPayment,
  useAddBulkDebtPayment,
} from "@/features/customers-debts/hooks";
export {
  useCompleteSale,
  useShiftInvoices,
  useShiftsByUserAndDate,
  useMultiShiftInvoices,
  useAllShiftInvoices,
} from "@/features/sales/hooks";
