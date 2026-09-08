/* C2: weighted / metre lines must consume their real amount, not `quantity`. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { stockUnitsFor, stockUnitsForRow } = require(
  path.join(P, "shared", "stockUnits.cjs"),
);
const { createProductsDB } = require(path.join(P, "db/repositories/products.cjs"));
const { createSalesDB } = require(path.join(P, "db/repositories/sales.cjs"));

const dbPath = path.join(WORKDIR, "verify-c2.db");
for (const s of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + s)) fs.unlinkSync(dbPath + s);
}
fs.copyFileSync((FIXTURE), dbPath);
const db = new Database(dbPath);
// The repositories expect the schema the app boots with, so bring the copy up
// to date exactly as initDatabase() would.
require(require("path").join(path.join(__dirname, "..", ".."), "db/migrations.cjs")).runMigrations(db);
require(path.join(P, "db/helpers/images.cjs")).initImagePaths(__dirname);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// ── Unit helper ────────────────────────────────────────────────────────────
console.log("=== stockUnitsFor ===");
check("piece line uses quantity", stockUnitsFor({ quantity: 3, isWeighted: false }) === 3);
check(
  "weight line uses measureAmount (kg), not quantity",
  stockUnitsFor({ quantity: 1, isWeighted: true, measureAmount: 5, weightGrams: 5 }) === 5,
);
check(
  "metre line uses measureAmount (previously deducted 0)",
  stockUnitsFor({ quantity: 1, isWeighted: true, measureAmount: 7, weightGrams: undefined }) === 7,
);
check(
  "malformed weighted line falls back to quantity, never 0",
  stockUnitsFor({ quantity: 1, isWeighted: true }) === 1,
);
check(
  "row helper reads snake_case",
  stockUnitsForRow({ quantity: 1, is_weighted: 1, measure_amount: 2.5, weight_grams: 2.5 }) === 2.5,
);

// ── Fixtures ───────────────────────────────────────────────────────────────
const productsDB = createProductsDB(() => db);
const salesDB = createSalesDB(() => db, productsDB);

db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,category,unit,price_per_kg) VALUES ('p_yarn','خيط صوف',0,100,'2000000000017','خيوط','weight',80)",
).run();
db.prepare(
  "INSERT INTO products (id,name,price,stock,barcode,category,unit) VALUES ('p_ribbon','شريط',10,50,'2000000000024','إكسسوار','meter')",
).run();

const stockOf = (id) => db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock;

// ── POS checkout ───────────────────────────────────────────────────────────
console.log("\n=== POS checkout ===");
salesDB.complete({
  total: 400,
  cashier: "test",
  totalPaid: 400,
  items: [
    {
      productId: "p_yarn",
      name: "خيط صوف",
      price: 80,
      quantity: 1,
      isWeighted: true,
      measureAmount: 5,
      weightGrams: 5,
      lineTotal: 400,
    },
  ],
});
check("5 kg sale deducts 5 kg", stockOf("p_yarn") === 95, `stock=${stockOf("p_yarn")}`);

salesDB.complete({
  total: 70,
  cashier: "test",
  totalPaid: 70,
  items: [
    {
      productId: "p_ribbon",
      name: "شريط",
      price: 10,
      quantity: 1,
      isWeighted: true,
      measureAmount: 7,
      lineTotal: 70,
    },
  ],
});
check(
  "7 m sale deducts 7 m (previously deducted 0)",
  stockOf("p_ribbon") === 43,
  `stock=${stockOf("p_ribbon")}`,
);

// ── Online order lifecycle ─────────────────────────────────────────────────
console.log("\n=== online orders ===");
const { createDriversDB } = require(path.join(P, "db/repositories/drivers.cjs"));
const { createDebtsDB } = require(path.join(P, "db/repositories/debts.cjs"));
const { createCustomersDB } = require(path.join(P, "db/repositories/customers.cjs"));
const { createOnlineOrdersDB } = require(path.join(P, "db/repositories/onlineOrders.cjs"));
const { createShiftsDB, createEnsureActiveShift } = require(
  path.join(P, "db/repositories/shifts.cjs"),
);
const driversDB = createDriversDB(() => db);
const debtsDB = createDebtsDB(() => db);
const customersDB = createCustomersDB(() => db, debtsDB);
const shiftsDB = createShiftsDB(() => db);
const onlineOrdersDB = createOnlineOrdersDB(
  () => db,
  productsDB,
  customersDB,
  driversDB,
  createEnsureActiveShift(shiftsDB),
);

db.prepare(
  "INSERT INTO users (id,username,password_hash,display_name,role) VALUES ('u_test','tester','x','Tester','admin')",
).run();
const driver = driversDB.create({ name: "مندوب", phone: "01000000099" });

const before = stockOf("p_yarn");
const order = onlineOrdersDB.create({
  customerName: "عميل",
  customerPhone: "01000000098",
  addressText: "عنوان",
  source: "whatsapp",
  paymentMethod: "cod",
  deliveryFee: 20,
  prepaidAmount: 0,
  createdBy: "u_test",
  items: [
    {
      productId: "p_yarn",
      name: "خيط صوف",
      price: 80,
      quantity: 1,
      isWeighted: true,
      measureAmount: 4,
      weightGrams: 4,
      measureUnit: "كجم",
      pricePerKg: 80,
      lineTotal: 320,
    },
  ],
});

const forSales = productsDB.getForSales().find((p) => p.id === "p_yarn");
check(
  "pending order reserves 4 kg from sellable stock",
  forSales.stock === before - 4,
  `sellable=${forSales.stock} raw=${before}`,
);

onlineOrdersDB.dispatch(order.id, driver.id);
check("dispatch deducts 4 kg", stockOf("p_yarn") === before - 4, `stock=${stockOf("p_yarn")}`);

onlineOrdersDB.markNotReceived(order.id);
check("not-received restores 4 kg", stockOf("p_yarn") === before, `stock=${stockOf("p_yarn")}`);

// ── Oversell guard ─────────────────────────────────────────────────────────
console.log("\n=== oversell guard ===");
let threw = null;
try {
  onlineOrdersDB.create({
    customerName: "عميل",
    customerPhone: "01000000097",
    addressText: "عنوان",
    source: "whatsapp",
    paymentMethod: "cod",
    deliveryFee: 0,
    prepaidAmount: 0,
    createdBy: "u_test",
    items: [
      {
        productId: "p_yarn",
        name: "خيط صوف",
        price: 80,
        quantity: 1,
        isWeighted: true,
        measureAmount: 9999,
        weightGrams: 9999,
        lineTotal: 799920,
      },
    ],
  });
} catch (e) {
  threw = e.message;
}
check("ordering 9999 kg is rejected", !!threw, threw ?? "NO ERROR — oversold");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
