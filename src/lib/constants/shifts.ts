export const SHIFT_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
} as const;
export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS];
import { strings } from "@/lib/i18n/ar";

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  get open() {
    return strings.shifts.statusOpen;
  },
  get closed() {
    return strings.shifts.statusClosed;
  },
};
export const SALES_INVOICES_TAB = {
  MY_SHIFT: "my_shift",
  ALL_SALES: "all_sales",
} as const;
export type SalesInvoicesTab =
  (typeof SALES_INVOICES_TAB)[keyof typeof SALES_INVOICES_TAB];
