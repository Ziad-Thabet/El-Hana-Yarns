/* H8: returns and voids — money, stock, debt and the cash drawer. */
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
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));

const dbPath = path.join(WORKDIR, "verify-h8.db");
for (const s of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
}
fs.copyFileSync((FIXTURE), dbPath);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
require(path.join(P, "db/helpers/images.cjs")).initImagePaths(__dirname);
runMigrations(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a, b, eps = 0.02) => Math.abs(a - b) < eps;

const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const returnsDB = createReturnsDB(() => db, productsDB);
const shiftsDB = createShiftsDB(() => db);

const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get().id;
const stockOf = (id) => db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock;

db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit,price_per_kg) VALUES ('p_w','صوف كيلو',0,100,'2000000000208','weight',50)",
).run();
db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit) VALUES ('p_p','إبرة',30,20,'2000000000215','piece')",
).run();

const shift = shiftsDB.create(admin, "2026-09-07", "2026-09-07T09:00:00Z");

// ── Fully paid sale, split across two methods ──────────────────────────────
console.log("=== partial return, split payment ===");
const sale = salesDB.complete({
  total: 350,
  cashier: "Tester",
  shiftId: shift.id,
  totalPaid: 350,
  paymentSplits: [
    { method: "cash", amount: 250 },
    { method: "instapay", amount: 100 },
  ],
  items: [
    { productId: "p_w", name: "صوف كيلو", price: 50, quantity: 1, isWeighted: true, measureAmount: 4, weightGrams: 4, measureUnit: "كجم", lineTotal: 200 },
    { productId: "p_p", name: "إبرة", price: 30, quantity: 5, isWeighted: false, lineTotal: 150 },
  ],
});
check("stock deducted on sale", stockOf("p_w") === 96 && stockOf("p_p") === 15,
  `w=${stockOf("p_w")} p=${stockOf("p_p")}`);

const lines = returnsDB.getReturnableLines(sale.id);
const wool = lines.find((l) => l.name === "صوف كيلو");
const needle = lines.find((l) => l.name === "إبرة");
check("weighted line returnable in kilograms", wool.returnableQuantity === 4, `${wool.returnableQuantity}`);
check("unit value derived from the line total", near(wool.unitValue, 50), `${wool.unitValue}`);

const drawerBefore = shiftsDB.getSummary(shift.id);

// Return 1 kg (restock) and 2 needles (damaged, no restock).
const ret = returnsDB.create(sale.id, {
  lines: [
    { invoiceItemId: wool.invoiceItemId, quantity: 1, restock: true },
    { invoiceItemId: needle.invoiceItemId, quantity: 2, restock: false },
  ],
  reason: "خامة مش مظبوطة",
  userId: admin,
  shiftId: shift.id,
});
check("refund total is 50 + 60", near(ret.total, 110), `${ret.total}`);
check("all refunded as money (nothing owed)", near(ret.refundedCash, 110) && ret.debtReduced === 0);
check("restocked line returns to stock", stockOf("p_w") === 97, `${stockOf("p_w")}`);
check("non-restocked line does NOT return to stock", stockOf("p_p") === 15, `${stockOf("p_p")}`);
check("marked partial", db.prepare("SELECT return_status s FROM sale_invoices WHERE id=?").get(sale.id).s === "partial");

const cashShare = ret.refundSplits.find((s) => s.method === "cash");
const instaShare = ret.refundSplits.find((s) => s.method === "instapay");
// Paid 250 cash / 100 instapay => 71.43% / 28.57% of any refund.
check("refund mirrors the original split pro rata",
  near(cashShare.amount, 78.57) && near(instaShare.amount, 31.43),
  `cash=${cashShare.amount} instapay=${instaShare.amount}`);
check("refund splits sum to the cash refund",
  near(cashShare.amount + instaShare.amount, ret.refundedCash));

const drawerAfter = shiftsDB.getSummary(shift.id);
check("cash drawer reduced by the cash share",
  near(drawerBefore.cash - drawerAfter.cash, 78.57),
  `${drawerBefore.cash} -> ${drawerAfter.cash}`);
check("instapay total reduced by its share",
  near(drawerBefore.instapay - drawerAfter.instapay, 31.43),
  `${drawerBefore.instapay} -> ${drawerAfter.instapay}`);

