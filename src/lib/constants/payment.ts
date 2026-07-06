import { strings } from "@/lib/i18n/ar";
export const PAYMENT_METHODS = ["cash", "vodafone", "instapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  get cash() {
    return strings.shifts.totalCash;
  },
  get vodafone() {
    return strings.shifts.totalVodafone;
  },
  get instapay() {
    return strings.shifts.totalInstapay;
  },
};

export const SHIFT_PAYMENT_KEYS = {
  CASH: "cash",
  VODAFONE_CASH: "vodafone_cash",
  INSTAPAY: "instapay",
} as const;
export type ShiftPaymentKey =
  (typeof SHIFT_PAYMENT_KEYS)[keyof typeof SHIFT_PAYMENT_KEYS];
export const SHIFT_PAYMENT_LABELS: Record<ShiftPaymentKey, string> = {
  get cash() {
    return strings.shifts.totalCash;
  },
  get vodafone_cash() {
    return strings.shifts.totalVodafone;
  },
  get instapay() {
    return strings.shifts.totalInstapay;
  },
};
