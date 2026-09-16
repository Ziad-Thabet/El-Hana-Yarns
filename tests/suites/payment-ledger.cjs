/* Every payment in the system goes through one writer, so the conventions it
   applies are worth stating outright.

   Eleven statements across five repositories used to write this table, each
   remembering for itself which ref_type to use, which source tag, whether to
   attach the shift, and that a refund is stored negative. Two defects came out
   of that. These checks are the conventions, in the one place they now live. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const {
  createPaymentLedger,
  SOURCE,
  REF_TYPE,
} = require(path.join(P, "db/services/paymentLedger.cjs"));

const dbPath = path.join(WORKDIR, "ledger.db");
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
const rowOf = (id) => db.prepare("SELECT * FROM payment_records WHERE id=?").get(id);

const ledger = createPaymentLedger(() => db);
const invoice = db.prepare("SELECT id FROM sale_invoices WHERE voided=0 LIMIT 1").get();
const purchase = db.prepare("SELECT id FROM purchase_invoices LIMIT 1").get();
// The application records dates in local time — a sale at 01:00 belongs to
// the day the shop is having, not to whatever day it is in UTC. A suite that
// asks for "today" in UTC therefore queries the wrong day for a few hours
// either side of midnight, and these suites did: they passed by day and
// failed by night.
const { formatDateYMD } = require(path.join(P, "shared/dateRules.cjs"));
const today = formatDateYMD(new Date());
const when = { date: today, time: "12:00" };

console.log("=== a sale collection ===");
const saleId = ledger.recordSaleCollection({
  invoiceId: invoice.id,
  amount: 120,
  method: "cash",
  shiftId: null,
  receiptImage: "img/x.png",
  ...when,
});
const sale = rowOf(saleId);
check("belongs to the sale ledger", sale.ref_type === REF_TYPE.SALE, sale.ref_type);
check("is tagged as taken at checkout", sale.source === SOURCE.CHECKOUT, sale.source);
check("records the amount as given", near(sale.amount, 120), String(sale.amount));
check("keeps the receipt image", sale.receipt_image === "img/x.png");

console.log("\n=== a refund ===");
// Callers pass what was handed back; the ledger owns the sign, because every
// total in the system subtracts refunds simply by summing this column.
const refundId = ledger.recordRefund({
  invoiceId: invoice.id,
  amount: 40,
  method: "cash",
  notes: "مرتجع",
  ...when,
});
const refund = rowOf(refundId);
check("is stored negative from a positive argument", near(refund.amount, -40), String(refund.amount));
check("is tagged as a refund", refund.source === SOURCE.REFUND, refund.source);
const alreadyNegative = rowOf(
  ledger.recordRefund({ invoiceId: invoice.id, amount: -25, method: "cash", ...when }),
);
check(
  "a caller who already negated does not double-negate it",
  near(alreadyNegative.amount, -25),
  String(alreadyNegative.amount),
);

console.log("\n=== a debt settlement ===");
const settleId = ledger.recordDebtSettlement({
  invoiceId: invoice.id,
  amount: 60,
  method: "vodafone",
  ...when,
});
const settle = rowOf(settleId);
check(
  "is recorded against the invoice, not the debt",
  settle.ref_id === invoice.id,
  settle.ref_id,
);
check(
  "is tagged so reports do not count the sale twice",
  settle.source === SOURCE.DEBT_SETTLEMENT,
  settle.source,
);

console.log("\n=== a supplier payment ===");
const purchaseId = ledger.recordPurchasePayment({
  invoiceId: purchase.id,
  amount: 300,
  method: "cash",
  ...when,
});
const paid = rowOf(purchaseId);
check("belongs to the purchase ledger", paid.ref_type === REF_TYPE.PURCHASE, paid.ref_type);
check(
  "carries no source, matching what purchases have always written",
  paid.source === null,
  String(paid.source),
);
check("and no shift — supplier payments are not takings", paid.shift_id === null);

console.log("\n=== money is whole cents ===");
const rounded = rowOf(
  ledger.recordSaleCollection({
    invoiceId: invoice.id,
    amount: 0.1 + 0.2,
    method: "cash",
    ...when,
  }),
);
check(
  "a third decimal cannot reach the ledger",
  near(rounded.amount, 0.3) && rounded.amount === 0.3,
  String(rounded.amount),
);

console.log("\n=== what it refuses ===");
for (const [label, call, expected] of [
  [
    "an amount that is not a number",
    () => ledger.recordSaleCollection({ invoiceId: invoice.id, amount: "abc", method: "cash", ...when }),
    "payment_amount_invalid",
  ],
  [
    "a payment against nothing",
    () => ledger.recordSaleCollection({ invoiceId: null, amount: 10, method: "cash", ...when }),
    "payment_ref_required",
  ],
]) {
  let msg = null;
  try {
    call();
  } catch (err) {
    msg = err.message;
  }
  check(`refuses ${label}`, msg === expected, msg ?? "no error");
}

console.log("\n=== nothing writes this table behind the ledger's back ===");
const repoDir = path.join(P, "db", "repositories");
const offenders = fs
  .readdirSync(repoDir)
  .filter((f) => f.endsWith(".cjs"))
  .filter((f) =>
    /INSERT\s+INTO\s+payment_records/i.test(fs.readFileSync(path.join(repoDir, f), "utf8")),
  );
check(
  "no repository inserts a payment directly",
  offenders.length === 0,
  offenders.join(", "),
);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
