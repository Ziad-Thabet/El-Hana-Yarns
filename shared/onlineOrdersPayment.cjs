const { ORDER_PAYMENT_METHOD } = require("./onlineOrdersEnums.cjs");

function computePaymentBreakdown(
  paymentMethod,
  productsTotal,
  deliveryFee,
  prepaidInput = 0,
) {
  const grandTotal = productsTotal + deliveryFee;
  switch (paymentMethod) {
    case ORDER_PAYMENT_METHOD.COD:
      return {
        grandTotal,
        prepaidAmount: 0,
        remainingAmount: productsTotal,
        collectFromCustomer: grandTotal,
        driverOwesShop: productsTotal,
        shopOwesDriver: 0,
      };
    case ORDER_PAYMENT_METHOD.PAID_ONLINE:
      return {
        grandTotal,
        prepaidAmount: grandTotal,
        remainingAmount: 0,
        collectFromCustomer: 0,
        driverOwesShop: 0,
        shopOwesDriver: deliveryFee,
      };
    case ORDER_PAYMENT_METHOD.SPLIT:
      return {
        grandTotal,
        prepaidAmount: productsTotal,
        remainingAmount: deliveryFee,
        collectFromCustomer: deliveryFee,
        driverOwesShop: 0,
        shopOwesDriver: 0,
      };
    case ORDER_PAYMENT_METHOD.PARTIAL: {
      const prepaidAmount = Math.max(0, Math.min(prepaidInput, productsTotal));
      const remainingAmount = productsTotal - prepaidAmount;
      return {
        grandTotal,
        prepaidAmount,
        remainingAmount,
        collectFromCustomer: remainingAmount + deliveryFee,
        driverOwesShop: remainingAmount,
        shopOwesDriver: 0,
      };
    }
    default:
      throw new Error(`طريقة دفع غير معروفة: ${paymentMethod}`);
  }
}

module.exports = { computePaymentBreakdown };
