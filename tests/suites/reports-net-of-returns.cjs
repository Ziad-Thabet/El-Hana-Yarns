/* A returned sale is not revenue, on every screen that reports revenue.

   The sales list already subtracted returns; the reports did not, so the same
   day read one way in one place and another way in another. These checks pin
   the arithmetic in both directions: returns come off the booked figures, and
   they do not come off twice anywhere they were already accounted for. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const { createReportsDB } = require(path.join(P, "db/repositories/reports.cjs"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createReturnsDB } = require(path.join(P, "db/repositories/returns.cjs"));

const dbPath = path.join(WORKDIR, "reports-net.db");
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
const { createDebtsDB } = require(path.join(P, "db/repositories/debts.cjs"));
const debtsDB = createDebtsDB(() => db);
const reportsDB = createReportsDB(
  () => db,
  productsDB,
  debtsDB,
  // Salaries are irrelevant here and expensive to compute per user.
  () => ({ getSalarySummary: () => ({ totalEarned: 0 }) }),
  null,
);

const actor = db.prepare("SELECT id FROM users LIMIT 1").get().id;
const today = new Date().toISOString().slice(0, 10);

// Work on one day so the figures are easy to reason about.
const invoices = salesDB
  .getAll()
  .filter((i) => i.date === today && (i.returnStatus ?? "none") === "none");
check("the fixture has sales to work with today", invoices.length > 0, `${invoices.length}`);

const salesReport = (from, to) => reportsDB.generate({ type: "sales", from, to });
const dashboard = (from, to) => reportsDB.generate({ type: "dashboard", from, to });

console.log("=== before any return ===");
const before = salesReport(today, today);
const beforeDash = dashboard(today, today);
check("nothing is reported as returned", before.stats.returned === 0, `${before.stats.returned}`);
check(
  "booked equals gross when nothing came back",
  near(before.stats.bookedRevenue, before.stats.grossRevenue),
  `${before.stats.bookedRevenue} vs ${before.stats.grossRevenue}`,
);
check(
  "the dashboard agrees with the sales report on what was sold",
  near(beforeDash.kpis.grossRevenue, before.stats.grossRevenue),
  `${beforeDash.kpis.grossRevenue} vs ${before.stats.grossRevenue}`,
);
const listBefore = salesDB
  .getAll()
  .filter((i) => i.date === today)
  .reduce((sum, i) => sum + i.netTotal, 0);
check(
  "and with the sales list",
  near(Math.round(listBefore * 100) / 100, before.stats.bookedRevenue),
  `list ${listBefore} vs report ${before.stats.bookedRevenue}`,
);

console.log("\n=== after a return ===");
const target = invoices[0];
const lines = returnsDB.getReturnableLines(target.id);
returnsDB.create(target.id, {
  lines: [
    {
      invoiceItemId: lines[0].invoiceItemId,
      quantity: lines[0].returnableQuantity,
      restock: true,
    },
  ],
  reason: "اختبار",
  userId: actor,
  shiftId: null,
});
const refunded = salesDB.getById(target.id).refundedAmount;
check("the return was recorded", refunded > 0, String(refunded));

const after = salesReport(today, today);
const afterDash = dashboard(today, today);

check(
  "the sales report reports what came back",
  near(after.stats.returned, refunded),
  `${after.stats.returned} vs ${refunded}`,
);
check("it counts the return", after.stats.returnCount === 1, `${after.stats.returnCount}`);
check(
  "gross is untouched — the sale still happened",
  near(after.stats.grossRevenue, before.stats.grossRevenue),
  `${after.stats.grossRevenue} vs ${before.stats.grossRevenue}`,
);
check(
  "booked revenue drops by exactly the refund",
  near(after.stats.bookedRevenue, before.stats.bookedRevenue - refunded),
  `${before.stats.bookedRevenue} → ${after.stats.bookedRevenue}`,
);
check(
  "the dashboard drops by the same amount",
  near(afterDash.kpis.bookedRevenue, beforeDash.kpis.bookedRevenue - refunded),
  `${beforeDash.kpis.bookedRevenue} → ${afterDash.kpis.bookedRevenue}`,
);
check(
  "the dashboard and the sales report still agree",
  near(afterDash.kpis.bookedRevenue, after.stats.bookedRevenue),
  `${afterDash.kpis.bookedRevenue} vs ${after.stats.bookedRevenue}`,
);

const listAfter = salesDB
  .getAll()
  .filter((i) => i.date === today)
  .reduce((sum, i) => sum + i.netTotal, 0);
check(
  "and the sales list agrees with both",
  near(Math.round(listAfter * 100) / 100, after.stats.bookedRevenue),
  `list ${listAfter} vs report ${after.stats.bookedRevenue}`,
);

console.log("\n=== the trend line and the derived figures ===");
const point = after.analytics?.trend?.find((p) => p.date === today) ?? null;
if (point) {
  check("the day's point carries the return", near(point.returned, refunded), `${point.returned}`);
  check(
    "its revenue is net",
    near(point.revenue, point.grossRevenue - point.returned),
    `${point.revenue} = ${point.grossRevenue} - ${point.returned}`,
  );
} else {
  check("the sales trend includes today", false, "no point for today");
}
check(
  "average invoice value is computed from the net figure",
  near(
    afterDash.kpis.averageTransactionValue,
    Math.round((afterDash.kpis.bookedRevenue / afterDash.kpis.invoices) * 100) / 100,
  ),
  `${afterDash.kpis.averageTransactionValue}`,
);
check(
  "gross profit fell with the returned sale",
  afterDash.kpis.grossProfit < beforeDash.kpis.grossProfit,
  `${beforeDash.kpis.grossProfit} → ${afterDash.kpis.grossProfit}`,
);

console.log("\n=== collected revenue is not double-counted ===");
// Cash refunds are already negative payment records, so the collected figure
// nets them on its own. Subtracting the return again here would charge the
// shop for it twice.
check(
  "collected revenue moved by at most the refund",
  beforeDash.kpis.revenue - afterDash.kpis.revenue <= refunded + 0.005,
  `${beforeDash.kpis.revenue} → ${afterDash.kpis.revenue}`,
);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
