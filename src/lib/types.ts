export type { UnitType } from "@/features/products/types";

export type PaymentMethod = "cash" | "vodafone" | "instapay";

export type { Category } from "@/features/categories/types";

export type { Product } from "@/features/products/types";

export type { CartItem, InvoiceItem } from "@/features/products/types";

export type { PurchaseInvoice } from "@/features/purchases/types";

export type { SaleInvoice } from "@/features/sales/types";

export type { Customer } from "@/features/customers-debts/types";
export type {
  CustomerAddress,
  CustomerAddressInput,
  CustomerPhone,
  CustomerPhoneInput,
  CustomerProfile,
} from "@/features/customers-debts/types";

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  time: string;
  method: PaymentMethod;
  receiptImage?: string;
  notes?: string;
}

import type { CustomerDebt } from "@/features/customers-debts/types";
export type { CustomerDebt };

export type UserRole = "admin" | "staff";

export type {
  AuthSession,
  LoginCredentials,
  User,
} from "@/features/auth/types";

export type IsoDate = string;

export interface ReportDateRange {
  from: IsoDate | null;
  to: IsoDate | null;
}
export type {
  ReportType,
  ReportRequest,
  ReportResult,
  PaymentMethodSummary,
  PaymentAnalytics,
  SalesTrendPoint,
  PurchasesTrendPoint,
  SalesComparison,
  PurchasesComparison,
  SalesReportStats,
  TopProduct,
  ProductPerformance,
  CategoryPerformance,
  InvoiceAnalytics,
  ReportCustomerRow,
  CustomerSegments,
  CustomerAnalytics,
  SalesBusinessHealth,
  SalesReportAnalytics,
  SalesReport,
  PurchasesReportStats,
  SupplierPerformance,
  PurchasesReportAnalytics,
  PurchasesReport,
  InventoryTotals,
  InventoryHealthMetrics,
  MovementProduct,
  InventoryMovement,
  InventoryReportAnalytics,
  InventoryReport,
  CustomerDebtSummary,
  DebtSegmentCustomer,
  DebtCustomerSegments,
  DebtsReportAnalytics,
  DebtsReport,
  DashboardKPIs,
  DashboardComparison,
  DashboardTrendPoint,
  DashboardCategoryBreakdown,
  DashboardPaymentMethod,
  DashboardTopDebtor,
  DashboardReport,
  OnlineOrdersReportStats,
  OnlineOrdersStatusBreakdown,
  OnlineOrdersSourceBreakdown,
  OnlineOrdersPaymentMethodBreakdown,
  OnlineOrdersTopCustomer,
  OnlineOrdersDriverPerformance,
  OnlineOrdersReportAnalytics,
  OnlineOrdersReport,
} from "@/features/reports/types";
export type { Alert, AlertType } from "@/features/alerts/types";
export type { Shift } from "@/features/sales/types";

export type { ShiftSummary } from "@/features/sales/types";

export type {
  SalaryType,
  Employee,
  SalaryHistoryRecord,
  ShiftSalaryDetail,
  SalarySummary,
} from "@/features/employees/types";

export type {
  ExpenseCategory,
  Expense,
  NetSummaryExpenseLine,
  NetSummary,
} from "@/features/expenses/types";

export type {
  OrderStatus,
  OrderSource,
  OrderPaymentMethod,
  OrderPaymentStatus,
  TrustLevel,
  OnlineOrderItem,
  OnlineOrderItemInput,
  OnlineOrder,
  OnlineOrderCreateInput,
  OnlineOrderUpdateInput,
  OnlineOrderFilters,
  TrustLevelResult,
} from "@/features/online-orders/types";

export type {
  SettlementType,
  Driver,
  DriverCreateInput,
  DriverUpdateInput,
  DriverSettlement,
  DriverLedgerFilters,
} from "@/features/drivers/types";
