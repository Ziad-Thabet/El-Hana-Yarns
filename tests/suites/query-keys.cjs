/* Cache keys come from one place, because a key that is nearly right is
   indistinguishable from one that is right until someone notices the screen
   is stale.

   React Query matches keys by prefix. A hook that invalidated
   `["onlineOrders"]` while every online-order query was keyed
   `["online-orders", …]` therefore invalidated nothing at all: creating an
   online order from the point of sale left the orders list showing the old
   data, with no error anywhere. The two spellings sat four files apart. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const KEYS_FILE = path.join(P, "src", "lib", "queryKeys.ts");
const keysSource = fs.readFileSync(KEYS_FILE, "utf8");
// Comments explain the keys — including, in this file, a comment quoting the
// misspelling that prompted all this. Scanning them would flag the
// explanation as the defect.
const keysCode = keysSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** Every .ts/.tsx under src, except the key registry itself. */
function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && full !== KEYS_FILE) out.push(full);
    }
  };
  walk(path.join(P, "src"));
  return out;
}

console.log("=== every key comes from the registry ===");
const offenders = [];
for (const file of sourceFiles()) {
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(/queryKey:\s*\[/g)) {
    const line = source.slice(0, m.index).split("\n").length;
    offenders.push(`${path.relative(P, file).replace(/\\/g, "/")}:${line}`);
  }
}
check(
  "no component or hook writes a cache key by hand",
  offenders.length === 0,
  offenders.join(", "),
);

console.log("\n=== the registry is internally consistent ===");
// Every key literal in the registry, as its first segment.
const families = new Map();
for (const m of keysCode.matchAll(/\[\s*"([a-zA-Z-]+)"/g)) {
  families.set(m[1], (families.get(m[1]) ?? 0) + 1);
}
check("the registry defines keys", families.size > 5, `${families.size} families`);

// Two spellings of one family is the defect that prompted this suite: a
// camelCase twin of a kebab-case family can only ever be a typo, because
// prefix matching means one of them matches nothing.
const spellings = [...families.keys()];
const twins = [];
for (const name of spellings) {
  const flattened = name.replace(/-/g, "").toLowerCase();
  for (const other of spellings) {
    if (other !== name && other.replace(/-/g, "").toLowerCase() === flattened) {
      twins.push(`${name} / ${other}`);
    }
  }
}
check(
  "no family is spelled two ways",
  twins.length === 0,
  [...new Set(twins)].join(", "),
);

console.log("\n=== the families the app actually uses ===");
// A root exists to be invalidated; a root nobody references is dead weight,
// and a family with no root forces the next hook to write one by hand.
const rootNames = [...keysCode.matchAll(/^\s+(\w+Root)\s*[:(]/gm)].map((m) => m[1]);
check("roots are declared for invalidation", rootNames.length > 0, rootNames.join(", "));

const used = new Set();
for (const file of sourceFiles()) {
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(/QK\.(\w+)/g)) used.add(m[1]);
}
const unusedRoots = rootNames.filter((r) => !used.has(r));
check(
  "every declared root is used somewhere",
  unusedRoots.length === 0,
  unusedRoots.join(", "),
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
