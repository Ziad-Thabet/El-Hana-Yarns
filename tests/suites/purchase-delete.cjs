/* C3: deleting a purchase invoice must reverse its stock and leave no orphans. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createPurchaseDB } = require(path.join(P, "db/repositories/purchase.cjs"));

const dbPath = path.join(WORKDIR, "verify-c3.db");
for (const s of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
}
fs.copyFileSync((FIXTURE), dbPath);
const db = new Database(dbPath);
require(path.join(P, "db/helpers/images.cjs")).initImagePaths(__dirname);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// ── Legacy row, written before product_id existed ──────────────────────────
db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit) VALUES ('p_legacy','منتج قديم',5,10,'2000000000109','piece')",
).run();
db.prepare(
  "INSERT INTO purchase_invoices (id,invoice_number,supplier,date,time,total,status,paid_amount) VALUES ('pi_legacy','PI-LEGACY','مورد','2026-01-01','10:00',50,'paid',50)",
).run();
db.prepare(
  "INSERT INTO purchase_invoice_items (id,invoice_id,product_name,barcode,quantity,unit,purchase_price,item_total) VALUES ('pit_legacy','pi_legacy','منتج قديم','2000000000109',10,'piece',5,50)",
).run();

// ── Migration (same SQL as database.cjs) ──────────────────────────────────
console.log("=== migration backfill ===");
// Guarded exactly as the app's own bring-up is: the column may already be
// there, and the backfill below has to run either way.
if (
  !db
    .pragma("table_info(purchase_invoice_items)")
    .some((c) => c.name === "product_id")
) {
  db.exec("ALTER TABLE purchase_invoice_items ADD COLUMN product_id TEXT");
}
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_invoice_items(product_id)",
);
db.transaction(() => {
  db.prepare(
    `UPDATE purchase_invoice_items SET product_id = (
       SELECT p.id FROM products p WHERE p.barcode IS NOT NULL AND p.barcode <> ''
         AND p.barcode = purchase_invoice_items.barcode LIMIT 1)
     WHERE product_id IS NULL AND barcode IS NOT NULL AND barcode <> ''`,
  ).run();
  db.prepare(
    `UPDATE purchase_invoice_items SET product_id = (
       SELECT p.id FROM products p WHERE p.name = purchase_invoice_items.product_name LIMIT 1)
     WHERE product_id IS NULL`,
  ).run();
})();
check(
  "legacy item linked by barcode",
  db.prepare("SELECT product_id FROM purchase_invoice_items WHERE id='pit_legacy'").get()
    .product_id === "p_legacy",
);

const productsDB = createProductsDB(() => db);
const purchaseDB = createPurchaseDB(() => db, productsDB);
const stockOf = (id) => db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock;
const countRows = (sql, ...p) => db.prepare(sql).get(...p).c;

// Deleting the legacy invoice must still reverse its stock.
purchaseDB.delete("pi_legacy");
check("legacy invoice delete reverses stock", stockOf("p_legacy") === 0, `stock=${stockOf("p_legacy")}`);

// ── New invoice: save links the product and adds stock ────────────────────
console.log("\n=== save + delete round trip ===");
db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit) VALUES ('p_wool','صوف',20,4,'2000000000116','piece')",
).run();

const saved = purchaseDB.save({
  supplier: "مورد الصوف",
  total: 300,
  paidAmount: 300,
  items: [
    { productName: "صوف", barcode: "2000000000116", quantity: 15, unit: "piece", purchasePrice: 20 },
  ],
});
check("save adds stock", stockOf("p_wool") === 19, `stock=${stockOf("p_wool")}`);
check(
  "save records product_id",
  db.prepare("SELECT product_id FROM purchase_invoice_items WHERE invoice_id=?").get(saved.id)
    .product_id === "p_wool",
);
check("save records the payment", countRows("SELECT COUNT(*) c FROM payment_records WHERE ref_id=? AND ref_type='purchase'", saved.id) === 1);

db.prepare(
  "INSERT INTO invoice_due_dates (id,invoice_id,due_date,created_at) VALUES ('idd_t',?,'2026-02-01','2026-01-01T00:00:00Z')",
).run(saved.id);
db.prepare(
  "INSERT INTO alerts (id,type,ref_id,message,is_read,created_at) VALUES ('al_t','invoice_overdue',?,'متأخرة',0,'2026-01-01T00:00:00Z')",
).run(saved.id);

const res = purchaseDB.delete(saved.id);
check("delete reverses the added stock", stockOf("p_wool") === 4, `stock=${stockOf("p_wool")}`);
check("delete reports reversed items", res.reversedItems === 1);
check("invoice row gone", countRows("SELECT COUNT(*) c FROM purchase_invoices WHERE id=?", saved.id) === 0);
check("line items gone", countRows("SELECT COUNT(*) c FROM purchase_invoice_items WHERE invoice_id=?", saved.id) === 0);
check("payment records gone", countRows("SELECT COUNT(*) c FROM payment_records WHERE ref_id=? AND ref_type='purchase'", saved.id) === 0);
check("due date gone", countRows("SELECT COUNT(*) c FROM invoice_due_dates WHERE invoice_id=?", saved.id) === 0);
check("alert gone", countRows("SELECT COUNT(*) c FROM alerts WHERE ref_id=?", saved.id) === 0);

// ── Clamp when stock was already sold ─────────────────────────────────────
console.log("\n=== clamp guard ===");
const sold = purchaseDB.save({
  supplier: "مورد",
  total: 200,
  paidAmount: 0,
  items: [
    { productName: "صوف", barcode: "2000000000116", quantity: 10, unit: "piece", purchasePrice: 20 },
  ],
});
check("stock after receiving", stockOf("p_wool") === 14, `stock=${stockOf("p_wool")}`);
db.prepare("UPDATE products SET stock = 3 WHERE id='p_wool'").run(); // 11 sold since
purchaseDB.delete(sold.id);
check("reversal clamps at zero instead of going negative", stockOf("p_wool") === 0, `stock=${stockOf("p_wool")}`);

// ── Unknown id is a no-op ─────────────────────────────────────────────────
const missing = purchaseDB.delete("pi_does_not_exist");
check("deleting an unknown invoice is a safe no-op", missing.success === true && missing.reversedItems === 0);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
