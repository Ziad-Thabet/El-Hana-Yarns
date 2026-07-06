export type AlertType =
  | "low_stock"
  | "out_of_stock"
  | "invoice_overdue"
  | "invoice_due"
  | "shift_open";

export interface Alert {
  id: string;
  type: AlertType;
  ref_id: string | null;
  message: string;
  is_read: number;
  due_date: string | null;
  created_at: string;
}
