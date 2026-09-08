/* PR 1: settings must be a behavioural no-op at their defaults, and must
   actually take effect when changed. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion } = require(path.join(P, "db/migrations.cjs"));
const schema = require(path.join(P, "shared/settingsSchema.cjs"));
const { createSettingsDB } = require(path.join(P, "db/repositories/settings.cjs"));
const images = require(path.join(P, "db/helpers/images.cjs"));

const workDir = path.join(WORKDIR, "settings");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "s.db");
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

const settingsDB = createSettingsDB(() => db);

console.log("=== schema ===");
check("migration reached v3", getSchemaVersion(db) >= 3, `v${getSchemaVersion(db)}`);
check("settings table exists", !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='settings'").get());
check("table starts empty (overrides only)", db.prepare("SELECT COUNT(*) c FROM settings").get().c === 0);

console.log("\n=== defaults equal the literals they replaced ===");
const EXPECTED = {
  "inventory.lowStockThreshold": 10,
  "inventory.outOfStockThreshold": 0,
  "alerts.overdueInvoiceDays": 7,
  "shift.staleHours": 10,
  "security.sessionTimeoutHours": 24,
  "security.maxLoginAttempts": 5,
  "security.lockoutMinutes": 5,
  "backup.retentionCount": 30,
  "backup.intervalHours": 4,
  "alerts.checkIntervalMinutes": 30,
  "receipt.widthMm": 80,
  "barcode.internalPrefix": "20",
};
for (const [key, expected] of Object.entries(EXPECTED)) {
  check(`${key} = ${JSON.stringify(expected)}`, settingsDB.get(key) === expected, JSON.stringify(settingsDB.get(key)));
}
check("every registry key has a default", schema.KEYS.every((k) => schema.defaultFor(k) !== undefined));

console.log("\n=== runtimeConfig converts units correctly ===");
const cfg = settingsDB.runtimeConfig();
check("sessionTimeoutMs = 24h", cfg.sessionTimeoutMs === 24 * 60 * 60 * 1000, `${cfg.sessionTimeoutMs}`);
check("lockoutDurationMs = 5min", cfg.lockoutDurationMs === 5 * 60 * 1000, `${cfg.lockoutDurationMs}`);
check("backupIntervalMs = 4h", cfg.backupIntervalMs === 4 * 60 * 60 * 1000, `${cfg.backupIntervalMs}`);
check("alertIntervalMs = 30min", cfg.alertIntervalMs === 30 * 60 * 1000, `${cfg.alertIntervalMs}`);
check("maxBackups = 30", cfg.maxBackups === 30);
check("maxLoginAttempts = 5", cfg.maxLoginAttempts === 5);

console.log("\n=== the singletons accept configuration ===");
const sessionManager = require(path.join(P, "session-manager.cjs"));
const rateLimiter = require(path.join(P, "rate-limiter.cjs"));
sessionManager.configure({ sessionTimeoutMs: 3 * 60 * 60 * 1000 });
check("session timeout applied", sessionManager.sessionTimeout === 3 * 60 * 60 * 1000);
rateLimiter.configure({ maxAttempts: 9, lockoutDurationMs: 60_000 });
check("lockout config applied", rateLimiter.maxAttempts === 9 && rateLimiter.lockoutDuration === 60_000);
// A junk or zero value must be ignored rather than bricking auth.
sessionManager.configure({ sessionTimeoutMs: 0 });
rateLimiter.configure({ maxAttempts: 0 });
check("zero session timeout ignored", sessionManager.sessionTimeout === 3 * 60 * 60 * 1000);
check("zero max attempts ignored", rateLimiter.maxAttempts === 9);
sessionManager.configure({});
rateLimiter.configure();
check("empty configure() is safe", sessionManager.sessionTimeout === 3 * 60 * 60 * 1000);

console.log("\n=== writes, clamping and reset ===");
settingsDB.set("inventory.lowStockThreshold", 5, "u_test");
check("write is visible immediately (cache invalidated)", settingsDB.get("inventory.lowStockThreshold") === 5);
check("row records the actor", db.prepare("SELECT updated_by FROM settings WHERE key=?").get("inventory.lowStockThreshold").updated_by === "u_test");
settingsDB.set("security.maxLoginAttempts", 0);
check("below-minimum value is clamped, not stored raw", settingsDB.get("security.maxLoginAttempts") === 1, `${settingsDB.get("security.maxLoginAttempts")}`);
settingsDB.set("backup.retentionCount", 99999);
check("above-maximum value is clamped", settingsDB.get("backup.retentionCount") === 1000, `${settingsDB.get("backup.retentionCount")}`);
settingsDB.set("alerts.overdueInvoiceDays", 7.6);
check("integer setting is rounded", settingsDB.get("alerts.overdueInvoiceDays") === 8, `${settingsDB.get("alerts.overdueInvoiceDays")}`);
settingsDB.set("barcode.internalPrefix", "abc");
check("pattern violation falls back to the default", settingsDB.get("barcode.internalPrefix") === "20");
settingsDB.reset("inventory.lowStockThreshold");
check("reset restores the default", settingsDB.get("inventory.lowStockThreshold") === 10);

let threw = null;
try { settingsDB.set("nope.notAKey", 1); } catch (e) { threw = e.message; }
check("unknown key is rejected", !!threw);

console.log("\n=== a corrupt row never throws ===");
db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('shift.staleHours','{{{not json',?)").run(new Date().toISOString());
settingsDB.invalidate();
check("invalid JSON falls back to the default", settingsDB.get("shift.staleHours") === 10);
db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('shift.staleHours','\"banana\"',?)").run(new Date().toISOString());
settingsDB.invalidate();
check("wrong-typed value falls back to the default", settingsDB.get("shift.staleHours") === 10);
db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('shift.staleHours','99999',?)").run(new Date().toISOString());
settingsDB.invalidate();
check("out-of-range stored value is clamped on read", settingsDB.get("shift.staleHours") === 168, `${settingsDB.get("shift.staleHours")}`);
db.prepare("DELETE FROM settings WHERE key='shift.staleHours'").run();
settingsDB.invalidate();

console.log("\n=== caching ===");
settingsDB.invalidate();
let queries = 0;
const realPrepare = db.prepare.bind(db);
db.prepare = (sql) => { if (/FROM settings/.test(sql)) queries++; return realPrepare(sql); };
for (let i = 0; i < 50; i++) settingsDB.get("inventory.lowStockThreshold");
check("50 reads issue one query", queries === 1, `${queries}`);
settingsDB.set("shift.staleHours", 12);
settingsDB.get("shift.staleHours");
check("a write forces exactly one reload", queries === 2, `${queries}`);
db.prepare = realPrepare;
settingsDB.reset("shift.staleHours");

console.log("\n=== consumers honour the settings ===");
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createShiftsDB } = require(path.join(P, "db/repositories/shifts.cjs"));
const { createAlertsDB } = require(path.join(P, "db/repositories/alerts.cjs"));
const { createDebtsDB } = require(path.join(P, "db/repositories/debts.cjs"));
const { createReportsDB } = require(path.join(P, "db/repositories/reports.cjs"));

const productsDB = createProductsDB(() => db, settingsDB);
const shiftsDB = createShiftsDB(() => db, settingsDB);
const alertsDB = createAlertsDB(() => db, shiftsDB, settingsDB);
const debtsDB = createDebtsDB(() => db);
const reportsDB = createReportsDB(() => db, productsDB, debtsDB, () => null, settingsDB);

// Products already in the fixture are referenced by invoices and protected by
// a RESTRICT foreign key, so add to the set rather than replacing it and assert
// the report agrees with the rule applied directly to the table.
for (const [id, stock] of [["ps_a", 0], ["ps_b", 3], ["ps_c", 8], ["ps_d", 20]]) {
  db.prepare("INSERT INTO products (id,name,price,stock,unit) VALUES (?,?,?,?,'piece')").run(id, `P-${id}`, 10, stock);
}

const expectedLow = (threshold) =>
  db.prepare("SELECT COUNT(*) c FROM products WHERE stock < ?").get(threshold).c;
const lowAt = (threshold) => {
  if (threshold === null) settingsDB.reset("inventory.lowStockThreshold");
  else settingsDB.set("inventory.lowStockThreshold", threshold);
  return reportsDB.generate({ type: "inventory" }).lowStock.length;
};
check("default threshold matches the rule applied to the table", lowAt(null) === expectedLow(10), `${lowAt(null)} vs ${expectedLow(10)}`);
check("threshold 5 narrows the list", lowAt(5) === expectedLow(5), `${lowAt(5)} vs ${expectedLow(5)}`);
check("threshold 25 widens the list", lowAt(25) === expectedLow(25), `${lowAt(25)} vs ${expectedLow(25)}`);
check("the three thresholds actually differ", expectedLow(5) < expectedLow(10) && expectedLow(10) < expectedLow(25),
  `${expectedLow(5)}/${expectedLow(10)}/${expectedLow(25)}`);
settingsDB.reset("inventory.lowStockThreshold");

// Out-of-stock alerts: the rule was `stock = 0`, which missed negative stock.
const alertCount = () =>
  db.prepare("SELECT COUNT(*) c FROM alerts WHERE type='out_of_stock'").get().c;
db.prepare("DELETE FROM alerts").run();
db.prepare("UPDATE products SET stock=-2 WHERE id='ps_a'").run();
alertsDB.runChecks();
check(
  "negative stock now raises an out-of-stock alert",
  db.prepare("SELECT COUNT(*) c FROM alerts WHERE type='out_of_stock' AND ref_id='ps_a'").get().c === 1,
);
const atZero = alertCount();
db.prepare("DELETE FROM alerts").run();
settingsDB.set("inventory.outOfStockThreshold", 5);
alertsDB.runChecks();
const atFive = alertCount();
check(
  "raising the out-of-stock threshold widens the alert",
  atFive > atZero && atFive === db.prepare("SELECT COUNT(*) c FROM products WHERE stock <= 5").get().c,
  `${atZero} -> ${atFive}`,
);
settingsDB.reset("inventory.outOfStockThreshold");

// The stale-shift message embedded "10" in its text.
db.prepare("DELETE FROM alerts").run();
db.prepare("INSERT INTO users (id,username,password_hash,display_name,role) VALUES ('u_stale','stale','x','Stale','staff')").run();
db.prepare(
  "INSERT INTO shifts (id,user_id,date,started_at,status,total_cash,total_vodafone,total_instapay,total_invoices) VALUES ('sh_stale','u_stale','2020-01-01','2020-01-01T00:00:00Z','open',0,0,0,0)",
).run();
settingsDB.set("shift.staleHours", 3);
alertsDB.runChecks();
const msg = db.prepare("SELECT message FROM alerts WHERE type='shift_open'").get()?.message ?? "";
check("stale-shift message quotes the configured hours", msg.includes("3 ساعات"), msg);
check("message no longer hardcodes 10", !msg.includes("10 ساعات"));
settingsDB.reset("shift.staleHours");

// Barcode prefix.
settingsDB.set("barcode.internalPrefix", "29");
const code = productsDB.generateUniqueBarcode();
check("barcode uses the configured prefix", code.startsWith("29") && code.length === 13, code);
settingsDB.reset("barcode.internalPrefix");
const defaultCode = productsDB.generateUniqueBarcode();
check("default prefix still 20 and 13 digits", defaultCode.startsWith("20") && defaultCode.length === 13, defaultCode);

check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check")[0].integrity_check === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
