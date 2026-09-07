/** One invoice line, with the portion already returned subtracted. */
export interface ReturnableLine {
  invoiceItemId: string;
  productId: string | null;
  name: string;
  isWeighted: boolean;
  measureUnit: string | null;
  /** In stock units: pieces, kilograms or metres. */
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  lineTotal: number;
  /** Value of one stock unit, derived from the recorded line total. */
  unitValue: number;
}

export interface ReturnLineInput {
  invoiceItemId: string;
  quantity: number;
  /** False for damaged goods that are refunded but not put back on the shelf. */
  restock: boolean;
}

export interface SaleReturnItem {
  id: string;
  invoiceItemId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  lineTotal: number;
  restocked: boolean;
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  invoiceId: string;
  date: string;
  time: string;
  /** Total value returned. */
  total: number;
  /** Portion handed back as money. */
  refundedCash: number;
  /** Portion written off against an unpaid balance instead. */
  debtReduced: number;
  isFull: boolean;
  reason: string | null;
  createdBy: string;
  createdByName: string | null;
  shiftId: string | null;
  createdAt: string;
  items: SaleReturnItem[];
}

export interface SaleReturnResult extends SaleReturn {
  refundSplits: { method: string; amount: number }[];
}
