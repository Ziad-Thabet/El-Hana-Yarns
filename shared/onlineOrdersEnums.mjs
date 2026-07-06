const ORDER_STATUS = {
  NEW: "new",
  PREPARING: "preparing",
  READY: "ready",
  DISPATCHED: "dispatched",
  CANCELLED: "cancelled",
  NOT_RECEIVED: "not_received",
};

const PRE_DISPATCH_STATUSES = [
  ORDER_STATUS.NEW,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
];

const ORDER_SOURCE = {
  WHATSAPP: "whatsapp",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  PHONE: "phone",
  OTHER: "other",
};

const ORDER_PAYMENT_METHOD = {
  COD: "cod",
  PAID_ONLINE: "paid_online",
  SPLIT: "split",
  PARTIAL: "partial",
};

const SETTLEMENT_TYPE = {
  CUSTODY_CHARGE: "custody_charge",
  DRIVER_PAYMENT: "driver_payment",
  SHOP_OWES_DRIVER: "shop_owes_driver",
  MANUAL_ADJUSTMENT: "manual_adjustment",
};

const ORDER_PAYMENT_STATUS = {
  PAID: "paid",
  PARTIAL: "partial",
  UNPAID: "unpaid",
  REFUND_REQUIRED: "refund_required",
};

const TRUST_LEVEL = {  REGULAR: "regular",
  VIP: "vip",
  WARNING: "warning",
  HIGH_RISK: "high_risk",
};

const TRUST_LEVEL_RULES = {
  MIN_ORDERS_FOR_JUDGMENT: 3,
  VIP_MIN_SUCCESSFUL_ORDERS: 10,
  VIP_MIN_SUCCESS_RATE: 0.85,
  WARNING_FAILED_COUNT_THRESHOLD: 2,
  HIGH_RISK_MIN_ORDERS: 3,
  HIGH_RISK_FAILURE_RATE_THRESHOLD: 0.4,
};

export {
  ORDER_STATUS,
  PRE_DISPATCH_STATUSES,
  ORDER_SOURCE,
  ORDER_PAYMENT_METHOD,
  ORDER_PAYMENT_STATUS,
  SETTLEMENT_TYPE,
  TRUST_LEVEL,
  TRUST_LEVEL_RULES,
};
