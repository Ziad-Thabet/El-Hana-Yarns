export type DriverType = "driver" | "company_next_day" | "company_direct";

export type SettlementType =
  | "custody_charge"
  | "driver_payment"
  | "shop_owes_driver"
  | "manual_adjustment";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  driverType: DriverType;
  paysNextDay: boolean;
  createdAt: string;
}

export interface DriverCreateInput {
  name: string;
  phone: string;
  driverType?: DriverType;
  paysNextDay?: boolean;
}

export interface DriverUpdateInput {
  name: string;
  phone: string;
  isActive: boolean;
  driverType: DriverType;
  paysNextDay: boolean;
}

export interface DriverSummary {
  deliveriesCount: number;
  totalCollected: number;
  totalDriverFees: number;
  totalPaidBack: number;
  currentBalance: number;
}

export interface DriverSettlement {
  id: string;
  driverId: string;
  orderId: string | null;
  type: SettlementType;
  amount: number;
  balanceAfter: number;
  date: string;
  time: string;
  notes: string | null;
}

export interface DriverLedgerFilters {
  from?: string;
  to?: string;
}
