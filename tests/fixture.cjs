/**
 * Builds the database every suite runs against.
 *
 * The fixture is created by the application's own bring-up — `initDatabase()`
 * followed by the demo seeder — pointed at a scratch directory through
 * `ELHANA_DATA_DIR`. That matters more than it looks: a hand-maintained test
 * schema is a second source of truth that drifts from the real one, and the
 * bugs it hides are exactly the migration bugs worth catching. Here the tests
 * exercise the same createTables, the same legacy bring-up and the same
 * versioned migrations the shop's own database went through this morning.
 *
 * Nothing here reads the shop's data, so no real database is ever needed to
 * run the suite — on a clean checkout or on CI it builds itself.
 */
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

/**
 * better-sqlite3 is a native module built against Electron's ABI, so anything
 * that opens the database has to run under Electron's Node — not the system
 * one this runner happens to be started with.
 */
// `require("electron")` from plain Node resolves to the binary's path — which
// is what we want here, rather than the .cmd shim Windows refuses to spawn
// without a shell.
const ELECTRON = require(path.join(ROOT, "node_modules", "electron"));

/**
 * Creates a fresh, fully seeded database and returns the path to the file.
 * Safe to call repeatedly: the directory is rebuilt from scratch each time.
 */
function buildFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const env = { ...process.env, ELHANA_DATA_DIR: dir, ELECTRON_RUN_AS_NODE: "1" };
  // A child process, because database.cjs holds a module-level connection and
  // a suite that opened its own copy must not share it.
  execFileSync(ELECTRON, [path.join(__dirname, "buildFixture.child.cjs")], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const dbPath = path.join(dir, "el-hana-yarns.db");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`fixture was not created at ${dbPath}`);
  }
  return dbPath;
}

module.exports = { buildFixture, ROOT, ELECTRON };
