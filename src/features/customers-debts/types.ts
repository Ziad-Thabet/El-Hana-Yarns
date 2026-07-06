import type { PaymentRecord } from "@/lib/types";

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  totalDebt: number;
  lastPaymentDate?: string;
}

export interface CustomerDebt {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentHistory: PaymentRecord[];
  createdDate: string;
  lastUpdated: string;
  notes?: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string | null;
  region: string | null;
  addressText: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CustomerAddressInput {
  label?: string | null;
  region?: string | null;
  addressText: string;
  isDefault?: boolean;
}

export interface CustomerPhone {
  id: string;
  customerId: string;
  phone: string;
  label: string | null;
  createdAt: string;
}

export interface CustomerPhoneInput {
  phone: string;
  label?: string | null;
}

export interface CustomerProfile {
  customer: Customer;
  addresses: CustomerAddress[];
  phones: CustomerPhone[];
}