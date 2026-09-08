/* PR 3: every audited operation is recorded with the actor from the session,
   passwords never reach the log, and the log cannot be rewritten. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations, getSchemaVersion } = require(path.join(P, "db/migrations.cjs"));
const { createAuditDB } = require(path.join(P, "db/repositories/audit.cjs"));
const { AUDIT_DESCRIPTORS, PASSWORD_KEYS } = require(path.join(P, "audit-descriptors.cjs"));
const { CHANNEL_PERMISSIONS } = require(path.join(P, "ipc-channels.cjs"));
const sessionManager = require(path.join(P, "session-manager.cjs"));

const workDir = path.join(WORKDIR, "audit");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "a.db");
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
runMigrations(db);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const auditDB = createAuditDB(() => db);

console.log("=== schema ===");
check("migration reached v4", getSchemaVersion(db) >= 4, `v${getSchemaVersion(db)}`);
check("audit_log exists", !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='audit_log'").get());
check("starts empty", db.prepare("SELECT COUNT(*) c FROM audit_log").get().c === 0);

console.log("\n=== append-only is enforced by the database ===");
auditDB.write({ actorUsername: "seed", channel: "x", action: "a", entity: "e" });
const seeded = db.prepare("SELECT id FROM audit_log LIMIT 1").get().id;
let threw = null;
try { db.prepare("UPDATE audit_log SET summary='tampered' WHERE id=?").run(seeded); }
catch (e) { threw = e.message; }
check("UPDATE is rejected", !!threw && /append-only/.test(threw), threw ?? "no error");
threw = null;
try { db.prepare("DELETE FROM audit_log WHERE id=?").run(seeded); }
catch (e) { threw = e.message; }
check("DELETE is rejected", !!threw && /append-only/.test(threw), threw ?? "no error");

console.log("\n=== the handle() wrapper records the right things ===");

// Verbatim copy of handle()'s audit behaviour from electron-main.cjs.
function recordAudit(descriptor, channel, payload, result, userSession, status, error) {
  let actorUserId = userSession?.userId ?? null;
  let actorUsername = userSession?.username ?? null;
  let actorRole = userSession?.role ?? null;
  if (!actorUserId && descriptor.actorFromResult && result) {
    actorUserId = result.userId ?? null;
    actorUsername = result.username ?? null;
    actorRole = result.role ?? null;
  }
  const safeCall = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
  const contributed = result && typeof result === "object" ? result.__audit : null;
  auditDB.write({
    actorUserId,
    actorUsername: actorUsername ?? "غير معروف",
    actorRole,
    channel,
    action: descriptor.action,
    entity: descriptor.entity,
    entityId: descriptor.entityId ? safeCall(() => descriptor.entityId(payload, result)) : null,
    summary: descriptor.summary ? safeCall(() => descriptor.summary(payload, result)) : null,
    detail: { payload, ...(contributed ? { changes: contributed } : {}) },
    redact: descriptor.redact ?? PASSWORD_KEYS,
    status,
    error: error ?? null,
  });
}

const handlers = new Map();
function handle(channel, fn) {
  const permission = CHANNEL_PERMISSIONS[channel];
  const auditDescriptor = AUDIT_DESCRIPTORS[channel] ?? null;
  handlers.set(channel, async (payload, auth) => {
    let userSession = null;
    try {
      if (permission !== "public") {
        const sid = typeof auth?.sessionId === "string" ? auth.sessionId : null;
        userSession = sid ? sessionManager.get(sid) : null;
        if (!userSession) throw new Error("Authentication required");
        if (permission === "admin" && userSession.role !== "admin") {
          if (auditDescriptor) {
            recordAudit(auditDescriptor, channel, payload, null, userSession, "denied",
              "صلاحيات المسؤول مطلوبة لهذه العملية");
          }
          throw new Error("صلاحيات المسؤول مطلوبة لهذه العملية");
        }
      }
      const result = await fn(payload, userSession);
      if (auditDescriptor) recordAudit(auditDescriptor, channel, payload, result, userSession, "ok");
      if (result && typeof result === "object" && "__audit" in result) delete result.__audit;
      return { success: true, data: result };
    } catch (error) {
      const message = error.message;
      if (auditDescriptor && message !== "صلاحيات المسؤول مطلوبة لهذه العملية") {
        recordAudit(auditDescriptor, channel, payload, null, userSession, "failed", message);
      }
      return { success: false, message };
    }
  });
}

handle("products:delete", (id) => ({ success: true }));
handle("products:update", ({ id, data }) => ({
  id,
  // A repository contributing before/after values the wrapper cannot see.
  __audit: { price: { from: 10, to: data.price } },
}));
handle("employees:changePassword", () => ({ success: true }));
handle("auth:login", (p) => {
  if (p.password !== "correct-horse") throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
  return { userId: "u_admin", username: "hana", role: "admin" };
});
handle("settings:update", (v) => Object.entries(v).map(([k, value]) => ({ key: k, value })));
handle("categories:getAll", () => []); // not audited

const invoke = (ch, payload, sid) => handlers.get(ch)(payload, { sessionId: sid ?? null });
// Insertion order, not occurred_at: several rows can share a millisecond.
const rows = () => db.prepare("SELECT * FROM audit_log ORDER BY rowid").all();

(async () => {
  sessionManager.destroyAll();
  const adminSid = sessionManager.create("u_admin", "hana", "admin", "هنا");
  const before = rows().length;

  await invoke("products:delete", "prod_1", adminSid);
  const del = rows().at(-1);
  check("a delete is recorded", del.action === "product.delete", del.action);
  check("actor comes from the session", del.actor_user_id === "u_admin" && del.actor_username === "hana");
  check("role is recorded", del.actor_role === "admin");
  check("entity id extracted from the payload", del.entity_id === "prod_1");
  check("status is ok", del.status === "ok");
  check("date is populated for range filtering", /^\d{4}-\d{2}-\d{2}$/.test(del.date), del.date);

  await invoke("products:update", { id: "prod_2", data: { price: 25 } }, adminSid);
  const upd = rows().at(-1);
  const updDetail = JSON.parse(upd.detail);
  check("repository-contributed before/after is captured",
    updDetail.changes?.price?.from === 10 && updDetail.changes?.price?.to === 25,
    JSON.stringify(updDetail.changes));

  console.log("\n=== passwords never reach the log ===");
  await invoke("employees:changePassword", { userId: "u9", newPassword: "hunter2" }, adminSid);
  const pw = rows().at(-1);
  check("password value is redacted", !JSON.stringify(pw).includes("hunter2"), pw.detail);
  check("the key is still visible as redacted", JSON.parse(pw.detail).payload.newPassword === "[redacted]");

  console.log("\n=== login: public channel, actor from the result ===");
  await invoke("auth:login", { username: "hana", password: "correct-horse" }, null);
  const ok = rows().at(-1);
  check("successful login records the actor from the result",
    ok.actor_user_id === "u_admin" && ok.status === "ok");
  check("login password redacted", !JSON.stringify(ok).includes("correct-horse"));

  await invoke("auth:login", { username: "hana", password: "wrong" }, null);
  const bad = rows().at(-1);
  check("failed login is recorded as failed", bad.status === "failed", bad.status);
  check("failed login keeps the attempted username",
    JSON.parse(bad.detail).payload.username === "hana");
  check("failed login has no actor id", bad.actor_user_id === null);
  check("failed login records the error", !!bad.error);

  console.log("\n=== denial and failure ===");
  const staffSid = sessionManager.create("u_staff", "sara", "staff", "سارة");
  const denied = await invoke("products:delete", "prod_3", staffSid);
  check("staff is refused", denied.success === false);
  const den = rows().at(-1);
  check("a refused attempt is recorded as denied", den.status === "denied", den.status);
  check("denial records who tried", den.actor_username === "sara");
  check("exactly one row for the denial (not also 'failed')",
    rows().filter((r) => r.status === "denied").length === 1);

  console.log("\n=== not everything is audited ===");
  const countBefore = rows().length;
  await invoke("categories:getAll", undefined, sessionManager.create("u_admin", "hana", "admin", "هنا"));
  check("a read-only channel writes nothing", rows().length === countBefore);

  console.log("\n=== the response never carries __audit ===");
  const adminSid2 = sessionManager.getAll()[0].sessionId;
  const res = await invoke("products:update", { id: "prod_9", data: { price: 5 } }, adminSid2);
  check("__audit stripped from the IPC response", !("__audit" in (res.data ?? {})),
    JSON.stringify(res.data));

  console.log("\n=== querying ===");
  const all = auditDB.query({});
  check("query returns entries and a total", all.entries.length > 0 && all.total === all.entries.length + 0, `${all.total}`);
  check("newest first", all.entries[0].occurredAt >= all.entries[all.entries.length - 1].occurredAt);
  check("pagination is stable across pages", (() => {
    const p1 = auditDB.query({ limit: 3, offset: 0 }).entries.map((e) => e.id);
    const p2 = auditDB.query({ limit: 3, offset: 3 }).entries.map((e) => e.id);
    return new Set([...p1, ...p2]).size === p1.length + p2.length;
  })());
  check("filter by action", auditDB.query({ action: "product.delete" }).entries.every((e) => e.action === "product.delete"));
  check("filter by status", auditDB.query({ status: "failed" }).entries.every((e) => e.status === "failed"));
  check("filter by actor", auditDB.query({ actorUserId: "u_staff" }).entries.every((e) => e.actorUserId === "u_staff"));
  check("limit is honoured and bounded", auditDB.query({ limit: 2 }).entries.length === 2);
  check("an absurd limit is capped", auditDB.query({ limit: 999999 }).limit === 1000);
  const opts = auditDB.getFilterOptions();
  check("filter options list actions", opts.actions.includes("product.delete"));
  check("filter options list actors", opts.actors.some((a) => a.username === "sara"));

  console.log("\n=== a broken descriptor cannot break the operation ===");
  handle("purchase:delete", () => ({ success: true }));
  AUDIT_DESCRIPTORS["purchase:delete"].entityId = () => {
    throw new Error("boom");
  };
  const survived = await invoke("purchase:delete", "pi_1", adminSid2);
  check("the operation still succeeds", survived.success === true);
  check("a row is still written, with a null entity id",
    rows().at(-1).action === "purchase.delete" && rows().at(-1).entity_id === null);

  check("foreign_key_check clean", db.pragma("foreign_key_check").length === 0);
  check("integrity_check ok", db.pragma("integrity_check")[0].integrity_check === "ok");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
