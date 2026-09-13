/* The drawer holds what it should, including money that was never a sale.

   The expected figure at closing used to be the opening float plus cash sales
   less refunds. Any other movement — a bill paid out of the till, change
   brought in — was invisible, so the count came up short by exactly whatever
   the shop paid out and the variance blamed the cashier for the electricity.
   These checks pin the arithmetic now that the cash book exists. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion } = require(path.join(P, "db/migrations.cjs"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createSettingsDB } = require(path.join(P, "db/repositories/settings.cjs"));
const {
  createPaymentMethodsDB,
} = require(path.join(P, "db/repositories/paymentMethods.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const {
  createCashMovementsDB,
} = require(path.join(P, "db/repositories/cashMovements.cjs"));
const { CHANNEL_PERMISSIONS, CHANNEL_CAPABILITY } = require(path.join(P, "ipc-channels.cjs"));
const { AUDIT_DESCRIPTORS } = require(path.join(P, "audit-descriptors.cjs"));

const dbPath = path.join(WORKDIR, "cash-drawer.db");
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
const settingsDB = createSettingsDB(() => db);
const paymentMethodsDB = createPaymentMethodsDB(() => db);
const cashDB = createCashMovementsDB(() => db);
const shiftsDB = createShiftsDB(() => db, settingsDB, paymentMethodsDB, cashDB);

const actor = db.prepare("SELECT id FROM users LIMIT 1").get().id;
const today = new Date().toISOString().slice(0, 10);

console.log("=== schema and wiring ===");
check("migration reached v8", getSchemaVersion(db) >= 8, `v${getSchemaVersion(db)}`);
const cols = new Set(db.pragma("table_info(cash_movements)").map((c) => c.name));
for (const c of ["direction", "amount", "reason", "shift_id", "ref_type", "ref_id", "created_by"]) {
  check(`cash_movements.${c} exists`, cols.has(c));
}
check(
  "the channels are declared and carry a capability",
  CHANNEL_PERMISSIONS["cash:record"] === "any" && !!CHANNEL_CAPABILITY["cash:record"],
);
check(
  "recording a movement is audited",
  AUDIT_DESCRIPTORS["cash:record"]?.action === "cash.movement",
);

console.log("\n=== what the drawer should hold ===");
settingsDB.set("shift.openingFloat", 200, actor);
const shift = shiftsDB.create(actor, today, `${today}T09:00:00`);
salesDB.complete({
  total: 400,
  cashier: "T",
  shiftId: shift.id,
  totalPaid: 400,
  paymentSplits: [{ method: "cash", amount: 400 }],
  items: [
    {
      productId: db.prepare("SELECT id FROM products LIMIT 1").get().id,
      name: "بند",
      price: 400,
      quantity: 1,
      isWeighted: false,
      lineTotal: 400,
    },
  ],
});

const baseline = shiftsDB.previewClose(shift.id, 0);
check("float plus cash sales", near(baseline.expectedCash, 600), `${baseline.expectedCash}`);

cashDB.record({
  direction: "out",
  amount: 150,
  reason: "فاتورة كهربا",
  shiftId: shift.id,
  createdBy: actor,
});
const afterOut = shiftsDB.previewClose(shift.id, 0);
check(
  "money paid out lowers what the drawer should hold",
  near(afterOut.expectedCash, 450),
  `${afterOut.expectedCash}`,
);

cashDB.record({
  direction: "in",
  amount: 50,
  reason: "فكة",
  shiftId: shift.id,
  createdBy: actor,
});
const afterIn = shiftsDB.previewClose(shift.id, 0);
check(
  "money put in raises it",
  near(afterIn.expectedCash, 500),
  `${afterIn.expectedCash}`,
);
check(
  "the preview shows its working",
  near(afterIn.cashPaidIn, 50) && near(afterIn.cashPaidOut, 150),
  `in ${afterIn.cashPaidIn}, out ${afterIn.cashPaidOut}`,
);

console.log("\n=== the count now balances instead of blaming the cashier ===");
// The till physically holds 200 float + 400 sales - 150 paid out + 50 in = 500.
const counted = shiftsDB.previewClose(shift.id, 500);
check("a correctly counted drawer balances", near(counted.variance, 0), `${counted.variance}`);
// Without the cash book this same drawer would have read 100 short.
check(
  "and the old arithmetic would have called it short by what was paid out",
  near(500 - 600, -100),
);

const closed = shiftsDB.closeRegister(shift.id, {
  countedCash: 500,
  note: null,
  endedAt: `${today}T18:00:00`,
  closedBy: actor,
});
check("the shift closes balanced", near(closed.cashVariance, 0), `${closed.cashVariance}`);
check("the expected figure is stored with the movements in it", near(closed.expectedCash, 500));

console.log("\n=== what a movement will and will not accept ===");
for (const [label, payload, expected] of [
  [
    "a direction that is neither in nor out",
    { direction: "sideways", amount: 10, reason: "x", createdBy: actor },
    "cash_direction_invalid",
  ],
  [
    "a zero amount",
    { direction: "out", amount: 0, reason: "x", createdBy: actor },
    "cash_amount_required",
  ],
  [
    "a negative amount",
    { direction: "out", amount: -5, reason: "x", createdBy: actor },
    "cash_amount_required",
  ],
  [
    "no reason",
    { direction: "out", amount: 10, reason: "   ", createdBy: actor },
    "cash_reason_required",
  ],
  [
    "no actor",
    { direction: "out", amount: 10, reason: "x", createdBy: null },
    "cash_actor_required",
  ],
]) {
  let msg = null;
  try {
    cashDB.record(payload);
  } catch (err) {
    msg = err.message;
  }
  check(`refuses ${label}`, msg === expected, msg ?? "no error");
}

console.log("\n=== the cash book itself ===");
const all = cashDB.getByShift(shift.id);
check("both movements are on the record", all.length === 2, `${all.length}`);
check(
  "amounts are stored positive with a signed view for summing",
  all.every((m) => m.amount > 0) &&
    near(all.reduce((s, m) => s + m.signedAmount, 0), -100),
  `${all.map((m) => m.signedAmount).join(", ")}`,
);
const range = cashDB.netForRange(today, today);
check(
  "the range total matches the shift total",
  near(range.net, -100) && range.count === 2,
  `${range.net} over ${range.count}`,
);

// A correction is another movement, not an edit.
cashDB.record({
  direction: "in",
  amount: 150,
  reason: "إلغاء فاتورة الكهربا — اتدفعت من مكان تاني",
  shiftId: shift.id,
  createdBy: actor,
});
check(
  "a mistake is corrected by an opposing movement, leaving both visible",
  cashDB.getByShift(shift.id).length === 3 &&
    near(cashDB.netForShift(shift.id).net, 50),
  `${cashDB.netForShift(shift.id).net}`,
);
check(
  "no way to delete or edit one",
  typeof cashDB.delete === "undefined" && typeof cashDB.update === "undefined",
);

console.log("\n=== movements belong to the shift that made them ===");
const other = shiftsDB.create(actor, today, `${today}T19:00:00`);
check(
  "a new shift starts with no movements against it",
  near(cashDB.netForShift(other.id).net, 0),
);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
