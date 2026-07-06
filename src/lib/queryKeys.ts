export const QK = {
  products: ["products"] as const,
  categories: ["categories"] as const,
  sales: ["sales"] as const,
  purchases: ["purchases"] as const,
  customers: ["customers"] as const,
  customerProfile: (customerId: string) =>
    ["customers", "profile", customerId] as const,
  customerAddresses: (customerId: string) =>
    ["customers", "addresses", customerId] as const,
  customerPhones: (customerId: string) =>
    ["customers", "phones", customerId] as const,
  debts: ["debts"] as const,
  salesBySource: (source: string, from?: string, to?: string) =>
    ["sales", "by-source", source, from, to] as const,
  salesStats: (from?: string, to?: string) =>
    ["sales", "stats", from, to] as const,
  reports: (type: string, from?: string, to?: string) =>
    ["reports", type, from, to] as const,
  shiftInvoices: (shiftId: string) => ["shifts", "invoices", shiftId] as const,
  allShiftInvoices: (from?: string, to?: string) =>
    ["shifts", "all-invoices", from, to] as const,
  activeShift: (userId: string, date: string) =>
    ["shifts", "active", userId, date] as const,
  shiftsByUserAndDate: (userId: string, date: string) =>
    ["shifts", "by-user-date", userId, date] as const,
  employees: ["employees"] as const,
  salaryHistory: (userId: string) =>
    ["employees", "salary-history", userId] as const,
  salarySummary: (userId: string, from: string, to: string) =>
    ["employees", "salary-summary", userId, from, to] as const,
  expenseCategories: ["expenses", "categories"] as const,
  expensesList: (from?: string, to?: string) =>
    ["expenses", "list", from, to] as const,
  netSummary: (from?: string, to?: string) =>
    ["expenses", "net-summary", from, to] as const,
  authSession: ["auth", "session"] as const,
  onlineOrders: (filters?: { status?: string; from?: string; to?: string }) =>
    ["online-orders", filters?.status, filters?.from, filters?.to] as const,
  onlineOrder: (id: string) => ["online-orders", "detail", id] as const,
  customerTrustLevel: (customerId: string) =>
    ["online-orders", "trust-level", customerId] as const,
  drivers: ["drivers"] as const,
  activeDrivers: ["drivers", "active"] as const,
  driverBalance: (driverId: string) =>
    ["drivers", "balance", driverId] as const,
  driverLedger: (driverId: string, from?: string, to?: string) =>
    ["drivers", "ledger", driverId, from, to] as const,
  shiftSummary: (shiftId: string) => ["shifts", "summary", shiftId] as const,
} as const;
