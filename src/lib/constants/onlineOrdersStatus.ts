import {
  ORDER_STATUS as ORDER_STATUS_RAW,
  ORDER_SOURCE as ORDER_SOURCE_RAW,
  ORDER_PAYMENT_METHOD as ORDER_PAYMENT_METHOD_RAW,
  ORDER_PAYMENT_STATUS as ORDER_PAYMENT_STATUS_RAW,
  TRUST_LEVEL as TRUST_LEVEL_RAW,
  SETTLEMENT_TYPE as SETTLEMENT_TYPE_RAW,
} from "../../../shared/onlineOrdersEnums.mjs";
import { strings } from "@/lib/i18n/ar";

const ORDER_STATUS = ORDER_STATUS_RAW as {
  readonly NEW: "new";
  readonly PREPARING: "preparing";
  readonly READY: "ready";
  readonly DISPATCHED: "dispatched";
  readonly CANCELLED: "cancelled";
  readonly NOT_RECEIVED: "not_received";
};

const ORDER_SOURCE = ORDER_SOURCE_RAW as {
  readonly WHATSAPP: "whatsapp";
  readonly FACEBOOK: "facebook";
  readonly INSTAGRAM: "instagram";
  readonly PHONE: "phone";
  readonly OTHER: "other";
};

const ORDER_PAYMENT_METHOD = ORDER_PAYMENT_METHOD_RAW as {
  readonly COD: "cod";
  readonly PAID_ONLINE: "paid_online";
  readonly SPLIT: "split";
  readonly PARTIAL: "partial";
};

const ORDER_PAYMENT_STATUS = ORDER_PAYMENT_STATUS_RAW as {
  readonly PAID: "paid";
  readonly PARTIAL: "partial";
  readonly UNPAID: "unpaid";
  readonly REFUND_REQUIRED: "refund_required";
};

const TRUST_LEVEL = TRUST_LEVEL_RAW as {
  readonly REGULAR: "regular";
  readonly VIP: "vip";
  readonly WARNING: "warning";
  readonly HIGH_RISK: "high_risk";
};

const SETTLEMENT_TYPE = SETTLEMENT_TYPE_RAW as {
  readonly CUSTODY_CHARGE: "custody_charge";
  readonly DRIVER_PAYMENT: "driver_payment";
  readonly SHOP_OWES_DRIVER: "shop_owes_driver";
  readonly MANUAL_ADJUSTMENT: "manual_adjustment";
};

export const ORDER_STATUSES = Object.values(ORDER_STATUS);
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  get [ORDER_STATUS.NEW]() {
    return strings.onlineOrdersStatusLabels.statusNew;
  },
  get [ORDER_STATUS.PREPARING]() {
    return strings.onlineOrdersStatusLabels.statusPreparing;
  },
  get [ORDER_STATUS.READY]() {
    return strings.onlineOrdersStatusLabels.statusReady;
  },
  get [ORDER_STATUS.DISPATCHED]() {
    return strings.onlineOrdersStatusLabels.statusDispatched;
  },
  get [ORDER_STATUS.CANCELLED]() {
    return strings.onlineOrdersStatusLabels.statusCancelled;
  },
  get [ORDER_STATUS.NOT_RECEIVED]() {
    return strings.onlineOrdersStatusLabels.statusNotReceived;
  },
};

