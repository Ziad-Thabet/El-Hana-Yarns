/* Phase 5: the end-of-day figures must be correct, date-scoped and repeatable,
   and the workbook must actually open. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const ExcelJS = require(path.join(P, "node_modules", "exceljs"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const images = require(path.join(P, "db/helpers/images.cjs"));

const workDir = path.join(WORKDIR, "eod");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "eod.db");
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
images.initImagePaths(workDir);
// database.cjs guarantees this column via its legacy startup bring-up, which
// runs before the versioned migrations. Reproduce that baseline here.
if (!db.prepare("PRAGMA table_info(purchase_invoice_items)").all().some((c) => c.name === "product_id")) {
  db.exec("ALTER TABLE purchase_invoice_items ADD COLUMN product_id TEXT");
}
runMigrations(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a, b, eps = 0.005) => Math.abs((a ?? 0) - (b ?? 0)) < eps;

const { createSettingsDB } = require(path.join(P, "db/repositories/settings.cjs"));
const { createPaymentMethodsDB } = require(path.join(P, "db/repositories/paymentMethods.cjs"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const { createReturnsDB } = require(path.join(P, "db/repositories/returns.cjs"));
const { createEndOfDayDB } = require(path.join(P, "db/repositories/endOfDay.cjs"));
const { buildWorkbook, writeWorkbook } = require(path.join(P, "workers/excelWriter.cjs"));

const settingsDB = createSettingsDB(() => db);
const paymentMethodsDB = createPaymentMethodsDB(() => db);
const productsDB = createProductsDB(() => db, settingsDB);
const salesDB = createSalesDB(() => db, productsDB);
const shiftsDB = createShiftsDB(() => db, settingsDB, paymentMethodsDB);
const returnsDB = createReturnsDB(() => db, productsDB);
const endOfDayDB = createEndOfDayDB(() => db, settingsDB);

// ── A known day, built from scratch ────────────────────────────────────────
const DAY = "2026-06-15";
const OTHER = "2026-06-16";
db.prepare("INSERT INTO users (id,username,password_hash,display_name,role,is_active) VALUES ('eod_u','eod','x','EOD User','admin',1)").run();
db.prepare("INSERT INTO products (id,name,price,stock,barcode,unit,category) VALUES ('eod_a','Yarn A',50,100,'2000000005001','piece','خيوط')").run();
db.prepare("INSERT INTO products (id,name,price,stock,barcode,unit,category) VALUES ('eod_b','Yarn B',30,2,'2000000005002','piece','خيوط')").run();
const shift = shiftsDB.create("eod_u", DAY, `${DAY}T08:00:00Z`);

function saleOn(date, splits, total, qty, customer) {
  const res = salesDB.complete({
    total, cashier: "EOD User", shiftId: shift.id,
    totalPaid: splits.reduce((s, x) => s + x.amount, 0),
    paymentSplits: splits, customerInfo: customer,
    items: [{ productId: "eod_a", name: "Yarn A", price: 50, quantity: qty, isWeighted: false, lineTotal: total }],
  });
  db.prepare("UPDATE sale_invoices SET date=? WHERE id=?").run(date, res.id);
  db.prepare("UPDATE payment_records SET date=? WHERE ref_id=?").run(date, res.id);
  return res;
}

const s1 = saleOn(DAY, [{ method: "cash", amount: 100 }], 100, 2);
const s2 = saleOn(DAY, [{ method: "cash", amount: 100 }, { method: "instapay", amount: 50 }], 150, 3);
const s3 = saleOn(DAY, [{ method: "cash", amount: 50 }], 200, 4, { name: "Debtor", phone: "01555111222" });
// A sale on the following day, which must not leak into the report.
saleOn(OTHER, [{ method: "cash", amount: 999 }], 999, 1);

console.log("=== the report is scoped to its date ===");
const report = endOfDayDB.build(DAY);
check("only that day's invoices", report.invoices.length === 3, `${report.invoices.length}`);
check("gross sales excludes the next day", near(report.summary.grossSales, 450), `${report.summary.grossSales}`);
check("the other day reports its own figure",
  near(endOfDayDB.build(OTHER).summary.grossSales, 999));
check("collected is net of what was actually paid",
  near(report.summary.collectedTotal, 300), `${report.summary.collectedTotal}`);
check("cash and instapay split correctly", (() => {
  const byMethod = Object.fromEntries(report.summary.collectedByMethod.map((m) => [m.method, m.amount]));
  return near(byMethod.cash, 250) && near(byMethod.instapay, 50);
})(), JSON.stringify(report.summary.collectedByMethod));
check("the debt sale leaves a remaining balance",
  report.invoices.some((i) => near(i.remaining, 150)));
check("items sold counted", near(report.summary.itemsSold, 9), `${report.summary.itemsSold}`);
check("average basket", near(report.summary.averageBasket, 150), `${report.summary.averageBasket}`);

console.log("\n=== idempotent ===");
const again = endOfDayDB.build(DAY);
const strip = (r) => JSON.stringify({ ...r, meta: { ...r.meta, generatedAt: null } });
check("rebuilding the same day gives the same numbers", strip(report) === strip(again));

console.log("\n=== returns reduce net sales ===");
const lines = returnsDB.getReturnableLines(s2.id);
const ret = returnsDB.create(s2.id, {
  lines: [{ invoiceItemId: lines[0].invoiceItemId, quantity: 1, restock: true }],
  reason: "عيب في الخامة", userId: "eod_u", shiftId: shift.id,
});
db.prepare("UPDATE sale_returns SET date=? WHERE id=?").run(DAY, ret.id);
db.prepare("UPDATE payment_records SET date=? WHERE source='refund'").run(DAY);
const afterReturn = endOfDayDB.build(DAY);
check("the return appears", afterReturn.returns.length === 1, `${afterReturn.returns.length}`);
check("gross sales unchanged by a return", near(afterReturn.summary.grossSales, 450));
check("net sales is gross minus returns",
  near(afterReturn.summary.netSales, 450 - afterReturn.summary.returnedTotal),
  `${afterReturn.summary.netSales}`);
check("collected drops by the refund",
  afterReturn.summary.collectedTotal < 300, `${afterReturn.summary.collectedTotal}`);

console.log("\n=== inventory movement reconciles ===");
const yarnA = afterReturn.inventory.find((i) => i.name === "Yarn A");
check("sold quantity is right", near(yarnA.sold, 9), `${yarnA.sold}`);
check("restocked return counted", near(yarnA.returned, 1), `${yarnA.returned}`);
// opening = closing + sold - returned - received, so the identity must hold.
check("opening reconciles with closing",
  near(yarnA.openingStock, yarnA.closingStock + yarnA.sold - yarnA.returned - yarnA.received),
  `${yarnA.openingStock} vs ${yarnA.closingStock}+${yarnA.sold}-${yarnA.returned}-${yarnA.received}`);

console.log("\n=== stock alerts follow the configured threshold ===");
check("low-stock product flagged", afterReturn.alerts.some((a) => a.name === "Yarn B"));
settingsDB.set("inventory.lowStockThreshold", 1);
const tighter = endOfDayDB.build(DAY);
check("raising the bar narrows the list",
  tighter.alerts.length < afterReturn.alerts.length,
  `${tighter.alerts.length} vs ${afterReturn.alerts.length}`);
settingsDB.reset("inventory.lowStockThreshold");
check("days of cover is null when nothing sold",
  afterReturn.alerts.filter((a) => a.soldInPeriod === 0).every((a) => a.daysOfCover === null));

console.log("\n=== shop identity reaches the report header ===");
settingsDB.setMany({ "shop.name": "محل التقرير", "shop.address": "١ شارع الاختبار" });
const branded = endOfDayDB.build(DAY);
check("configured shop name is in the meta", branded.meta.shop.name === "محل التقرير");
check("configured address is in the meta", branded.meta.shop.address === "١ شارع الاختبار");

console.log("\n=== a date range works, not just one day ===");
const ranged = endOfDayDB.build(DAY, OTHER);
check("range covers both days", near(ranged.summary.grossSales, 450 + 999), `${ranged.summary.grossSales}`);
check("range is flagged as multi-day", ranged.meta.isSingleDay === false);
let threw = null;
try { endOfDayDB.build(null); } catch (e) { threw = e.message; }
check("a missing date is rejected", !!threw);

console.log("\n=== the workbook is real and opens ===");
const outPath = path.join(workDir, "report.xlsx");
(async () => {
  await writeWorkbook(branded, outPath);
  check("file written", fs.existsSync(outPath));
  check("file is not empty", fs.statSync(outPath).size > 5000, `${fs.statSync(outPath).size} bytes`);

  // Read it back with a fresh ExcelJS instance — if it cannot parse, Excel won't.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(outPath);
  const names = wb.worksheets.map((w) => w.name);
  check("all expected sheets present", names.length === 11, names.join(", "));
  for (const expected of ["الملخص", "المبيعات", "أصناف المبيعات", "حركة المخزون",
    "تنبيهات المخزون", "المرتجعات", "الطلبات الأونلاين", "الديون", "المصروفات",
    "المشتريات", "الشيفتات"]) {
    if (!names.includes(expected)) check(`sheet "${expected}" present`, false);
  }
  check("summary carries the configured shop name",
    wb.getWorksheet("الملخص").getCell("A1").value === "محل التقرير",
    String(wb.getWorksheet("الملخص").getCell("A1").value));

  const salesSheet = wb.getWorksheet("المبيعات");
  check("sales sheet has a row per invoice plus header and totals",
    salesSheet.rowCount === branded.invoices.length + 2,
    `${salesSheet.rowCount} rows for ${branded.invoices.length} invoices`);
  check("sales sheet is right-to-left", salesSheet.views[0].rightToLeft === true);
  check("header row is frozen", salesSheet.views[0].state === "frozen");
  // Column keys do not survive a round trip through the file format, so the
  // read-back workbook is addressed by index. TOTAL_COL is the 7th column.
  const TOTAL_COL = 7;
  check("money column carries a number format",
    /#,##0/.test(salesSheet.getColumn(TOTAL_COL).numFmt ?? ""),
    salesSheet.getColumn(TOTAL_COL).numFmt);
  check("totals row sums the invoices", (() => {
    const last = salesSheet.getRow(salesSheet.rowCount);
    return near(last.getCell(TOTAL_COL).value, branded.summary.grossSales);
  })(), String(salesSheet.getRow(salesSheet.rowCount).getCell(TOTAL_COL).value));
  check("values are numbers, not strings",
    typeof salesSheet.getRow(2).getCell(TOTAL_COL).value === "number");
  check("the header row is bold", salesSheet.getRow(1).font?.bold === true);

  const lineSheet = wb.getWorksheet("أصناف المبيعات");
  check("line-item sheet has every sold line",
    lineSheet.rowCount === branded.lines.length + 2, `${lineSheet.rowCount}`);

  // An empty day must still produce a valid, openable file.
  const emptyPath = path.join(workDir, "empty.xlsx");
  await writeWorkbook(endOfDayDB.build("2019-01-01"), emptyPath);
  const emptyWb = new ExcelJS.Workbook();
  await emptyWb.xlsx.readFile(emptyPath);
  check("a day with no activity still produces a valid workbook",
    emptyWb.worksheets.length === 11, `${emptyWb.worksheets.length} sheets`);
  check("empty sheets have only their header",
    emptyWb.getWorksheet("المبيعات").rowCount === 1,
    `${emptyWb.getWorksheet("المبيعات").rowCount}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
