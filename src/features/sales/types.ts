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
  /** Cash put into the drawer during the shift for reasons other than sales. */
  cashPaidIn: number;
  /** Cash taken out of it — an expense paid from the till, say. */
  cashPaidOut: number;
  /** Above this difference, closing asks for an explanation. */
  noteThreshold: number;
}

export interface ShiftSummary {
  cash: number;
  vodafone_cash: number;
  instapay: number;
  totalInvoices: number;
}

/** A movement of cash in or out of the drawer that is not a sale. */
export interface CashMovement {
  id: string;
  direction: "in" | "out";
  /** Always positive; `direction` carries the sign. */
  amount: number;
  reason: string;
  date: string;
  time: string;
  shiftId: string | null;
  /** Set when the movement pays for something the system already knows about. */
  refType: string | null;
  refId: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  /** Negative for money taken out, so a list can be summed directly. */
  signedAmount: number;
}
