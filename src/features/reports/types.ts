import type {
  IsoDate,
  ReportDateRange,
  PaymentMethod,
  Product,
} from "@/lib/types";
import type { CustomerDebt } from "@/features/customers-debts/types";

export type ReportType =
  | "sales"
  | "purchases"
  | "inventory"
  | "debts"
  | "dashboard"
  | "online_orders";

export interface ReportRequest {
  type: ReportType;
  from?: string;
  to?: string;
}

export interface PaymentMethodSummary {
  method: PaymentMethod | "unknown";
  amount: number;
  count: number;
  share: number;
  byRefType: Record<string, { amount: number; count: number }>;
}

export interface PaymentAnalytics {
  methods: PaymentMethodSummary[];
  totalAmount: number;
}

export interface SalesTrendPoint {
  date: IsoDate;
  revenue: number;
  invoices: number;
}

export interface PurchasesTrendPoint {
  date: IsoDate;
  spend: number;
  invoices: number;
}

export interface SalesComparison {
  currentPeriod: {
    from: IsoDate;
    to: IsoDate;
    revenue: number;
    invoices: number;
  };
  previousPeriod: {
    from: IsoDate;
    to: IsoDate;
    revenue: number;
    invoices: number;
  };
  revenueChange: number;
  invoiceChange: number;
}

export interface PurchasesComparison {
  currentPeriod: {
    from: IsoDate;
    to: IsoDate;
    spend: number;
    invoices: number;
  };
  previousPeriod: {
    from: IsoDate;
    to: IsoDate;
    spend: number;
    invoices: number;
  };
  spendChange: number;
  invoiceChange: number;
}

export interface SalesReportStats {
  total: number;
  count: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  sold: number;
}

export interface ProductPerformance {
  name: string;
  barcode: string | null;
  category: string;
  revenue: number;
  quantity: number;
  averagePrice: number;
  estimatedCost: number;
  grossProfit: number;
  grossMargin: number;
  invoiceCount: number;
}

export interface CategoryPerformance {
  category: string;
  revenue: number;
  quantity: number;
  invoices: number;
  revenueShare: number;
}

export interface InvoiceAnalytics {
  averageTransactionValue: number;
  averageUnitsPerInvoice: number;
  averageUnitPrice: number;
  totalQuantity: number;
  invoiceCount: number;
}

export interface ReportCustomerRow {
  id: string;
  name: string;
  totalDebt: number;
  lastPaymentDate: IsoDate | null;
  remainingAmount: number;
  debtCount: number;
}

export interface CustomerSegments {
  highValue: ReportCustomerRow[];
  atRisk: ReportCustomerRow[];
  regular: ReportCustomerRow[];
  inactive: ReportCustomerRow[];
}

export interface CustomerAnalytics {
  customers: ReportCustomerRow[];
  segments: CustomerSegments;
}

export interface SalesBusinessHealth {
  revenueGrowth: number;
  transactionGrowth: number;
  averageMargin: number;
  topCategories: CategoryPerformance[];
}

export interface SalesReportAnalytics {
  invoiceAnalytics: InvoiceAnalytics;
  productPerformance: ProductPerformance[];
  categoryPerformance: CategoryPerformance[];
  paymentAnalytics: PaymentAnalytics;
  customerAnalytics: CustomerAnalytics;
  trend: SalesTrendPoint[];
  comparisons: SalesComparison | null;
  businessHealth: SalesBusinessHealth;
}

export interface SalesReport {
  type: "sales";
  stats: SalesReportStats;
  topProducts: TopProduct[];
  analytics: SalesReportAnalytics;
  metadata: {
    generatedAt: string;
    dateRange: ReportDateRange;
    recordCounts: { saleInvoices: number; saleItems: number };
  };
}

export interface PurchasesReportStats {
  total: number;
  count: number;
  paid: number;
  unpaid: number;
}

export interface SupplierPerformance {
  supplier: string;
  spend: number;
  paid: number;
  unpaid: number;
  invoices: number;
}

export interface PurchasesReportAnalytics {
  supplierPerformance: SupplierPerformance[];
  trend: PurchasesTrendPoint[];
  comparison: PurchasesComparison | null;
  paymentAnalytics: PaymentAnalytics;
}

export interface PurchasesReport {
  type: "purchases";
  stats: PurchasesReportStats;
  analytics: PurchasesReportAnalytics;
  metadata: {
    generatedAt: string;
    dateRange: ReportDateRange;
    recordCounts: { purchaseInvoices: number; suppliers: number };
  };
}

export interface InventoryTotals {
  inventoryValueRetail: number;
  inventoryValueCost: number;
  lowStockCount: number;
  outOfStockCount: number;
  productCount: number;
}

export interface InventoryHealthMetrics {
  lowStockRate: number;
  outOfStockRate: number;
}

