const {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  session,
} = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication");
app.commandLine.appendSwitch(
  "disable-features",
  "AutofillEnableSupportForContours",
);
const sessionManager = require("./session-manager.cjs");
const rateLimiter = require("./rate-limiter.cjs");
const { CHANNEL_PERMISSIONS } = require("./ipc-channels.cjs");
const { formatDateYMD } = require("./shared/dateRules.cjs");
if (process.platform === "win32") {
  app.setAppUserModelId("com.elhanayarns.app");
}
let mainWindow;
const isDev = !app.isPackaged;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    title: "El-Hana Yarns",
    icon: path.join(__dirname, "src/assets/icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:8080");
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedOrigins = isDev ? ["http://localhost:8080"] : ["file://"];
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
      console.warn(`[Security] Blocked navigation to: ${url}`);
    }
  });
  if (!isDev) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow.webContents.closeDevTools();
    });
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window:maximized", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window:maximized", false);
  });
}

function handle(channel, fn) {
  const permission = CHANNEL_PERMISSIONS[channel];
  if (!permission) {
    console.warn(`[Security] Channel not in permissions map: ${channel}`);
  }
  ipcMain.handle(channel, async (_, ...args) => {
    try {
      if (permission !== "public") {
        const firstArg = args[0];
        const sessionIdFromRequest =
          typeof firstArg === "string" && firstArg.length >= 20
            ? firstArg
            : typeof firstArg?.sessionId === "string"
              ? firstArg.sessionId
              : null;

        let session = sessionIdFromRequest
          ? sessionManager.get(sessionIdFromRequest)
          : null;
        if (!session) {
          const activeSessions = sessionManager.getAll
            ? sessionManager.getAll()
            : [];
          session = activeSessions.length > 0 ? activeSessions[0] : null;
        }
        if (!session) {
          throw new Error("Authentication required");
        }
        if (permission === "admin" && session.role !== "admin") {
          console.warn(
            `[Security] Role violation: user="${session.username}" role="${session.role}" tried channel="${channel}"`,
          );
          throw new Error("صلاحيات المسؤول مطلوبة لهذه العملية");
        }
      }
      const result = await fn(...args, session ?? null);
      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) console.error("[IPC Stack]", error.stack);
      else console.error("[IPC Error]", message);
      return { success: false, message };
    }
  });
}

