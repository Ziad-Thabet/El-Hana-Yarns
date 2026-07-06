const path = require("path");
const fs = require("fs");
const electron = require("electron");
const app = electron?.app ||
  electron?.remote?.app || { isPackaged: false, getPath: () => process.cwd() };
const bcryptjs = require("bcryptjs");
const { formatDateYMD } = require("./shared/dateRules.cjs");
const images = require("./db/helpers/images.cjs");
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

const isDev = !app.isPackaged;

const DATA_DIR = isDev
  ? path.join(__dirname, "userdata")
  : app.getPath("userData");

const DB_PATH = path.join(DATA_DIR, "el-hana-yarns.db");

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  images.initImagePaths(DATA_DIR);
}

let db;

function initDatabase() {
  ensureDirectories();

  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables();
  migrateLegacyDates();
  seedDefaultUsers();

  console.log(`✅ Database connected (better-sqlite3): ${DB_PATH}`);
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      color       TEXT NOT NULL DEFAULT '#6366f1'
    );

    CREATE TABLE IF NOT EXISTS products (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      price        REAL NOT NULL DEFAULT 0,
      stock        REAL NOT NULL DEFAULT 0,
      barcode      TEXT,
      image_url    TEXT,
      category     TEXT,
      unit         TEXT NOT NULL DEFAULT 'piece',
      price_per_kg REAL
    );

    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      username       TEXT NOT NULL UNIQUE,
      password       TEXT,
      password_hash  TEXT,
      display_name   TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'staff'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id   TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      username     TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role         TEXT NOT NULL,
      login_at     TEXT NOT NULL,
      started_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id              TEXT PRIMARY KEY,
      invoice_number  TEXT NOT NULL UNIQUE,
      supplier        TEXT NOT NULL,
      date            TEXT NOT NULL,
      time            TEXT NOT NULL,
      total           REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'unpaid',
      paid_amount     REAL NOT NULL DEFAULT 0,
      receipt_image   TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id               TEXT PRIMARY KEY,
      invoice_id       TEXT NOT NULL,
      product_name     TEXT NOT NULL,
      barcode          TEXT,
      quantity         REAL NOT NULL,
      unit             TEXT NOT NULL DEFAULT 'piece',
      purchase_price   REAL NOT NULL,
      item_total       REAL NOT NULL DEFAULT 0,
      category         TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id             TEXT PRIMARY KEY,
      ref_id         TEXT NOT NULL,
      ref_type       TEXT NOT NULL,
      amount         REAL NOT NULL,
      date           TEXT NOT NULL,
      time           TEXT NOT NULL,
      method         TEXT NOT NULL DEFAULT 'cash',
      receipt_image  TEXT,
      notes          TEXT,
      source         TEXT,
      shift_id       TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_invoices (
      id              TEXT PRIMARY KEY,
      invoice_number  TEXT NOT NULL UNIQUE,
      date            TEXT NOT NULL,
      time            TEXT NOT NULL,
      total           REAL NOT NULL DEFAULT 0,
      cashier         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_invoice_items (
      id             TEXT PRIMARY KEY,
      invoice_id     TEXT NOT NULL,
      product_id     TEXT,
      name           TEXT NOT NULL,
      price          REAL NOT NULL,
      quantity       REAL NOT NULL DEFAULT 1,
      barcode        TEXT,
      is_weighted    INTEGER DEFAULT 0,
      weight_grams   REAL,
      measure_amount REAL,
      measure_unit   TEXT,
      price_per_kg   REAL,
      line_total     REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      phone             TEXT,
      address           TEXT,
      total_debt        REAL NOT NULL DEFAULT 0,
      last_payment_date TEXT
    );

    CREATE TABLE IF NOT EXISTS customer_debts (
      id               TEXT PRIMARY KEY,
      customer_id      TEXT NOT NULL,
      customer_name    TEXT NOT NULL,
      invoice_id       TEXT,
      invoice_number   TEXT NOT NULL,
      total_amount     REAL NOT NULL,
      paid_amount      REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL,
      created_date     TEXT NOT NULL,
      last_updated     TEXT NOT NULL,
      notes            TEXT
    );

    -- ======================================
    -- shifts — جدول الشيفتات (Phase 5)
    -- ======================================
    CREATE TABLE IF NOT EXISTS shifts (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      date             TEXT NOT NULL,
      started_at       TEXT NOT NULL,
      ended_at         TEXT,
      total_cash       REAL NOT NULL DEFAULT 0,
      total_vodafone   REAL NOT NULL DEFAULT 0,
      total_instapay   REAL NOT NULL DEFAULT 0,
      total_invoices   INTEGER NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'open'
    );

    -- ======================================
    -- Indexes (Phase 4 — performance)
    -- ======================================
    CREATE INDEX IF NOT EXISTS idx_products_barcode       ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category      ON products(category);
    CREATE INDEX IF NOT EXISTS idx_sale_invoices_date     ON sale_invoices(date);
    CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date);
    CREATE INDEX IF NOT EXISTS idx_sale_items_invoice     ON sale_invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice ON purchase_invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_customer_debts_cust    ON customer_debts(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payment_ref            ON payment_records(ref_id, ref_type);
    CREATE INDEX IF NOT EXISTS idx_payment_method_type    ON payment_records(method, ref_type);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product     ON sale_invoice_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_barcode ON purchase_invoice_items(barcode);

    -- Phase 5 indexes
    CREATE INDEX IF NOT EXISTS idx_shifts_user_date  ON shifts(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_shifts_status     ON shifts(status);

    -- ======================================
    -- Feature A — salary_history
    -- ======================================
    CREATE TABLE IF NOT EXISTS salary_history (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      amount         REAL NOT NULL,
      effective_from TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      notes          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_salary_history_user
      ON salary_history(user_id, effective_from);

    -- ======================================
    -- Feature B — expense_categories + expenses
    -- ======================================
    CREATE TABLE IF NOT EXISTS expense_categories (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount      REAL NOT NULL,
      date        TEXT NOT NULL,
      description TEXT,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_cat  ON expenses(category_id);

    -- ======================================
    -- Feature C — alerts + invoice_due_dates
    -- ======================================
    CREATE TABLE IF NOT EXISTS alerts (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      ref_id     TEXT,
      message    TEXT NOT NULL,
      is_read    INTEGER DEFAULT 0,
      due_date   TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read, created_at);

     CREATE TABLE IF NOT EXISTS invoice_due_dates (
      id         TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL UNIQUE,
      due_date   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- ======================================
    -- Phase 7 — Online Orders / Delivery
    -- ======================================
    CREATE TABLE IF NOT EXISTS drivers (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS driver_settlements (
      id              TEXT PRIMARY KEY,
      driver_id       TEXT NOT NULL,
      order_id        TEXT,
      type            TEXT NOT NULL,
      amount          REAL NOT NULL,
      balance_after   REAL NOT NULL,
      date            TEXT NOT NULL,
      time            TEXT NOT NULL,
      notes           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver ON driver_settlements(driver_id, date);

    CREATE TABLE IF NOT EXISTS online_customers_addresses (
      id           TEXT PRIMARY KEY,
      customer_id  TEXT NOT NULL,
      label        TEXT,
      region       TEXT,
      address_text TEXT NOT NULL,
      is_default   INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_online_addresses_customer ON online_customers_addresses(customer_id);

    CREATE TABLE IF NOT EXISTS online_customer_phones (
      id           TEXT PRIMARY KEY,
      customer_id  TEXT NOT NULL,
      phone        TEXT NOT NULL,
      label        TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_online_phones_customer ON online_customer_phones(customer_id);
    CREATE INDEX IF NOT EXISTS idx_online_phones_phone    ON online_customer_phones(phone);

    CREATE TABLE IF NOT EXISTS online_orders (
      id                 TEXT PRIMARY KEY,
      order_number       TEXT NOT NULL UNIQUE,
      daily_sequence     INTEGER NOT NULL,
      order_date         TEXT NOT NULL,
      customer_id        TEXT,
      customer_name      TEXT NOT NULL,
      customer_phone     TEXT NOT NULL,
      address_id         TEXT,
      address_text       TEXT NOT NULL,
      address_label      TEXT,
      source             TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'new',
      payment_method     TEXT NOT NULL,
      payment_status     TEXT NOT NULL DEFAULT 'pending',
      products_total     REAL NOT NULL DEFAULT 0,
      delivery_fee       REAL NOT NULL DEFAULT 0,
      grand_total        REAL NOT NULL DEFAULT 0,
      prepaid_amount     REAL NOT NULL DEFAULT 0,
      remaining_amount   REAL NOT NULL DEFAULT 0,
      driver_id          TEXT,
      requested_datetime TEXT,
      notes              TEXT,
      created_at         TEXT NOT NULL,
      dispatched_at      TEXT,
      completed_at       TEXT,
      created_by         TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_online_orders_seq ON online_orders(order_date, daily_sequence);
    CREATE INDEX IF NOT EXISTS idx_online_orders_status   ON online_orders(status);
    CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON online_orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_online_orders_driver   ON online_orders(driver_id);

    CREATE TABLE IF NOT EXISTS online_order_items (
      id             TEXT PRIMARY KEY,
      order_id       TEXT NOT NULL,
      product_id     TEXT,
      name           TEXT NOT NULL,
      price          REAL NOT NULL,
      quantity       REAL NOT NULL DEFAULT 1,
      line_total     REAL NOT NULL,
      is_weighted    INTEGER DEFAULT 0,
      weight_grams   REAL,
      measure_amount REAL,
      measure_unit   TEXT,
      price_per_kg   REAL
    );
    CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(order_id);

  `);

  migrateShiftColumn();
  migrateSaleInvoicesOnlineColumns();
  migrateOnlineOrderInvoiceLink();
  migratePurchaseItemTotal();
  migrateUsersColumns();
  seedExpenseCategories();
  migrateCustomersOnlineColumns();
  migrateDriversColumns();
  migrateOnlineOrderBillOfLading();
  migratePaymentRecordsSource();
  migratePaymentRecordsShiftId();
  migrateOnlineOrderItemsWeightColumns();
  migrateCustomerDebtsInvoiceNumberUnique();
}

function migrateSaleInvoicesOnlineColumns() {
  try {
    const cols = db.prepare("PRAGMA table_info(sale_invoices)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("source")) {
      db.exec("ALTER TABLE sale_invoices ADD COLUMN source TEXT");
      console.log("✅ Migration: added source to sale_invoices");
    }
    if (!names.has("voided")) {
      db.exec(
        "ALTER TABLE sale_invoices ADD COLUMN voided INTEGER NOT NULL DEFAULT 0",
      );
      console.log("✅ Migration: added voided to sale_invoices");
    }
  } catch (err) {
    console.error("❌ migrateSaleInvoicesOnlineColumns failed:", err.message);
  }
}

function migrateOnlineOrderInvoiceLink() {
  try {
    const cols = db.prepare("PRAGMA table_info(online_orders)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("sale_invoice_id")) {
      db.exec("ALTER TABLE online_orders ADD COLUMN sale_invoice_id TEXT");
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_online_orders_invoice ON online_orders(sale_invoice_id)",
      );
      console.log("✅ Migration: added sale_invoice_id to online_orders");
    }
  } catch (err) {
    console.error("❌ migrateOnlineOrderInvoiceLink failed:", err.message);
  }
}

function migratePurchaseItemTotal() {
  try {
    const cols = db.prepare("PRAGMA table_info(purchase_invoice_items)").all();
    const hasItemTotal = cols.some((c) => c.name === "item_total");
    if (!hasItemTotal) {
      db.exec(
        "ALTER TABLE purchase_invoice_items ADD COLUMN item_total REAL NOT NULL DEFAULT 0",
      );
      db.exec(
        "UPDATE purchase_invoice_items SET item_total = purchase_price * quantity WHERE item_total = 0",
      );
      console.log("✅ Migration: added item_total to purchase_invoice_items");
    }
  } catch (err) {
    console.error("❌ Migration item_total failed:", err.message);
  }
}

function migrateShiftColumn() {
  try {
    const cols = db.prepare("PRAGMA table_info(sale_invoices)").all();
    const hasShiftId = cols.some((c) => c.name === "shift_id");
    if (!hasShiftId) {
      db.exec("ALTER TABLE sale_invoices ADD COLUMN shift_id TEXT");
      console.log("✅ Migration: added shift_id to sale_invoices");
    }
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_sale_invoices_shift ON sale_invoices(shift_id)",
    );
  } catch (err) {
    console.error("❌ Migration shift_id failed:", err.message);
  }
}

function migrateUsersColumns() {
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all();
    const names = new Set(cols.map((c) => c.name));

    if (!names.has("is_active")) {
      db.exec(
        "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
      );
      console.log("✅ Migration: added is_active to users");
    }
    if (!names.has("salary_type")) {
      db.exec(
        "ALTER TABLE users ADD COLUMN salary_type TEXT NOT NULL DEFAULT 'monthly'",
      );
      console.log("✅ Migration: added salary_type to users");
    }
    if (!names.has("daily_hours")) {
      db.exec(
        "ALTER TABLE users ADD COLUMN daily_hours REAL NOT NULL DEFAULT 8",
      );
      console.log("✅ Migration: added daily_hours to users");
    }
    if (!names.has("created_at")) {
      db.exec("ALTER TABLE users ADD COLUMN created_at TEXT");
      console.log("✅ Migration: added created_at to users");
    }
  } catch (err) {
    console.error("❌ migrateUsersColumns failed:", err.message);
  }
}

function migrateOnlineOrderBillOfLading() {
  try {
    const cols = db.prepare("PRAGMA table_info(online_orders)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("bill_of_lading_image")) {
      db.exec("ALTER TABLE online_orders ADD COLUMN bill_of_lading_image TEXT");
      console.log("✅ Migration: added bill_of_lading_image to online_orders");
    }
    if (!names.has("pre_selected_driver_id")) {
      db.exec(
        "ALTER TABLE online_orders ADD COLUMN pre_selected_driver_id TEXT",
      );
      console.log(
        "✅ Migration: added pre_selected_driver_id to online_orders",
      );
    }
    if (!names.has("online_payment_channel")) {
      db.exec(
        "ALTER TABLE online_orders ADD COLUMN online_payment_channel TEXT",
      );
      console.log(
        "✅ Migration: added online_payment_channel to online_orders",
      );
    }
  } catch (err) {
    console.error("❌ migrateOnlineOrderBillOfLading failed:", err.message);
  }
}

function migratePaymentRecordsSource() {
  try {
    const cols = db.prepare("PRAGMA table_info(payment_records)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("source")) {
      db.exec("ALTER TABLE payment_records ADD COLUMN source TEXT");
      db.exec(
        "UPDATE payment_records SET source = CASE WHEN ref_type='debt' THEN 'debt_settlement' ELSE 'checkout' END WHERE source IS NULL",
      );
      console.log(
        "✅ Migration: added source to payment_records (backfilled best-effort)",
      );
    }
  } catch (err) {
    console.error("❌ migratePaymentRecordsSource failed:", err.message);
  }
}

function migratePaymentRecordsShiftId() {
  try {
    const cols = db.prepare("PRAGMA table_info(payment_records)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("shift_id")) {
      db.exec("ALTER TABLE payment_records ADD COLUMN shift_id TEXT");
      db.exec(
        `UPDATE payment_records SET shift_id = (
           SELECT si.shift_id FROM sale_invoices si WHERE si.id = payment_records.ref_id
         ) WHERE ref_type='sale' AND source='checkout' AND shift_id IS NULL`,
      );
      console.log(
        "✅ Migration: added shift_id to payment_records (backfilled checkout only)",
      );
    }
  } catch (err) {
    console.error("❌ migratePaymentRecordsShiftId failed:", err.message);
  }
}

function migrateOnlineOrderItemsWeightColumns() {
  try {
    const cols = db.prepare("PRAGMA table_info(online_order_items)").all();
    const names = new Set(cols.map((c) => c.name));
    const toAdd = [
      ["is_weighted", "INTEGER DEFAULT 0"],
      ["weight_grams", "REAL"],
      ["measure_amount", "REAL"],
      ["measure_unit", "TEXT"],
      ["price_per_kg", "REAL"],
    ];
    for (const [col, type] of toAdd) {
      if (!names.has(col)) {
        db.exec(`ALTER TABLE online_order_items ADD COLUMN ${col} ${type}`);
        console.log(`✅ Migration: added ${col} to online_order_items`);
      }
    }
  } catch (err) {
    console.error(
      "❌ migrateOnlineOrderItemsWeightColumns failed:",
      err.message,
    );
  }
}

function migrateCustomerDebtsInvoiceNumberUnique() {
  try {
    const existing = db.prepare("PRAGMA index_list(customer_debts)").all();
    const alreadyExists = existing.some(
      (idx) => idx.name === "idx_customer_debts_invoice_number",
    );
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_debts_invoice_number ON customer_debts(invoice_number)",
    );
    if (!alreadyExists) {
      console.log(
        "✅ Migration: added UNIQUE index on customer_debts.invoice_number",
      );
    }
  } catch (err) {
    console.error(
      "❌ migrateCustomerDebtsInvoiceNumberUnique failed — duplicate invoice_number values likely exist and need manual cleanup first:",
      err.message,
    );
  }
}

function migrateDriversColumns() {
  try {
    const cols = db.prepare("PRAGMA table_info(drivers)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("driver_type")) {
      db.exec(
        "ALTER TABLE drivers ADD COLUMN driver_type TEXT NOT NULL DEFAULT 'driver'",
      );
      console.log("✅ Migration: added driver_type to drivers");
    }
    if (!names.has("pays_next_day")) {
      db.exec(
        "ALTER TABLE drivers ADD COLUMN pays_next_day INTEGER NOT NULL DEFAULT 0",
      );
      console.log("✅ Migration: added pays_next_day to drivers");
    }
  } catch (err) {
    console.error("❌ migrateDriversColumns failed:", err.message);
  }
}

function migrateCustomersOnlineColumns() {
  try {
    const cols = db.prepare("PRAGMA table_info(customers)").all();
    const names = new Set(cols.map((c) => c.name));

    if (!names.has("trust_level")) {
      db.exec("ALTER TABLE customers ADD COLUMN trust_level TEXT");
      console.log("✅ Migration: added trust_level to customers");
    }
    if (!names.has("online_notes")) {
      db.exec("ALTER TABLE customers ADD COLUMN online_notes TEXT");
      console.log("✅ Migration: added online_notes to customers");
    }
    if (!names.has("total_online_orders")) {
      db.exec(
        "ALTER TABLE customers ADD COLUMN total_online_orders INTEGER NOT NULL DEFAULT 0",
      );
      console.log("✅ Migration: added total_online_orders to customers");
    }
    if (!names.has("successful_online_orders")) {
      db.exec(
        "ALTER TABLE customers ADD COLUMN successful_online_orders INTEGER NOT NULL DEFAULT 0",
      );
      console.log("✅ Migration: added successful_online_orders to customers");
    }
    if (!names.has("cancelled_online_orders")) {
      db.exec(
        "ALTER TABLE customers ADD COLUMN cancelled_online_orders INTEGER NOT NULL DEFAULT 0",
      );
      console.log("✅ Migration: added cancelled_online_orders to customers");
    }
    if (!names.has("not_received_online_orders")) {
      db.exec(
        "ALTER TABLE customers ADD COLUMN not_received_online_orders INTEGER NOT NULL DEFAULT 0",
      );
      console.log(
        "✅ Migration: added not_received_online_orders to customers",
      );
    }
  } catch (err) {
    console.error("❌ migrateCustomersOnlineColumns failed:", err.message);
  }
}

function seedExpenseCategories() {
  try {
    const count = db
      .prepare("SELECT COUNT(*) as c FROM expense_categories")
      .get();
    if (count.c > 0) return;

    const defaults = ["إيجار", "كهرباء", "إنترنت", "صيانة وزيادات"];
    const now = new Date().toISOString();
    const stmt = db.prepare(
      "INSERT INTO expense_categories (id, name, is_default, created_at) VALUES (?,?,1,?)",
    );
    const tx = db.transaction(() => {
      for (const name of defaults) {
        stmt.run(generateId("excat"), name, now);
      }
    });
    tx();
    console.log("✅ Seeded default expense categories");
  } catch (err) {
    console.error("❌ seedExpenseCategories failed:", err.message);
  }
}

function seedDefaultUsers() {
  const count = db.prepare("SELECT COUNT(*) as c FROM users").get();
  if (count.c === 0) {
    // Hash passwords synchronously (bcryptjs supports sync hashing)
    const adminHash = bcryptjs.hashSync("admin123", 12);
    const cashierHash = bcryptjs.hashSync("cashier123", 12);

    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?,?,?,?,?)",
    ).run("user-admin-1", "هنا", adminHash, "المدير", "admin");
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?,?,?,?,?)",
    ).run("user-staff-1", "cashier", cashierHash, "الكاشير", "staff");
    console.log("✅ Default users created (password hashed with bcryptjs)");
  } else {
    // Migration: Hash existing plain text passwords
    migratePasswordsToHash();
  }
}

function migratePasswordsToHash() {
  try {
    const users = db
      .prepare(
        "SELECT id, password FROM users WHERE password IS NOT NULL AND password_hash IS NULL",
      )
      .all();

    if (users.length === 0) return; // All already migrated

    const migrateTx = db.transaction(() => {
      for (const user of users) {
        const hash = bcryptjs.hashSync(user.password, 12);
        db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
          hash,
          user.id,
        );
      }
    });

    migrateTx();
    console.log(`✅ Migrated ${users.length} users to hashed passwords`);
  } catch (error) {
    console.error("❌ Password migration failed:", error.message);
  }
}

const { generateId } = require("./db/helpers/ids.cjs");
const {
  normalizeIsoDate,
  normalizeIsoTime,
  formatIsoDate,
  formatIsoTime,
  nowDateTime,
  addDaysToIsoDate,
} = require("./db/helpers/isoDates.cjs");

function migrateLegacyDates() {
  const tables = [
    { name: "sale_invoices", idField: "id", fields: ["date", "time"] },
    { name: "purchase_invoices", idField: "id", fields: ["date", "time"] },
    { name: "payment_records", idField: "id", fields: ["date", "time"] },
    {
      name: "customer_debts",
      idField: "id",
      fields: ["created_date", "last_updated"],
    },
    { name: "customers", idField: "id", fields: ["last_payment_date"] },
  ];

  const rowsToUpdate = [];

  for (const table of tables) {
    const records = db.prepare(`SELECT * FROM ${table.name}`).all();
    for (const record of records) {
      const updates = {};
      for (const field of table.fields) {
        const rawValue = record[field];
        if (rawValue == null) continue;
        const normalized =
          field === "time"
            ? normalizeIsoTime(rawValue)
            : normalizeIsoDate(rawValue);
        if (normalized && normalized !== rawValue) {
          updates[field] = normalized;
        }
      }
      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((field) => `${field} = ?`)
          .join(", ");
        const params = [...Object.values(updates), record[table.idField]];
        rowsToUpdate.push({
          table: table.name,
          setClause,
          params,
          idField: table.idField,
        });
      }
    }
  }

  if (rowsToUpdate.length === 0) return;

  const migrateTx = db.transaction(() => {
    for (const row of rowsToUpdate) {
      db.prepare(
        `UPDATE ${row.table} SET ${row.setClause} WHERE ${row.idField} = ?`,
      ).run(...row.params);
    }
  });

  migrateTx();
}

const categoriesDB = createCategoriesDB(() => db);

const productsDB = createProductsDB(() => db);

const authDB = createAuthDB(() => db);

const purchaseDB = createPurchaseDB(() => db, productsDB);

const salesDB = createSalesDB(() => db, productsDB);

const debtsDB = createDebtsDB(() => db);
const customersDB = createCustomersDB(() => db, debtsDB);

const reportsDB = createReportsDB(
  () => db,
  productsDB,
  debtsDB,
  () => employeesDB,
);

const shiftsDB = createShiftsDB(() => db);
const ensureActiveShift = createEnsureActiveShift(shiftsDB);
function globalAutoCloseShifts() {
  try {
    shiftsDB.autoCloseStale(null, null);
  } catch (err) {
    console.error("❌ globalAutoCloseShifts failed:", err.message);
  }
}

const employeesDB = createEmployeesDB(() => db, shiftsDB);

const expensesDB = createExpensesDB(() => db, employeesDB);

const alertsDB = createAlertsDB(() => db, shiftsDB);

const driversDB = createDriversDB(() => db);

const onlineOrdersDB = createOnlineOrdersDB(
  () => db,
  productsDB,
  customersDB,
  driversDB,
  ensureActiveShift,
);

module.exports = {
  initDatabase,
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
};
