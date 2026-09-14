#!/usr/bin/env node
/**
 * Generates the ESM mirror of every rule in `shared/`.
 *
 * These modules are the rules both processes have to agree on — how many stock
 * units a line consumes, what a receipt's header says, which order statuses
 * come before dispatch. The main process, the workers, the seeder and the test
 * suite are CommonJS; the renderer is ESM and bundled by Vite.
 *
 * They used to exist as a `.cjs` and a hand-copied `.mjs` carrying a comment
 * asking whoever edited one to remember the other. `stockUnits` was among them
 * — the very rule whose divergence caused the weighted-stock defect. Nobody
 * should be asked to keep two copies of an arithmetic rule in step by hand.
 *
 * Importing the `.cjs` directly from the renderer looks like the obvious fix
 * and passes `vite build`, because Rollup converts CommonJS when bundling. It
 * fails in `vite dev`, which serves the file untransformed and leaves the
 * browser to choke on `module.exports`. So the mirror stays — but it is
 * generated from the `.cjs` rather than typed, and a test fails if the
 * committed file is not what this script produces.
 *
 *   npm run shared:sync     regenerate after editing any shared/*.cjs
 */
const fs = require("fs");
const path = require("path");

const SHARED_DIR = path.join(__dirname, "..", "shared");

/** Modules the renderer imports. Anything not listed stays CommonJS-only. */
const MIRRORED = [
  "dateRules",
  "onlineOrdersEnums",
  "onlineOrdersPayment",
  "receiptIdentity",
  "stockUnits",
];

const HEADER = (name) => `/**
 * GENERATED FROM shared/${name}.cjs — DO NOT EDIT.
 *
 * Edit the .cjs and run \`npm run shared:sync\`. A test fails if this file and
 * its source disagree, so the two cannot drift apart.
 */
`;

/** Rewrites a CommonJS shared module as the equivalent ES module. */
function toEsm(source, name) {
  let out = source;

  // A sibling rule: `const { X } = require("./y.cjs")` → an ESM import of the
  // sibling's mirror.
  out = out.replace(
    /const\s*\{([^}]+)\}\s*=\s*require\("\.\/([A-Za-z]+)\.cjs"\);/g,
    (_m, names, mod) => `import {${names}} from "./${mod}.mjs";`,
  );

  // The trailing `module.exports = { a, b }` becomes `export { a, b }`.
  const exportsMatch = out.match(/module\.exports\s*=\s*\{([\s\S]*?)\};\s*$/);
  if (!exportsMatch) {
    throw new Error(
      `${name}.cjs does not end in a single "module.exports = { ... }" — the ` +
        `generator only understands that shape, so either restore it or teach ` +
        `this script the new one.`,
    );
  }
  const exported = exportsMatch[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  out = out.replace(/module\.exports\s*=\s*\{[\s\S]*?\};\s*$/, "");

  return `${HEADER(name)}${out.trimEnd()}\n\nexport { ${exported.join(", ")} };\n`;
}

/** What the mirror for `name` should contain, given the current .cjs. */
function expectedMirror(name) {
  const source = fs.readFileSync(path.join(SHARED_DIR, `${name}.cjs`), "utf8");
  // Normalised to LF: the .cjs files are checked out with CRLF on Windows and
  // the comparison should be about content, not line endings.
  return toEsm(source.replace(/\r\n/g, "\n"), name);
}

function write() {
  for (const name of MIRRORED) {
    const target = path.join(SHARED_DIR, `${name}.mjs`);
    const content = expectedMirror(name);
    const current = fs.existsSync(target)
      ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n")
      : null;
    if (current === content) {
      console.log(`  unchanged  shared/${name}.mjs`);
      continue;
    }
    fs.writeFileSync(target, content);
    console.log(`  written    shared/${name}.mjs`);
  }
}

module.exports = { MIRRORED, expectedMirror };

if (require.main === module) {
  console.log("generating ESM mirrors from shared/*.cjs");
  write();
}