export const ORDER_STATUS_COLORS: Record<OrderStatusValue, string> = {
  [ORDER_STATUS.NEW]: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  [ORDER_STATUS.PREPARING]:
    "bg-amber-500/10 text-amber-600 border-amber-500/20",
  [ORDER_STATUS.READY]: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  [ORDER_STATUS.DISPATCHED]:
    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  [ORDER_STATUS.CANCELLED]: "bg-red-500/10 text-red-600 border-red-500/20",
  [ORDER_STATUS.NOT_RECEIVED]:
    "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export const ORDER_SOURCES = Object.values(ORDER_SOURCE);
export type OrderSourceValue = (typeof ORDER_SOURCES)[number];

export const ORDER_SOURCE_LABELS: Record<OrderSourceValue, string> = {
  get [ORDER_SOURCE.WHATSAPP]() {
    return strings.onlineOrdersStatusLabels.sourceWhatsapp;
  },
  get [ORDER_SOURCE.FACEBOOK]() {
    return strings.onlineOrdersStatusLabels.sourceFacebook;
  },
  get [ORDER_SOURCE.INSTAGRAM]() {
    return strings.onlineOrdersStatusLabels.sourceInstagram;
  },
  get [ORDER_SOURCE.PHONE]() {
    return strings.onlineOrdersStatusLabels.sourcePhone;
  },
  get [ORDER_SOURCE.OTHER]() {
    return strings.onlineOrdersStatusLabels.sourceOther;
  },
};

export const ORDER_PAYMENT_METHODS = Object.values(ORDER_PAYMENT_METHOD);
export type OrderPaymentMethodValue = (typeof ORDER_PAYMENT_METHODS)[number];

export const ORDER_PAYMENT_METHOD_LABELS: Record<
  OrderPaymentMethodValue,
  string
> = {
  get [ORDER_PAYMENT_METHOD.COD]() {
    return strings.onlineOrdersStatusLabels.paymentMethodCod;
  },
  get [ORDER_PAYMENT_METHOD.PAID_ONLINE]() {
    return strings.onlineOrdersStatusLabels.paymentMethodPaidOnline;
  },
  get [ORDER_PAYMENT_METHOD.SPLIT]() {
    return strings.onlineOrdersStatusLabels.paymentMethodSplit;
  },
  get [ORDER_PAYMENT_METHOD.PARTIAL]() {
    return strings.onlineOrdersStatusLabels.paymentMethodPartial;
  },
};

export const ORDER_PAYMENT_STATUSES = Object.values(ORDER_PAYMENT_STATUS);
export type OrderPaymentStatusValue = (typeof ORDER_PAYMENT_STATUSES)[number];

export const ORDER_PAYMENT_STATUS_LABELS: Record<
  OrderPaymentStatusValue,
  string
> = {
  get [ORDER_PAYMENT_STATUS.PAID]() {
    return strings.onlineOrdersStatusLabels.paymentStatusPaid;
  },
  get [ORDER_PAYMENT_STATUS.PARTIAL]() {
    return strings.onlineOrdersStatusLabels.paymentStatusPartial;
  },
  get [ORDER_PAYMENT_STATUS.UNPAID]() {
    return strings.onlineOrdersStatusLabels.paymentStatusUnpaid;
  },
  get [ORDER_PAYMENT_STATUS.REFUND_REQUIRED]() {
    return strings.onlineOrdersStatusLabels.paymentStatusRefundRequired;
  },
};
export const TRUST_LEVELS = Object.values(TRUST_LEVEL);
export type TrustLevelValue = (typeof TRUST_LEVELS)[number];

export const TRUST_LEVEL_LABELS: Record<TrustLevelValue, string> = {
  get [TRUST_LEVEL.REGULAR]() {
    return strings.onlineOrdersStatusLabels.trustRegular;
  },
  get [TRUST_LEVEL.VIP]() {
    return strings.onlineOrdersStatusLabels.trustVip;
  },
  get [TRUST_LEVEL.WARNING]() {
    return strings.onlineOrdersStatusLabels.trustWarning;
  },
  get [TRUST_LEVEL.HIGH_RISK]() {
    return strings.onlineOrdersStatusLabels.trustHighRisk;
  },
};

export const TRUST_LEVEL_COLORS: Record<TrustLevelValue, string> = {
  [TRUST_LEVEL.REGULAR]: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  [TRUST_LEVEL.VIP]: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  [TRUST_LEVEL.WARNING]:
    "bg-orange-500/10 text-orange-600 border-orange-500/20",
  [TRUST_LEVEL.HIGH_RISK]: "bg-red-500/10 text-red-600 border-red-500/20",
};

export const SETTLEMENT_TYPES = Object.values(SETTLEMENT_TYPE);
export type SettlementTypeValue = (typeof SETTLEMENT_TYPES)[number];

export const SETTLEMENT_TYPE_LABELS: Record<SettlementTypeValue, string> = {
  get [SETTLEMENT_TYPE.CUSTODY_CHARGE]() {
    return strings.onlineOrdersStatusLabels.settlementCustodyCharge;
  },
  get [SETTLEMENT_TYPE.DRIVER_PAYMENT]() {
    return strings.onlineOrdersStatusLabels.settlementDriverPayment;
  },
  get [SETTLEMENT_TYPE.SHOP_OWES_DRIVER]() {
    return strings.onlineOrdersStatusLabels.settlementShopOwesDriver;
  },
  get [SETTLEMENT_TYPE.MANUAL_ADJUSTMENT]() {
    return strings.onlineOrdersStatusLabels.settlementManualAdjustment;
  },
};
