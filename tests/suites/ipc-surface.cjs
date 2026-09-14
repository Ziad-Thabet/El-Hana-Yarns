/* The IPC surface is one list, and everything else agrees with it.

   The same 128 channels used to be restated in five places: a permissions
   map, a capability map, the handlers, the preload bridge and the TypeScript
   declarations. Five lists of the same thing eventually disagree — and they
   had, by two and by four. Worse, one channel declared a permission that was
   never enforced, because it was wired with a raw ipcMain.handle that skips
   the gate entirely.

   These checks are what keeps the lists honest. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const {
  CHANNEL_PERMISSIONS,
  CHANNEL_CAPABILITY,
  CAPABILITY_NOUN,
  capabilityFor,
} = require(path.join(P, "ipc-channels.cjs"));

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const read = (f) => fs.readFileSync(path.join(P, f), "utf8");
const listed = (source, re) => new Set([...source.matchAll(re)].map((m) => m[1]));
const missing = (a, b) => [...a].filter((x) => !b.has(x));

const main = read("electron-main.cjs");
const preload = read("preload.js");

const declared = new Set(Object.keys(CHANNEL_PERMISSIONS));
// Only the gate wrapper: `ipcMain.handle` and `protocol.handle` are different
// things entirely, and a plain \b matches the tail of both.
const gated = listed(main, /(?<![.\w])handle\(\s*"([^"]+)"/g);
const raw = listed(main, /ipcMain\.handle\(\s*"([^"]+)"/g);
const invoked = listed(preload, /secureInvoke\(\s*"([^"]+)"/g);

console.log("=== one list, and everyone agrees with it ===");
check("channels are declared", declared.size > 100, `${declared.size}`);
check(
  "every declared channel has a handler",
  missing(declared, gated).length === 0,
  missing(declared, gated).join(", "),
);
check(
  "every handler is declared",
  missing(gated, declared).length === 0,
  missing(gated, declared).join(", "),
);
check(
  "every channel the preload calls is declared",
  missing(invoked, declared).join(", ") === "",
  missing(invoked, declared).join(", "),
);
check(
  "no channel is declared that nothing can call",
  missing(declared, invoked).length === 0,
  missing(declared, invoked).join(", "),
);

console.log("\n=== nothing skips the gate ===");
// A raw ipcMain.handle for a declared channel advertises a permission that
// is never checked. print:invoice did exactly that.
const skipping = [...raw].filter((c) => declared.has(c));
check(
  "no declared channel is wired with a raw ipcMain.handle",
  skipping.length === 0,
  skipping.join(", "),
);
// Window controls are not part of the permissioned surface; they carry no
// data and no authority. Anything else handled raw is an oversight.
const unexpectedRaw = [...raw].filter((c) => !c.startsWith("window:"));
check(
  "the only raw handlers are window controls",
  unexpectedRaw.length === 0,
  unexpectedRaw.join(", "),
);

console.log("\n=== capabilities are derived, not typed ===");
const wrongCapability = Object.entries(CHANNEL_PERMISSIONS)
  .filter(([c, p]) => CHANNEL_CAPABILITY[c] !== capabilityFor(c, p))
  .map(([c]) => c);
check(
  "every capability matches the rule",
  wrongCapability.length === 0,
  wrongCapability.join(", "),
);
check(
  "the suffix follows the permission, never the feature",
  Object.entries(CHANNEL_PERMISSIONS).every(([c, p]) =>
    CHANNEL_CAPABILITY[c].endsWith(p === "admin" ? ".manage" : ".use"),
  ),
);
// The escalation this prevents: a capability named after the feature alone
// put reads and writes behind one name, so seeding a role from the channels
// marked `any` handed it the manage capability too.
const cashierCaps = new Set(
  Object.entries(CHANNEL_PERMISSIONS)
    .filter(([, p]) => p !== "admin")
    .map(([c]) => CHANNEL_CAPABILITY[c]),
);
const adminOnlyCaps = new Set(
  Object.entries(CHANNEL_PERMISSIONS)
    .filter(([, p]) => p === "admin")
    .map(([c]) => CHANNEL_CAPABILITY[c]),
);
const overlap = [...cashierCaps].filter((c) => adminOnlyCaps.has(c));
check(
  "no capability is held by both a public channel and an admin one",
  overlap.length === 0,
  overlap.join(", "),
);

console.log("\n=== the alias map earns its keep ===");
const aliasesUsed = new Set(
  Object.keys(CHANNEL_PERMISSIONS).map((c) => c.split(":")[0]),
);
const strayAliases = Object.keys(CAPABILITY_NOUN).filter((a) => !aliasesUsed.has(a));
check(
  "no alias for a prefix that no longer exists",
  strayAliases.length === 0,
  strayAliases.join(", "),
);

console.log("\n=== the renderer's declarations keep up ===");
// Not a channel-by-channel comparison — the .d.ts is organised by feature,
// not by channel name — but a missing block is worth catching.
const dts = read("src/types/electron.d.ts");
const prefixes = [...new Set(Object.keys(CHANNEL_PERMISSIONS).map((c) => c.split(":")[0]))];
const undeclared = prefixes.filter(
  (prefix) => !new RegExp(`\\b${prefix}\\s*:\\s*\\{`).test(dts) && prefix !== "print",
);
check(
  "every channel family appears in electron.d.ts",
  undeclared.length === 0,
  undeclared.join(", "),
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
