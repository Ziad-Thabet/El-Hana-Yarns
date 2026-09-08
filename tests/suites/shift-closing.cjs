/* PR-0: all three shift-closing paths must produce identical rows. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const images = require(path.join(P, "db/helpers/images.cjs"));

const workDir = path.join(WORKDIR, "closeshift");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "cs.db");
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
const { createEmployeesDB } = require(path.join(P, "db/repositories/employees.cjs"));
const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const shiftsDB = createShiftsDB(() => db);
const employeesDB = createEmployeesDB(() => db, shiftsDB);

db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,unit) VALUES ('p1','P',10,100000,'2000000003333','piece')",
).run();

let seq = 0;
function makeUserWithShift(role) {
  seq++;
  const uid = `u${seq}`;
  db.prepare(
    "INSERT INTO users (id,username,password_hash,display_name,role,is_active) VALUES (?,?,?,?,?,1)",
  ).run(uid, `user${seq}`, "x", `User ${seq}`, role);
  const shift = shiftsDB.create(uid, "2026-09-07", "2026-09-07T08:00:00Z");
  // Identical takings on every shift: split payment plus a debt settlement.
  salesDB.complete({
    total: 300, cashier: `User ${seq}`, shiftId: shift.id, totalPaid: 300,
    paymentSplits: [
      { method: "cash", amount: 200 },
      { method: "instapay", amount: 60 },
      { method: "vodafone", amount: 40 },
    ],
    items: [{ productId: "p1", name: "P", price: 10, quantity: 30, isWeighted: false, lineTotal: 300 }],
  });
  return { uid, shift };
}

const row = (id) =>
  db.prepare(
    "SELECT status, total_cash, total_vodafone, total_instapay, total_invoices FROM shifts WHERE id=?",
  ).get(id);

console.log("=== the three closing paths ===");

// 1. end()
const a = makeUserWithShift("staff");
shiftsDB.end(a.shift.id, "2026-09-07T20:00:00Z");
const viaEnd = row(a.shift.id);

// 2. employees.setActive(false) on a user with an open shift
const b = makeUserWithShift("staff");
employeesDB.setActive(b.uid, false);
const viaSetActive = row(b.shift.id);

// 3. autoCloseStale (shift dated in the past)
const c = makeUserWithShift("staff");
db.prepare("UPDATE shifts SET date='2026-09-01' WHERE id=?").run(c.shift.id);
shiftsDB.autoCloseStale(null, "2026-09-07");
const viaAutoClose = row(c.shift.id);

check("end() closes the shift", viaEnd.status === "closed");
check("setActive() closes the shift", viaSetActive.status === "closed");
check("autoCloseStale() closes the shift", viaAutoClose.status === "closed");

const totalsOf = (r) => `${r.total_cash}/${r.total_vodafone}/${r.total_instapay}/${r.total_invoices}`;
check("end() totals are correct", totalsOf(viaEnd) === "200/40/60/1", totalsOf(viaEnd));
check(
  "setActive() writes the same totals as end()",
  totalsOf(viaSetActive) === totalsOf(viaEnd),
  `${totalsOf(viaSetActive)} vs ${totalsOf(viaEnd)}`,
);
check(
  "autoCloseStale() writes the same totals as end()",
  totalsOf(viaAutoClose) === totalsOf(viaEnd),
  `${totalsOf(viaAutoClose)} vs ${totalsOf(viaEnd)}`,
);

console.log("\n=== behaviour preserved ===");
let threw = null;
try {
  shiftsDB.end(a.shift.id, "2026-09-07T21:00:00Z");
} catch (e) { threw = e.message; }
check("end() still rejects an already-closed shift", threw === "shift_not_found_or_already_closed", threw ?? "no error");

check("closeIfOpen returns null for a closed shift", shiftsDB.closeIfOpen(a.shift.id, "x") === null);
check("closeIfOpen returns null for an unknown shift", shiftsDB.closeIfOpen("nope", "x") === null);

// Deactivating a user with no open shift must not throw.
seq++;
db.prepare(
  "INSERT INTO users (id,username,password_hash,display_name,role,is_active) VALUES ('u_noshift','noshift','x','No Shift','staff',1)",
).run();
let ok = true;
try { employeesDB.setActive("u_noshift", false); } catch { ok = false; }
check("deactivating a user with no open shift is safe", ok);
check("user actually deactivated", db.prepare("SELECT is_active FROM users WHERE id='u_noshift'").get().is_active === 0);

// An admin's same-day shift is still exempt from auto-close.
const adminUser = makeUserWithShift("admin");
shiftsDB.autoCloseStale(null, "2026-09-07");
check("admin same-day shift still exempt from auto-close", row(adminUser.shift.id).status === "open");

console.log("\n=== summary agrees with the stored row ===");
const d = makeUserWithShift("staff");
const summary = shiftsDB.getSummary(d.shift.id);
shiftsDB.end(d.shift.id, "2026-09-07T20:00:00Z");
const stored = row(d.shift.id);
check(
  "getSummary matches what closeShift persisted",
  summary.cash === stored.total_cash &&
    summary.vodafone_cash === stored.total_vodafone &&
    summary.instapay === stored.total_instapay &&
    summary.totalInvoices === stored.total_invoices,
  `${summary.cash}/${summary.vodafone_cash}/${summary.instapay} vs ${totalsOf(stored)}`,
);

check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
