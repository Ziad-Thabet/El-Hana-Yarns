/* C1: the object handed to IPC handlers must be the user's session,
   not Electron's `session` module. Replicates the real handle() wrapper. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const PROJ = P;
const sessionManager = require(path.join(PROJ, "session-manager.cjs"));
const { CHANNEL_PERMISSIONS } = require(path.join(PROJ, "ipc-channels.cjs"));

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// Minimal stand-in for ipcMain that lets us invoke registered handlers.
const handlers = new Map();
const ipcMain = { handle: (ch, fn) => handlers.set(ch, fn) };

// --- verbatim copy of handle() from electron-main.cjs -----------------------
function handle(channel, fn) {
  const permission = CHANNEL_PERMISSIONS[channel];
  ipcMain.handle(channel, async (_, ...args) => {
    let userSession = null;
    try {
      if (permission !== "public") {
        const firstArg = args[0];
        const sessionIdFromRequest =
          typeof firstArg === "string" && firstArg.length >= 20
            ? firstArg
            : typeof firstArg?.sessionId === "string"
              ? firstArg.sessionId
              : null;
        userSession = sessionIdFromRequest
          ? sessionManager.get(sessionIdFromRequest)
          : null;
        if (!userSession) {
          const active = sessionManager.getAll ? sessionManager.getAll() : [];
          userSession = active.length > 0 ? active[0] : null;
        }
        if (!userSession) throw new Error("Authentication required");
        if (permission === "admin" && userSession.role !== "admin") {
          throw new Error("صلاحيات المسؤول مطلوبة لهذه العملية");
        }
      }
      const result = await fn(...args, userSession);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}
// ---------------------------------------------------------------------------

let seen;
handle("expenses:add", (data, _session) => {
  seen = _session;
  return { createdBy: _session?.userId ?? "admin" };
});
handle("auth:hasAnyUsers", (_arg, _session) => {
  seen = _session;
  return true;
});
handle("employees:setActive", ({ userId, isActive }, _session) => {
  if (_session && _session.userId === userId && !isActive) {
    throw new Error("لا يمكن تعطيل حسابك الخاص");
  }
  return { ok: true };
});

const invoke = (ch, arg) => handlers.get(ch)(null, arg);

(async () => {
  const sid = sessionManager.create("user_admin_1", "ziad", "admin", "زياد");

  const res = await invoke("expenses:add", { amount: 5 });
  check("handler receives a real user session", seen?.userId === "user_admin_1", `userId=${seen?.userId}`);
  check(
    "session carries the full identity (role/username/displayName)",
    seen?.role === "admin" && seen?.username === "ziad" && seen?.displayName === "زياد",
  );
  check("expenses:add records the real user id", res.data.createdBy === "user_admin_1");

  await invoke("auth:hasAnyUsers");
  check("public channels still receive null", seen === null, `got ${seen}`);

  const selfOff = await invoke("employees:setActive", {
    userId: "user_admin_1",
    isActive: false,
  });
  check(
    "admin cannot deactivate their own account",
    selfOff.success === false && selfOff.message.includes("حسابك"),
    selfOff.message ?? "no error raised",
  );

  const otherOff = await invoke("employees:setActive", {
    userId: "user_staff_9",
    isActive: false,
  });
  check("admin can still deactivate others", otherOff.success === true);

  // Role gating still works.
  sessionManager.destroy(sid);
  sessionManager.create("user_staff_9", "sara", "staff", "سارة");
  const denied = await invoke("expenses:add", { amount: 5 });
  check(
    "staff is blocked from an admin channel",
    denied.success === false && denied.message.includes("المسؤول"),
  );

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
