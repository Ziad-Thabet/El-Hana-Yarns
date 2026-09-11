/* Phase 3: the bulk-hydrated list endpoints must return exactly what the
   per-invoice versions did, apart from receipts becoming URLs. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const assert = require("assert");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const images = require(path.join(P, "db/helpers/images.cjs"));

const workDir = path.join(WORKDIR, "p3");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "p3.db");
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

const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const shiftsDB = createShiftsDB(() => db);

const receipt =
  "data:image/jpeg;base64," + Buffer.alloc(2048, 0x7f).toString("base64");

db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit,price_per_kg) VALUES ('pw','Wool',0,100000,'2000000001111','weight',50)",
).run();
db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit) VALUES ('pp','Pin',10,100000,'2000000002222','piece')",
).run();
db.prepare(
  "INSERT INTO users (id,username,password_hash,display_name,role) VALUES ('u','t','x','T','admin')",
).run();
const shift = shiftsDB.create("u", "2026-09-07", "2026-09-07T09:00:00Z");

// A deliberately varied set: split payments with and without receipts, a
// weighted line, an invoice left partly on debt, and one with no payment.
const N = 60;
for (let i = 0; i < N; i++) {
  const onDebt = i % 5 === 0;
  const withReceipt = i % 3 === 0;
  salesDB.complete({
    total: 300,
    cashier: "T",
    shiftId: shift.id,
    totalPaid: onDebt ? 100 : 300,
    customerInfo: onDebt
      ? { name: `Customer ${i}`, phone: `0100000${String(i).padStart(4, "0")}` }
      : undefined,
    paymentSplits: onDebt
      ? [{ method: "cash", amount: 100, receiptImage: withReceipt ? receipt : null }]
      : [
          { method: "cash", amount: 200, receiptImage: withReceipt ? receipt : null },
          { method: "instapay", amount: 100, receiptImage: null },
        ],
    items: [
      { productId: "pw", name: "Wool", price: 50, quantity: 1, isWeighted: true,
        measureAmount: 4, weightGrams: 4, measureUnit: "كجم", lineTotal: 200 },
      { productId: "pp", name: "Pin", price: 10, quantity: 10, isWeighted: false, lineTotal: 100 },
    ],
  });
}

/** The pre-refactor algorithm, reproduced as the reference. */
function referenceGetAll() {
  return db
    .prepare("SELECT * FROM sale_invoices WHERE voided=0 ORDER BY date DESC, time DESC")
    .all()
    .map((inv) => {
      const items = db
        .prepare("SELECT * FROM sale_invoice_items WHERE invoice_id=?")
        .all(inv.id);
      const payments = db
        .prepare(
          "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='sale' ORDER BY date ASC, time ASC",
        )
        .all(inv.id);
      const debt = db
        .prepare(
          "SELECT total_amount, paid_amount, remaining_amount FROM customer_debts WHERE invoice_id=? LIMIT 1",
        )
        .get(inv.id);
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        date: inv.date,
        time: inv.time,
        total: inv.total,
        cashier: inv.cashier,
        shiftId: inv.shift_id ?? null,
        returnStatus: inv.return_status ?? "none",
        refundedAmount: round(
          db.prepare("SELECT COALESCE(SUM(total),0) r FROM sale_returns WHERE invoice_id=?").get(inv.id).r,
        ),
        netTotal: round(
          inv.total -
            db.prepare("SELECT COALESCE(SUM(total),0) r FROM sale_returns WHERE invoice_id=?").get(inv.id).r,
        ),
        paymentMethod: payments[0]?.method ?? inv.payment_method ?? null,
        paidAmount: debt ? debt.paid_amount : undefined,
        remainingAmount: debt ? debt.remaining_amount : undefined,
        paymentHistory: payments.map((p) => ({
          id: p.id, amount: p.amount, date: p.date, time: p.time, method: p.method,
          receiptPath: p.receipt_image, notes: p.notes,
        })),
        items: items.map((i) => ({
          id: i.id, productId: i.product_id, name: i.name, price: i.price,
          quantity: i.quantity, barcode: i.barcode, isWeighted: i.is_weighted === 1,
          weightGrams: i.weight_grams, measureAmount: i.measure_amount,
          measureUnit: i.measure_unit, pricePerKg: i.price_per_kg, lineTotal: i.line_total,
        })),
      };
    });
}

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

console.log("=== equivalence with the pre-refactor algorithm ===");
const expected = referenceGetAll();
const actual = salesDB.getAll();
check("same number of invoices", actual.length === expected.length, `${actual.length} vs ${expected.length}`);
check("same order", actual.every((inv, i) => inv.id === expected[i].id));

