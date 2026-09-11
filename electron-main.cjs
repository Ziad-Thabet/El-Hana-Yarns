const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  net,
  session,
  shell,
  utilityProcess,
} = require("electron");
const path = require("path");
// One comma-separated value: appendSwitch replaces any previous value for the
// same switch, so calling it twice silently dropped the first feature.
app.commandLine.appendSwitch(
  "disable-features",
  "AutofillServerCommunication,AutofillEnableSupportForContours",
);
const sessionManager = require("./session-manager.cjs");
const rateLimiter = require("./rate-limiter.cjs");
const {
  CHANNEL_PERMISSIONS,
  CHANNEL_CAPABILITY,
} = require("./ipc-channels.cjs");
const {
  AUDIT_DESCRIPTORS,
  PASSWORD_KEYS,
} = require("./audit-descriptors.cjs");
const { formatDateYMD } = require("./shared/dateRules.cjs");
const { receiptPageSize } = require("./shared/receiptIdentity.cjs");
if (process.platform === "win32") {
  app.setAppUserModelId("com.elhanayarns.app");
}
let mainWindow;
const isDev = !app.isPackaged;
let db;
const PERIODIC_BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000;
const ALERT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
// Recomputed from settings by restartBackgroundTimers().
let receiptPrintSize = receiptPageSize(80);
const PRINT_TIMEOUT_MS = 2 * 60 * 1000;
// Cleared on quit so the timers cannot fire against a closed database.
const backgroundTimers = [];

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
  // Drop the reference so the BrowserWindow and its listeners can be collected.
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Records an audited operation. Deliberately swallows its own failures: an
 * audit row is valuable, but never valuable enough to turn a completed sale
 * into an IPC error.
 */
function recordAudit(descriptor, channel, payload, result, userSession, status, error) {
  try {
    if (!db?.auditDB) return;
    // Identity comes from the session, never the payload. `auth:login` is the
    // one exception: it is public, so on success the actor is only knowable
    // from the handler's own result.
    let actorUserId = userSession?.userId ?? null;
    let actorUsername = userSession?.username ?? null;
    let actorRole = userSession?.role ?? null;
    if (!actorUserId && descriptor.actorFromResult && result) {
      actorUserId = result.userId ?? null;
      actorUsername = result.username ?? null;
      actorRole = result.role ?? null;
    }
    const safeCall = (fn, fallback = null) => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };
    // Repositories attach `__audit` to their return value when they know
    // before/after values the wrapper cannot see (old and new price, say).
    const contributed = result && typeof result === "object" ? result.__audit : null;
    db.auditDB.write({
      actorUserId,
      actorUsername: actorUsername ?? "غير معروف",
      actorRole,
      channel,
      action: descriptor.action,
      entity: descriptor.entity,
      entityId: descriptor.entityId
        ? safeCall(() => descriptor.entityId(payload, result))
        : null,
      summary: descriptor.summary
        ? safeCall(() => descriptor.summary(payload, result))
        : null,
      detail: { payload, ...(contributed ? { changes: contributed } : {}) },
      redact: descriptor.redact ?? PASSWORD_KEYS,
      status,
      error: error ?? null,
    });
  } catch (err) {
    console.error("[Audit] recordAudit failed:", err.message);
  }
}

function handle(channel, fn) {
  const permission = CHANNEL_PERMISSIONS[channel];
  const auditDescriptor = AUDIT_DESCRIPTORS[channel] ?? null;
  // Unmapped channels fall back to their own name, which no seeded role holds:
  // deny by default, never allow by default.
  const capability = CHANNEL_CAPABILITY[channel] ?? channel;
  if (!permission) {
    console.warn(`[Security] Channel not in permissions map: ${channel}`);
  }
  // `auth` is a dedicated second argument supplied by the preload bridge, kept
  // separate from `payload` so a caller cannot forge a session by passing
  // `{ sessionId: ... }` as request data.
  ipcMain.handle(channel, async (_event, payload, auth) => {
    // Declared here (not inside the `if`) so handlers always receive the
    // authenticated session; when block-scoped it silently leaked Electron's
    // own `session` module into every handler.
    let userSession = null;
    try {
      if (permission !== "public") {
        const sessionId =
          typeof auth?.sessionId === "string" ? auth.sessionId : null;
        userSession = sessionId ? sessionManager.get(sessionId) : null;
        // No "use whichever session happens to be first" fallback: with more
        // than one live session that handed the caller someone else's role.
        if (!userSession) {
          throw new Error("Authentication required");
        }
        if (
          permission === "admin" &&
          !db.rolesDB.hasCapability(userSession.role, capability)
        ) {
          console.warn(
            `[Security] Capability denied: user="${userSession.username}" role="${userSession.role}" lacks "${capability}" for channel="${channel}"`,
          );
          // A refused attempt on a privileged channel is exactly the kind of
          // thing the log exists for.
          if (auditDescriptor) {
            recordAudit(
              auditDescriptor,
              channel,
              payload,
              null,
              userSession,
              "denied",
              "صلاحيات المسؤول مطلوبة لهذه العملية",
            );
          }
          throw new Error("صلاحيات المسؤول مطلوبة لهذه العملية");
        }
      }
      const result = await fn(payload, userSession);
      if (auditDescriptor) {
        recordAudit(auditDescriptor, channel, payload, result, userSession, "ok");
      }
      // `__audit` is a channel between repository and audit writer, not part of
      // the API surface; strip it before the response crosses the bridge.
      if (result && typeof result === "object" && "__audit" in result) {
        delete result.__audit;
      }
      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) console.error("[IPC Stack]", error.stack);
      else console.error("[IPC Error]", message);
      // A failed attempt is worth recording too — but not the denial we already
      // logged above, which rethrows the same message.
      if (
        auditDescriptor &&
        message !== "صلاحيات المسؤول مطلوبة لهذه العملية"
      ) {
        recordAudit(
          auditDescriptor,
          channel,
          payload,
          null,
          userSession,
          "failed",
          message,
        );
      }
      return { success: false, message };
    }
  });
}

