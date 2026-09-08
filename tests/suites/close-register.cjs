/* Phase 5 PR 2: closing the register is a count, and the difference is recorded. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion } = require(path.join(P, "db/migrations.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const { createSettingsDB } = require(path.join(P, "db/repositories/settings.cjs"));
const { createPaymentMethodsDB } = require(path.join(P, "db/repositories/paymentMethods.cjs"));
const { CHANNEL_PERMISSIONS, CHANNEL_CAPABILITY } = require(path.join(P, "ipc-channels.cjs"));
const { AUDIT_DESCRIPTORS } = require(path.join(P, "audit-descriptors.cjs"));

const dbPath = path.join(WORKDIR, "closereg.db");
for (const s of ["", "-wal", "-shm"]) if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
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

const settingsDB = createSettingsDB(() => db);
const paymentMethodsDB = createPaymentMethodsDB(() => db);
const shiftsDB = createShiftsDB(() => db, settingsDB, paymentMethodsDB);

const actor = db.prepare("SELECT id FROM users LIMIT 1").get().id;
const today = new Date().toISOString().slice(0, 10);

console.log("=== schema ===");
check("migration reached v7", getSchemaVersion(db) >= 7, `v${getSchemaVersion(db)}`);
const cols = new Set(db.pragma("table_info(shifts)").map((c) => c.name));
for (const c of ["opening_float", "counted_cash", "expected_cash", "cash_variance", "close_note", "closed_by"]) {
  check(`shifts.${c} exists`, cols.has(c));
}
check("the new channels are declared",
  CHANNEL_PERMISSIONS["shifts:closeRegister"] === "any" &&
  CHANNEL_PERMISSIONS["shifts:previewClose"] === "any");
check("both carry a capability",
  !!CHANNEL_CAPABILITY["shifts:closeRegister"] && !!CHANNEL_CAPABILITY["shifts:previewClose"]);
check("closing is audited", AUDIT_DESCRIPTORS["shifts:closeRegister"]?.action === "shift.close");

// ── a shift with known takings ────────────────────────────────────────────
settingsDB.set("shift.openingFloat", 200, actor);
settingsDB.set("shift.varianceNoteThreshold", 20, actor);

const shift = shiftsDB.create(actor, today, `${today}T09:00:00`);
check("the shift opens with the configured float", shift.openingFloat === 200, String(shift.openingFloat));

const addPayment = db.prepare(
  `INSERT INTO payment_records (id, ref_id, ref_type, amount, date, time, method, shift_id)
   VALUES (?,?,'sale',?,?,?,?,?)`,
);
const invoice = db.prepare("SELECT id FROM sale_invoices WHERE voided=0 LIMIT 1").get();
addPayment.run("pay-t1", invoice.id, 300, today, "10:00", "cash", shift.id);
addPayment.run("pay-t2", invoice.id, 150, today, "11:00", "vodafone", shift.id);
addPayment.run("pay-t3", invoice.id, -50, today, "12:00", "cash", shift.id); // a refund

console.log("\n=== what the drawer should hold ===");
const preview = shiftsDB.previewClose(shift.id, 450);
check("expected = float + cash taken - cash refunded",
  near(preview.expectedCash, 200 + 300 - 50), String(preview.expectedCash));
check("card takings are not in the drawer",
  !near(preview.expectedCash, 200 + 300 - 50 + 150));
check("the variance is counted less expected", near(preview.variance, 0), String(preview.variance));
check("the note threshold is reported", preview.noteThreshold === 20);
check("previewing writes nothing",
  db.prepare("SELECT status, counted_cash FROM shifts WHERE id=?").get(shift.id).status === "open" &&
  db.prepare("SELECT counted_cash FROM shifts WHERE id=?").get(shift.id).counted_cash === null);

const short = shiftsDB.previewClose(shift.id, 400);
check("a light drawer reads as short", near(short.variance, -50), String(short.variance));
const over = shiftsDB.previewClose(shift.id, 475);
check("a heavy drawer reads as over", near(over.variance, 25), String(over.variance));

console.log("\n=== closing against the count ===");
const closed = shiftsDB.closeRegister(shift.id, {
  countedCash: 430,
  note: "باقي عميل",
  endedAt: `${today}T17:00:00`,
  closedBy: actor,
});
check("the shift is closed", closed.status === "closed");
check("the counted figure is stored", near(closed.countedCash, 430), String(closed.countedCash));
check("the expected figure is stored", near(closed.expectedCash, 450), String(closed.expectedCash));
check("the variance is stored", near(closed.cashVariance, -20), String(closed.cashVariance));
check("the note is stored", closed.closeNote === "باقي عميل");
check("who closed it is stored", closed.closedBy === actor);
check("the legacy totals still agree", near(closed.totalCash, 250) && near(closed.totalVodafone, 150),
  `cash=${closed.totalCash} vodafone=${closed.totalVodafone}`);

let reclose = null;
try {
  shiftsDB.closeRegister(shift.id, { countedCash: 1, endedAt: `${today}T18:00:00`, closedBy: actor });
} catch (err) {
  reclose = err.message;
}
check("a closed shift cannot be closed again", reclose === "shift_not_found_or_already_closed", reclose ?? "no error");

console.log("\n=== a count is required, and must be real ===");
const shift2 = shiftsDB.create(actor, today, `${today}T18:30:00`);
for (const [label, value, expected] of [
  ["a missing count is refused", undefined, "counted_cash_required"],
  ["a null count is refused", null, "counted_cash_required"],
  ["a negative count is refused", -5, "counted_cash_negative"],
]) {
  let msg = null;
  try {
    shiftsDB.closeRegister(shift2.id, { countedCash: value, endedAt: `${today}T19:00:00`, closedBy: actor });
  } catch (err) {
    msg = err.message;
  }
  check(label, msg === expected, msg ?? "no error");
}
check("none of those closed the shift",
  db.prepare("SELECT status FROM shifts WHERE id=?").get(shift2.id).status === "open");

console.log("\n=== a shift nobody counted ===");
shiftsDB.end(shift2.id, `${today}T20:00:00`);
const uncounted = db.prepare("SELECT * FROM shifts WHERE id=?").get(shift2.id);
check("it closes", uncounted.status === "closed");
check("counted stays null rather than zero", uncounted.counted_cash === null);
check("so does the variance", uncounted.cash_variance === null);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
