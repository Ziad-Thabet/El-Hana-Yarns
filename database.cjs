const path = require("path");
const fs = require("fs");
const electron = require("electron");
const app = electron?.app ||
  electron?.remote?.app || { isPackaged: false, getPath: () => process.cwd() };
const { formatDateYMD } = require("./shared/dateRules.cjs");
const images = require("./db/helpers/images.cjs");
const { createBackupManager } = require("./db/backup.cjs");
const { runMigrations, getSchemaVersion } = require("./db/migrations.cjs");
const { createBaseTables } = require("./db/schema.cjs");
const legacy = require("./db/legacy/bringUp.cjs");
const { createCategoriesDB } = require("./db/repositories/categories.cjs");
const { createProductsDB } = require("./db/repositories/products.cjs");
const { createPurchaseDB } = require("./db/repositories/purchase.cjs");
const { createSalesDB } = require("./db/repositories/sales.cjs");
const { createDebtsDB } = require("./db/repositories/debts.cjs");
const { createCustomersDB } = require("./db/repositories/customers.cjs");
const {
  createShiftsDB,
  mapShift,
  createEnsureActiveShift,
} = require("./db/repositories/shifts.cjs");
const { createEmployeesDB } = require("./db/repositories/employees.cjs");
const { createExpensesDB } = require("./db/repositories/expenses.cjs");
const { createAlertsDB } = require("./db/repositories/alerts.cjs");
const { createReportsDB } = require("./db/repositories/reports.cjs");
const { createAuthDB } = require("./db/repositories/auth.cjs");
const { createDriversDB } = require("./db/repositories/drivers.cjs");
const { createOnlineOrdersDB } = require("./db/repositories/onlineOrders.cjs");
const { createReturnsDB } = require("./db/repositories/returns.cjs");
const { createSettingsDB } = require("./db/repositories/settings.cjs");
const { createAuditDB } = require("./db/repositories/audit.cjs");
const { createRolesDB } = require("./db/repositories/roles.cjs");
const {
  createPaymentMethodsDB,
} = require("./db/repositories/paymentMethods.cjs");
const { createEndOfDayDB } = require("./db/repositories/endOfDay.cjs");
const {
  createCashMovementsDB,
} = require("./db/repositories/cashMovements.cjs");
const { createPaymentLedger } = require("./db/services/paymentLedger.cjs");

const isDev = !app.isPackaged;

// An explicit directory wins over both, so the app can be pointed at a scratch
// database — that is how the test suite builds a fixture through the real
// bring-up path instead of maintaining a second copy of the schema.
const DATA_DIR = process.env.ELHANA_DATA_DIR
  ? path.resolve(process.env.ELHANA_DATA_DIR)
  : isDev
    ? path.join(__dirname, "userdata")
    : app.getPath("userData");

const DB_PATH = path.join(DATA_DIR, "el-hana-yarns.db");

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  images.initImagePaths(DATA_DIR);
}

let db;

const backups = createBackupManager({
  getDb: () => db,
  closeDb: () => closeDatabase(),
  dbPath: DB_PATH,
  dataDir: DATA_DIR,
});

function initDatabase() {
  ensureDirectories();

  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Report corruption before anything writes to the file, and snapshot the
  // database before migrations touch the schema, so a failed migration is
  // always recoverable. Neither is allowed to prevent the app from starting.
  try {
    backups.integrityCheck();
    backups.createDaily("startup");
  } catch (err) {
    console.error("❌ Startup backup failed:", err.message);
  }

  createBaseTables(db);
  legacy.runPostSchemaBringUp(db);
  // Legacy date normalisation full-scans five tables. It only ever needed to
  // run once, so it is gated on a marker rather than repeated on every launch,
  // where its cost grows with the shop's entire history.
  if (db.pragma("user_version", { simple: true }) === 0) {
    legacy.migrateLegacyDates(db);
  }
  legacy.seedDefaultUsers(db);
  // Versioned migrations run last, on top of the baseline shape the legacy
  // idempotent helpers above guarantee. These are allowed to throw: a database
  // that cannot be migrated must not be served.
  runMigrations(db);

  // Settings exist only after the migration above, so the singletons that were
  // constructed at require time are configured here.
  applyRuntimeSettings();

  console.log(
    `✅ Database connected (better-sqlite3, schema v${getSchemaVersion(db)}): ${DB_PATH}`,
  );
  return db;
}

