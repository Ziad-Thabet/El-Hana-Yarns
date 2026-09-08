#!/usr/bin/env node
/**
 * Runs every suite in tests/suites.
 *
 * Plain Node on purpose: it only spawns children. The suites themselves need
 * Electron's Node, because better-sqlite3 is compiled against Electron's ABI
 * and will refuse to load under the system one — hence ELECTRON_RUN_AS_NODE.
 *
 *   npm test                 — build a fixture, run everything
 *   npm test -- capabilities — run only suites whose name matches
 *   npm test -- --keep       — leave the fixture behind for inspection
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");
const { buildFixture, ROOT, ELECTRON } = require("./fixture.cjs");

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const filters = args.filter((a) => !a.startsWith("--"));

if (!fs.existsSync(ELECTRON)) {
  console.error("Electron is not installed — run `npm install` first.");
  process.exit(1);
}

const SUITES_DIR = path.join(__dirname, "suites");
const suites = fs
  .readdirSync(SUITES_DIR)
  .filter((f) => f.endsWith(".cjs"))
  .filter((f) => filters.length === 0 || filters.some((needle) => f.includes(needle)))
  .sort();

if (suites.length === 0) {
  console.error(`No suites matched ${filters.join(", ")}`);
  process.exit(1);
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "elhana-tests-"));
const fixtureDir = path.join(workDir, "fixture");

console.log("building the fixture database…");
let fixture;
try {
  fixture = buildFixture(fixtureDir);
} catch (err) {
  console.error(`could not build the fixture: ${err.message}`);
  process.exit(1);
}
console.log(`fixture ready: ${fixture}\n`);

const started = Date.now();
let passed = 0;
let failedChecks = 0;
const failedSuites = [];

for (const suite of suites) {
  const name = suite.replace(/\.cjs$/, "");
  // Each suite gets its own scratch directory, so one that corrupts its copy
  // on purpose cannot take the next one down with it.
  const suiteDir = path.join(workDir, name);
  fs.mkdirSync(suiteDir, { recursive: true });

  const result = spawnSync(ELECTRON, [path.join(SUITES_DIR, suite)], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ELHANA_TEST_FIXTURE: fixture,
      ELHANA_TEST_WORKDIR: suiteDir,
    },
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const checks = (output.match(/^PASS\b/gm) ?? []).length;
  const fails = (output.match(/^FAIL\b/gm) ?? []).length;
  passed += checks;
  failedChecks += fails;

  if (result.status === 0 && fails === 0) {
    console.log(`  ok    ${name.padEnd(24)} ${checks} checks`);
  } else {
    failedSuites.push(name);
    console.log(`  FAIL  ${name.padEnd(24)} ${checks} passed, ${fails} failed`);
    // Only the interesting lines: a wall of passing checks helps nobody.
    const detail = output
      .split("\n")
      .filter((l) => /^FAIL\b/.test(l) || /Error|error:/.test(l))
      .slice(0, 12);
    for (const line of detail) console.log(`          ${line.trim()}`);
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `\n${passed} checks passed${failedChecks ? `, ${failedChecks} failed` : ""} ` +
    `across ${suites.length} suites in ${seconds}s`,
);

if (keep) {
  console.log(`fixture kept at ${workDir}`);
} else {
  fs.rmSync(workDir, { recursive: true, force: true });
}

if (failedSuites.length > 0) {
  console.log(`failing suites: ${failedSuites.join(", ")}`);
  process.exit(1);
}
