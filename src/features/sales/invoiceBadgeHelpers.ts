import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";
import type { SaleInvoice } from "./types";

export interface InvoicePaymentBadgeInfo {
  methodLabel: string | null;
  isFullyOnDebt: boolean;
  isPartialDebt: boolean;
}

export function getInvoicePaymentBadgeInfo(
  invoice: SaleInvoice,
): InvoicePaymentBadgeInfo {
  const methodLabel = invoice.paymentMethod
    ? (PAYMENT_METHOD_LABELS[
        invoice.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
      ] ?? invoice.paymentMethod)
    : null;
  const isFullyOnDebt = !methodLabel && (invoice.remainingAmount ?? 0) > 0;
  const isPartialDebt = !!methodLabel && (invoice.remainingAmount ?? 0) > 0;
  return { methodLabel, isFullyOnDebt, isPartialDebt };
}
