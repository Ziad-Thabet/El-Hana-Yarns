/* A returned invoice must stop counting as revenue, and must say so. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createReturnsDB } = require(path.join(P, "db/repositories/returns.cjs"));

const dbPath = path.join(WORKDIR, "nettotals.db");
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

// sale_returns.created_by is a real foreign key, so borrow an existing account.
const actor = db.prepare("SELECT id FROM users LIMIT 1").get().id;
const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);
const returnsDB = createReturnsDB(() => db, productsDB);

const netOf = (list) => Math.round(list.reduce((s, i) => s + i.netTotal, 0) * 100) / 100;
const grossOf = (list) => Math.round(list.reduce((s, i) => s + i.total, 0) * 100) / 100;

console.log("=== before any return ===");
const before = salesDB.getAll();
check("every invoice carries the new figures",
  before.every((i) => typeof i.netTotal === "number" && typeof i.refundedAmount === "number"));
check("with nothing returned, net equals gross", netOf(before) === grossOf(before),
  `${netOf(before)} vs ${grossOf(before)}`);

// Pick an invoice whose lines are all still returnable.
const target = before.find((inv) => (inv.returnStatus ?? "none") === "none" && inv.items.length > 0);
check("found an invoice to return", !!target, target?.invoiceNumber);

const lines = returnsDB.getReturnableLines(target.id);
const half = lines[0];
console.log("\n=== a partial return ===");
returnsDB.create(target.id, {
  lines: [{ invoiceItemId: half.invoiceItemId, quantity: half.returnableQuantity, restock: true }],
  reason: "اختبار",
  userId: actor,
  shiftId: null,
});
const afterPartial = salesDB.getAll();
const partialInv = afterPartial.find((i) => i.id === target.id);
const refunded = partialInv.refundedAmount;
check("the refund is recorded on the invoice", refunded > 0, String(refunded));
check("net = total - refunded",
  partialInv.netTotal === Math.round((partialInv.total - refunded) * 100) / 100,
  `${partialInv.netTotal}`);
check("gross is untouched", partialInv.total === target.total);
check("the row says it was returned",
  ["partial", "full"].includes(partialInv.returnStatus), partialInv.returnStatus);
check("the list total dropped by exactly the refund",
  netOf(afterPartial) === Math.round((netOf(before) - refunded) * 100) / 100,
  `${netOf(before)} → ${netOf(afterPartial)}`);
check("getById agrees with the list",
  salesDB.getById(target.id).netTotal === partialInv.netTotal);

console.log("\n=== returning the rest ===");
const rest = returnsDB.getReturnableLines(target.id).filter((l) => l.returnableQuantity > 0);
if (rest.length > 0) {
  returnsDB.create(target.id, {
    lines: rest.map((l) => ({ invoiceItemId: l.invoiceItemId, quantity: l.returnableQuantity, restock: true })),
    reason: "اختبار",
    userId: actor,
    shiftId: null,
  });
}
const afterFull = salesDB.getAll();
const fullInv = afterFull.find((i) => i.id === target.id);
check("the invoice reads as fully returned", fullInv.returnStatus === "full", fullInv.returnStatus);
check("nothing of it is left in the total", fullInv.netTotal <= 0.01,
  `net=${fullInv.netTotal} refunded=${fullInv.refundedAmount}`);

console.log("\n=== the database is still sound ===");
check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check", { simple: true }) === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
