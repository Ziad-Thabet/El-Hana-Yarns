import type { CartItem } from "@/lib/types";
import type { PaymentRecord } from "@/lib/types";

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  items: CartItem[];
  total: number;
  cashier: string;
  shiftId?: string | null;
  paymentMethod?: string | null;
  paymentHistory?: PaymentRecord[];
  paidAmount?: number;
  remainingAmount?: number;
  /** 'none' | 'partial' | 'full' — set by the returns flow. */
  returnStatus?: string | null;
  /** Value returned against this invoice, whether refunded or written off a debt. */
  refundedAmount?: number;
  /** `total` less what came back. This is what a revenue total should sum. */
  netTotal?: number;
}

export interface Shift {
  id: string;
  userId: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  totalCash: number;
  totalVodafone: number;
  totalInstapay: number;
  totalInvoices: number;
  status: "open" | "closed";
}

export interface ShiftSummary {
  cash: number;
  vodafone_cash: number;
  instapay: number;
  totalInvoices: number;
}
