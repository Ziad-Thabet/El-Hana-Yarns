/**
 * The idempotent bring-up that predates versioned migrations.
 *
 * These have always run on every launch, each checking for itself whether its
 * column or index is already there. They are the shape a schema takes before
 * anyone introduces `user_version`, and they are kept because a shop's
 * database out there has been through some of them and not others: their
 * whole contract is that running them again is harmless.
 *
 * Nothing new belongs here. A schema change goes in db/migrations.cjs, runs
 * once, and is recorded. This file exists to finish what the old mechanism
 * started, and should only ever shrink.
 *
 * The helpers are unchanged from when they lived in database.cjs; they close
 * over the connection they are handed instead of a module-level one, which is
 * what kept them tangled with the composition root.
 */
const bcryptjs = require("bcryptjs");
const { generateId } = require("../helpers/ids.cjs");
const {
  normalizeIsoDate,
  normalizeIsoTime,
  formatIsoDate,
  formatIsoTime,
  nowDateTime,
  addDaysToIsoDate,
} = require("../helpers/isoDates.cjs");

function createLegacyBringUp(db) {
  // Purchase items recorded which product they topped up only implicitly, by
  // re-matching on barcode or name. Deleting an invoice could therefore not
  // reverse the stock it had added. Store the resolved product id at write time
  // and backfill history with the same matching rule `save()` used.
  function migratePurchaseItemProductLink() {
    try {
      const cols = db.prepare("PRAGMA table_info(purchase_invoice_items)").all();
      if (cols.some((c) => c.name === "product_id")) return;

      db.exec("ALTER TABLE purchase_invoice_items ADD COLUMN product_id TEXT");
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_invoice_items(product_id)",
      );
      const backfill = db.transaction(() => {
        db.prepare(
          `UPDATE purchase_invoice_items
              SET product_id = (
                SELECT p.id FROM products p
                 WHERE p.barcode IS NOT NULL
                   AND p.barcode <> ''
                   AND p.barcode = purchase_invoice_items.barcode
                 LIMIT 1
              )
            WHERE product_id IS NULL AND barcode IS NOT NULL AND barcode <> ''`,
        ).run();
        db.prepare(
          `UPDATE purchase_invoice_items
              SET product_id = (
                SELECT p.id FROM products p
                 WHERE p.name = purchase_invoice_items.product_name
                 LIMIT 1
              )
            WHERE product_id IS NULL`,
        ).run();
      });
      backfill();
      const linked = db
        .prepare(
          "SELECT COUNT(*) c FROM purchase_invoice_items WHERE product_id IS NOT NULL",
        )
        .get().c;
      console.log(
        `✅ Migration: added product_id to purchase_invoice_items (${linked} rows linked)`,
      );
    } catch (err) {
      console.error("❌ migratePurchaseItemProductLink failed:", err.message);
    }
  }

  // The alert engine used INSERT OR IGNORE against a freshly generated random
  // primary key, so it could never actually collide — every 30-minute tick
  // re-inserted an alert for the same still-open condition. Collapse the backlog
  // and enforce "at most one unread alert per (type, ref_id)" at the DB level.
  function migrateAlertsDedupe() {
    try {
      const removed = db
        .prepare(
          `DELETE FROM alerts
           WHERE is_read = 0
             AND id NOT IN (
               SELECT id FROM (
                 SELECT id,
                        ROW_NUMBER() OVER (
                          PARTITION BY type, ref_id
                          ORDER BY created_at DESC, id DESC
                        ) AS rn
                 FROM alerts
                 WHERE is_read = 0
               )
               WHERE rn = 1
             )`,
        )
        .run();
      db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unique_unread
           ON alerts(type, ref_id) WHERE is_read = 0`,
      );
      if (removed.changes > 0) {
        console.log(
          `✅ Migration: removed ${removed.changes} duplicate unread alerts`,
        );
      }
    } catch (err) {
      console.error("❌ migrateAlertsDedupe failed:", err.message);
    }
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
    migratePasswordsToHash();
  }

  function migratePasswordsToHash() {
    try {
      // Rows still holding a cleartext password. Two cases are handled:
      //  - never hashed  -> hash it, then clear the cleartext column
      //  - already hashed -> just clear the leftover cleartext column
      const users = db
        .prepare("SELECT id, password, password_hash FROM users WHERE password IS NOT NULL")
        .all();

      if (users.length === 0) return; // Nothing in cleartext

      const setHash = db.prepare(
        "UPDATE users SET password_hash=?, password=NULL WHERE id=?",
      );
      const clearOnly = db.prepare(
        "UPDATE users SET password=NULL WHERE id=?",
      );

      let hashed = 0;
      let cleared = 0;
      const migrateTx = db.transaction(() => {
        for (const user of users) {
          if (user.password_hash) {
            clearOnly.run(user.id);
            cleared++;
          } else {
            setHash.run(bcryptjs.hashSync(user.password, 12), user.id);
            hashed++;
          }
        }
      });

      migrateTx();
      console.log(
        `✅ Password migration: ${hashed} hashed, ${cleared} leftover cleartext removed`,
      );
    } catch (error) {
      console.error("❌ Password migration failed:", error.message);
    }
  }


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

  return {
    /**
     * The helpers that run immediately after the baseline schema, in the
     * order they have always run in — several add a column that a later one
     * backfills.
     */
    runPostSchemaBringUp() {
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
      migrateAlertsDedupe();
      migratePurchaseItemProductLink();
    },
    migrateLegacyDates,
    seedDefaultUsers,
  };
}

module.exports = {
  runPostSchemaBringUp: (db) => createLegacyBringUp(db).runPostSchemaBringUp(),
  migrateLegacyDates: (db) => createLegacyBringUp(db).migrateLegacyDates(),
  seedDefaultUsers: (db) => createLegacyBringUp(db).seedDefaultUsers(),
};