/**
 * (Re)creates the background timers from the current settings. Called at
 * startup and again whenever an interval setting changes, so a new value takes
 * effect without a restart.
 */
function restartBackgroundTimers() {
  for (const timer of backgroundTimers.splice(0)) clearInterval(timer);
  const dbModule = require("./database.cjs");
  const config = dbModule.settingsDB.runtimeConfig();
  receiptPrintSize = receiptPageSize(config.receiptWidthMm);
  backgroundTimers.push(
    setInterval(() => {
      try {
        dbModule.backups.create("periodic");
      } catch (err) {
        console.error("[Backup]", err.message);
      }
    }, config.backupIntervalMs || PERIODIC_BACKUP_INTERVAL_MS),
    setInterval(() => {
      try {
        dbModule.alertsDB.runChecks();
      } catch (err) {
        console.error("[AlertEngine]", err.message);
      }
    }, config.alertIntervalMs || ALERT_CHECK_INTERVAL_MS),
  );
}

const EXCEL_BUILD_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Builds the workbook in a child process.
 *
 * Not in main: it is single threaded and owns window compositing, so a
 * multi-second build there freezes the whole application. Not in the renderer
 * either: the data would cross the bridge only to become a file.
 */
function buildWorkbookInChild(data, filePath) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "workers", "excelWriter.cjs");
    let child = null;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (child) child.kill();
      } catch {
        /* already gone */
      }
      fn(value);
    };
    // A worker that hangs must not leave the export spinning forever.
    const timer = setTimeout(
      () => finish(reject, new Error("تعذر إنشاء الملف — انتهت المهلة")),
      EXCEL_BUILD_TIMEOUT_MS,
    );
    try {
      child = utilityProcess.fork(workerPath, [], { serviceName: "excel-writer" });
    } catch (err) {
      return finish(reject, err);
    }
    child.on("message", (message) => {
      if (message?.ok) finish(resolve, message.filePath);
      else finish(reject, new Error(message?.error ?? "فشل إنشاء الملف"));
    });
    child.on("exit", (code) => {
      if (!settled) {
        finish(reject, new Error(`توقف منشئ الملف بشكل غير متوقع (${code})`));
      }
    });
    // The port is only connected once the child has spawned; posting earlier
    // drops the payload and the export would hang until the timeout.
    child.on("spawn", () => child.postMessage({ data, filePath }));
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
    returnsDB,
    settingsDB,
    auditDB,
    rolesDB,
    endOfDayDB,
  } = db;
  function getTodayDateYMD() {
    return formatDateYMD(new Date());
  }
  // Named `userSession` rather than `session` so it cannot be confused with
  // Electron's own `session` module imported at the top of this file.
  function resolveActiveShiftId(userSession) {
    if (!userSession?.userId) return null;
    const shift = shiftsDB.getActive(userSession.userId, getTodayDateYMD());
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
      capabilities: db.rolesDB.capabilitiesFor(user.role),
    };
  });

  handle("auth:hasAnyUsers", () => authDB.hasAnyUsers());
  handle("auth:register", (data) => {
    const username = data?.username?.trim?.();
    const password = data?.password;
    const displayName = data?.displayName?.trim?.() || username;
    if (!username || !password) {
      throw new Error("اسم المستخدم وكلمة المرور مطلوبان");
    }
    const todayDate = formatDateYMD(new Date());
    const user = authDB.register(username, password, displayName);
    const sessionId = sessionManager.create(
      user.userId,
      user.username,
      user.role,
      user.displayName,
    );
    const activeSession = sessionManager.get(sessionId);
    const activeShift = shiftsDB.getActive(user.userId, todayDate);
    return {
      sessionId,
      userId: user.userId,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      startedAt: activeSession?.startedAt ?? new Date().toISOString(),
      firstLoginAt: sessionManager.getFirstLoginAt(user.userId),
      shiftId: activeShift?.id ?? null,
      capabilities: db.rolesDB.capabilitiesFor(user.role),
    };
  });

  // Public: signing out must work even once a session has already expired,
  // otherwise the UI cannot clear itself.
  handle("auth:logout", (sessionId) => {
    if (typeof sessionId === "string") sessionManager.destroy(sessionId);
    return { success: true };
  });
  /** Attaches the capability list so the UI can ask "can I?" not "am I admin?". */
  function withCapabilities(sessionData) {
    if (!sessionData) return sessionData;
    return {
      ...sessionData,
      capabilities: db.rolesDB.capabilitiesFor(sessionData.role),
    };
  }
  handle("auth:getSession", (sessionId) =>
    withCapabilities(sessionManager.get(sessionId)),
  );
  handle("auth:getActiveSession", () => {
    db.globalAutoCloseShifts();
    const sessions = sessionManager.getAll();
    if (sessions.length === 0) return null;
    const s = sessions[0];
    const todayDate = formatDateYMD(new Date());
    const activeShift = shiftsDB.getActive(s.userId, todayDate);
    const firstLoginAt = sessionManager.getFirstLoginAt(s.userId);
    return withCapabilities({
      ...s,
      shiftId: activeShift?.id ?? null,
      firstLoginAt,
    });
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
  // ── SALES ─────────────────────────────────
  handle("sales:getAll", () => salesDB.getAll());
  handle("sales:getById", (id) => salesDB.getById(id));
  handle("sales:complete", (checkoutData, _session) => {
    // The renderer passes the shift it believes is open. If it passes none —
    // a stale window, a session resumed after an auto-close — the takings
    // would belong to no shift at all and be invisible to every shift summary
    // and to the drawer count at closing. Fall back to the caller's own open
    // shift. Deliberately never creates one: a sale should not be able to
    // open a shift nobody started.
    let shiftId = checkoutData.shiftId ?? null;
    if (!shiftId && _session?.userId) {
      const today = formatDateYMD(new Date());
      shiftId = shiftsDB.getActive(_session.userId, today)?.id ?? null;
    }
    return salesDB.complete({
      ...checkoutData,
      shiftId,
      cashier: _session?.displayName ?? checkoutData.cashier,
    });
  });
  handle("sales:getBySource", ({ source, from, to }) =>
    salesDB.getBySource(source, from, to),
  );
  handle("sales:getStats", ({ from, to }) => salesDB.getStats(from, to));
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
  handle("shifts:previewClose", ({ shiftId, countedCash }) =>
    shiftsDB.previewClose(shiftId, countedCash),
  );
  // Who closed the register comes from the session, never the renderer.
  handle("shifts:closeRegister", ({ shiftId, countedCash, note, endedAt }, session) =>
    shiftsDB.closeRegister(shiftId, {
      countedCash,
      note,
      endedAt: endedAt ?? new Date().toISOString(),
      closedBy: session?.userId ?? null,
    }),
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
  handle("employees:update", ({ id, data }) => {
    const updated = employeesDB.update(id, data);
    if (updated?.__sessionInvalidated) {
      sessionManager.destroyForUser(id);
      delete updated.__sessionInvalidated;
    }
    return updated;
  });
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
  // ── RETURNS / VOIDS ───────────────────────
  handle("returns:getForInvoice", (invoiceId) =>
    returnsDB.getForInvoice(invoiceId),
  );
  handle("returns:getReturnableLines", (invoiceId) =>
    returnsDB.getReturnableLines(invoiceId),
  );
  handle("returns:getAll", ({ from, to } = {}) => returnsDB.getAll(from, to));
  handle("returns:create", ({ invoiceId, lines, reason }, userSession) =>
    returnsDB.create(invoiceId, {
      lines,
      reason,
      // Taken from the session, never the renderer: this is the audit trail.
      userId: userSession?.userId,
      shiftId: resolveActiveShiftId(userSession),
    }),
  );
  handle("returns:void", ({ invoiceId, reason }, userSession) =>
    returnsDB.voidInvoice(invoiceId, {
      reason,
      userId: userSession?.userId,
      shiftId: resolveActiveShiftId(userSession),
    }),
  );
  // ── SETTINGS ──────────────────────────────
  handle("settings:getClient", () => settingsDB.getClient());
  handle("settings:getAll", () => settingsDB.getAll());
  handle("settings:update", (values, userSession) => {
    const applied = settingsDB.setMany(values, userSession?.userId ?? null);
    // Intervals, timeouts and the receipt size live outside the database, so
    // push the new values out rather than waiting for a restart.
    db.applyRuntimeSettings();
    restartBackgroundTimers();
    return applied;
  });
  handle("settings:reset", (key) => {
    const result = settingsDB.reset(key);
    db.applyRuntimeSettings();
    restartBackgroundTimers();
    return result;
  });
  // ── END OF DAY ────────────────────────────
  handle("endOfDay:preview", ({ from, to } = {}) =>
    endOfDayDB.build(from, to ?? from),
  );
  handle("endOfDay:export", async ({ from, to } = {}) => {
    const data = endOfDayDB.build(from, to ?? from);
    const label = data.meta.isSingleDay
      ? data.meta.from
      : `${data.meta.from}_${data.meta.to}`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "حفظ تقرير نهاية اليوم",
      defaultPath: `تقرير-${label}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (result.canceled || !result.filePath) {
      return { cancelled: true, filePath: null };
    }
    const filePath = await buildWorkbookInChild(data, result.filePath);
    return {
      cancelled: false,
      filePath,
      rowCounts: {
        invoices: data.invoices.length,
        lines: data.lines.length,
        returns: data.returns.length,
        alerts: data.alerts.length,
      },
    };
  });
  // ── AUDIT ─────────────────────────────────
  handle("audit:query", (filters) => auditDB.query(filters ?? {}));
  handle("audit:getFilterOptions", () => auditDB.getFilterOptions());
  // ── BACKUPS ───────────────────────────────
  handle("backup:list", () => ({
    directory: db.backups.backupDir,
    entries: db.backups.list(),
  }));
  handle("backup:create", () => db.backups.create("manual"));
  handle("backup:reveal", async () => {
    await shell.openPath(db.backups.backupDir);
    return { success: true };
  });
  handle("backup:restore", (fileName) => {
    const result = db.backups.restore(fileName);
    // The connection is closed and every repository still points at it, so the
    // only safe next step is a restart. Defer it so this reply reaches the
    // renderer first.
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
    return result;
  });
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
    if (typeof htmlContent !== "string") {
      return { success: false, message: "Invalid print content" };
    }
    let printWin = null;
    // Guarantees the hidden window is released down every path: a failed load,
    // a print callback that never fires, or a thrown error. Previously the only
    // close() sat inside the print callback, so any of those leaked a window.
    const destroy = () => {
      if (printWin && !printWin.isDestroyed()) printWin.destroy();
      printWin = null;
    };
    try {
      printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: false,
        },
      });
      // Wait for the document to be ready rather than racing a fixed timeout.
      const ready = new Promise((resolve) => {
        printWin.webContents.once("did-finish-load", resolve);
      });
      await printWin.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent),
      );
      await ready;

      await new Promise((resolve) => {
        // A print dialog the user never dismisses must not pin the window
        // forever; fall back to tearing it down after a generous timeout.
        const guard = setTimeout(resolve, PRINT_TIMEOUT_MS);
        printWin.webContents.print(
          {
            silent: false,
            printBackground: true,
            pageSize: receiptPrintSize,
          },
          (success, errorType) => {
            clearTimeout(guard);
            if (!success && errorType !== "cancelled") {
              console.error("[Print Error]", errorType);
            }
            resolve();
          },
        );
      });
      return { success: true };
    } catch (error) {
      console.error("[IPC Error] print:invoice:", error.message);
      return { success: false, message: error.message };
    } finally {
      destroy();
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
      returnsDB: dbModule.returnsDB,
      settingsDB: dbModule.settingsDB,
      auditDB: dbModule.auditDB,
      rolesDB: dbModule.rolesDB,
      endOfDayDB: dbModule.endOfDayDB,
      applyRuntimeSettings: dbModule.applyRuntimeSettings,
      backups: dbModule.backups,
    };
    dbModule.initDatabase();
    // A retail day accumulates cash and stock movements worth more than the
    // once-per-launch snapshot; take a rolling one while the shop is open.
    restartBackgroundTimers();
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
  app.on("before-quit", () => {
    for (const timer of backgroundTimers.splice(0)) clearInterval(timer);
    sessionManager.destroyAll();
    try {
      // Checkpoints the WAL so the database is left in a clean state.
      require("./database.cjs").closeDatabase();
    } catch (err) {
      console.error("[Shutdown]", err.message);
    }
  });
  app.on("window-all-closed", () => {
    sessionManager.destroyAll();
    if (process.platform !== "darwin") app.quit();
  });
}