let mismatch = null;
for (let i = 0; i < expected.length && !mismatch; i++) {
  const e = expected[i];
  const a = actual[i];
  // Receipts intentionally changed from base64 to app-img URLs; compare the
  // rest of the payload structurally.
  const strip = (inv) => ({
    ...inv,
    paymentHistory: inv.paymentHistory.map(({ receiptImage, receiptPath, ...rest }) => rest),
  });
  try {
    assert.deepStrictEqual(strip(a), strip(e));
  } catch (err) {
    mismatch = `invoice ${i} (${e.id}): ${err.message.split("\n")[0]}`;
  }
}
check("every field identical to the reference", !mismatch, mismatch ?? "");

console.log("\n=== receipts ===");
const withReceipts = actual.flatMap((inv) =>
  inv.paymentHistory.filter((p) => p.receiptImage),
);
check("some payments carry a receipt", withReceipts.length > 0, `${withReceipts.length}`);
check(
  "receipts are app-img URLs, not base64",
  withReceipts.every((p) => p.receiptImage.startsWith("app-img://receipts/")),
  withReceipts[0]?.receiptImage?.slice(0, 40),
);
check(
  "each URL maps to a file that exists",
  withReceipts.every((p) => {
    const name = decodeURIComponent(p.receiptImage.split("/").pop());
    return fs.existsSync(path.join(workDir, "images", "receipts", name));
  }),
);
const expectedWithReceipt = expected.flatMap((inv) =>
  inv.paymentHistory.filter((p) => p.receiptPath),
).length;
check(
  "same number of receipts as before",
  withReceipts.length === expectedWithReceipt,
  `${withReceipts.length} vs ${expectedWithReceipt}`,
);
check(
  "payments without a receipt stay null",
  actual.every((inv) =>
    inv.paymentHistory.every((p) => p.receiptImage === null || typeof p.receiptImage === "string"),
  ),
);

console.log("\n=== debt fields survive ===");
const withDebt = actual.filter((inv) => inv.remainingAmount !== undefined);
const expectedWithDebt = expected.filter((inv) => inv.remainingAmount !== undefined);
check(
  "invoices left on debt still expose their balance",
  withDebt.length === expectedWithDebt.length && withDebt.length >= Math.ceil(N / 5),
  `${withDebt.length} vs reference ${expectedWithDebt.length}`,
);
check("balances match the reference",
  withDebt.every((inv) => {
    const ref = expected.find((e) => e.id === inv.id);
    return ref.remainingAmount === inv.remainingAmount && ref.paidAmount === inv.paidAmount;
  }));

console.log("\n=== other endpoints agree ===");
const byShift = shiftsDB.getInvoices(shift.id);
check("shift invoices hydrate", byShift.length === N && byShift.every((i) => i.items.length === 2), `${byShift.length}`);
const all = shiftsDB.getAllInvoices();
check("getAllInvoices hydrates", all.length === actual.length);
const one = salesDB.getById(actual[0].id);
check("getById matches the list entry", JSON.stringify(one) === JSON.stringify(actual[0]));
const pos = salesDB.getBySource("pos");
// Look for this suite's own invoice rather than whatever sorted first: the
// fixture carries demo sales on the same date, and their ordering against
// these depends on the time of day the suite happens to run.
const mine = pos.find((i) => i.cashier === "T");
check("getBySource hydrates", pos.length > 0 && !!mine && mine.items.length === 2);

console.log("\n=== IN(...) chunking beyond the SQLite parameter limit ===");
const many = db.prepare("SELECT * FROM sale_invoices WHERE voided=0").all();
const { hydrateSaleInvoices } = require(path.join(P, "db/repositories/sales.cjs"));
// Feed the same rows repeatedly to exceed 900 ids in one call.
const inflated = [];
for (let i = 0; i < 20; i++) inflated.push(...many);
let chunkOk = true;
let chunkErr = "";
try {
  const out = hydrateSaleInvoices(db, inflated);
  const reference = new Map(actual.map((inv) => [inv.id, inv.items.length]));
  chunkOk =
    out.length === inflated.length &&
    // Each copy must hydrate to the same item count as the single-pass result.
    out.every((o) => reference.get(o.id) === o.items.length);
} catch (e) {
  chunkOk = false;
  chunkErr = e.message;
}
check(`hydrating ${inflated.length} rows in one call works`, chunkOk, chunkErr);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
