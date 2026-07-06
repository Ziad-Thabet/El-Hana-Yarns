export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "dispatched"
  | "cancelled"
  | "not_received";

export type OrderSource =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "phone"
  | "other";

export type OrderPaymentMethod = "cod" | "paid_online" | "split" | "partial";

export type OrderPaymentStatus =
  | "paid"
  | "partial"
  | "unpaid"
  | "refund_required";

export type TrustLevel = "regular" | "vip" | "warning" | "high_risk";

export interface OnlineOrderItem {
  id: string;
  productId: string | null;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  isWeighted?: boolean;
  weightGrams?: number | null;
  measureAmount?: number | null;
  measureUnit?: string | null;
  pricePerKg?: number | null;
}

export interface OnlineOrderItemInput {
  productId?: string | null;
  name: string;
  price: number;
  quantity: number;
  lineTotal?: number;
  isWeighted?: boolean;
  weightGrams?: number | null;
  measureAmount?: number | null;
  measureUnit?: string | null;
  pricePerKg?: number | null;
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  dailySequence: number;
  orderDate: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  addressId: string | null;
  addressText: string;
  addressLabel: string | null;
  source: OrderSource;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  productsTotal: number;
  deliveryFee: number;
  grandTotal: number;
  prepaidAmount: number;
  remainingAmount: number;
  driverId: string | null;
  requestedDateTime: string | null;
  notes: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  saleInvoiceId: string | null;
  billOfLadingImage: string | null;
  preSelectedDriverId: string | null;
  onlinePaymentChannel: "vodafone" | "instapay" | null;
  items: OnlineOrderItem[];
}

export interface OnlineOrderCreateInput {
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  saveCustomer?: boolean;
  addressId?: string | null;
  addressText: string;
  addressLabel?: string | null;
  source: OrderSource;
  paymentMethod: OrderPaymentMethod;
  deliveryFee?: number;
  prepaidAmount?: number;
  requestedDateTime?: string | null;
  notes?: string | null;
  createdBy: string;
  preSelectedDriverId?: string | null;
  onlinePaymentChannel?: "vodafone" | "instapay" | null;
  initialStatus?: OrderStatus;
  items: OnlineOrderItemInput[];
}

export interface OnlineOrderUpdateInput {
  customerName: string;
  customerPhone: string;
  addressId?: string | null;
  addressText: string;
  addressLabel?: string | null;
  source: OrderSource;
  paymentMethod: OrderPaymentMethod;
  deliveryFee?: number;
  prepaidAmount?: number;
  requestedDateTime?: string | null;
  notes?: string | null;
  onlinePaymentChannel?: "vodafone" | "instapay" | null;
  items: OnlineOrderItemInput[];
}

export interface OnlineOrderFilters {
  status?: OrderStatus;
  from?: string;
  to?: string;
}

export interface TrustLevelResult {
  trustLevel: TrustLevel;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  notReceivedOrders: number;
  successRate: number;
  totalSpent: number;
  lastOrderDate: string | null;
}
