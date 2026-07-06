import type {
  Product,
  Category,
  PurchaseInvoice,
  SaleInvoice,
  Customer,
  CustomerDebt,
  CustomerAddress,
  CustomerAddressInput,
  CustomerPhone,
  CustomerPhoneInput,
  CustomerProfile,
  PaymentRecord,
  AuthSession,
  LoginCredentials,
  User,
  CartItem,
  ReportRequest,
  ReportResult,
  Employee,
  SalaryHistoryRecord,
  SalarySummary,
  ExpenseCategory,
  Expense,
  NetSummary,
  OnlineOrder,
  OnlineOrderCreateInput,
  OnlineOrderUpdateInput,
  OnlineOrderFilters,
  TrustLevelResult,
  Driver,
  DriverCreateInput,
  DriverUpdateInput,
  DriverSettlement,
  DriverLedgerFilters,
} from "./types";
async function call<T>(
  fn: () => Promise<{ success: boolean; data?: T; message?: string }>,
): Promise<T> {
  const res = await fn();
  if (!res.success) throw new Error(res.message ?? "Unknown error");
  return res.data as T;
}
// AUTH
export const authApi = {
  login: (credentials: LoginCredentials) =>
    call(() => window.api.auth.login(credentials)),
  logout: (sessionId: string) => call(() => window.api.auth.logout(sessionId)),
  getSession: (sessionId: string) =>
    call(() => window.api.auth.getSession(sessionId)),
  getActiveSession: () =>
    call<AuthSession>(() => window.api.auth.getActiveSession()),
 getUsers: () => call<User[]>(() => window.api.auth.getUsers()),
  changePassword: (userId: string, newPassword: string) =>
    call(() => window.api.auth.changePassword(userId, newPassword)),
};
// CATEGORIES
export const categoriesApi = {
  getAll: () => call<Category[]>(() => window.api.categories.getAll()),
  create: (data: Omit<Category, "id">) =>
    call<Category>(() => window.api.categories.create(data)),
  update: (id: string, data: Partial<Category>) =>
    call<Category>(() => window.api.categories.update(id, data)),
  delete: (id: string) => call(() => window.api.categories.delete(id)),
};
// PRODUCTS
export const productsApi = {
  getAll: () => call<Product[]>(() => window.api.products.getAll()),
  getById: (id: string) => call<Product>(() => window.api.products.getById(id)),
  getByBarcode: (barcode: string) =>
    call<Product>(() => window.api.products.getByBarcode(barcode)),
  generateBarcode: () =>
    call<string>(() => window.api.products.generateBarcode()),
  create: (data: Omit<Product, "id">) =>
    call<Product>(() => window.api.products.create(data)),
  update: (id: string, data: Partial<Product>) =>
    call<Product>(() => window.api.products.update(id, data)),
  delete: (id: string) => call(() => window.api.products.delete(id)),
  deductStock: (id: string, amount: number) =>
    call(() => window.api.products.deductStock(id, amount)),
  addStock: (id: string, amount: number) =>
    call(() => window.api.products.addStock(id, amount)),
  getForSales: () => call<Product[]>(() => window.api.products.getForSales()),
};
// PURCHASE
export const purchaseApi = {
  getAll: () => call<PurchaseInvoice[]>(() => window.api.purchase.getAll()),
  getById: (id: string) =>
    call<PurchaseInvoice>(() => window.api.purchase.getById(id)),
  save: (data: Omit<PurchaseInvoice, "id">) =>
    call<PurchaseInvoice>(() => window.api.purchase.save(data)),
  addPayment: (invoiceId: string, paymentData: Partial<PaymentRecord>) =>
    call<PurchaseInvoice>(() =>
      window.api.purchase.addPayment(invoiceId, paymentData),
    ),
  delete: (id: string) => call(() => window.api.purchase.delete(id)),
};
// SALES
export const salesApi = {
  getAll: () => call<SaleInvoice[]>(() => window.api.sales.getAll()),
  getById: (id: string) =>
    call<SaleInvoice>(() => window.api.sales.getById(id)),
  complete: (checkoutData: {
    items: CartItem[];
    total: number;
    cashier: string;
    shiftId?: string | null;
    totalPaid?: number;
    paymentMethod?: string;
    customerInfo?: { name?: string; phone?: string; notes?: string };
  }) =>
    call<{
      id: string;
      invoiceNumber: string;
      changeDue: number;
      remainingDebt: number;
      debt?: { id: string; customerId: string } | null;
    }>(() => window.api.sales.complete(checkoutData)),
  getBySource: (source: "online" | "pos", from?: string, to?: string) =>
    call<SaleInvoice[]>(() => window.api.sales.getBySource(source, from, to)),
  getStats: (from?: string, to?: string) =>
    call<{ total: number; count: number }>(() =>
      window.api.sales.getStats(from, to),
    ),
};
// CUSTOMERS
export const customersApi = {
  getAll: () => call<Customer[]>(() => window.api.customers.getAll()),
  getById: (id: string) =>
    call<Customer>(() => window.api.customers.getById(id)),
  create: (data: Omit<Customer, "id" | "totalDebt">) =>
    call<Customer>(() => window.api.customers.create(data)),
  update: (id: string, data: Partial<Customer>) =>
    call<Customer>(() => window.api.customers.update(id, data)),
  delete: (id: string) => call(() => window.api.customers.delete(id)),
  getDebts: (customerId: string) =>
    call<CustomerDebt[]>(() => window.api.customers.getDebts(customerId)),
  addDebt: (data: Omit<CustomerDebt, "id" | "paymentHistory">) =>
    call<CustomerDebt>(() => window.api.customers.addDebt(data)),
  getByAnyPhone: (phone: string) =>
    call<Customer | null>(() => window.api.customers.getByAnyPhone(phone)),
  getProfile: (customerId: string) =>
    call<CustomerProfile>(() => window.api.customers.getProfile(customerId)),
  getAddresses: (customerId: string) =>
    call<CustomerAddress[]>(() =>
      window.api.customers.getAddresses(customerId),
    ),
  addAddress: (customerId: string, data: CustomerAddressInput) =>
    call<CustomerAddress>(() =>
      window.api.customers.addAddress(customerId, data),
    ),
  updateAddress: (addressId: string, data: CustomerAddressInput) =>
    call<CustomerAddress>(() =>
      window.api.customers.updateAddress(addressId, data),
    ),
  deleteAddress: (addressId: string) =>
    call(() => window.api.customers.deleteAddress(addressId)),
  setDefaultAddress: (customerId: string, addressId: string) =>
    call<CustomerAddress[]>(() =>
      window.api.customers.setDefaultAddress(customerId, addressId),
    ),
  getPhones: (customerId: string) =>
    call<CustomerPhone[]>(() => window.api.customers.getPhones(customerId)),
  addPhone: (customerId: string, data: CustomerPhoneInput) =>
    call<CustomerPhone>(() => window.api.customers.addPhone(customerId, data)),
  updatePhone: (phoneId: string, data: CustomerPhoneInput) =>
    call<CustomerPhone>(() => window.api.customers.updatePhone(phoneId, data)),
  deletePhone: (phoneId: string) =>
    call(() => window.api.customers.deletePhone(phoneId)),
};
export const debtsApi = {
  getAll: () => call<CustomerDebt[]>(() => window.api.debts.getAll()),
  getById: (id: string) =>
    call<CustomerDebt>(() => window.api.debts.getById(id)),
  addPayment: (debtId: string, paymentData: Partial<PaymentRecord>) =>
    call<CustomerDebt>(() => window.api.debts.addPayment(debtId, paymentData)),
  addBulkPayment: (
    customerId: string,
    amount: number,
    paymentData: Partial<PaymentRecord>,
  ) =>
    call<CustomerDebt[]>(() =>
      window.api.debts.addBulkPayment({ customerId, amount, paymentData }),
    ),
};
// REPORTS
export const reportsApi = {
  generate: (reportData: ReportRequest) =>
    call<ReportResult>(() => window.api.reports.generate(reportData)),
};
// EMPLOYEES
export const employeesApi = {
  getAll: () => call<Employee[]>(() => window.api.employees.getAll()),
  getById: (id: string) =>
    call<Employee>(() => window.api.employees.getById(id)),
  getSalaryHistory: (userId: string) =>
    call<SalaryHistoryRecord[]>(() =>
      window.api.employees.getSalaryHistory(userId),
    ),
  getSalarySummary: (userId: string, from: string, to: string) =>
    call<SalarySummary>(() =>
      window.api.employees.getSalarySummary(userId, from, to),
    ),
  create: (data: {
    username: string;
    password: string;
    displayName: string;
    role?: "staff" | "admin";
    salaryType?: "monthly" | "weekly";
    dailyHours?: number;
    salary?: number;
  }) => call<Employee>(() => window.api.employees.create(data)),
  update: (
    id: string,
    data: Partial<Pick<Employee, "displayName" | "salaryType" | "dailyHours">>,
  ) => call<Employee>(() => window.api.employees.update(id, data)),
  setSalary: (
    userId: string,
    amount: number,
    effectiveFrom: string,
    notes?: string,
  ) =>
    call<SalaryHistoryRecord>(() =>
      window.api.employees.setSalary(userId, amount, effectiveFrom, notes),
    ),
  setActive: (userId: string, isActive: boolean) =>
    call(() => window.api.employees.setActive(userId, isActive)),
  changePassword: (userId: string, newPassword: string) =>
    call(() => window.api.employees.changePassword(userId, newPassword)),
};
// EXPENSES
export const expensesApi = {
  getCategories: () =>
    call<ExpenseCategory[]>(() => window.api.expenses.getCategories()),
  getAll: (from?: string, to?: string) =>
    call<Expense[]>(() => window.api.expenses.getAll(from, to)),
  getNetSummary: (from: string, to: string) =>
    call<NetSummary>(() => window.api.expenses.getNetSummary(from, to)),
  add: (data: {
    categoryId: string;
    amount: number;
    date: string;
    description?: string;
  }) => call<Expense>(() => window.api.expenses.add(data)),
  delete: (id: string) => call(() => window.api.expenses.delete(id)),
  createCategory: (name: string) =>
    call<ExpenseCategory>(() => window.api.expenses.createCategory(name)),
  deleteCategory: (id: string) =>
    call(() => window.api.expenses.deleteCategory(id)),
};
// ONLINE ORDERS
export const onlineOrdersApi = {
  getAll: (filters?: OnlineOrderFilters) =>
    call<OnlineOrder[]>(() => window.api.onlineOrders.getAll(filters)),
  getById: (id: string) =>
    call<OnlineOrder>(() => window.api.onlineOrders.getById(id)),
  create: (data: OnlineOrderCreateInput) =>
    call<OnlineOrder>(() => window.api.onlineOrders.create(data)),
  update: (id: string, data: OnlineOrderUpdateInput) =>
    call<OnlineOrder>(() => window.api.onlineOrders.update(id, data)),
  cancel: (id: string) =>
    call<OnlineOrder>(() => window.api.onlineOrders.cancel(id)),
  updateStatus: (id: string, status: OnlineOrder["status"]) =>
    call<OnlineOrder>(() => window.api.onlineOrders.updateStatus(id, status)),
  dispatch: (orderId: string, driverId: string) =>
    call<OnlineOrder>(() =>
      window.api.onlineOrders.dispatch(orderId, driverId),
    ),
  markNotReceived: (id: string) =>
    call<OnlineOrder>(() => window.api.onlineOrders.markNotReceived(id)),
  calculateTrustLevel: (customerId: string) =>
    call<TrustLevelResult>(() =>
      window.api.onlineOrders.calculateTrustLevel(customerId),
    ),
  uploadBillOfLading: (orderId: string, image: string) =>
    call<OnlineOrder>(() =>
      window.api.onlineOrders.uploadBillOfLading(orderId, image),
    ),
};
// DRIVERS
export const driversApi = {
  getAll: () => call<Driver[]>(() => window.api.drivers.getAll()),
  getActive: () => call<Driver[]>(() => window.api.drivers.getActive()),
  getById: (id: string) => call<Driver>(() => window.api.drivers.getById(id)),
  create: (data: DriverCreateInput) =>
    call<Driver>(() => window.api.drivers.create(data)),
  update: (id: string, data: DriverUpdateInput) =>
    call<Driver>(() => window.api.drivers.update(id, data)),
  getBalance: (driverId: string) =>
    call<number>(() => window.api.drivers.getBalance(driverId)),
  registerManualPayment: (driverId: string, amount: number, notes?: string) =>
    call<DriverSettlement>(() =>
      window.api.drivers.registerManualPayment(driverId, amount, notes),
    ),
  getLedger: (driverId: string, filters?: DriverLedgerFilters) =>
    call<DriverSettlement[]>(() =>
      window.api.drivers.getLedger(driverId, filters),
    ),
  getSummary: (driverId: string, from?: string, to?: string) =>
    call<{
      deliveriesCount: number;
      totalCollected: number;
      totalDriverFees: number;
      totalPaidBack: number;
      currentBalance: number;
    }>(() => window.api.drivers.getSummary(driverId, from, to)),
};
