export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplier: string;
  date: string;
  time: string;
  items: import("@/features/products/types").InvoiceItem[];
  total: number;
  status: "paid" | "partial" | "unpaid";
  paidAmount: number;
  dueDate?: string | null;
  method?: import("@/lib/types").PaymentMethod;
  paymentHistory: import("@/lib/types").PaymentRecord[];
  receiptImage?: string;
}
