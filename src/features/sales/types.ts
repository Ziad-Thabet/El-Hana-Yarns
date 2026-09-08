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
  /** What the drawer started with. */
  openingFloat?: number;
  /** Null when the shift was closed without anyone counting the drawer. */
  countedCash?: number | null;
  expectedCash?: number | null;
  cashVariance?: number | null;
  closeNote?: string | null;
  closedBy?: string | null;
}

/** What the drawer should hold, revealed only once a count has been entered. */
export interface ShiftClosePreview {
  shiftId: string;
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  /** Counted less expected: positive is over, negative is short. */
  variance: number;
  invoiceCount: number;
  byCode: Record<string, number>;
  /** Above this difference, closing asks for an explanation. */
  noteThreshold: number;
}

export interface ShiftSummary {
  cash: number;
  vodafone_cash: number;
  instapay: number;
  totalInvoices: number;
}
