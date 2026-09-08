/* C6/M9: backup, retention, integrity gate, and restore. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { createBackupManager } = require(path.join(P, "db", "backup.cjs"));

const workDir = path.join(WORKDIR, "backup-test");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

const dbPath = path.join(workDir, "el-hana-yarns.db");
fs.copyFileSync((FIXTURE), dbPath);

let db = new Database(dbPath);
db.pragma("journal_mode = WAL");

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const backups = createBackupManager({
  getDb: () => db,
  closeDb: () => {
    if (db && db.open) db.close();
  },
  dbPath,
  dataDir: workDir,
});

console.log("=== create ===");
check("integrity_check ok", backups.integrityCheck() === "ok");
const first = backups.create("manual");
check("backup file written", !!first && fs.existsSync(path.join(backups.backupDir, first.fileName)));
check("filename parses back", first.reason === "manual" && /^\d{8}$/.test(first.date));
check("listed", backups.list().some((b) => b.fileName === first.fileName));

console.log("\n=== consistency: WAL data is captured ===");
db.prepare(
  "INSERT INTO products (id,name,price,stock,unit) VALUES ('p_wal','WAL Marker',1,1,'piece')",
).run();
const withMarker = backups.create("periodic");
const snap = new Database(path.join(backups.backupDir, withMarker.fileName), { readonly: true });
check(
  "row committed to WAL appears in the backup",
  snap.prepare("SELECT COUNT(*) c FROM products WHERE id='p_wal'").get().c === 1,
);
snap.close();

console.log("\n=== daily de-duplication ===");
const startupA = backups.createDaily("startup");
const startupB = backups.createDaily("startup");
check("first startup backup is taken", !!startupA);
check("second on the same day is skipped", startupB === null);

console.log("\n=== retention ===");
// Fabricate more than the cap, oldest-first by name.
for (let i = 0; i < 40; i++) {
  const stamp = `2025010${(i % 9) + 1}-${String(100000 + i)}`;
  fs.writeFileSync(path.join(backups.backupDir, `backup-${stamp}-periodic.db`), "x");
}
backups.prune();
check("retention caps the folder at 30", backups.list().length === 30, `count=${backups.list().length}`);
check(
  "newest entries are the ones kept",
  backups.list()[0].fileName === backups.list().map((b) => b.fileName).sort().reverse()[0],
);

console.log("\n=== traversal + validation guards ===");
const outside = path.join(workDir, "outside.db");
fs.writeFileSync(outside, "x");
for (const bad of [
  "../outside.db",
  "..\\outside.db",
  "backup-20250101-000000-manual.db/../../outside.db",
  "not-a-backup.db",
  "",
]) {
  let threw = false;
  try {
    backups.restore(bad);
  } catch {
    threw = true;
  }
  check(`rejects ${JSON.stringify(bad)}`, threw);
}

let corruptRejected = false;
const corrupt = path.join(backups.backupDir, "backup-20250101-000001-manual.db");
fs.writeFileSync(corrupt, "this is not a sqlite file");
try {
  backups.restore("backup-20250101-000001-manual.db");
} catch {
  corruptRejected = true;
}
check("rejects a corrupt backup file", corruptRejected);
check("database still open after a rejected restore", db.open);

console.log("\n=== restore ===");
// Take a clean snapshot, then damage the live data, then restore.
const good = backups.create("manual");
const beforeCount = db.prepare("SELECT COUNT(*) c FROM products").get().c;
// Wiping the catalogue is the test destroying data on purpose, not the app
// doing it: products are protected by RESTRICT precisely so the application
// cannot. Constraints go back on immediately afterwards.
db.pragma("foreign_keys = OFF");
db.prepare("DELETE FROM products").run();
db.pragma("foreign_keys = ON");
check("live data destroyed", db.prepare("SELECT COUNT(*) c FROM products").get().c === 0);

const result = backups.restore(good.fileName);
check("restore reports restart required", result.requiresRestart === true);
check("restore made a safety copy", !!result.safetyBackup);
check(
  "safety copy holds the destroyed state",
  (() => {
    const s = new Database(path.join(backups.backupDir, result.safetyBackup), { readonly: true });
    const c = s.prepare("SELECT COUNT(*) c FROM products").get().c;
    s.close();
    return c === 0;
  })(),
);
check("wal sidecar cleared", !fs.existsSync(dbPath + "-wal"));

db = new Database(dbPath);
check(
  "restored database has the original rows back",
  db.prepare("SELECT COUNT(*) c FROM products").get().c === beforeCount,
  `count=${db.prepare("SELECT COUNT(*) c FROM products").get().c} expected=${beforeCount}`,
);
check("restored database passes integrity_check", backups.integrityCheck() === "ok");

db.close();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
