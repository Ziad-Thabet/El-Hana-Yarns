/* PR 5: shift_totals must agree with the legacy columns to the cent, across
   every historical shift and every kind of money movement. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion } = require(path.join(P, "db/migrations.cjs"));
const images = require(path.join(P, "db/helpers/images.cjs"));

const workDir = path.join(WORKDIR, "pm");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "pm.db");
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
images.initImagePaths(workDir);
runMigrations(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a, b, eps = 0.005) => Math.abs((a ?? 0) - (b ?? 0)) < eps;

const { createPaymentMethodsDB } = require(path.join(P, "db/repositories/paymentMethods.cjs"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const { createReturnsDB } = require(path.join(P, "db/repositories/returns.cjs"));
const { createDebtsDB } = require(path.join(P, "db/repositories/debts.cjs"));

const paymentMethodsDB = createPaymentMethodsDB(() => db);
const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const shiftsDB = createShiftsDB(() => db, null, paymentMethodsDB);
const returnsDB = createReturnsDB(() => db, productsDB);
const debtsDB = createDebtsDB(() => db);

console.log("=== schema and seed ===");
check("migration reached v6", getSchemaVersion(db) >= 6, `v${getSchemaVersion(db)}`);
check("three methods seeded", paymentMethodsDB.getAll().length === 3);
check(
  "codes match payment_records.method",
  paymentMethodsDB.getAll().map((m) => m.code).sort().join(",") === "cash,instapay,vodafone",
);
check(
  "cash is the only cash-kind method",
  paymentMethodsDB.getAll().filter((m) => m.isCash).map((m) => m.code).join() === "cash",
);
check(
  "digital methods want a receipt",
  paymentMethodsDB.byCode("vodafone").needsReceipt && paymentMethodsDB.byCode("instapay").needsReceipt,
);
check("cash does not", paymentMethodsDB.byCode("cash").needsReceipt === false);

console.log("\n=== backfill: every historical shift reconciles ===");
const reconcile = () => {
  const bad = [];
  for (const shift of db.prepare("SELECT * FROM shifts").all()) {
    const stored = shiftsDB.getStoredTotals(shift.id);
    const pairs = [
      ["cash", shift.total_cash],
      ["vodafone", shift.total_vodafone],
      ["instapay", shift.total_instapay],
    ];
    for (const [code, legacy] of pairs) {
      if (!near(stored[code], legacy)) {
        bad.push(`${shift.id}/${code}: ${stored[code]} vs ${legacy}`);
      }
    }
  }
  return bad;
};
// Shifts written straight into the fixture never went through the v6 backfill
// — an open shift legitimately has no stored totals until it closes. Apply the
// migration's own statement first, so what is being reconciled is that SQL.
for (const [methodId, column] of [
  ["pm_cash", "total_cash"],
  ["pm_vodafone", "total_vodafone"],
  ["pm_instapay", "total_instapay"],
]) {
  db.prepare(
    `INSERT OR IGNORE INTO shift_totals (shift_id, method_id, amount)
     SELECT id, ?, COALESCE(${column}, 0) FROM shifts`,
  ).run(methodId);
}

const shiftCount = db.prepare("SELECT COUNT(*) c FROM shifts").get().c;
const initialDiffs = reconcile();
check(
  `all ${shiftCount} existing shifts backfilled to the cent`,
  initialDiffs.length === 0,
  initialDiffs.slice(0, 3).join("; "),
);

console.log("\n=== the two writers agree on new activity ===");
db.prepare("INSERT INTO products (id,name,price,stock,unit) VALUES ('pm_p','P',10,100000,'piece')").run();
db.prepare("INSERT INTO users (id,username,password_hash,display_name,role,is_active) VALUES ('pm_u','pmuser','x','PM','admin',1)").run();

function sale(shiftId, splits, total, customer) {
  return salesDB.complete({
    total,
    cashier: "PM",
    shiftId,
    totalPaid: splits.reduce((s, x) => s + x.amount, 0),
    paymentSplits: splits,
    customerInfo: customer,
    items: [
      { productId: "pm_p", name: "P", price: 10, quantity: total / 10, isWeighted: false, lineTotal: total },
    ],
  });
}

const s1 = shiftsDB.create("pm_u", "2026-09-08", "2026-09-08T08:00:00Z");
sale(s1.id, [{ method: "cash", amount: 100 }], 100);
shiftsDB.end(s1.id, "2026-09-08T20:00:00Z");
let row = db.prepare("SELECT * FROM shifts WHERE id=?").get(s1.id);
let stored = shiftsDB.getStoredTotals(s1.id);
check("cash-only shift agrees", near(stored.cash, row.total_cash) && near(stored.cash, 100), `${stored.cash} vs ${row.total_cash}`);

const s2 = shiftsDB.create("pm_u", "2026-09-09", "2026-09-09T08:00:00Z");
sale(s2.id, [{ method: "cash", amount: 200 }, { method: "vodafone", amount: 60 }, { method: "instapay", amount: 40 }], 300);
shiftsDB.end(s2.id, "2026-09-09T20:00:00Z");
row = db.prepare("SELECT * FROM shifts WHERE id=?").get(s2.id);
stored = shiftsDB.getStoredTotals(s2.id);
check(
  "split shift agrees on all three methods",
  near(stored.cash, row.total_cash) && near(stored.vodafone, row.total_vodafone) && near(stored.instapay, row.total_instapay),
  `${stored.cash}/${stored.vodafone}/${stored.instapay} vs ${row.total_cash}/${row.total_vodafone}/${row.total_instapay}`,
);

// A refund must subtract from the same buckets in both representations.
const s3 = shiftsDB.create("pm_u", "2026-09-10", "2026-09-10T08:00:00Z");
const refunded = sale(s3.id, [{ method: "cash", amount: 250 }, { method: "instapay", amount: 100 }], 350);
const lines = returnsDB.getReturnableLines(refunded.id);
returnsDB.create(refunded.id, {
  lines: [{ invoiceItemId: lines[0].invoiceItemId, quantity: 10, restock: true }],
  userId: "pm_u",
  shiftId: s3.id,
});
shiftsDB.end(s3.id, "2026-09-10T20:00:00Z");
row = db.prepare("SELECT * FROM shifts WHERE id=?").get(s3.id);
stored = shiftsDB.getStoredTotals(s3.id);
check(
  "refund subtracts identically in both",
  near(stored.cash, row.total_cash) && near(stored.instapay, row.total_instapay),
  `${stored.cash}/${stored.instapay} vs ${row.total_cash}/${row.total_instapay}`,
);
check("the refund actually reduced the drawer", row.total_cash < 250, `${row.total_cash}`);

// A debt settlement lands in the shift it was collected in.
const s4 = shiftsDB.create("pm_u", "2026-09-11", "2026-09-11T08:00:00Z");
const onDebt = sale(s4.id, [{ method: "cash", amount: 50 }], 200, { name: "PM Cust", phone: "01999888777" });
const debt = db.prepare("SELECT * FROM customer_debts WHERE invoice_id=?").get(onDebt.id);
debtsDB.addPayment(debt.id, { amount: 75, method: "vodafone", shiftId: s4.id });
shiftsDB.end(s4.id, "2026-09-11T20:00:00Z");
row = db.prepare("SELECT * FROM shifts WHERE id=?").get(s4.id);
stored = shiftsDB.getStoredTotals(s4.id);
check(
  "debt settlement agrees in both",
  near(stored.cash, row.total_cash) && near(stored.vodafone, row.total_vodafone),
  `${stored.cash}/${stored.vodafone} vs ${row.total_cash}/${row.total_vodafone}`,
);
check("the settlement was counted", near(row.total_vodafone, 75), `${row.total_vodafone}`);

console.log("\n=== whole-table reconciliation after all of that ===");
const finalDiffs = reconcile();
check("every shift still reconciles to the cent", finalDiffs.length === 0, finalDiffs.slice(0, 3).join("; "));

console.log("\n=== legacy cannot drift from byCode ===");
const summary = shiftsDB.getSummary(s2.id);
check(
  "legacy keys are derived from byCode",
  summary.cash === (summary.byCode.cash ?? 0) &&
    summary.vodafone_cash === (summary.byCode.vodafone ?? 0) &&
    summary.instapay === (summary.byCode.instapay ?? 0),
);
check(
  "existing consumers still see the legacy shape",
  typeof summary.cash === "number" &&
    typeof summary.vodafone_cash === "number" &&
    typeof summary.instapay === "number" &&
    typeof summary.totalInvoices === "number",
);

console.log("\n=== a new method needs no code change ===");
db.prepare(
  "INSERT INTO payment_methods (id,code,name_ar,name_en,kind,needs_receipt,sort_order,is_active,is_system) VALUES ('pm_card','card','بطاقة','Card','digital',1,3,1,0)",
).run();
paymentMethodsDB.invalidate();
const s5 = shiftsDB.create("pm_u", "2026-09-12", "2026-09-12T08:00:00Z");
sale(s5.id, [{ method: "card", amount: 120 }], 120);
shiftsDB.end(s5.id, "2026-09-12T20:00:00Z");
stored = shiftsDB.getStoredTotals(s5.id);
check("a brand-new method is totalled with no code change", near(stored.card, 120), `${stored.card}`);
const s5summary = shiftsDB.getSummary(s5.id);
check("it appears in byCode", near(s5summary.byCode.card, 120));
check(
  "but not in the legacy triplet, which only knows three",
  s5summary.cash === 0 && s5summary.vodafone_cash === 0 && s5summary.instapay === 0,
);

console.log("\n=== method management ===");
let threw = null;
try {
  paymentMethodsDB.update("pm_cash", { isActive: false });
} catch (e) {
  threw = e.message;
}
check("a system method cannot be deactivated", !!threw, threw ?? "no error");
const renamed = paymentMethodsDB.update("pm_vodafone", { nameAr: "فودافون", sortOrder: 5 });
check("rename and reorder work", renamed.nameAr === "فودافون" && renamed.sortOrder === 5);
check("the code is untouched by a rename", renamed.code === "vodafone");
paymentMethodsDB.update("pm_card", { isActive: false });
check("a non-system method can be deactivated", paymentMethodsDB.getActive().every((m) => m.code !== "card"));
check("but its historical totals survive", near(shiftsDB.getStoredTotals(s5.id).card, 120));

console.log("\n=== integrity ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check")[0].integrity_check === "ok");
check(
  "a method in use cannot be deleted",
  (() => {
    try {
      db.prepare("DELETE FROM payment_methods WHERE id='pm_cash'").run();
      return false;
    } catch {
      return true;
    }
  })(),
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
