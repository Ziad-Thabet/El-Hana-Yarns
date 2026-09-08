/* H4: schema versioning + foreign keys, run against a copy of the real DB. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion, MIGRATIONS } = require(path.join(P, "db", "migrations.cjs"));
const LATEST = Math.max(...MIGRATIONS.map((m) => m.version));

const dbPath = path.join(WORKDIR, "verify-h4.db");
for (const s of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
}
fs.copyFileSync((FIXTURE), dbPath);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// The fixture arrives fully migrated. This suite is about what the migration
// does to a database that has not had it, so wind the copy back first.
require(path.join(P, "tests", "helpers", "legacyShape.cjs")).toLegacyShape(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const count = (sql, ...p) => db.prepare(sql).get(...p).c;

// Snapshot what must survive.
const before = {};
for (const t of ["products", "sale_invoices", "customers", "customer_debts", "online_orders", "payment_records", "shifts", "expenses"]) {
  before[t] = count(`SELECT COUNT(*) c FROM ${t}`);
}
const orphanItemsBefore = count(
  "SELECT COUNT(*) c FROM sale_invoice_items ch WHERE NOT EXISTS (SELECT 1 FROM sale_invoices p WHERE p.id=ch.invoice_id)",
);
const itemsBefore = count("SELECT COUNT(*) c FROM sale_invoice_items");

console.log("=== migration ===");
check("starts at schema version 0", getSchemaVersion(db) === 0, `v${getSchemaVersion(db)}`);
const result = runMigrations(db);
check("migration applied", result.applied.includes("foreign-keys"));
check("schema version recorded", getSchemaVersion(db) === LATEST, `v${getSchemaVersion(db)} expected v${LATEST}`);

console.log("\n=== idempotency ===");
const second = runMigrations(db);
check("re-running is a no-op", second.applied.length === 0);

console.log("\n=== data preserved ===");
check("integrity_check ok", db.pragma("integrity_check")[0].integrity_check === "ok");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
for (const t of Object.keys(before)) {
  check(`${t} row count unchanged`, count(`SELECT COUNT(*) c FROM ${t}`) === before[t], `${count(`SELECT COUNT(*) c FROM ${t}`)} vs ${before[t]}`);
}
check(
  "orphaned line items removed",
  count("SELECT COUNT(*) c FROM sale_invoice_items") === itemsBefore - orphanItemsBefore,
  `removed ${itemsBefore - count("SELECT COUNT(*) c FROM sale_invoice_items")} of ${orphanItemsBefore}`,
);
check(
  "created_by now points at a real user",
  count("SELECT COUNT(*) c FROM expenses ch WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id=ch.created_by)") === 0 &&
  count("SELECT COUNT(*) c FROM online_orders ch WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id=ch.created_by)") === 0,
);

console.log("\n=== schema shape preserved ===");
check(
  "UNIQUE on sale_invoices.invoice_number kept",
  (() => {
    try {
      const row = db.prepare("SELECT invoice_number FROM sale_invoices LIMIT 1").get();
      if (!row) return true;
      db.prepare("INSERT INTO sale_invoices (id,invoice_number,date,time,total,cashier) VALUES ('dup_t',?,'2026-01-01','10:00',1,'x')").run(row.invoice_number);
      return false;
    } catch (e) {
      return String(e.message).includes("UNIQUE");
    }
  })(),
);
check(
  "explicit indexes replayed",
  db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='index' AND name='idx_sale_items_invoice'").get().c === 1,
);
check(
  "columns added by earlier ALTERs survived",
  db.prepare("PRAGMA table_info(online_orders)").all().some((c) => c.name === "bill_of_lading_image") &&
  db.prepare("PRAGMA table_info(sale_invoices)").all().some((c) => c.name === "voided"),
);
check(
  "primary keys intact",
  db.prepare("PRAGMA table_info(sale_invoice_items)").all().find((c) => c.name === "id").pk === 1,
);

console.log("\n=== constraints behave as chosen ===");
const tryRun = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.message;
  }
};

// RESTRICT: a product with sales history cannot be deleted.
const soldProduct = db
  .prepare("SELECT product_id FROM sale_invoice_items WHERE product_id IS NOT NULL LIMIT 1")
  .get();
check(
  "deleting a product with history is blocked",
  !!tryRun(() => db.prepare("DELETE FROM products WHERE id=?").run(soldProduct.product_id)),
);

// RESTRICT: a customer with debts cannot be deleted.
const indebted = db.prepare("SELECT customer_id FROM customer_debts LIMIT 1").get();
check(
  "deleting a customer with debts is blocked",
  !!tryRun(() => db.prepare("DELETE FROM customers WHERE id=?").run(indebted.customer_id)),
);

// CASCADE: deleting an invoice takes its lines with it.
const inv = db
  .prepare("SELECT invoice_id FROM sale_invoice_items GROUP BY invoice_id HAVING COUNT(*) > 0 LIMIT 1")
  .get();
const linesBefore = count("SELECT COUNT(*) c FROM sale_invoice_items WHERE invoice_id=?", inv.invoice_id);
db.prepare("DELETE FROM customer_debts WHERE invoice_id=?").run(inv.invoice_id);
db.prepare("DELETE FROM sale_invoices WHERE id=?").run(inv.invoice_id);
check(
  "invoice lines cascade with the invoice",
  linesBefore > 0 && count("SELECT COUNT(*) c FROM sale_invoice_items WHERE invoice_id=?", inv.invoice_id) === 0,
);

// SET NULL: deleting a driver detaches orders instead of destroying them.
const drv = db.prepare("SELECT id FROM drivers LIMIT 1").get();
db.prepare("UPDATE online_orders SET driver_id=? WHERE id=(SELECT id FROM online_orders LIMIT 1)").run(drv.id);
const attached = count("SELECT COUNT(*) c FROM online_orders WHERE driver_id=?", drv.id);
db.prepare("DELETE FROM driver_settlements WHERE driver_id=?").run(drv.id);
db.prepare("DELETE FROM drivers WHERE id=?").run(drv.id);
check(
  "orders survive driver deletion with a null link",
  attached > 0 && count("SELECT COUNT(*) c FROM online_orders WHERE driver_id=?", drv.id) === 0,
);

// CASCADE on customer detail.
const custWithAddr = db.prepare("SELECT customer_id FROM online_customers_addresses LIMIT 1").get();
if (custWithAddr) {
  db.prepare("DELETE FROM customer_debts WHERE customer_id=?").run(custWithAddr.customer_id);
  db.prepare("DELETE FROM online_orders WHERE customer_id=?").run(custWithAddr.customer_id);
  const addrBefore = count("SELECT COUNT(*) c FROM online_customers_addresses WHERE customer_id=?", custWithAddr.customer_id);
  const err = tryRun(() => db.prepare("DELETE FROM customers WHERE id=?").run(custWithAddr.customer_id));
  check(
    "addresses cascade once the protected references are gone",
    !err && addrBefore > 0 &&
      count("SELECT COUNT(*) c FROM online_customers_addresses WHERE customer_id=?", custWithAddr.customer_id) === 0,
    err ?? "",
  );
}

check("still clean after the destructive checks", db.pragma("foreign_key_check").length === 0);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
