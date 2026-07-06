import type {
  Product,
  Category,
  CartItem,
  Customer,
  CustomerDebt,
  CustomerAddress,
  CustomerAddressInput,
  CustomerPhone,
  CustomerPhoneInput,
  CustomerProfile,
  PaymentRecord,
  PurchaseInvoice,
  SaleInvoice,
  AuthSession,
  LoginCredentials,
  User,
  ReportRequest,
  ReportResult,
  Shift,
  ShiftSummary,
  Employee,
  SalaryHistoryRecord,
  SalarySummary,
  ExpenseCategory,
  Expense,
  NetSummary,
  Alert,
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
} from "@/lib/types";
export {};
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}
declare global {
  interface Window {
    api: {
      auth: {
        login: (
          credentials: LoginCredentials,
        ) => Promise<ApiResponse<AuthSession>>;
        logout: (sessionId: string) => Promise<ApiResponse>;
        getSession: (sessionId: string) => Promise<ApiResponse<AuthSession>>;
        getActiveSession: () => Promise<ApiResponse<AuthSession>>;
        getUsers: () => Promise<ApiResponse<User[]>>;
        changePassword: (
          userId: string,
          newPassword: string,
        ) => Promise<ApiResponse>;
      };

      categories: {
        getAll: () => Promise<ApiResponse<Category[]>>;
        create: (data: Omit<Category, "id">) => Promise<ApiResponse<Category>>;
        update: (
          id: string,
          data: Partial<Category>,
        ) => Promise<ApiResponse<Category>>;
        delete: (id: string) => Promise<ApiResponse>;
      };

      products: {
        getAll: () => Promise<ApiResponse<Product[]>>;
        getById: (id: string) => Promise<ApiResponse<Product>>;
        getByBarcode: (barcode: string) => Promise<ApiResponse<Product>>;
        generateBarcode: () => Promise<ApiResponse<string>>;
        create: (data: Omit<Product, "id">) => Promise<ApiResponse<Product>>;
        update: (
          id: string,
          data: Partial<Product>,
        ) => Promise<ApiResponse<Product>>;
        delete: (id: string) => Promise<ApiResponse>;
        deductStock: (id: string, amount: number) => Promise<ApiResponse>;
        addStock: (id: string, amount: number) => Promise<ApiResponse>;
        getForSales: () => Promise<ApiResponse<Product[]>>;
      };

      purchase: {
        getAll: () => Promise<ApiResponse<PurchaseInvoice[]>>;
        getById: (id: string) => Promise<ApiResponse<PurchaseInvoice>>;
        save: (
          data: Omit<PurchaseInvoice, "id">,
        ) => Promise<ApiResponse<PurchaseInvoice>>;
        addPayment: (
          invoiceId: string,
          paymentData: Partial<PaymentRecord>,
        ) => Promise<ApiResponse<PurchaseInvoice>>;
        delete: (id: string) => Promise<ApiResponse>;
      };

      sales: {
        getBySource: (
          source: string,
          from?: string,
          to?: string,
        ) => Promise<ApiResponse<SaleInvoice[]>>;
        getAll: () => Promise<ApiResponse<SaleInvoice[]>>;
        getById: (id: string) => Promise<ApiResponse<SaleInvoice>>;
        complete: (checkoutData: {
          items: CartItem[];
          total: number;
          cashier: string;
          shiftId?: string | null;
          totalPaid?: number;
          paymentMethod?: string;
          customerInfo?: { name?: string; phone?: string; notes?: string };
        }) => Promise<
          ApiResponse<{
            id: string;
            invoiceNumber: string;
            changeDue: number;
            remainingDebt: number;
            debt?: { id: string; customerId: string } | null;
          }>
        >;
        getStats: (
          from?: string,
          to?: string,
        ) => Promise<ApiResponse<{ total: number; count: number }>>;
      };

      customers: {
        getAll: () => Promise<ApiResponse<Customer[]>>;
        getById: (id: string) => Promise<ApiResponse<Customer>>;
        create: (
          data: Omit<Customer, "id" | "totalDebt">,
        ) => Promise<ApiResponse<Customer>>;
        update: (
          id: string,
          data: Partial<Customer>,
        ) => Promise<ApiResponse<Customer>>;
        delete: (id: string) => Promise<ApiResponse>;
        getDebts: (customerId: string) => Promise<ApiResponse<CustomerDebt[]>>;
        addDebt: (
          data: Omit<CustomerDebt, "id" | "paymentHistory">,
        ) => Promise<ApiResponse<CustomerDebt>>;
        getByAnyPhone: (phone: string) => Promise<ApiResponse<Customer | null>>;
        getProfile: (
          customerId: string,
        ) => Promise<ApiResponse<CustomerProfile>>;
        getAddresses: (
          customerId: string,
        ) => Promise<ApiResponse<CustomerAddress[]>>;
        addAddress: (
          customerId: string,
          data: CustomerAddressInput,
        ) => Promise<ApiResponse<CustomerAddress>>;
        updateAddress: (
          addressId: string,
          data: CustomerAddressInput,
        ) => Promise<ApiResponse<CustomerAddress>>;
        deleteAddress: (addressId: string) => Promise<ApiResponse>;
        setDefaultAddress: (
          customerId: string,
          addressId: string,
        ) => Promise<ApiResponse<CustomerAddress[]>>;
        getPhones: (
          customerId: string,
        ) => Promise<ApiResponse<CustomerPhone[]>>;
        addPhone: (
          customerId: string,
          data: CustomerPhoneInput,
        ) => Promise<ApiResponse<CustomerPhone>>;
        updatePhone: (
          phoneId: string,
          data: CustomerPhoneInput,
        ) => Promise<ApiResponse<CustomerPhone>>;
        deletePhone: (phoneId: string) => Promise<ApiResponse>;
      };

      debts: {
        getAll: () => Promise<ApiResponse<CustomerDebt[]>>;
        getById: (id: string) => Promise<ApiResponse<CustomerDebt>>;
        addPayment: (
          debtId: string,
          paymentData: Partial<PaymentRecord>,
        ) => Promise<ApiResponse<CustomerDebt>>;
        addBulkPayment: (data: {
          customerId: string;
          amount: number;
          paymentData: Partial<PaymentRecord>;
        }) => Promise<ApiResponse<CustomerDebt[]>>;
      };

      shifts: {
        getActive: (
          userId: string,
          date: string,
        ) => Promise<ApiResponse<Shift | null>>;
        getByUserAndDate: (
          userId: string,
          date: string,
        ) => Promise<ApiResponse<Shift[]>>;
        getOrCreate: (
          userId: string,
          date: string,
          nowIso: string,
        ) => Promise<ApiResponse<Shift>>;
        end: (shiftId: string, endedAt: string) => Promise<ApiResponse<Shift>>;
        getInvoices: (shiftId: string) => Promise<ApiResponse<SaleInvoice[]>>;
        getAllInvoices: (
          from?: string,
          to?: string,
        ) => Promise<ApiResponse<SaleInvoice[]>>;
        getSummary: (shiftId: string) => Promise<ApiResponse<ShiftSummary>>;
      };

      reports: {
        generate: (
          reportData: ReportRequest,
        ) => Promise<ApiResponse<ReportResult>>;
      };

      print: (htmlContent: string) => Promise<ApiResponse>;

      employees: {
        getAll: () => Promise<ApiResponse<Employee[]>>;
        getById: (id: string) => Promise<ApiResponse<Employee>>;
        create: (data: {
          username: string;
          password: string;
          displayName: string;
          role?: "staff" | "admin";
          salaryType?: "monthly" | "weekly";
          dailyHours?: number;
          salary?: number;
        }) => Promise<ApiResponse<Employee>>;
        update: (
          id: string,
          data: Partial<
            Pick<Employee, "displayName" | "salaryType" | "dailyHours">
          >,
        ) => Promise<ApiResponse<Employee>>;
        setSalary: (
          userId: string,
          amount: number,
          effectiveFrom: string,
          notes?: string,
        ) => Promise<ApiResponse<SalaryHistoryRecord>>;
        getSalaryHistory: (
          userId: string,
        ) => Promise<ApiResponse<SalaryHistoryRecord[]>>;
        setActive: (userId: string, isActive: boolean) => Promise<ApiResponse>;
        changePassword: (
          userId: string,
          newPassword: string,
        ) => Promise<ApiResponse>;
        getShifts: (
          userId: string,
          from?: string,
          to?: string,
        ) => Promise<ApiResponse<Shift[]>>;
        getShiftInvoices: (
          shiftId: string,
        ) => Promise<ApiResponse<SaleInvoice[]>>;
        getSalarySummary: (
          userId: string,
          from: string,
          to: string,
        ) => Promise<ApiResponse<SalarySummary>>;
      };

      expenses: {
        getCategories: () => Promise<ApiResponse<ExpenseCategory[]>>;
        createCategory: (name: string) => Promise<ApiResponse<ExpenseCategory>>;
        deleteCategory: (id: string) => Promise<ApiResponse>;
        add: (data: {
          categoryId: string;
          amount: number;
          date: string;
          description?: string;
        }) => Promise<ApiResponse<Expense>>;
        getAll: (from?: string, to?: string) => Promise<ApiResponse<Expense[]>>;
        delete: (id: string) => Promise<ApiResponse>;
        getNetSummary: (
          from: string,
          to: string,
        ) => Promise<ApiResponse<NetSummary>>;
      };

      alerts: {
        getAll: () => Promise<ApiResponse<Alert[]>>;
        markRead: (id: string) => Promise<ApiResponse>;
        markAllRead: () => Promise<ApiResponse>;
        setInvoiceDueDate: (
          invoiceId: string,
          dueDate: string,
        ) => Promise<ApiResponse>;
        runChecks: () => Promise<ApiResponse>;
      };

      onlineOrders: {
        getAll: (
          filters?: OnlineOrderFilters,
        ) => Promise<ApiResponse<OnlineOrder[]>>;
        getById: (id: string) => Promise<ApiResponse<OnlineOrder>>;
        create: (
          data: OnlineOrderCreateInput,
        ) => Promise<ApiResponse<OnlineOrder>>;
        update: (
          id: string,
          data: OnlineOrderUpdateInput,
        ) => Promise<ApiResponse<OnlineOrder>>;
        cancel: (id: string) => Promise<ApiResponse<OnlineOrder>>;
        updateStatus: (
          id: string,
          status: OnlineOrder["status"],
        ) => Promise<ApiResponse<OnlineOrder>>;
        dispatch: (
          orderId: string,
          driverId: string,
        ) => Promise<ApiResponse<OnlineOrder>>;
        markNotReceived: (id: string) => Promise<ApiResponse<OnlineOrder>>;
        calculateTrustLevel: (
          customerId: string,
        ) => Promise<ApiResponse<TrustLevelResult>>;
        uploadBillOfLading: (
          orderId: string,
          image: string,
        ) => Promise<ApiResponse<OnlineOrder>>;
      };

      drivers: {
        getAll: () => Promise<ApiResponse<Driver[]>>;
        getActive: () => Promise<ApiResponse<Driver[]>>;
        getById: (id: string) => Promise<ApiResponse<Driver>>;
        create: (data: DriverCreateInput) => Promise<ApiResponse<Driver>>;
        update: (
          id: string,
          data: DriverUpdateInput,
        ) => Promise<ApiResponse<Driver>>;
        getBalance: (driverId: string) => Promise<ApiResponse<number>>;
        registerManualPayment: (
          driverId: string,
          amount: number,
          notes?: string,
        ) => Promise<ApiResponse<DriverSettlement>>;
        getLedger: (
          driverId: string,
          filters?: DriverLedgerFilters,
        ) => Promise<ApiResponse<DriverSettlement[]>>;
        getSummary: (
          driverId: string,
          from?: string,
          to?: string,
        ) => Promise<
          ApiResponse<{
            deliveriesCount: number;
            totalCollected: number;
            totalDriverFees: number;
            totalPaidBack: number;
            currentBalance: number;
          }>
        >;
      };

      completeCheckout: (checkoutData: unknown) => Promise<ApiResponse>;
      savePurchaseInvoice: (invoiceData: unknown) => Promise<ApiResponse>;
      updatePurchasePayment: (paymentData: unknown) => Promise<ApiResponse>;
      generateReport: (reportData: unknown) => Promise<ApiResponse>;
      generateInvoice: (invoiceData: unknown) => Promise<ApiResponse>;

      windowControls: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void;
      };
    };
  }
}
