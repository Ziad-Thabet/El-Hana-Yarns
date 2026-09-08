/* H1: a request must be authorised by its own session, never an ambient one. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const sessionManager = require(path.join(P, "session-manager.cjs"));
const { CHANNEL_PERMISSIONS } = require(path.join(P, "ipc-channels.cjs"));

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// Stand-in for ipcMain, plus a verbatim copy of handle() from electron-main.cjs.
const handlers = new Map();
const ipcMain = { handle: (ch, fn) => handlers.set(ch, fn) };

function handle(channel, fn) {
  const permission = CHANNEL_PERMISSIONS[channel];
  ipcMain.handle(channel, async (_event, payload, auth) => {
    let userSession = null;
    try {
      if (permission !== "public") {
        const sessionId =
          typeof auth?.sessionId === "string" ? auth.sessionId : null;
        userSession = sessionId ? sessionManager.get(sessionId) : null;
        if (!userSession) throw new Error("Authentication required");
        if (permission === "admin" && userSession.role !== "admin") {
          throw new Error("صلاحيات المسؤول مطلوبة لهذه العملية");
        }
      }
      const result = await fn(payload, userSession);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}

let seen;
handle("expenses:getAll", (payload, s) => { seen = s; return "admin-data"; });
handle("sales:complete", (payload, s) => { seen = s; return { cashier: s?.displayName }; });
handle("auth:hasAnyUsers", (payload, s) => { seen = s; return true; });
handle("auth:logout", (sessionId) => {
  if (typeof sessionId === "string") sessionManager.destroy(sessionId);
  return { success: true };
});

// invoke(channel, payload, sessionId) mirrors what the preload bridge sends.
const invoke = (ch, payload, sessionId) =>
  handlers.get(ch)(null, payload, { sessionId: sessionId ?? null });

(async () => {
  sessionManager.destroyAll();

  console.log("=== the original vulnerability ===");
  const adminSid = sessionManager.create("u_admin", "hana", "admin", "هنا");
  // Before: a second login left BOTH sessions live and getAll()[0] returned the
  // admin, so a staff request inherited admin rights.
  const staffSid = sessionManager.create("u_staff", "sara", "staff", "سارة");
  check(
    "logging in ends the previous session",
    sessionManager.getAll().length === 1,
    `${sessionManager.getAll().length} live session(s)`,
  );
  check("the surviving session is the new one", sessionManager.get(adminSid) === null);

  const escalation = await invoke("expenses:getAll", {}, staffSid);
  check(
    "staff cannot reach an admin channel",
    escalation.success === false && escalation.message.includes("المسؤول"),
    escalation.success ? "ESCALATED" : escalation.message,
  );

  console.log("\n=== a request without a session is rejected ===");
  const anon = await invoke("expenses:getAll", {}, null);
  check("no session id -> Authentication required",
    anon.success === false && anon.message === "Authentication required");
  const forged = await invoke("expenses:getAll", {}, "sess_u_admin_9999_forged");
  check("unknown session id -> Authentication required",
    forged.success === false && forged.message === "Authentication required");

  console.log("\n=== the payload cannot forge a session ===");
  // The old code read sessionId out of the request body; auth now travels in a
  // separate argument, so this must still be rejected.
  const spoof = await invoke("expenses:getAll", { sessionId: staffSid }, null);
  check("sessionId inside the payload is ignored", spoof.success === false);
  sessionManager.destroyAll();
  const adminSid2 = sessionManager.create("u_admin", "hana", "admin", "هنا");
  const spoof2 = await invoke("expenses:getAll", { sessionId: adminSid2 }, null);
  check("even a VALID id in the payload is ignored", spoof2.success === false);

  console.log("\n=== identity is taken from the session, not the caller ===");
  const sale = await invoke(
    "sales:complete",
    { cashier: "SOMEONE ELSE" },
    adminSid2,
  );
  check("handler receives the real session", seen?.userId === "u_admin");
  check("cashier comes from the session", sale.data.cashier === "هنا",
    `got ${sale.data.cashier}`);

  console.log("\n=== public channels still work unauthenticated ===");
  const pub = await invoke("auth:hasAnyUsers", undefined, null);
  check("public channel succeeds with no session", pub.success === true);
  check("public handler receives null", seen === null);

  console.log("\n=== logout ===");
  const out = await invoke("auth:logout", adminSid2, adminSid2);
  check("logout succeeds", out.success === true);
  check("session destroyed", sessionManager.get(adminSid2) === null);
  const afterOut = await invoke("expenses:getAll", {}, adminSid2);
  check("the destroyed session no longer authorises",
    afterOut.success === false && afterOut.message === "Authentication required");
  const outAgain = await invoke("auth:logout", "sess_already_gone", null);
  check("logging out an expired session still succeeds", outAgain.success === true);

  console.log("\n=== legacy channels are gone ===");
  for (const ch of ["complete-checkout","save-purchase-invoice","update-purchase-payment","generate-report"]) {
    check(`${ch} removed from the permission map`, !(ch in CHANNEL_PERMISSIONS));
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
