/* Phase 0 verification: H6 (alert dedupe) and C5 (password purge). */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(
  path.join(P, "node_modules", "better-sqlite3"),
);
const bcryptjs = require(path.join(P, "node_modules", "bcryptjs"));
const { createAlertsDB } = require(
  path.join(P, "db", "repositories", "alerts.cjs"),
);

const TMP = WORKDIR;
const dbPath = path.join(TMP, "verify.db");
// Remove the WAL/SHM sidecars too, or a previous run's journal replays onto
// the freshly copied database.
for (const suffix of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
}

// Start from a copy of the real dev DB so we exercise real data shapes.
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// The fixture is a fully migrated database, so the guard this migration adds
// is already in place. Drop it to recreate the state the migration is meant to
// clean up — otherwise the duplicates it exists to remove cannot be inserted.
db.exec("DROP INDEX IF EXISTS idx_alerts_unique_unread");

// ── Seed duplicate unread alerts the way the old engine would have ──────────
const seedAlert = db.prepare(
  `INSERT INTO alerts (id, type, ref_id, message, is_read, due_date, created_at)
   VALUES (?,?,?,?,0,NULL,?)`,
);
for (let i = 0; i < 12; i++) {
  seedAlert.run(`dup_${i}`, "out_of_stock", "prod_X", "نفد المخزون", `2026-09-0${(i % 9) + 1}T10:00:00Z`);
}
seedAlert.run("dup_other", "invoice_overdue", "pinv_Y", "متأخرة", "2026-09-01T10:00:00Z");
seedAlert.run("dup_null_a", "shift_open", null, "شيفت", "2026-09-01T10:00:00Z");
db.prepare(
  `INSERT INTO alerts (id, type, ref_id, message, is_read, due_date, created_at)
   VALUES ('already_read','out_of_stock','prod_X','قديم',1,NULL,'2026-08-01T10:00:00Z')`,
).run();

const beforeDupes = db
  .prepare("SELECT COUNT(*) c FROM alerts WHERE type='out_of_stock' AND ref_id='prod_X' AND is_read=0")
  .get().c;
check("seeded duplicate unread alerts", beforeDupes === 12, `${beforeDupes} rows`);

// ── Run the migration exactly as database.cjs does ──────────────────────────
const removed = db
  .prepare(
    `DELETE FROM alerts
     WHERE is_read = 0
       AND id NOT IN (
         SELECT id FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY type, ref_id
                    ORDER BY created_at DESC, id DESC
                  ) AS rn
           FROM alerts
           WHERE is_read = 0
         )
         WHERE rn = 1
       )`,
  )
  .run();
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unique_unread
     ON alerts(type, ref_id) WHERE is_read = 0`,
);
console.log(`   (migration removed ${removed.changes} rows)`);

check(
  "dedupe collapses to one unread per (type, ref_id)",
  db.prepare("SELECT COUNT(*) c FROM alerts WHERE type='out_of_stock' AND ref_id='prod_X' AND is_read=0").get().c === 1,
);
check(
  "dedupe keeps the newest row",
  db.prepare("SELECT id FROM alerts WHERE type='out_of_stock' AND ref_id='prod_X' AND is_read=0").get().id === "dup_8",
);
check(
  "read alerts are left untouched",
  db.prepare("SELECT COUNT(*) c FROM alerts WHERE id='already_read'").get().c === 1,
);
check(
  "unrelated alert survives",
  db.prepare("SELECT COUNT(*) c FROM alerts WHERE id='dup_other'").get().c === 1,
);

// ── Run the real alert engine twice; it must not grow the table ────────────
const shiftsStub = { autoCloseStale: () => {} };
const alertsDB = createAlertsDB(() => db, shiftsStub);

// Guarantee there is something to alert about.
db.prepare("UPDATE products SET stock = 0 WHERE id = (SELECT id FROM products LIMIT 1)").run();

db.prepare("DELETE FROM alerts").run();
alertsDB.runChecks();
const afterFirst = db.prepare("SELECT COUNT(*) c FROM alerts").get().c;
alertsDB.runChecks();
alertsDB.runChecks();
const afterThird = db.prepare("SELECT COUNT(*) c FROM alerts").get().c;
check(
  "repeated runChecks() does not duplicate alerts",
  afterFirst > 0 && afterFirst === afterThird,
  `first=${afterFirst} third=${afterThird}`,
);

const worstDupe = db
  .prepare("SELECT COUNT(*) c FROM alerts WHERE is_read=0 GROUP BY type, ref_id ORDER BY c DESC LIMIT 1")
  .get();
check("no (type, ref_id) has >1 unread alert", !worstDupe || worstDupe.c === 1, `max=${worstDupe?.c ?? 0}`);

// A read alert must be re-raisable on the next check.
db.prepare("UPDATE alerts SET is_read=1").run();
alertsDB.runChecks();
check(
  "resolved-then-read condition surfaces again",
  db.prepare("SELECT COUNT(*) c FROM alerts WHERE is_read=0").get().c > 0,
);

// ── C5: password purge + hashed-only login ─────────────────────────────────
// The fixture's own accounts are left alone — they are referenced by shifts and
// expenses, and the purge below is global anyway, so two extra rows are all
// this needs.
db.prepare(
  "INSERT INTO users (id, username, password, password_hash, display_name, role) VALUES ('u1','legacy','plaintext123',NULL,'Legacy','admin')",
).run();
db.prepare(
  "INSERT INTO users (id, username, password, password_hash, display_name, role) VALUES ('u2','leftover','plaintext456',?,'Leftover','staff')",
).run(bcryptjs.hashSync("plaintext456", 12));

const users = db
  .prepare("SELECT id, password, password_hash FROM users WHERE password IS NOT NULL")
  .all();
const setHash = db.prepare("UPDATE users SET password_hash=?, password=NULL WHERE id=?");
const clearOnly = db.prepare("UPDATE users SET password=NULL WHERE id=?");
db.transaction(() => {
  for (const u of users) {
    if (u.password_hash) clearOnly.run(u.id);
    else setHash.run(bcryptjs.hashSync(u.password, 12), u.id);
  }
})();

check(
  "no cleartext password remains",
  db.prepare("SELECT COUNT(*) c FROM users WHERE password IS NOT NULL").get().c === 0,
);
const u1 = db.prepare("SELECT password_hash FROM users WHERE id='u1'").get();
check("legacy user got a hash", !!u1.password_hash && u1.password_hash !== "plaintext123");
check("legacy password still verifies", bcryptjs.compareSync("plaintext123", u1.password_hash));

const { createAuthDB } = require(
  path.join(P, "db", "repositories", "auth.cjs"),
);
const authDB = createAuthDB(() => db);
check("login works after purge", authDB.login("legacy", "plaintext123")?.role === "admin");
check("wrong password rejected", authDB.login("legacy", "wrongpass123") === null);
db.prepare("UPDATE users SET password_hash=NULL WHERE id='u1'").run();
check("hashless row cannot log in", authDB.login("legacy", "plaintext123") === null);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
