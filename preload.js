const { contextBridge, ipcRenderer } = require("electron");

let currentSessionId = null;
const SESSIONLESS_CHANNELS = new Set(["auth:login"]);

const secureInvoke = (channel, data) => {
  if (
    data !== undefined &&
    typeof data !== "object" &&
    typeof data !== "string" &&
    typeof data !== "number"
  ) {
    console.error(`[Security] Invalid data type for channel: ${channel}`);
    return Promise.reject(new Error("Invalid request"));
  }
  return ipcRenderer.invoke(channel, data);
};

contextBridge.exposeInMainWorld("api", {
  auth: {
    login: (credentials) => {
      if (!credentials || typeof credentials !== "object") {
        return Promise.reject(new Error("Invalid credentials"));
      }
      if (
        typeof credentials.username !== "string" ||
        typeof credentials.password !== "string"
      ) {
        return Promise.reject(new Error("Invalid credentials format"));
      }
      return secureInvoke("auth:login", credentials);
    },
    logout: (sessionId) => {
      if (typeof sessionId !== "string") {
        return Promise.reject(new Error("Invalid session ID"));
      }
      return secureInvoke("auth:logout", sessionId);
    },
    getSession: (sessionId) => {
      if (typeof sessionId !== "string") {
        return Promise.reject(new Error("Invalid session ID"));
      }
      return secureInvoke("auth:getSession", sessionId);
    },
    getActiveSession: () => secureInvoke("auth:getActiveSession"),
    getUsers: () => secureInvoke("auth:getUsers"),
    changePassword: (userId, newPassword) => {
      if (typeof userId !== "string" || typeof newPassword !== "string") {
        return Promise.reject(new Error("Invalid password change request"));
      }
      return secureInvoke("auth:changePassword", { userId, newPassword });
    },
  },

  categories: {
    getAll: () => secureInvoke("categories:getAll"),
    create: (data) => {
      if (!data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid category data"));
      }
      return secureInvoke("categories:create", data);
    },
    update: (id, data) => {
      if (typeof id !== "string" || typeof data !== "object") {
        return Promise.reject(new Error("Invalid update data"));
      }
      return secureInvoke("categories:update", { id, data });
    },
    delete: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("categories:delete", id);
    },
  },

  products: {
    getAll: () => secureInvoke("products:getAll"),
    getById: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("products:getById", id);
    },
    getByBarcode: (barcode) => {
      if (typeof barcode !== "string") {
        return Promise.reject(new Error("Invalid barcode"));
      }
      return secureInvoke("products:getByBarcode", barcode);
    },
    generateBarcode: () => secureInvoke("products:generateBarcode"),
    create: (data) => {
      if (!data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid product data"));
      }
      return secureInvoke("products:create", data);
    },
    update: (id, data) => {
      if (typeof id !== "string" || typeof data !== "object") {
        return Promise.reject(new Error("Invalid update data"));
      }
      return secureInvoke("products:update", { id, data });
    },
    delete: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("products:delete", id);
    },
    getForSales: () => secureInvoke("products:getForSales"),
    deductStock: (id, amount) => {
      if (typeof id !== "string" || typeof amount !== "number") {
        return Promise.reject(new Error("Invalid stock data"));
      }
      return secureInvoke("products:deductStock", { id, amount });
    },
    addStock: (id, amount) => {
      if (typeof id !== "string" || typeof amount !== "number") {
        return Promise.reject(new Error("Invalid stock data"));
      }
      return secureInvoke("products:addStock", { id, amount });
    },
  },

  purchase: {
    getAll: () => secureInvoke("purchase:getAll"),
    getById: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("purchase:getById", id);
    },
    save: (data) => {
      if (!data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid invoice data"));
      }
      return secureInvoke("purchase:save", data);
    },
    addPayment: (invoiceId, paymentData) => {
      if (typeof invoiceId !== "string" || typeof paymentData !== "object") {
        return Promise.reject(new Error("Invalid payment data"));
      }
      return secureInvoke("purchase:addPayment", { invoiceId, paymentData });
    },
    delete: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("purchase:delete", id);
    },
  },

  sales: {
    getAll: () => secureInvoke("sales:getAll"),
    getById: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("sales:getById", id);
    },
    complete: (checkoutData) => {
      if (!checkoutData || typeof checkoutData !== "object") {
        return Promise.reject(new Error("Invalid checkout data"));
      }
      return secureInvoke("sales:complete", checkoutData);
    },
    getBySource: (source, from, to) => {
      if (typeof source !== "string")
        return Promise.reject(new Error("Invalid source"));
      return secureInvoke("sales:getBySource", { source, from, to });
    },
    getStats: (from, to) => {
      if (
        (from && typeof from !== "string") ||
        (to && typeof to !== "string")
      ) {
        return Promise.reject(new Error("Invalid date range"));
      }
      return secureInvoke("sales:getStats", { from, to });
    },
  },

  customers: {
    getAll: () => secureInvoke("customers:getAll"),
    getById: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("customers:getById", id);
    },
    create: (data) => {
      if (!data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid customer data"));
      }
      return secureInvoke("customers:create", data);
    },
    update: (id, data) => {
      if (typeof id !== "string" || typeof data !== "object") {
        return Promise.reject(new Error("Invalid update data"));
      }
      return secureInvoke("customers:update", { id, data });
    },
    delete: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("customers:delete", id);
    },
    getDebts: (customerId) => {
      if (typeof customerId !== "string") {
        return Promise.reject(new Error("Invalid customer ID"));
      }
      return secureInvoke("customers:getDebts", customerId);
    },
    addDebt: (data) => {
      if (!data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid debt data"));
      }
      return secureInvoke("customers:addDebt", data);
    },
    getByAnyPhone: (phone) => {
      if (typeof phone !== "string") {
        return Promise.reject(new Error("Invalid phone"));
      }
      return secureInvoke("customers:getByAnyPhone", phone);
    },
    getProfile: (customerId) => {
      if (typeof customerId !== "string") {
        return Promise.reject(new Error("Invalid customer ID"));
      }
      return secureInvoke("customers:getProfile", customerId);
    },
    getAddresses: (customerId) => {
      if (typeof customerId !== "string") {
        return Promise.reject(new Error("Invalid customer ID"));
      }
      return secureInvoke("customers:getAddresses", customerId);
    },
    addAddress: (customerId, data) => {
      if (typeof customerId !== "string" || !data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid address data"));
      }
      return secureInvoke("customers:addAddress", { customerId, data });
    },
    updateAddress: (addressId, data) => {
      if (typeof addressId !== "string" || !data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid address data"));
      }
      return secureInvoke("customers:updateAddress", { addressId, data });
    },
    deleteAddress: (addressId) => {
      if (typeof addressId !== "string") {
        return Promise.reject(new Error("Invalid address ID"));
      }
      return secureInvoke("customers:deleteAddress", addressId);
    },
    setDefaultAddress: (customerId, addressId) => {
      if (typeof customerId !== "string" || typeof addressId !== "string") {
        return Promise.reject(new Error("Invalid address data"));
      }
      return secureInvoke("customers:setDefaultAddress", {
        customerId,
        addressId,
      });
    },
    getPhones: (customerId) => {
      if (typeof customerId !== "string") {
        return Promise.reject(new Error("Invalid customer ID"));
      }
      return secureInvoke("customers:getPhones", customerId);
    },
    addPhone: (customerId, data) => {
      if (typeof customerId !== "string" || !data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid phone data"));
      }
      return secureInvoke("customers:addPhone", { customerId, data });
    },
    updatePhone: (phoneId, data) => {
      if (typeof phoneId !== "string" || !data || typeof data !== "object") {
        return Promise.reject(new Error("Invalid phone data"));
      }
      return secureInvoke("customers:updatePhone", { phoneId, data });
    },
    deletePhone: (phoneId) => {
      if (typeof phoneId !== "string") {
        return Promise.reject(new Error("Invalid phone ID"));
      }
      return secureInvoke("customers:deletePhone", phoneId);
    },
  },

  debts: {
    getAll: () => secureInvoke("debts:getAll"),
    getById: (id) => {
      if (typeof id !== "string") {
        return Promise.reject(new Error("Invalid ID"));
      }
      return secureInvoke("debts:getById", id);
    },
    addPayment: (debtId, paymentData) => {
      if (typeof debtId !== "string" || typeof paymentData !== "object") {
        return Promise.reject(new Error("Invalid payment data"));
      }
      return secureInvoke("debts:addPayment", { debtId, paymentData });
    },
    addBulkPayment: (data) => {
      if (
        typeof data !== "object" ||
        typeof data.customerId !== "string" ||
        typeof data.amount !== "number"
      ) {
        return Promise.reject(new Error("Invalid bulk payment data"));
      }
      return secureInvoke("debts:addBulkPayment", data);
    },
  },

  shifts: {
    getActive: (userId, date) => {
      if (typeof userId !== "string" || typeof date !== "string") {
        return Promise.reject(new Error("Invalid shift query data"));
      }
      return secureInvoke("shifts:getActive", { userId, date });
    },
    getByUserAndDate: (userId, date) => {
      if (typeof userId !== "string" || typeof date !== "string") {
        return Promise.reject(new Error("Invalid shift query data"));
      }
      return secureInvoke("shifts:getByUserAndDate", { userId, date });
    },
    getOrCreate: (userId, date, nowIso) => {
      if (
        typeof userId !== "string" ||
        typeof date !== "string" ||
        typeof nowIso !== "string"
      ) {
        return Promise.reject(new Error("Invalid shift data"));
      }
      return secureInvoke("shifts:getOrCreate", { userId, date, nowIso });
    },
    ensure: (userId, date, nowIso) => {
      if (
        typeof userId !== "string" ||
        typeof date !== "string" ||
        typeof nowIso !== "string"
      ) {
        return Promise.reject(new Error("Invalid shift data"));
      }
      return secureInvoke("shifts:ensure", { userId, date, nowIso });
    },
    end: (shiftId, endedAt) => {
      if (typeof shiftId !== "string" || typeof endedAt !== "string") {
        return Promise.reject(new Error("Invalid shift end data"));
      }
      return secureInvoke("shifts:end", { shiftId, endedAt });
    },
    getInvoices: (shiftId) => {
      if (typeof shiftId !== "string") {
        return Promise.reject(new Error("Invalid shift ID"));
      }
      return secureInvoke("shifts:getInvoices", shiftId);
    },
    getAllInvoices: (from, to) => {
      if (
        (from && typeof from !== "string") ||
        (to && typeof to !== "string")
      ) {
        return Promise.reject(new Error("Invalid date range"));
      }
      return secureInvoke("shifts:getAllInvoices", { from, to });
    },
    getSummary: (shiftId) => {
      if (typeof shiftId !== "string") {
        return Promise.reject(new Error("Invalid shift ID"));
      }
      return secureInvoke("shifts:getSummary", shiftId);
    },
  },

  reports: {
    generate: (reportData) => {
      if (!reportData || typeof reportData !== "object") {
        return Promise.reject(new Error("Invalid report data"));
      }
      return secureInvoke("reports:generate", reportData);
    },
  },

  print: (htmlContent) => {
    if (typeof htmlContent !== "string") {
      return Promise.reject(new Error("Invalid print data"));
    }
    return secureInvoke("print:invoice", htmlContent);
  },

  employees: {
    getAll: () => secureInvoke("employees:getAll"),
    getById: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid ID"));
      return secureInvoke("employees:getById", id);
    },
    create: (data) => {
      if (!data || typeof data !== "object")
        return Promise.reject(new Error("Invalid employee data"));
      return secureInvoke("employees:create", data);
    },
    update: (id, data) => {
      if (typeof id !== "string" || typeof data !== "object")
        return Promise.reject(new Error("Invalid update data"));
      return secureInvoke("employees:update", { id, data });
    },
    setSalary: (userId, amount, effectiveFrom, notes) => {
      if (
        typeof userId !== "string" ||
        typeof amount !== "number" ||
        typeof effectiveFrom !== "string"
      ) {
        return Promise.reject(new Error("Invalid salary data"));
      }
      return secureInvoke("employees:setSalary", {
        userId,
        amount,
        effectiveFrom,
        notes,
      });
    },
    getSalaryHistory: (userId) => {
      if (typeof userId !== "string")
        return Promise.reject(new Error("Invalid user ID"));
      return secureInvoke("employees:getSalaryHistory", userId);
    },
    setActive: (userId, isActive) => {
      if (typeof userId !== "string" || typeof isActive !== "boolean") {
        return Promise.reject(new Error("Invalid activation data"));
      }
      return secureInvoke("employees:setActive", { userId, isActive });
    },
    changePassword: (userId, newPassword) => {
      if (typeof userId !== "string" || typeof newPassword !== "string") {
        return Promise.reject(new Error("Invalid password data"));
      }
      return secureInvoke("employees:changePassword", { userId, newPassword });
    },
    getShifts: (userId, from, to) => {
      if (typeof userId !== "string")
        return Promise.reject(new Error("Invalid user ID"));
      return secureInvoke("employees:getShifts", { userId, from, to });
    },
    getShiftInvoices: (shiftId) => {
      if (typeof shiftId !== "string")
        return Promise.reject(new Error("Invalid shift ID"));
      return secureInvoke("employees:getShiftInvoices", shiftId);
    },
    getSalarySummary: (userId, from, to) => {
      if (typeof userId !== "string")
        return Promise.reject(new Error("Invalid user ID"));
      return secureInvoke("employees:getSalarySummary", { userId, from, to });
    },
  },

  expenses: {
    getCategories: () => secureInvoke("expenses:getCategories"),
    createCategory: (name) => {
      if (typeof name !== "string" || !name.trim())
        return Promise.reject(new Error("Invalid category name"));
      return secureInvoke("expenses:createCategory", name);
    },
    deleteCategory: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid ID"));
      return secureInvoke("expenses:deleteCategory", id);
    },
    add: (data) => {
      if (!data || typeof data !== "object")
        return Promise.reject(new Error("Invalid expense data"));
      return secureInvoke("expenses:add", data);
    },
    getAll: (from, to) => secureInvoke("expenses:getAll", { from, to }),
    delete: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid ID"));
      return secureInvoke("expenses:delete", id);
    },
    getNetSummary: (from, to) => {
      if (typeof from !== "string" || typeof to !== "string") {
        return Promise.reject(new Error("Invalid date range"));
      }
      return secureInvoke("expenses:getNetSummary", { from, to });
    },
  },

  alerts: {
    getAll: () => secureInvoke("alerts:getAll"),
    markRead: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid ID"));
      return secureInvoke("alerts:markRead", id);
    },
    markAllRead: () => secureInvoke("alerts:markAllRead"),
    setInvoiceDueDate: (invoiceId, dueDate) => {
      if (typeof invoiceId !== "string" || typeof dueDate !== "string") {
        return Promise.reject(new Error("Invalid due date data"));
      }
      return secureInvoke("alerts:setInvoiceDueDate", { invoiceId, dueDate });
    },
    runChecks: () => secureInvoke("alerts:runChecks"),
  },

  onlineOrders: {
    getAll: (filters) => secureInvoke("onlineOrders:getAll", filters ?? {}),
    getById: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid order ID"));
      return secureInvoke("onlineOrders:getById", id);
    },
    create: (data) => {
      if (!data || typeof data !== "object")
        return Promise.reject(new Error("Invalid order data"));
      return secureInvoke("onlineOrders:create", data);
    },
    update: (id, data) => {
      if (typeof id !== "string" || typeof data !== "object") {
        return Promise.reject(new Error("Invalid order update data"));
      }
      return secureInvoke("onlineOrders:update", { id, data });
    },
    cancel: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid order ID"));
      return secureInvoke("onlineOrders:cancel", id);
    },
    updateStatus: (id, status) => {
      if (typeof id !== "string" || typeof status !== "string") {
        return Promise.reject(new Error("Invalid status update data"));
      }
      return secureInvoke("onlineOrders:updateStatus", { id, status });
    },
    dispatch: (orderId, driverId) => {
      if (typeof orderId !== "string" || typeof driverId !== "string") {
        return Promise.reject(new Error("Invalid dispatch data"));
      }
      return secureInvoke("onlineOrders:dispatch", { orderId, driverId });
    },
    markNotReceived: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid order ID"));
      return secureInvoke("onlineOrders:markNotReceived", id);
    },
    calculateTrustLevel: (customerId) => {
      if (typeof customerId !== "string")
        return Promise.reject(new Error("Invalid customer ID"));
      return secureInvoke("onlineOrders:calculateTrustLevel", customerId);
    },
    uploadBillOfLading: (orderId, image) => {
      if (typeof orderId !== "string")
        return Promise.reject(new Error("Invalid order ID"));
      return secureInvoke("onlineOrders:uploadBillOfLading", {
        orderId,
        image,
      });
    },
  },

  drivers: {
    getAll: () => secureInvoke("drivers:getAll"),
    getActive: () => secureInvoke("drivers:getActive"),
    getById: (id) => {
      if (typeof id !== "string")
        return Promise.reject(new Error("Invalid driver ID"));
      return secureInvoke("drivers:getById", id);
    },
    create: (data) => {
      if (!data || typeof data !== "object")
        return Promise.reject(new Error("Invalid driver data"));
      return secureInvoke("drivers:create", data);
    },
    update: (id, data) => {
      if (typeof id !== "string" || typeof data !== "object") {
        return Promise.reject(new Error("Invalid driver update data"));
      }
      return secureInvoke("drivers:update", { id, data });
    },
    getBalance: (driverId) => {
      if (typeof driverId !== "string")
        return Promise.reject(new Error("Invalid driver ID"));
      return secureInvoke("drivers:getBalance", driverId);
    },
    registerManualPayment: (driverId, amount, notes) => {
      if (typeof driverId !== "string" || typeof amount !== "number") {
        return Promise.reject(new Error("Invalid payment data"));
      }
      return secureInvoke("drivers:registerManualPayment", {
        driverId,
        amount,
        notes,
      });
    },
    getLedger: (driverId, filters) => {
      if (typeof driverId !== "string")
        return Promise.reject(new Error("Invalid driver ID"));
      return secureInvoke("drivers:getLedger", { driverId, filters });
    },
    getSummary: (driverId, from, to) => {
      if (typeof driverId !== "string")
        return Promise.reject(new Error("Invalid driver ID"));
      return secureInvoke("drivers:getSummary", { driverId, from, to });
    },
  },

  completeCheckout: (checkoutData) => {
    if (!checkoutData || typeof checkoutData !== "object") {
      return Promise.reject(new Error("Invalid checkout data"));
    }
    return secureInvoke("complete-checkout", checkoutData);
  },
  savePurchaseInvoice: (invoiceData) => {
    if (!invoiceData || typeof invoiceData !== "object") {
      return Promise.reject(new Error("Invalid invoice data"));
    }
    return secureInvoke("save-purchase-invoice", invoiceData);
  },
  updatePurchasePayment: (paymentData) => {
    if (!paymentData || typeof paymentData !== "object") {
      return Promise.reject(new Error("Invalid payment data"));
    }
    return secureInvoke("update-purchase-payment", paymentData);
  },
  generateReport: (reportData) => {
    if (!reportData || typeof reportData !== "object") {
      return Promise.reject(new Error("Invalid report data"));
    }
    return secureInvoke("generate-report", reportData);
  },

  windowControls: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (cb) => {
      ipcRenderer.on("window:maximized", (_, value) => cb(value));
      return () => ipcRenderer.removeAllListeners("window:maximized");
    },
  },
});