export interface MovementProduct {
  productId: string | null;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface InventoryMovement {
  fastMoving: MovementProduct[];
  slowMoving: MovementProduct[];
}

export interface InventoryReportAnalytics {
  totals: InventoryTotals;
  movement: InventoryMovement;
  overstockItems: (Product & { estimatedCost: number })[];
  health: InventoryHealthMetrics;
}

export interface InventoryReport {
  type: "inventory";
  products: Product[];
  lowStock: Product[];
  analytics: InventoryReportAnalytics;
  metadata: {
    generatedAt: string;
    productCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

export interface CustomerDebtSummary {
  customerName: string;
  remainingAmount: number;
  totalAmount: number;
  debtCount: number;
}

export interface DebtSegmentCustomer {
  id: string;
  name: string;
  remainingAmount: number;
  lastPaymentDate: IsoDate | null;
}

export interface DebtCustomerSegments {
  highValue: DebtSegmentCustomer[];
  atRisk: DebtSegmentCustomer[];
  regular: DebtSegmentCustomer[];
  inactive: DebtSegmentCustomer[];
}

export interface DebtsReportAnalytics {
  customerSummary: CustomerDebtSummary[];
  segments: DebtCustomerSegments;
  paymentAnalytics: PaymentAnalytics;
  topDebtors: CustomerDebtSummary[];
}

export interface DebtsReport {
  type: "debts";
  debts: CustomerDebt[];
  totalRemaining: number;
  analytics: DebtsReportAnalytics;
  metadata: {
    generatedAt: string;
    debtCount: number;
    totalRemaining: number;
  };
}

export interface DashboardKPIs {
  revenue: number;
  invoices: number;
  spend: number;
  unpaidPurchases: number;
  totalDebt: number;
  debtCount: number;
  grossProfit: number;
  grossMargin: number;
  productCount: number;
  outOfStock: number;
  lowStock: number;
  averageTransactionValue: number;
  expensesTotal: number;
  salariesTotal: number;
  purchasesPaidActual: number;
  trueNetProfit: number;
  collectedFromCheckout: number;
  collectedFromDebtSettlement: number;
  driverCustodyCollected: number;
  driverFeesPaid: number;
  pendingRefunds: number;
  pendingRefundsCount: number;
}
export interface DashboardComparison {
  revenueChange: number;
  bookedRevenueChange: number;
  invoiceChange: number;
  spendChange: number;
  previousPeriod: {
    from: IsoDate;
    to: IsoDate;
    revenue: number;
    collectedRevenue: number;
    invoices: number;
    spend: number;
  };
}

export interface DashboardTrendPoint {
  date: IsoDate;
  revenue: number;
  spend: number;
  invoices: number;
}

export interface DashboardCategoryBreakdown {
  category: string;
  revenue: number;
  share: number;
}

export interface DashboardPaymentMethod {
  method: string;
  amount: number;
  count: number;
}

export interface DashboardTopDebtor {
  name: string;
  remaining: number;
}

export interface DashboardReport {
  type: "dashboard";
  kpis: DashboardKPIs;
  comparison: DashboardComparison | null;
  combinedTrend: DashboardTrendPoint[];
  topProducts: TopProduct[];
  categoryBreakdown: DashboardCategoryBreakdown[];
  paymentMethods: DashboardPaymentMethod[];
  topDebtors: DashboardTopDebtor[];
  metadata: { generatedAt: string; dateRange: ReportDateRange };
}

export interface OnlineOrdersReportStats {
  totalOrders: number;
  dispatchedCount: number;
  cancelledCount: number;
  notReceivedCount: number;
  revenue: number;
  averageOrderValue: number;
  successRate: number;
  cancellationRate: number;
  notReceivedRate: number;
}

export interface OnlineOrdersStatusBreakdown {
  status: string;
  count: number;
  revenue: number;
}

export interface OnlineOrdersSourceBreakdown {
  source: string;
  count: number;
  revenue: number;
}

export interface OnlineOrdersPaymentMethodBreakdown {
  paymentMethod: string;
  count: number;
  revenue: number;
}

export interface OnlineOrdersTopCustomer {
  customerId: string | null;
  customerName: string;
  orderCount: number;
  totalSpent: number;
  trustLevel: string | null;
}

export interface OnlineOrdersDriverPerformance {
  driverId: string;
  driverName: string;
  isActive: boolean;
  deliveries: number;
  revenue: number;
  currentBalance: number;
}

export interface OnlineOrdersCustomerDistribution {
  vip: number;
  regular: number;
  warning: number;
  high_risk: number;
}

export interface OnlineOrdersTopArea {
  area: string;
  count: number;
  revenue: number;
}

export interface OnlineOrdersDriverSettlementTotals {
  totalOwedToShop: number;
  totalOwedToDrivers: number;
}

export interface OnlineOrdersReportAnalytics {
  statusBreakdown: OnlineOrdersStatusBreakdown[];
  sourceBreakdown: OnlineOrdersSourceBreakdown[];
  paymentMethodBreakdown: OnlineOrdersPaymentMethodBreakdown[];
  topCustomers: OnlineOrdersTopCustomer[];
  driverPerformance: OnlineOrdersDriverPerformance[];
  customerDistribution: OnlineOrdersCustomerDistribution;
  topAreas: OnlineOrdersTopArea[];
  driverSettlementTotals: OnlineOrdersDriverSettlementTotals;
}

export interface OnlineOrdersReport {
  type: "online_orders";
  stats: OnlineOrdersReportStats;
  analytics: OnlineOrdersReportAnalytics;
  metadata: { generatedAt: string; dateRange: ReportDateRange };
}

export type ReportResult =
  | SalesReport
  | PurchasesReport
  | InventoryReport
  | DebtsReport
  | DashboardReport
  | OnlineOrdersReport;
