/* Document numbers must be unique and sequential past the 999/day boundary. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { nextDocumentNumber } = require(path.join(P, "db/helpers/documentNumbers.cjs"));

const dbPath = path.join(WORKDIR, "docnum.db");
for (const s of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
}
const db = new Database(dbPath);
db.exec(`CREATE TABLE sale_invoices (
  id INTEGER PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, date TEXT NOT NULL)`);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const insert = db.prepare(
  "INSERT INTO sale_invoices (invoice_number, date) VALUES (?, ?)",
);
const gen = (date) =>
  nextDocumentNumber(db, {
    table: "sale_invoices",
    column: "invoice_number",
    prefix: "SL",
    date,
  });

const DATE = "2026-09-07";
const N = 1500; // deliberately past the 999 boundary that broke string ordering
const produced = [];
for (let i = 0; i < N; i++) {
  const n = gen(DATE);
  produced.push(n);
  insert.run(n, DATE);
}

check("all numbers unique", new Set(produced).size === N, `${new Set(produced).size}/${N}`);
check("first is SL-20260907-001", produced[0] === "SL-20260907-001", produced[0]);
check("999th is zero-padded", produced[998] === "SL-20260907-999", produced[998]);
check("1000th widens cleanly", produced[999] === "SL-20260907-1000", produced[999]);
check("last is sequential", produced[N - 1] === `SL-20260907-${N}`, produced[N - 1]);
check(
  "strictly increasing numerically",
  produced.every((n, i) => i === 0 || Number(n.split("-").pop()) === Number(produced[i - 1].split("-").pop()) + 1),
);

// A new day restarts at 001 without colliding.
const nextDay = gen("2026-09-08");
check("a new day restarts the sequence", nextDay === "SL-20260908-001", nextDay);

// A different prefix keeps its own sequence in the same table.
const online = nextDocumentNumber(db, {
  table: "sale_invoices", column: "invoice_number", prefix: "OL", date: DATE,
});
check("a different prefix has its own sequence", online === "OL-20260907-001", online);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
