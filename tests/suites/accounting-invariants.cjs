/* The books have to add up, in every section, after real operations.

   This suite is not about any one feature. It states the arithmetic the whole
   system has to obey — a debt equals what is owed less what was paid, a
   shift's totals equal the money taken during it, an invoice's payments never
   exceed what it charged — then performs ordinary shop work and checks that
   every statement still holds.

   Invariants are checked before and after the work, so a figure that was
   already wrong in the fixture is distinguished from one this run broke. */
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
const { createPurchaseDB } = require(path.join(P, "db/repositories/purchase.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const { createSettingsDB } = require(path.join(P, "db/repositories/settings.cjs"));
const {
  createPaymentMethodsDB,
} = require(path.join(P, "db/repositories/paymentMethods.cjs"));
const { createEndOfDayDB } = require(path.join(P, "db/repositories/endOfDay.cjs"));
const { stockUnitsSql } = require(path.join(P, "shared/stockUnits.cjs"));

const dbPath = path.join(WORKDIR, "invariants.db");
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
const rows = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);

const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const returnsDB = createReturnsDB(() => db, productsDB);
const debtsDB = createDebtsDB(() => db);
const purchaseDB = createPurchaseDB(() => db, productsDB);
const settingsDB = createSettingsDB(() => db);
const paymentMethodsDB = createPaymentMethodsDB(() => db);
const shiftsDB = createShiftsDB(() => db, settingsDB, paymentMethodsDB);
const endOfDayDB = createEndOfDayDB(() => db, settingsDB);

const actor = one("SELECT id FROM users LIMIT 1").id;
const today = new Date().toISOString().slice(0, 10);

/**
 * Every invariant, as a named query returning the rows that break it.
 * An empty result is a healthy book.
 */
const INVARIANTS = [
  [
    "a debt's remaining equals what it charged less what was paid",
    `SELECT d.id, d.total_amount, d.paid_amount, d.remaining_amount
       FROM customer_debts d
      WHERE ABS(d.remaining_amount - (d.total_amount - d.paid_amount)) > 0.005`,
  ],
  [
    "no debt is paid for more than it charged",
    "SELECT id, total_amount, paid_amount FROM customer_debts WHERE paid_amount > total_amount + 0.005",
  ],
  [
    "no debt owes a negative amount",
    "SELECT id, remaining_amount FROM customer_debts WHERE remaining_amount < -0.005",
  ],
  [
    "a customer's stored balance equals the sum of their debts",
    `SELECT c.id, c.name, c.total_debt,
            COALESCE((SELECT SUM(d.remaining_amount) FROM customer_debts d WHERE d.customer_id = c.id), 0) AS derived
       FROM customers c
      WHERE ABS(c.total_debt - COALESCE((SELECT SUM(d.remaining_amount) FROM customer_debts d WHERE d.customer_id = c.id), 0)) > 0.005`,
  ],
  [
    "a debt's payments add up to what it records as paid",
    `SELECT d.id, d.paid_amount,
            COALESCE((SELECT SUM(pr.amount) FROM payment_records pr
                       WHERE pr.ref_type='debt' AND pr.ref_id = d.id), 0) AS recorded
       FROM customer_debts d
      WHERE d.paid_amount > 0
        AND ABS(d.paid_amount - COALESCE((SELECT SUM(pr.amount) FROM payment_records pr
                                           WHERE pr.ref_type='debt' AND pr.ref_id = d.id), 0)) > 0.005
        AND NOT EXISTS (SELECT 1 FROM sale_invoices si WHERE si.id = d.invoice_id)`,
  ],
  [
    "an invoice never collects more than it charged",
    `SELECT si.invoice_number, si.total,
            COALESCE(SUM(pr.amount), 0) AS collected
       FROM sale_invoices si
       JOIN payment_records pr ON pr.ref_id = si.id AND pr.ref_type='sale'
      WHERE si.voided = 0
      GROUP BY si.id
     HAVING collected > si.total + 0.005`,
  ],
  [
    "an invoice is never refunded for more than it charged",
    `SELECT si.invoice_number, si.total, SUM(r.total) AS refunded
       FROM sale_returns r
       JOIN sale_invoices si ON si.id = r.invoice_id
      GROUP BY si.id
     HAVING refunded > si.total + 0.005`,
  ],
  [
    "a return's lines add up to the return's total",
    `SELECT r.return_number, r.total,
            COALESCE((SELECT SUM(ri.line_total) FROM sale_return_items ri WHERE ri.return_id = r.id), 0) AS lines
       FROM sale_returns r
      WHERE ABS(r.total - COALESCE((SELECT SUM(ri.line_total) FROM sale_return_items ri WHERE ri.return_id = r.id), 0)) > 0.005`,
  ],
  [
    "a return's cash and debt parts add up to its total",
    `SELECT return_number, total, refunded_cash, debt_reduced
       FROM sale_returns
      WHERE ABS(total - (refunded_cash + debt_reduced)) > 0.005`,
  ],
  [
    "nothing is returned that was never sold",
    `SELECT ri.id, ri.name, ri.quantity
       FROM sale_return_items ri
       JOIN sale_invoice_items si ON si.id = ri.invoice_item_id
      GROUP BY ri.invoice_item_id
     HAVING SUM(ri.quantity) > MAX(${stockUnitsSql("si")}) + 0.005`,
  ],
  [
    "a purchase invoice's paid amount matches its payment records",
    `SELECT pi.invoice_number, pi.paid_amount,
            COALESCE((SELECT SUM(pr.amount) FROM payment_records pr
                       WHERE pr.ref_type='purchase' AND pr.ref_id = pi.id), 0) AS recorded
       FROM purchase_invoices pi
      WHERE pi.paid_amount > 0
        AND ABS(pi.paid_amount - COALESCE((SELECT SUM(pr.amount) FROM payment_records pr
                                            WHERE pr.ref_type='purchase' AND pr.ref_id = pi.id), 0)) > 0.005`,
  ],
  [
    "a purchase is never paid for more than it cost",
    "SELECT invoice_number, total, paid_amount FROM purchase_invoices WHERE paid_amount > total + 0.005",
  ],
  [
    "a purchase invoice's status matches what has been paid",
    `SELECT invoice_number, total, paid_amount, status FROM purchase_invoices
      WHERE (status = 'paid' AND paid_amount < total - 0.005)
         OR (status <> 'paid' AND paid_amount >= total + 0.005)`,
  ],
  [
    "a closed shift's stored totals match the money taken during it",
    `SELECT s.id, s.total_cash,
            COALESCE((SELECT SUM(pr.amount) FROM payment_records pr
                       WHERE pr.shift_id = s.id AND pr.ref_type='sale' AND pr.method='cash'), 0) AS taken
       FROM shifts s
      WHERE s.status = 'closed'
        AND ABS(s.total_cash - COALESCE((SELECT SUM(pr.amount) FROM payment_records pr
                                          WHERE pr.shift_id = s.id AND pr.ref_type='sale' AND pr.method='cash'), 0)) > 0.005`,
  ],
  [
    "the per-method shift totals match the legacy columns",
    `SELECT s.id, s.total_cash, st.amount
       FROM shifts s
       JOIN shift_totals st ON st.shift_id = s.id AND st.method_id = 'pm_cash'
      WHERE ABS(s.total_cash - st.amount) > 0.005`,
  ],
  [
    "a counted shift records a variance equal to counted less expected",
    `SELECT id, counted_cash, expected_cash, cash_variance FROM shifts
      WHERE counted_cash IS NOT NULL
        AND ABS(cash_variance - (counted_cash - expected_cash)) > 0.005`,
  ],
  [
    "an invoice's line totals add up to its total",
    `SELECT si.invoice_number, si.total,
            COALESCE((SELECT SUM(it.line_total) FROM sale_invoice_items it WHERE it.invoice_id = si.id), 0) AS lines
       FROM sale_invoices si
      WHERE si.voided = 0
        AND ABS(si.total - COALESCE((SELECT SUM(it.line_total) FROM sale_invoice_items it WHERE it.invoice_id = si.id), 0)) > 0.005`,
  ],
  [
    "a purchase invoice's line totals add up to its total",
    `SELECT pi.invoice_number, pi.total,
            COALESCE((SELECT SUM(it.item_total) FROM purchase_invoice_items it WHERE it.invoice_id = pi.id), 0) AS lines
       FROM purchase_invoices pi
      WHERE ABS(pi.total - COALESCE((SELECT SUM(it.item_total) FROM purchase_invoice_items it WHERE it.invoice_id = pi.id), 0)) > 0.005`,
  ],
  [
    "no money is recorded to more decimal places than money has",
    `SELECT id, amount FROM payment_records WHERE ABS(amount * 100 - ROUND(amount * 100)) > 0.0001`,
  ],
  [
    "no expense is negative",
    "SELECT id, amount FROM expenses WHERE amount < 0",
  ],
  [
    "no product is priced below zero",
    "SELECT id, name, price FROM products WHERE price < 0",
  ],
];

function runInvariants(stage) {
  console.log(`\n=== ${stage} ===`);
  for (const [label, sql] of INVARIANTS) {
    let broken;
    try {
      broken = rows(sql);
    } catch (err) {
      check(label, false, `query failed: ${err.message}`);
      continue;
    }
    check(
      label,
      broken.length === 0,
      broken.length ? `${broken.length} row(s), e.g. ${JSON.stringify(broken[0])}` : "",
    );
  }
}

runInvariants("the books as the fixture leaves them");

// ── now do a day's work and check again ────────────────────────────────────
console.log("\n=== performing a day's trading ===");
const shift = shiftsDB.create(actor, today, `${today}T09:00:00`);
const product = one("SELECT * FROM products WHERE unit = 'piece' AND stock > 10 LIMIT 1");
const customer = one("SELECT * FROM customers LIMIT 1");

// a straight cash sale
const cashSale = salesDB.complete({
  total: 200,
  cashier: "T",
  shiftId: shift.id,
  totalPaid: 200,
  paymentSplits: [{ method: "cash", amount: 200 }],
  items: [
    {
      productId: product.id,
      name: product.name,
      price: 100,
      quantity: 2,
      barcode: product.barcode,
      isWeighted: false,
      lineTotal: 200,
    },
  ],
});
console.log(`  cash sale ${cashSale.invoiceNumber}`);

// a split payment, part of it left on the customer's account
const debtSale = salesDB.complete({
  total: 300,
  cashier: "T",
  shiftId: shift.id,
  totalPaid: 120,
  customerInfo: { name: customer.name, phone: customer.phone },
  paymentSplits: [
    { method: "cash", amount: 70 },
    { method: "vodafone", amount: 50 },
  ],
  items: [
    {
      productId: product.id,
      name: product.name,
      price: 100,
      quantity: 3,
      barcode: product.barcode,
      isWeighted: false,
      lineTotal: 300,
    },
  ],
});
console.log(`  part-paid sale ${debtSale.invoiceNumber}, ${debtSale.remainingDebt} left owing`);

// settle some of that debt
const debt = one(
  "SELECT * FROM customer_debts WHERE invoice_id=(SELECT id FROM sale_invoices WHERE invoice_number=?)",
  debtSale.invoiceNumber,
);
if (debt) {
  debtsDB.addPayment(debt.id, { amount: 80, method: "cash", date: today, time: "12:00" });
  console.log("  collected 80 against it");
}

// return one unit of the cash sale
const cashInvoice = one("SELECT id FROM sale_invoices WHERE invoice_number=?", cashSale.invoiceNumber);
const returnable = returnsDB.getReturnableLines(cashInvoice.id)[0];
returnsDB.create(cashInvoice.id, {
  lines: [{ invoiceItemId: returnable.invoiceItemId, quantity: 1, restock: true }],
  reason: "اختبار",
  userId: actor,
  shiftId: shift.id,
});
console.log("  returned one unit");

// buy stock and pay part of the bill
const purchase = purchaseDB.save({
  supplier: "مورد الاختبار",
  date: today,
  time: "13:00",
  total: 500,
  paidAmount: 200,
  items: [
    {
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      quantity: 10,
      unit: "piece",
      purchasePrice: 50,
      itemTotal: 500,
    },
  ],
});
console.log(`  purchased stock on invoice ${purchase.invoiceNumber}`);
purchaseDB.addPayment(purchase.id, { amount: 300, method: "cash", date: today, time: "14:00" });
console.log("  settled the rest of it");

// close the register on a counted drawer
const preview = shiftsDB.previewClose(shift.id, 0);
shiftsDB.closeRegister(shift.id, {
  countedCash: preview.expectedCash,
  note: null,
  endedAt: `${today}T18:00:00`,
  closedBy: actor,
});
console.log(`  closed the shift against a counted ${preview.expectedCash}`);

runInvariants("the books after a day's trading");

// ── the day's report has to agree with the day's rows ──────────────────────
console.log("\n=== the day's report agrees with the day's rows ===");
const eod = endOfDayDB.build(today, today);
const collectedCash = eod.summary.collectedByMethod.find((m) => m.method === "cash");
const rawCash = one(
  `SELECT COALESCE(SUM(pr.amount),0) AS t FROM payment_records pr
     JOIN sale_invoices si ON si.id = pr.ref_id
    WHERE pr.ref_type='sale' AND si.voided = 0 AND pr.date = ?
      AND pr.method = 'cash'`,
  today,
).t;
check(
  "the report's cash figure is the cash in the records",
  Math.abs((collectedCash?.amount ?? 0) - rawCash) < 0.005,
  `${collectedCash?.amount} vs ${rawCash}`,
);
const closed = one("SELECT * FROM shifts WHERE id=?", shift.id);
check(
  "the closed shift balanced, because it was counted at the expected figure",
  Math.abs(closed.cash_variance) < 0.005,
  `${closed.cash_variance}`,
);
check(
  "stock movement balances: opening = closing + sold - returned - received",
  eod.inventory.every(
    (r) =>
      Math.abs(
        r.openingStock - (r.closingStock + r.sold - r.returned - r.received),
      ) < 0.005,
  ),
  `${eod.inventory.length} products checked`,
);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
