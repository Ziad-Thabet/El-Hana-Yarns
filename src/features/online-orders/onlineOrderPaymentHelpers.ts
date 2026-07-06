import type { OrderPaymentMethod } from "./types";

export function needsOnlinePaymentChannel(
  paymentMethod: OrderPaymentMethod,
  prepaidAmount: number,
): boolean {
  return (
    paymentMethod === "paid_online" ||
    paymentMethod === "split" ||
    (paymentMethod === "partial" && prepaidAmount > 0)
  );
}