function registerHandlers() {
  const {
    categoriesDB,
    productsDB,
    authDB,
    purchaseDB,
    salesDB,
    customersDB,
    debtsDB,
    reportsDB,
    shiftsDB,
    employeesDB,
    expensesDB,
    alertsDB,
    driversDB,
    onlineOrdersDB,
  } = db;
  function getTodayDateYMD() {
    return formatDateYMD(new Date());
  }
  function resolveActiveShiftId(session) {
    if (!session?.userId) return null;
    const shift = shiftsDB.getActive(session.userId, getTodayDateYMD());
    return shift?.id ?? null;
  }
  handle("auth:login", (credentials) => {
    const username = credentials?.username?.trim?.();
    const password = credentials?.password;
    if (!username || !password) return null;
    const todayDate = formatDateYMD(new Date());
    db.globalAutoCloseShifts();
    if (rateLimiter.isLocked(username)) {
      const remaining = rateLimiter.getLockoutTimeRemaining(username);
      throw new Error(
        `الحساب محظور مؤقتاً. حاول مرة أخرى بعد ${remaining} ثانية.`,
      );
    }
    const user = authDB.login(username, password);
    if (!user) {
      const nowLocked = rateLimiter.recordFailedAttempt(username);
      if (nowLocked) {
        throw new Error("محاولات كثيرة. الحساب محظور لمدة 5 دقائق.");
      }
      throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    }
    const userRow = db.employeesDB ? employeesDB.getById(user.userId) : null;
    if (userRow && userRow.isActive === false) {
      rateLimiter.reset(username);
      throw new Error("الحساب معطّل، تواصل مع المسؤول");
    }
    rateLimiter.reset(username);
    const sessionId = sessionManager.create(
      user.userId,
      user.username,
      user.role,
      user.displayName,
    );
    const activeSession = sessionManager.get(sessionId);
    const firstLoginAt = sessionManager.getFirstLoginAt(user.userId);
    const activeShift = shiftsDB.getActive(user.userId, todayDate);
    return {
      sessionId,
      userId: user.userId,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      startedAt: activeSession?.startedAt ?? new Date().toISOString(),
      firstLoginAt,
      shiftId: activeShift?.id ?? null,
    };
  });

  ipcMain.handle("auth:logout", async (_, sessionId) => {
    try {
      if (sessionId) sessionManager.destroy(sessionId);
      return { success: true, data: { success: true } };
    } catch {
      return { success: true, data: { success: true } };
    }
  });
  handle("auth:getSession", (sessionId) => sessionManager.get(sessionId));
  handle("auth:getActiveSession", () => {
    db.globalAutoCloseShifts();
    const sessions = sessionManager.getAll();
    if (sessions.length === 0) return null;
    const s = sessions[0];
    const todayDate = formatDateYMD(new Date());
    const activeShift = shiftsDB.getActive(s.userId, todayDate);
    const firstLoginAt = sessionManager.getFirstLoginAt(s.userId);
    return { ...s, shiftId: activeShift?.id ?? null, firstLoginAt };
  });
  handle("auth:getUsers", () => authDB.getUsers());
  handle("auth:changePassword", ({ userId, newPassword }) =>
    authDB.changePassword(userId, newPassword),
  );
  // ── CATEGORIES ────────────────────────────
  handle("categories:getAll", () => categoriesDB.getAll());
  handle("categories:create", (data) => categoriesDB.create(data));
  handle("categories:update", ({ id, data }) => categoriesDB.update(id, data));
  handle("categories:delete", (id) => categoriesDB.delete(id));
  // ── PRODUCTS ──────────────────────────────
  handle("products:getAll", () => productsDB.getAll());
  handle("products:getForSales", () => productsDB.getForSales());
  handle("products:getById", (id) => productsDB.getById(id));
  handle("products:getByBarcode", (barcode) =>
    productsDB.getByBarcode(barcode),
  );
  handle("products:generateBarcode", () => productsDB.generateUniqueBarcode());
  handle("products:create", (data) => productsDB.create(data));
  handle("products:update", ({ id, data }) => productsDB.update(id, data));
  handle("products:delete", (id) => productsDB.delete(id));
  handle("products:deductStock", ({ id, amount }) =>
    productsDB.deductStock(id, amount),
  );
  handle("products:addStock", ({ id, amount }) =>
    productsDB.addStock(id, amount),
  );
  // ── PURCHASE INVOICES ─────────────────────
  handle("purchase:getAll", () => purchaseDB.getAll());
  handle("purchase:getById", (id) => purchaseDB.getById(id));
  handle("purchase:save", (data) => purchaseDB.save(data));
  handle("purchase:addPayment", ({ invoiceId, paymentData }) =>
    purchaseDB.addPayment(invoiceId, paymentData),
  );
  handle("purchase:delete", (id) => purchaseDB.delete(id));
  // Legacy
  handle("save-purchase-invoice", (invoiceData) =>
    purchaseDB.save(invoiceData),
  );
  handle("update-purchase-payment", ({ invoiceId, ...paymentData }) =>
    purchaseDB.addPayment(invoiceId, paymentData),
  );
  // ── SALES ─────────────────────────────────
  handle("sales:getAll", () => salesDB.getAll());
  handle("sales:getById", (id) => salesDB.getById(id));
  handle("sales:complete", (checkoutData, _session) =>
    salesDB.complete({
      ...checkoutData,
      cashier: _session?.displayName ?? checkoutData.cashier,
    }),
  );
  handle("sales:getBySource", ({ source, from, to }) =>
    salesDB.getBySource(source, from, to),
  );
  handle("sales:getStats", ({ from, to }) => salesDB.getStats(from, to));
  // Legacy
  handle("complete-checkout", (checkoutData) => salesDB.complete(checkoutData));
  // ── CUSTOMERS ─────────────────────────────
  handle("customers:getAll", () => customersDB.getAll());
  handle("customers:getById", (id) => customersDB.getById(id));
  handle("customers:create", (data) => customersDB.create(data));
  handle("customers:update", ({ id, data }) => customersDB.update(id, data));
  handle("customers:delete", (id) => customersDB.delete(id));
  handle("customers:getDebts", (customerId) =>
    customersDB.getDebts(customerId),
  );
  handle("customers:addDebt", (data) => customersDB.addDebt(data));
  handle("customers:getByAnyPhone", (phone) =>
    customersDB.getByAnyPhone(phone),
  );
  handle("customers:getProfile", (customerId) =>
    customersDB.getProfile(customerId),
  );
  handle("customers:getAddresses", (customerId) =>
    customersDB.getAddresses(customerId),
  );
  handle("customers:addAddress", ({ customerId, data }) =>
    customersDB.addAddress(customerId, data),
  );
  handle("customers:updateAddress", ({ addressId, data }) =>
    customersDB.updateAddress(addressId, data),
  );
  handle("customers:deleteAddress", (addressId) =>
    customersDB.deleteAddress(addressId),
  );
  handle("customers:setDefaultAddress", ({ customerId, addressId }) =>
    customersDB.setDefaultAddress(customerId, addressId),
  );
  handle("customers:getPhones", (customerId) =>
    customersDB.getPhones(customerId),
  );
  handle("customers:addPhone", ({ customerId, data }) =>
    customersDB.addPhone(customerId, data),
  );
  handle("customers:updatePhone", ({ phoneId, data }) =>
    customersDB.updatePhone(phoneId, data),
  );
  handle("customers:deletePhone", (phoneId) =>
    customersDB.deletePhone(phoneId),
  );
  // ── DEBTS ─────────────────────────────────
  handle("debts:getAll", () => debtsDB.getAll());
  handle("debts:getById", (id) => debtsDB.getById(id));
  handle("debts:addPayment", ({ debtId, paymentData }, _session) =>
    debtsDB.addPayment(debtId, {
      ...paymentData,
      shiftId: resolveActiveShiftId(_session),
    }),
  );
  handle(
    "debts:addBulkPayment",
    ({ customerId, amount, paymentData }, _session) =>
      debtsDB.addBulkPayment(customerId, amount, {
        ...paymentData,
        shiftId: resolveActiveShiftId(_session),
      }),
  );
  // ── REPORTS ───────────────────────────────
  handle("reports:generate", (reportData) => reportsDB.generate(reportData));
  handle("generate-report", (reportData) => reportsDB.generate(reportData));
  // ── SHIFTS ────────────────────────────────
  handle("shifts:getActive", ({ userId, date }) =>
    shiftsDB.getActive(userId, date),
  );
  handle("shifts:getByUserAndDate", ({ userId, date }) =>
    shiftsDB.getByUserAndDate(userId, date),
  );
  handle("shifts:getOrCreate", ({ userId, date, nowIso }, _session) => {
    const firstLoginAt = sessionManager.getFirstLoginAt(userId);
    return shiftsDB.getOrCreate(userId, date, nowIso, firstLoginAt);
  });
  handle("shifts:ensure", ({ userId, date, nowIso }, _session) => {
    const firstLoginAt = sessionManager.getFirstLoginAt(userId);
    return shiftsDB.getOrCreate(userId, date, nowIso, firstLoginAt);
  });
  handle("shifts:end", ({ shiftId, endedAt }) =>
    shiftsDB.end(shiftId, endedAt),
  );
  handle("shifts:getInvoices", (shiftId) => shiftsDB.getInvoices(shiftId));
  handle("shifts:getAllInvoices", ({ from, to } = {}) =>
    shiftsDB.getAllInvoices(from, to),
  );
  handle("shifts:getSummary", (shiftId) => shiftsDB.getSummary(shiftId));
  // ── EMPLOYEES (Feature A) ─────────────────
  handle("employees:getAll", () => employeesDB.getAll());
  handle("employees:getById", (id) => employeesDB.getById(id));
  handle("employees:create", (data) => employeesDB.create(data));
  handle("employees:update", ({ id, data }) => employeesDB.update(id, data));
  handle("employees:setSalary", ({ userId, amount, effectiveFrom, notes }) =>
    employeesDB.setSalary(userId, amount, effectiveFrom, notes),
  );
  handle("employees:getSalaryHistory", (userId) =>
    employeesDB.getSalaryHistory(userId),
  );
  handle("employees:setActive", ({ userId, isActive }, _session) => {
    // Admin cannot deactivate themselves
    if (_session && _session.userId === userId && !isActive) {
      throw new Error("لا يمكن تعطيل حسابك الخاص");
    }
    return employeesDB.setActive(userId, isActive);
  });
  handle("employees:changePassword", ({ userId, newPassword }) =>
    employeesDB.changePassword(userId, newPassword),
  );
  handle("employees:getShifts", ({ userId, from, to }) =>
    employeesDB.getShifts(userId, from, to),
  );
  handle("employees:getShiftInvoices", (shiftId) =>
    employeesDB.getShiftInvoices(shiftId),
  );
  handle("employees:getSalarySummary", ({ userId, from, to }) =>
    employeesDB.getSalarySummary(userId, from, to),
  );
  // ── EXPENSES (Feature B) ──────────────────
  handle("expenses:getCategories", () => expensesDB.getCategories());
  handle("expenses:createCategory", (name) => expensesDB.createCategory(name));
  handle("expenses:deleteCategory", (id) => expensesDB.deleteCategory(id));
  handle("expenses:add", (data, _session) =>
    expensesDB.add({ ...data, createdBy: _session?.userId ?? "admin" }),
  );
  handle("expenses:getAll", ({ from, to } = {}) => expensesDB.getAll(from, to));
  handle("expenses:delete", (id) => expensesDB.delete(id));
  handle("expenses:getNetSummary", ({ from, to }) =>
    expensesDB.getNetSummary(from, to),
  );
  // ── ALERTS (Feature C) ────────────────────
  handle("alerts:getAll", () => alertsDB.getAll());
  handle("alerts:markRead", (id) => alertsDB.markRead(id));
  handle("alerts:markAllRead", () => alertsDB.markAllRead());
  handle("alerts:setInvoiceDueDate", ({ invoiceId, dueDate }) =>
    alertsDB.setInvoiceDueDate(invoiceId, dueDate),
  );
  handle("alerts:runChecks", () => alertsDB.runChecks());
  // ── ONLINE ORDERS (Phase 7) ───────────────
  handle("onlineOrders:getAll", (filters) => onlineOrdersDB.getAll(filters));
  handle("onlineOrders:getById", (id) => onlineOrdersDB.getById(id));
  handle("onlineOrders:create", (data, _session) =>
    onlineOrdersDB.create({
      ...data,
      createdBy: _session?.userId ?? data.createdBy,
    }),
  );
  handle("onlineOrders:update", ({ id, data }) =>
    onlineOrdersDB.update(id, data),
  );
  handle("onlineOrders:cancel", (id) => onlineOrdersDB.cancel(id));
  handle("onlineOrders:updateStatus", ({ id, status }) =>
    onlineOrdersDB.updateStatus(id, status),
  );
  handle("onlineOrders:dispatch", ({ orderId, driverId }) =>
    onlineOrdersDB.dispatch(orderId, driverId),
  );
  handle("onlineOrders:markNotReceived", (id) =>
    onlineOrdersDB.markNotReceived(id),
  );
  handle("onlineOrders:calculateTrustLevel", (customerId) =>
    onlineOrdersDB.calculateTrustLevel(customerId),
  );
  handle("onlineOrders:uploadBillOfLading", ({ orderId, image }) =>
    onlineOrdersDB.uploadBillOfLading(orderId, image),
  );
  // ── DRIVERS (Phase 7) ──────────────────────
  handle("drivers:getAll", () => driversDB.getAll());
  handle("drivers:getActive", () => driversDB.getActive());
  handle("drivers:getById", (id) => driversDB.getById(id));
  handle("drivers:create", (data) => driversDB.create(data));
  handle("drivers:update", ({ id, data }) => driversDB.update(id, data));
  handle("drivers:getBalance", (driverId) => driversDB.getBalance(driverId));
  handle("drivers:registerManualPayment", ({ driverId, amount, notes }) =>
    driversDB.registerManualPayment(driverId, amount, notes),
  );
  handle("drivers:getLedger", ({ driverId, filters }) =>
    driversDB.getLedger(driverId, filters),
  );
  handle("drivers:getSummary", ({ driverId, from, to }) =>
    driversDB.getSummary(driverId, from, to),
  );
  // ── WINDOW CONTROLS ───────────────────────
  ipcMain.on("window:minimize", () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });
  ipcMain.on("window:maximize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.on("window:close", () => {
    BrowserWindow.getFocusedWindow()?.close();
  });
  ipcMain.handle("window:isMaximized", () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });
  // ── PRINT INVOICE ─────────────────────────
  ipcMain.handle("print:invoice", async (event, htmlContent) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      await printWin.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent),
      );
      await new Promise((resolve) => setTimeout(resolve, 800));
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
          pageSize: { width: 80000, height: 297000 },
        },
        (success, errorType) => {
          if (!success && errorType !== "cancelled") {
            console.error("[Print Error]", errorType);
          }
          printWin.close();
        },
      );
      return { success: true };
    } catch (error) {
      console.error("[IPC Error] print:invoice:", error.message);
      return { success: false, message: error.message };
    }
  });
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-img",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: false,
    },
  },
]);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    const dbModule = require("./database.cjs");
    db = {
      categoriesDB: dbModule.categoriesDB,
      productsDB: dbModule.productsDB,
      authDB: dbModule.authDB,
      purchaseDB: dbModule.purchaseDB,
      salesDB: dbModule.salesDB,
      customersDB: dbModule.customersDB,
      debtsDB: dbModule.debtsDB,
      reportsDB: dbModule.reportsDB,
      shiftsDB: dbModule.shiftsDB,
      globalAutoCloseShifts: dbModule.globalAutoCloseShifts,
      employeesDB: dbModule.employeesDB,
      expensesDB: dbModule.expensesDB,
      alertsDB: dbModule.alertsDB,
      driversDB: dbModule.driversDB,
      onlineOrdersDB: dbModule.onlineOrdersDB,
    };
    dbModule.initDatabase();
    setInterval(
      () => {
        try {
          dbModule.alertsDB.runChecks();
        } catch (err) {
          console.error("[AlertEngine]", err.message);
        }
      },
      30 * 60 * 1000,
    );
    protocol.handle("app-img", (request) => {
      try {
        const url = new URL(request.url);
        const category = url.hostname;
        const filename = decodeURIComponent(url.pathname.replace(/^\//, ""));
        if (filename.includes("..") || filename.includes("\\")) {
          return new Response("Forbidden", { status: 403 });
        }
        const allowedCategories = ["products", "receipts", "thumbs", "lading"];
        if (!allowedCategories.includes(category)) {
          return new Response("Not Found", { status: 404 });
        }
        const DATA_DIR = isDev
          ? require("path").join(__dirname, "userdata")
          : app.getPath("userData");
        const filePath = require("path").join(
          DATA_DIR,
          "images",
          category,
          filename,
        );
        const imagesRoot = require("path").join(DATA_DIR, "images");
        if (!filePath.startsWith(imagesRoot)) {
          return new Response("Forbidden", { status: 403 });
        }
        return net.fetch("file:///" + filePath.replace(/\\/g, "/"));
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const csp = isDev
        ? [
            "default-src 'self' http://localhost:8080",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8080",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: app-img:",
            "connect-src 'self' ws://localhost:8080 http://localhost:8080",
          ].join("; ")
        : [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: app-img:",
            "connect-src 'self'",
          ].join("; ");
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [csp],
        },
      });
    });
    registerHandlers();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    sessionManager.destroyAll();
    if (process.platform !== "darwin") app.quit();
  });
}