/**
 * Pushes settings into the modules that are required before the database opens
 * and therefore cannot read them for themselves.
 */
function applyRuntimeSettings() {
  try {
    const config = settingsDB.runtimeConfig();
    require("./session-manager.cjs").configure(config);
    require("./rate-limiter.cjs").configure(config);
    backups.configure(config);
    return config;
  } catch (err) {
    console.error("❌ applyRuntimeSettings failed:", err.message);
    return null;
  }
}

function closeDatabase() {
  if (db && db.open) db.close();
  db = null;
}

// Instantiated first: several repositories take it as a dependency. Its
// cache is lazy, so it does not mind that the table does not exist yet.
const settingsDB = createSettingsDB(() => db);
const auditDB = createAuditDB(() => db);
const rolesDB = createRolesDB(() => db);
const paymentMethodsDB = createPaymentMethodsDB(() => db);
// The cash book, which both the end-of-day figures and the shift close read.
const cashMovementsDB = createCashMovementsDB(() => db);
const endOfDayDB = createEndOfDayDB(() => db, settingsDB, cashMovementsDB);

const categoriesDB = createCategoriesDB(() => db);

const productsDB = createProductsDB(() => db, settingsDB);

const authDB = createAuthDB(() => db);

// One ledger for the whole application: every payment in the system is
// written through this instance.
const paymentLedger = createPaymentLedger(() => db);
const purchaseDB = createPurchaseDB(() => db, productsDB, paymentLedger);

const salesDB = createSalesDB(() => db, productsDB, paymentLedger);

const returnsDB = createReturnsDB(() => db, productsDB, paymentLedger);

const debtsDB = createDebtsDB(() => db, paymentLedger);
const customersDB = createCustomersDB(() => db, debtsDB);

const reportsDB = createReportsDB(
  () => db,
  productsDB,
  debtsDB,
  () => employeesDB,
  settingsDB,
);

const shiftsDB = createShiftsDB(
  () => db,
  settingsDB,
  paymentMethodsDB,
  cashMovementsDB,
);
const ensureActiveShift = createEnsureActiveShift(shiftsDB);
function globalAutoCloseShifts() {
  try {
    shiftsDB.autoCloseStale(null, null);
  } catch (err) {
    console.error("❌ globalAutoCloseShifts failed:", err.message);
  }
}

const employeesDB = createEmployeesDB(() => db, shiftsDB, rolesDB);

const expensesDB = createExpensesDB(() => db, employeesDB);

const alertsDB = createAlertsDB(() => db, shiftsDB, settingsDB);

const driversDB = createDriversDB(() => db);

const onlineOrdersDB = createOnlineOrdersDB(
  () => db,
  productsDB,
  customersDB,
  driversDB,
  ensureActiveShift,
  paymentLedger,
);

module.exports = {
  initDatabase,
  closeDatabase,
  backups,
  categoriesDB,
  productsDB,
  authDB,
  purchaseDB,
  salesDB,
  customersDB,
  debtsDB,
  reportsDB,
  shiftsDB,
  globalAutoCloseShifts,
  employeesDB,
  expensesDB,
  alertsDB,
  driversDB,
  onlineOrdersDB,
  returnsDB,
  settingsDB,
  auditDB,
  rolesDB,
  paymentMethodsDB,
  endOfDayDB,
  cashMovementsDB,
  applyRuntimeSettings,
};
