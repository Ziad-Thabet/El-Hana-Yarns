import { strings } from "@/lib/i18n/ar";
import type { InvoiceItem, Category, PaymentMethod } from "@/lib/types";
import type { PurchaseInvoice } from "@/features/purchases/types";

export const EMPTY_ITEM: InvoiceItem = {
  productName: "",
  barcode: "",
  quantity: 0,
  unit: "piece",
  purchasePrice: 0,
  itemTotal: 0,
  category: "",
};

export const EMPTY_INVOICE = {
  invoiceNumber: "",
  supplier: "",
  date: "",
  total: 0,
  paidAmount: 0,
  receiptImage: "",
  method: "cash" as PaymentMethod,
};

export type InvoiceFormData = typeof EMPTY_INVOICE;

export const getStatus = (
  paid: number,
  total: number,
): PurchaseInvoice["status"] =>
  paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

export const getCategoryColor = (categories: Category[], name: string) =>
  categories.find((c) => c.name === name)?.color ??
  "hsl(var(--muted-foreground))";

export const unitLabel = (unit: string) =>
  unit === "piece"
    ? strings.purchases.unitPiece
    : unit === "weight"
      ? strings.purchases.unitWeight
      : unit === "meter"
        ? strings.purchases.unitMeter
        : strings.purchases.unitPiece;

export const statusLabel = (status: PurchaseInvoice["status"]) =>
  status === "paid"
    ? strings.purchases.statusPaid
    : status === "partial"
      ? strings.purchases.statusPartial
      : strings.purchases.statusUnpaid;

export const statusBadgeVariant = (status: PurchaseInvoice["status"]) =>
  status === "paid"
    ? "secondary"
    : status === "partial"
      ? "outline"
      : "destructive";
