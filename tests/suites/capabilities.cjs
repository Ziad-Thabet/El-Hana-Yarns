/* PR 4: capabilities replace the role string comparison, and the effective
   permissions must be provably identical to before. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion } = require(path.join(P, "db/migrations.cjs"));
const { createRolesDB } = require(path.join(P, "db/repositories/roles.cjs"));
const { createAuthDB } = require(path.join(P, "db/repositories/auth.cjs"));
const { CHANNEL_PERMISSIONS, CHANNEL_CAPABILITY } = require(path.join(P, "ipc-channels.cjs"));
const sessionManager = require(path.join(P, "session-manager.cjs"));
const bcryptjs = require(path.join(P, "node_modules", "bcryptjs"));

const workDir = path.join(WORKDIR, "caps");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "c.db");
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
runMigrations(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const rolesDB = createRolesDB(() => db);

console.log("=== schema ===");
check("migration reached v5", getSchemaVersion(db) >= 5, `v${getSchemaVersion(db)}`);
check("admin and staff are seeded",
  db.prepare("SELECT COUNT(*) c FROM roles").get().c === 2);
check("both are system roles",
  db.prepare("SELECT COUNT(*) c FROM roles WHERE is_system=1").get().c === 2);
check("admin holds the wildcard",
  db.prepare("SELECT COUNT(*) c FROM role_capabilities WHERE role_id='admin' AND capability='*'").get().c === 1);
check("every channel has a capability",
  Object.keys(CHANNEL_PERMISSIONS).every((ch) => !!CHANNEL_CAPABILITY[ch]));

console.log("\n=== THE MATRIX: effective permissions are unchanged ===");
// The whole point of this PR is that nothing about who-can-do-what changes.
// Compare the new capability check against the old rule, for every channel.
const oldRuleAllows = (role, channel) => {
  const perm = CHANNEL_PERMISSIONS[channel];
  if (perm === "public") return true;
  if (perm === "any") return true;      // any authenticated user
  return role === "admin";              // perm === "admin"
};
const newRuleAllows = (role, channel) => {
  const perm = CHANNEL_PERMISSIONS[channel];
  if (perm === "public" || perm === "any") return true;
  return rolesDB.hasCapability(role, CHANNEL_CAPABILITY[channel] ?? channel);
};

let adminDiffs = [];
let staffDiffs = [];
for (const channel of Object.keys(CHANNEL_PERMISSIONS)) {
  if (oldRuleAllows("admin", channel) !== newRuleAllows("admin", channel)) {
    adminDiffs.push(channel);
  }
  if (oldRuleAllows("staff", channel) !== newRuleAllows("staff", channel)) {
    staffDiffs.push(channel);
  }
}
check(`admin unchanged across all ${Object.keys(CHANNEL_PERMISSIONS).length} channels`,
  adminDiffs.length === 0, adminDiffs.slice(0, 5).join(", "));
check("staff unchanged across every channel",
  staffDiffs.length === 0, staffDiffs.slice(0, 5).join(", "));

const adminOnly = Object.entries(CHANNEL_PERMISSIONS).filter(([, p]) => p === "admin");
check("staff is refused on every admin channel",
  adminOnly.every(([ch]) => !newRuleAllows("staff", ch)), `${adminOnly.length} channels`);
check("admin is allowed on every admin channel",
  adminOnly.every(([ch]) => newRuleAllows("admin", ch)));

console.log("\n=== deny by default ===");
check("an unmapped capability is refused for staff",
  rolesDB.hasCapability("staff", "something.invented") === false);
check("an unknown role is refused", rolesDB.hasCapability("nope", "sales.use") === false);
check("a null role is refused", rolesDB.hasCapability(null, "sales.use") === false);
check("admin's wildcard still covers an invented capability",
  rolesDB.hasCapability("admin", "something.invented") === true);

console.log("\n=== the owner cannot be locked out ===");
// A half-migrated or hand-edited database must still admit the admin.
db.prepare("DELETE FROM role_capabilities").run();
rolesDB.invalidate();
check("with no capability rows, admin still passes",
  rolesDB.hasCapability("admin", "settings.manage") === true);
check("with no capability rows, staff is still refused",
  rolesDB.hasCapability("staff", "settings.manage") === false);
db.prepare("DROP TABLE role_capabilities").run();
rolesDB.invalidate();
check("with the table missing entirely, admin still passes",
  rolesDB.hasCapability("admin", "settings.manage") === true);
// Restore for the remaining checks.
runMigrations(db);
db.pragma("user_version = 4");
runMigrations(db);
rolesDB.invalidate();
check("capabilities restored", rolesDB.hasCapability("staff", "sales.use") === true);

console.log("\n=== capability lists for the renderer ===");
check("admin reports the wildcard", rolesDB.capabilitiesFor("admin").includes("*"));
const staffCaps = rolesDB.capabilitiesFor("staff");
check("staff reports a concrete list", staffCaps.length > 0 && !staffCaps.includes("*"), `${staffCaps.length} capabilities`);
check("staff can use sales but not manage the catalogue",
  staffCaps.includes("sales.use") && !staffCaps.includes("catalogue.manage"));
check("knownCapabilities is deduplicated and sorted", (() => {
  const k = rolesDB.knownCapabilities();
  return new Set(k).size === k.length && [...k].sort().join() === k.join();
})());

console.log("\n=== defect: a deactivated user cannot log in ===");
const authDB = createAuthDB(() => db);
db.prepare("DELETE FROM users WHERE id IN ('u_on','u_off')").run();
const hash = bcryptjs.hashSync("password123", 10);
db.prepare("INSERT INTO users (id,username,password_hash,display_name,role,is_active) VALUES ('u_on','activeuser',?,'Active','staff',1)").run(hash);
db.prepare("INSERT INTO users (id,username,password_hash,display_name,role,is_active) VALUES ('u_off','gone',?,'Gone','staff',0)").run(hash);
check("an active user logs in", authDB.login("activeuser", "password123")?.userId === "u_on");
check("a deactivated user is refused at the login path itself",
  authDB.login("gone", "password123") === null);
check("wrong password still refused", authDB.login("activeuser", "wrongpassword") === null);

console.log("\n=== role changes take effect ===");
sessionManager.destroyAll();
const sid = sessionManager.create("u_on", "activeuser", "staff", "Active");
check("session created", sessionManager.get(sid)?.role === "staff");
check("destroyForUser ends it", sessionManager.destroyForUser("u_on") === 1 && sessionManager.get(sid) === null);
check("destroyForUser on an unknown user is a no-op", sessionManager.destroyForUser("nobody") === 0);

// Editing what a role *can do* must apply immediately, without re-login,
// because sessions cache the role id and not the capability set.
const sid2 = sessionManager.create("u_on", "activeuser", "staff", "Active");
check("staff cannot manage settings", !rolesDB.hasCapability("staff", "settings.manage"));
db.prepare("INSERT INTO role_capabilities (role_id, capability) VALUES ('staff','settings.manage')").run();
rolesDB.invalidate();
check("granting a capability applies to the live session",
  rolesDB.hasCapability(sessionManager.get(sid2).role, "settings.manage") === true);
db.prepare("DELETE FROM role_capabilities WHERE role_id='staff' AND capability='settings.manage'").run();
rolesDB.invalidate();
check("revoking it applies immediately too",
  rolesDB.hasCapability("staff", "settings.manage") === false);

check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
check("integrity_check ok", db.pragma("integrity_check")[0].integrity_check === "ok");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