// ── Over-return is rejected ────────────────────────────────────────────────
console.log("\n=== limits ===");
const after = returnsDB.getReturnableLines(sale.id);
const woolLeft = after.find((l) => l.name === "صوف كيلو");
check("remaining returnable drops to 3 kg", woolLeft.returnableQuantity === 3, `${woolLeft.returnableQuantity}`);
let threw = null;
try {
  returnsDB.create(sale.id, {
    lines: [{ invoiceItemId: woolLeft.invoiceItemId, quantity: 99, restock: true }],
    userId: admin, shiftId: shift.id,
  });
} catch (e) { threw = e.message; }
check("returning more than sold is rejected", !!threw, threw ?? "NO ERROR");

try { threw = null; returnsDB.create(sale.id, { lines: [], userId: admin, shiftId: shift.id }); }
catch (e) { threw = e.message; }
check("empty return is rejected", !!threw);

// ── Void the remainder ─────────────────────────────────────────────────────
console.log("\n=== full void of the remainder ===");
const voided = returnsDB.voidInvoice(sale.id, { reason: "إلغاء", userId: admin, shiftId: shift.id });
check("void returns the rest of the value", near(voided.total, 240), `${voided.total}`);
check("void restocks everything remaining", stockOf("p_w") === 100 && stockOf("p_p") === 18,
  `w=${stockOf("p_w")} p=${stockOf("p_p")}`);
check("invoice marked fully returned",
  db.prepare("SELECT return_status s FROM sale_invoices WHERE id=?").get(sale.id).s === "full");
const finalDrawer = shiftsDB.getSummary(shift.id);
// Everything sold was returned, so every currency the customer paid comes back.
check("drawer nets to zero for this sale",
  near(finalDrawer.cash, drawerBefore.cash - 250) && near(finalDrawer.instapay, drawerBefore.instapay - 100),
  `cash=${finalDrawer.cash} instapay=${finalDrawer.instapay}`);
threw = null;
try { returnsDB.voidInvoice(sale.id, { userId: admin, shiftId: shift.id }); }
catch (e) { threw = e.message; }
check("voiding twice is rejected", !!threw);

// ── Debt-backed sale: write off before refunding cash ──────────────────────
console.log("\n=== sale with outstanding debt ===");
const debtSale = salesDB.complete({
  total: 300,
  cashier: "Tester",
  shiftId: shift.id,
  totalPaid: 100,
  paymentSplits: [{ method: "cash", amount: 100 }],
  customerInfo: { name: "عميل مرتجع", phone: "01555000111" },
  items: [{ productId: "p_p", name: "إبرة", price: 30, quantity: 10, isWeighted: false, lineTotal: 300 }],
});
const debtRow = db.prepare("SELECT * FROM customer_debts WHERE invoice_id=?").get(debtSale.id);
check("debt of 200 created", near(debtRow.remaining_amount, 200), `${debtRow.remaining_amount}`);
const custDebtBefore = db.prepare("SELECT total_debt FROM customers WHERE id=?").get(debtRow.customer_id).total_debt;

const debtLines = returnsDB.getReturnableLines(debtSale.id);
const r2 = returnsDB.create(debtSale.id, {
  lines: [{ invoiceItemId: debtLines[0].invoiceItemId, quantity: 8, restock: true }],
  userId: admin, shiftId: shift.id,
});
check("240 returned: 200 off the debt, 40 in cash",
  near(r2.total, 240) && near(r2.debtReduced, 200) && near(r2.refundedCash, 40),
  `total=${r2.total} debt=${r2.debtReduced} cash=${r2.refundedCash}`);
const debtAfter = db.prepare("SELECT * FROM customer_debts WHERE invoice_id=?").get(debtSale.id);
check("invoice debt cleared", near(debtAfter.remaining_amount, 0), `${debtAfter.remaining_amount}`);
check("customer balance reduced",
  near(custDebtBefore - db.prepare("SELECT total_debt FROM customers WHERE id=?").get(debtRow.customer_id).total_debt, 200));

// ── Audit trail ────────────────────────────────────────────────────────────
console.log("\n=== audit trail ===");
const history = returnsDB.getForInvoice(sale.id);
check("both returns recorded against the invoice", history.length === 2, `${history.length}`);
check("return numbers are sequential per day",
  history.every((h) => /^RT-\d{8}-\d{3}$/.test(h.returnNumber)),
  history.map((h) => h.returnNumber).join(", "));
check("operator recorded", history.every((h) => h.createdBy === admin));
check("reason stored", history.some((h) => h.reason === "إلغاء"));
check("restock flag stored per line",
  history.some((h) => h.items.some((i) => i.restocked === false)));

check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check")[0].integrity_check === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
