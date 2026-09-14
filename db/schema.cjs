/**
 * The shape of the database, as the application expects to find it.
 *
 * Every statement is `IF NOT EXISTS`: this runs on every launch and describes
 * the baseline, not a change. A change to an existing shop's schema belongs in
 * db/migrations.cjs, which is versioned and runs once.
 *
 * Split out of database.cjs, which held the schema, sixteen legacy bring-up
 * helpers and the wiring of twenty repositories in one 1058-line file.
 */
function createBaseTables(db) {
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
}

module.exports = { createBaseTables };
