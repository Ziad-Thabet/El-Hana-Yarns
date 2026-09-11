/* The figures underneath the headline have to be as honest as the headline.

   Three defects lived here, all of the same shape — an aggregate that ignored
   a dimension the rest of the system respects:

     - a weighted line stores quantity = 1 and the kilos in measure_amount, so
       SUM(quantity) reported one kilo of yarn sold when four were;
     - per-product revenue and quantity counted returned goods as sold, while
       the total above them did not;
     - cost was matched to purchases by barcode or name, so a product bought
       under a supplier's barcode matched nothing, cost came out zero, and the
       shop was told the sale was pure profit. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createReturnsDB } = require(path.join(P, "db/repositories/returns.cjs"));
const { createDebtsDB } = require(path.join(P, "db/repositories/debts.cjs"));
const { createReportsDB } = require(path.join(P, "db/repositories/reports.cjs"));

const dbPath = path.join(WORKDIR, "report-figures.db");
for (const s of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
}
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
runMigrations(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a, b) => Math.abs(a - b) < 0.005;

const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const returnsDB = createReturnsDB(() => db, productsDB);
const reportsDB = createReportsDB(
  () => db,
  productsDB,
  createDebtsDB(() => db),
  () => ({ getSalarySummary: () => ({ totalEarned: 0 }) }),
  null,
);

const actor = db.prepare("SELECT id FROM users LIMIT 1").get().id;
const today = new Date().toISOString().slice(0, 10);
const salesReport = () => reportsDB.generate({ type: "sales", from: today, to: today });
const dashboard = () => reportsDB.generate({ type: "dashboard", from: today, to: today });
const findProduct = (report, name) =>
  report.analytics.productPerformance.find((p) => p.name === name) ?? null;

// ── a product bought under one barcode and sold under another ──────────────
console.log("=== cost survives a barcode that does not match ===");
const categoryName = db.prepare("SELECT name FROM categories LIMIT 1").get().name;
db.prepare(
  `INSERT INTO products (id, name, price, stock, barcode, category, unit)
   VALUES ('p_costtest', 'خيط اختبار التكلفة', 100, 50, 'SHOP-BARCODE', ?, 'piece')`,
).run(categoryName);
db.prepare(
  `INSERT INTO purchase_invoices (id, invoice_number, supplier, date, time, total, status, paid_amount)
   VALUES ('pi_costtest', 'PI-COST', 'مورد', ?, '10:00', 600, 'paid', 600)`,
).run(today);
db.prepare(
  `INSERT INTO purchase_invoice_items
     (id, invoice_id, product_id, product_name, barcode, quantity, unit, purchase_price, item_total)
   VALUES ('pit_costtest', 'pi_costtest', 'p_costtest', 'اسم المورد المختلف', 'SUPPLIER-BARCODE', 10, 'piece', 60, 600)`,
).run();

salesDB.complete({
  total: 300,
  cashier: "T",
  totalPaid: 300,
  paymentSplits: [{ method: "cash", amount: 300 }],
  items: [
    {
      productId: "p_costtest",
      name: "خيط اختبار التكلفة",
      price: 100,
      quantity: 3,
      barcode: "SHOP-BARCODE",
      isWeighted: false,
      lineTotal: 300,
    },
  ],
});

const costRow = findProduct(salesReport(), "خيط اختبار التكلفة");
check("the sold product appears", !!costRow);
check(
  "its cost is matched through product_id, not the barcode",
  near(costRow.estimatedCost, 180),
  `${costRow.estimatedCost} (3 units at 60)`,
);
check(
  "so the margin is real rather than 100%",
  near(costRow.grossProfit, 120) && costRow.grossMargin < 100,
  `profit ${costRow.grossProfit}, margin ${costRow.grossMargin}%`,
);

// ── weighted lines are counted in their own unit ───────────────────────────
console.log("\n=== a weighted line is counted in kilos, not in lines ===");
const weighted = db.prepare("SELECT * FROM products WHERE unit <> 'piece' LIMIT 1").get();
check("the fixture has a weighted product", !!weighted, weighted?.unit);
const stockBefore = weighted.stock;
salesDB.complete({
  total: 400,
  cashier: "T",
  totalPaid: 400,
  paymentSplits: [{ method: "cash", amount: 400 }],
  items: [
    {
      productId: weighted.id,
      name: weighted.name,
      price: 100,
      quantity: 1,
      isWeighted: true,
      measureAmount: 4,
      measureUnit: "كجم",
      barcode: weighted.barcode,
      lineTotal: 400,
    },
  ],
});
const stockAfter = db.prepare("SELECT stock FROM products WHERE id=?").get(weighted.id).stock;
check("stock fell by the kilos sold", near(stockBefore - stockAfter, 4), `${stockBefore} → ${stockAfter}`);

const weightedRow = findProduct(salesReport(), weighted.name);
check(
  "the report counts the kilos, not the line",
  weightedRow.quantity >= 4,
  `${weightedRow.quantity}`,
);
const weightedTop = salesReport().topProducts.find((t) => t.name === weighted.name);
check("top products agrees", weightedTop && weightedTop.sold >= 4, `${weightedTop?.sold}`);

// ── returned goods stop being sold goods ───────────────────────────────────
console.log("\n=== a returned product is no longer a sold product ===");
const invoice = salesDB
  .getAll()
  .find((i) => i.items.some((it) => it.productId === "p_costtest"));
const beforeReturn = findProduct(salesReport(), "خيط اختبار التكلفة");
const dashBefore = dashboard();

const line = returnsDB
  .getReturnableLines(invoice.id)
  .find((l) => l.productId === "p_costtest");
returnsDB.create(invoice.id, {
  lines: [{ invoiceItemId: line.invoiceItemId, quantity: 1, restock: true }],
  reason: "اختبار",
  userId: actor,
  shiftId: null,
});

const afterReturn = findProduct(salesReport(), "خيط اختبار التكلفة");
const dashAfter = dashboard();
check(
  "its quantity drops by what came back",
  near(afterReturn.quantity, beforeReturn.quantity - 1),
  `${beforeReturn.quantity} → ${afterReturn.quantity}`,
);
check(
  "its revenue drops by the refunded value",
  near(afterReturn.revenue, beforeReturn.revenue - 100),
  `${beforeReturn.revenue} → ${afterReturn.revenue}`,
);
check(
  "what was sold is still visible alongside",
  near(afterReturn.grossRevenue, beforeReturn.revenue) && near(afterReturn.returned, 100),
  `gross ${afterReturn.grossRevenue}, returned ${afterReturn.returned}`,
);
check(
  "a restocked unit stops being a cost of goods sold",
  near(afterReturn.estimatedCost, beforeReturn.estimatedCost - 60),
  `${beforeReturn.estimatedCost} → ${afterReturn.estimatedCost}`,
);
check(
  "the restocked unit is back on the shelf",
  near(
    db.prepare("SELECT stock FROM products WHERE id='p_costtest'").get().stock,
    48,
  ),
  `${db.prepare("SELECT stock FROM products WHERE id='p_costtest'").get().stock}`,
);
check(
  "the dashboard's gross profit follows",
  dashAfter.kpis.grossProfit < dashBefore.kpis.grossProfit,
  `${dashBefore.kpis.grossProfit} → ${dashAfter.kpis.grossProfit}`,
);

// ── damaged stock is a real loss ───────────────────────────────────────────
console.log("\n=== goods refunded without restocking stay a cost ===");
const beforeDamage = findProduct(salesReport(), "خيط اختبار التكلفة");
const remaining = returnsDB
  .getReturnableLines(invoice.id)
  .find((l) => l.productId === "p_costtest");
returnsDB.create(invoice.id, {
  lines: [{ invoiceItemId: remaining.invoiceItemId, quantity: 1, restock: false }],
  reason: "تالف",
  userId: actor,
  shiftId: null,
});
const afterDamage = findProduct(salesReport(), "خيط اختبار التكلفة");
check(
  "the refund still comes off the revenue",
  near(afterDamage.revenue, beforeDamage.revenue - 100),
  `${beforeDamage.revenue} → ${afterDamage.revenue}`,
);
check(
  "but the cost stays, because the shop really lost the goods",
  near(afterDamage.estimatedCost, beforeDamage.estimatedCost),
  `${beforeDamage.estimatedCost} → ${afterDamage.estimatedCost}`,
);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
