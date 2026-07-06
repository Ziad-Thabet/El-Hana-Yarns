import { Money } from "@/lib/domain";
import { ORDER_SOURCE_LABELS } from "@/lib/constants/onlineOrdersStatus";
import { computePaymentBreakdown } from "../../../shared/onlineOrdersPayment.mjs";
import { strings } from "@/lib/i18n/ar";
import type { OnlineOrder } from "./types";
import type { Driver } from "@/features/drivers/types";

export function buildDriverMessage(order: OnlineOrder, driver: Driver): string {
  const breakdown = computePaymentBreakdown(
    order.paymentMethod,
    order.productsTotal,
    order.deliveryFee,
    order.prepaidAmount,
  );

  const lines = [
    strings.onlineOrdersExtra.driverMessageNewOrder.replace(
      "{orderNumber}",
      order.orderNumber,
    ),
    strings.onlineOrdersExtra.driverMessageCustomer.replace(
      "{name}",
      order.customerName,
    ),
    strings.onlineOrdersExtra.driverMessagePhone.replace(
      "{phone}",
      order.customerPhone,
    ),
    strings.onlineOrdersExtra.driverMessageAddress.replace(
      "{address}",
      order.addressText,
    ),
    strings.onlineOrdersExtra.driverMessageSource.replace(
      "{source}",
      ORDER_SOURCE_LABELS[order.source],
    ),
    "",
    strings.onlineOrdersExtra.driverMessageItemCount.replace(
      "{count}",
      String(order.items.length),
    ),
    strings.onlineOrdersExtra.driverMessageGrandTotal.replace(
      "{total}",
      Money.from(order.grandTotal).toString(),
    ),
  ];

  if (breakdown.collectFromCustomer > 0) {
    lines.push(
      strings.onlineOrdersExtra.driverMessageCollect.replace(
        "{amount}",
        Money.from(breakdown.collectFromCustomer).toString(),
      ),
    );
  }
  if (breakdown.driverOwesShop > 0) {
    lines.push(
      strings.onlineOrdersExtra.driverMessageCustody.replace(
        "{amount}",
        Money.from(breakdown.driverOwesShop).toString(),
      ),
    );
  }
  if (breakdown.shopOwesDriver > 0) {
    lines.push(
      strings.onlineOrdersExtra.driverMessageFee.replace(
        "{amount}",
        Money.from(breakdown.shopOwesDriver).toString(),
      ),
    );
  }
  if (order.notes) {
    lines.push(
      "",
      strings.onlineOrdersExtra.driverMessageNotes.replace(
        "{notes}",
        order.notes,
      ),
    );
  }

  return lines.join("\n");
}
