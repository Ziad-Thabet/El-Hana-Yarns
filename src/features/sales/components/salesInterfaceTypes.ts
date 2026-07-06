import type { PaymentMethod } from "@/lib/constants/payment";
import type { Product } from "@/lib/types";

export interface PaymentSplit {
  id: string;
  method: PaymentMethod;
  amount: number;
  receiptImage?: string;
}

export interface QuantityDialogState {
  open: boolean;
  product: Product | null;
}
