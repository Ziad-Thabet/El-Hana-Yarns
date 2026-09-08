/**
 * Runs inside a child Electron process (as Node) to create one fixture
 * database. Kept separate from fixture.cjs because database.cjs keeps a
 * module-level connection: building in-process would leave it open and every
 * suite would then be sharing one handle.
 */
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const database = require(path.join(ROOT, "database.cjs"));

database.initDatabase();
database.closeDatabase();

// The demo seeder fills every section the suites read: catalogue, customers,
// sales, purchases, debts, shifts, expenses, drivers and online orders.
execFileSync(process.execPath, [path.join(ROOT, "seed-demo.cjs")], {
  cwd: ROOT,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
