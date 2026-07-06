/**
 * seed-demo.cjs
 * El-Hana Yarns — demo data (full coverage of all sections)
 * Usage:
 *   node seed-demo.cjs          ← adds demo data
 *   node seed-demo.cjs --clear  ← clears only demo data
 */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const {
  ORDER_STATUS,
  ORDER_SOURCE,
  ORDER_PAYMENT_METHOD,
  ORDER_PAYMENT_STATUS,
  SETTLEMENT_TYPE,
} = require("./shared/onlineOrdersEnums.cjs");
const { computePaymentBreakdown } = require("./shared/onlineOrdersPayment.cjs");

// ── DB path (dev userdata) ─────────────────────────
const DB_PATH = path.join(__dirname, "userdata", "el-hana-yarns.db");
if (!fs.existsSync(DB_PATH)) {
  console.error("❌ مش لاقي الـ DB — شغّل الـ app الأول عشان يتعمل الملف");
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── helper ──────────────────────────────────────────
function id(prefix) {
  return `${prefix}-DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// CLEAR — remove only demo data (children before parents)
function clearDemo() {
  const tables = [
    "online_order_items",
    "online_orders",
    "online_customer_phones",
    "online_customers_addresses",
    "driver_settlements",
    "drivers",
    "invoice_due_dates",
    "alerts",
    "expenses",
    "salary_history",
    "shifts",
    "sale_invoice_items",
    "sale_invoices",
    "purchase_invoice_items",
    "purchase_invoices",
    "payment_records",
    "customer_debts",
    "customers",
    "products",
    "categories",
    "sessions",
  ];
  const clearTx = db.transaction(() => {
    for (const table of tables) {
      const idCol = table === "sessions" ? "session_id" : "id";
      const result = db
        .prepare(`DELETE FROM ${table} WHERE ${idCol} LIKE '%DEMO%'`)
        .run();
      if (result.changes > 0)
        console.log(`🗑  ${table}: حذف ${result.changes} صف`);
    }
    db.prepare("DELETE FROM payment_records WHERE ref_id LIKE '%DEMO%'").run();
  });
  clearTx();
  console.log("✅ تم مسح البيانات التجريبية");
}

// SEED — insert demo data
function seed() {
  console.log("🌱 بدء إضافة البيانات التجريبية...\n");
  const seedTx = db.transaction(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 6);
    const fmt = (d) => d.toISOString().slice(0, 10);

    // ── Categories ────────────────────────────────
    const categories = [
      {
        id: id("cat"),
        name: "خيوط صوف",
        color: "#6366f1",
        description: "خيوط صوف طبيعية وصناعية",
      },
      {
        id: id("cat"),
        name: "خيوط قطن",
        color: "#10b981",
        description: "خيوط قطن للكروشيه والتريكو",
      },
      {
        id: id("cat"),
        name: "إبر وأدوات",
        color: "#f59e0b",
        description: "إبر تريكو وكروشيه وأدوات",
      },
      {
        id: id("cat"),
        name: "خيوط مزخرفة",
        color: "#ec4899",
        description: "خيوط لامعة وميتاليك",
      },
    ];
    const insertCat = db.prepare(
      "INSERT OR IGNORE INTO categories (id, name, description, color) VALUES (?,?,?,?)",
    );
    for (const c of categories)
      insertCat.run(c.id, c.name, c.description, c.color);
    console.log(`✔ Categories: ${categories.length} صنف`);

    // ── Products ──────────────────────────────────
    const products = [
      {
        id: id("prod"),
        name: "صوف ميرينو أبيض 100جم",
        price: 45,
        stock: 120,
        barcode: "6001001001",
        category: categories[0].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "صوف ميرينو أسود 100جم",
        price: 45,
        stock: 95,
        barcode: "6001001002",
        category: categories[0].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "صوف أكريليك ملون 200جم",
        price: 35,
        stock: 200,
        barcode: "6001001003",
        category: categories[0].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "صوف بيبي ناعم وردي",
        price: 55,
        stock: 60,
        barcode: "6001001004",
        category: categories[0].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "صوف شتوي سميك بيج",
        price: 65,
        stock: 40,
        barcode: "6001001005",
        category: categories[0].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "قطن مرسرايز أبيض 50جم",
        price: 25,
        stock: 150,
        barcode: "6001002001",
        category: categories[1].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "قطن مرسرايز أزرق 50جم",
        price: 25,
        stock: 130,
        barcode: "6001002002",
        category: categories[1].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "قطن ماكرامي 3مم",
        price: 18,
        stock: 5,
        barcode: "6001002003",
        category: categories[1].name,
        unit: "kg",
        pricePerKg: 180,
      },
      {
        id: id("prod"),
        name: "إبرة كروشيه ستانلس 3مم",
        price: 12,
        stock: 80,
        barcode: "6001003001",
        category: categories[2].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "طقم إبر تريكو 7 مقاسات",
        price: 85,
        stock: 25,
        barcode: "6001003002",
        category: categories[2].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "مقياس غرزة بلاستيك",
        price: 8,
        stock: 50,
        barcode: "6001003003",
        category: categories[2].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "خيط لوريكس ذهبي 25جم",
        price: 30,
        stock: 70,
        barcode: "6001004001",
        category: categories[3].name,
        unit: "piece",
      },
      {
        id: id("prod"),
        name: "خيط لوريكس فضي 25جم",
        price: 30,
        stock: 65,
        barcode: "6001004002",
        category: categories[3].name,
        unit: "piece",
      },
    ];
    const insertProd = db.prepare(
      "INSERT OR IGNORE INTO products (id, name, price, stock, barcode, image_url, category, unit, price_per_kg) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    for (const p of products) {
      insertProd.run(
        p.id,
        p.name,
        p.price,
        p.stock,
        p.barcode,
        null,
        p.category,
        p.unit,
        p.pricePerKg ?? null,
      );
    }
    console.log(`✔ Products: ${products.length} منتج`);

    // ── Customers ─────────────────────────────────
    const customers = [
      {
        id: id("cust"),
        name: "أم أحمد",
        phone: "01001234567",
        address: "المنصورة",
      },
      {
        id: id("cust"),
        name: "سمر محمود",
        phone: "01112345678",
        address: "القاهرة",
      },
      {
        id: id("cust"),
        name: "نادية حسين",
        phone: "01223456789",
        address: "الإسكندرية",
      },
      {
        id: id("cust"),
        name: "منى عبدالله",
        phone: "01301234567",
        address: "طنطا",
      },
    ];
    const insertCust = db.prepare(
      "INSERT OR IGNORE INTO customers (id, name, phone, address, total_debt) VALUES (?,?,?,?,0)",
    );
    for (const c of customers) insertCust.run(c.id, c.name, c.phone, c.address);
    console.log(`✔ Customers: ${customers.length} عميل`);

    // ── Shifts ────────────────────────────────────
    const shift1Id = id("shift"); // closed shift, yesterday
    const shift2Id = id("shift"); // open shift, today
    db.prepare(
      "INSERT OR IGNORE INTO shifts (id, user_id, date, started_at, ended_at, total_cash, total_vodafone, total_instapay, total_invoices, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      shift1Id,
      "user-staff-1",
      fmt(yesterday),
      `${fmt(yesterday)}T09:00:00`,
      `${fmt(yesterday)}T17:00:00`,
      0,
      0,
      0,
      1,
      "closed",
    );
    db.prepare(
      "INSERT OR IGNORE INTO shifts (id, user_id, date, started_at, ended_at, total_cash, total_vodafone, total_instapay, total_invoices, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      shift2Id,
      "user-staff-1",
      fmt(today),
      `${fmt(today)}T09:00:00`,
      null,
      225,
      295,
      0,
      3,
      "open",
    );
    console.log("✔ Shifts: 2 (شيفت مقفول أمس + شيفت مفتوح النهاردة)");

    // ── Sale Invoices ─────────────────────────────
    const fmtT = (d) => d.toTimeString().slice(0, 8);
    const sales = [
      {
        id: id("sinv"),
        invoiceNumber: "SL-DEMO-001",
        date: fmt(today),
        time: "10:30 ص",
        total: 125,
        cashier: "الكاشير",
        shiftId: shift2Id,
        items: [
          {
            id: id("sitem"),
            productId: products[0].id,
            name: products[0].name,
            price: 45,
            quantity: 2,
            barcode: products[0].barcode,
            lineTotal: 90,
          },
          {
            id: id("sitem"),
            productId: products[8].id,
            name: products[8].name,
            price: 12,
            quantity: 1,
            barcode: products[8].barcode,
            lineTotal: 12,
          },
          {
            id: id("sitem"),
            productId: products[5].id,
            name: products[5].name,
            price: 25,
            quantity: 1,
            barcode: products[5].barcode,
            lineTotal: 25,
          },
        ],
      },
      {
        id: id("sinv"),
        invoiceNumber: "SL-DEMO-002",
        date: fmt(today),
        time: "02:15 م",
        total: 185,
        cashier: "المدير",
        shiftId: shift2Id,
        items: [
          {
            id: id("sitem"),
            productId: products[3].id,
            name: products[3].name,
            price: 55,
            quantity: 2,
            barcode: products[3].barcode,
            lineTotal: 110,
          },
          {
            id: id("sitem"),
            productId: products[9].id,
            name: products[9].name,
            price: 85,
            quantity: 1,
            barcode: products[9].barcode,
            lineTotal: 85,
          },
        ],
      },
      {
        id: id("sinv"),
        invoiceNumber: "SL-DEMO-004",
        date: fmt(lastWeek),
        time: "04:00 م",
        total: 215,
        cashier: "الكاشير",
        shiftId: null,
        items: [
          {
            id: id("sitem"),
            productId: products[2].id,
            name: products[2].name,
            price: 35,
            quantity: 1,
            barcode: products[2].barcode,
            lineTotal: 35,
          },
          {
            id: id("sitem"),
            productId: products[11].id,
            name: products[11].name,
            price: 30,
            quantity: 2,
            barcode: products[11].barcode,
            lineTotal: 60,
          },
        ],
      },
      {
        id: id("sinv"),
        invoiceNumber: "SL-DEMO-004",
        date: fmt(lastWeek),
        time: "04:00 م",
        total: 215,
        cashier: "الكاشير",
        items: [
          {
            id: id("sitem"),
            productId: products[4].id,
            name: products[4].name,
            price: 65,
            quantity: 2,
            barcode: products[4].barcode,
            lineTotal: 130,
          },
          {
            id: id("sitem"),
            productId: products[6].id,
            name: products[6].name,
            price: 25,
            quantity: 2,
            barcode: products[6].barcode,
            lineTotal: 50,
          },
          {
            id: id("sitem"),
            productId: products[10].id,
            name: products[10].name,
            price: 8,
            quantity: 1,
            barcode: products[10].barcode,
            lineTotal: 8,
          },
          {
            id: id("sitem"),
            productId: products[1].id,
            name: products[1].name,
            price: 45,
            quantity: 1,
            barcode: products[1].barcode,
            lineTotal: 45,
          },
        ],
      },
    ];
    const insertSaleWithShiftSource = db.prepare(
      "INSERT OR IGNORE INTO sale_invoices (id, invoice_number, date, time, total, cashier, shift_id, source, voided) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    const insertSaleItem = db.prepare(
      "INSERT OR IGNORE INTO sale_invoice_items (id, invoice_id, product_id, name, price, quantity, barcode, is_weighted, line_total) VALUES (?,?,?,?,?,?,?,0,?)",
    );
    for (const s of sales) {
      insertSaleWithShiftSource.run(
        s.id,
        s.invoiceNumber,
        s.date,
        s.time,
        s.total,
        s.cashier,
        s.shiftId ?? null,
        null,
        0,
      );
      for (const item of s.items) {
        insertSaleItem.run(
          item.id,
          s.id,
          item.productId,
          item.name,
          item.price,
          item.quantity,
          item.barcode,
          item.lineTotal,
        );
      }
    }
    console.log(`✔ Sale Invoices: ${sales.length} فاتورة مبيعات`);

    // ── Checkout payment records — money actually collected at time of sale ──
    // SL-DEMO-001: paid in full, cash, no debt
    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method, source, shift_id) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      sales[0].id,
      "sale",
      sales[0].total,
      sales[0].date,
      sales[0].time,
      "cash",
      "checkout",
      shift2Id,
    );
    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method, source, shift_id) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      sales[1].id,
      "sale",
      100,
      sales[1].date,
      sales[1].time,
      "cash",
      "checkout",
      shift2Id,
    );

    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method, source, shift_id) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      sales[3].id,
      "sale",
      sales[3].total,
      sales[3].date,
      sales[3].time,
      "cash",
      "checkout",
      null,
    );
    console.log("✔ Checkout payment records: 3 (خالص، جزئي، بدون)");
    // ── Purchase Invoices ─────────────────────────
    const pinv1Id = id("pinv");
    const pinv2Id = id("pinv");
    db.prepare(
      "INSERT OR IGNORE INTO purchase_invoices (id, invoice_number, supplier, date, time, total, status, paid_amount) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      pinv1Id,
      "PI-DEMO-001",
      "مصنع الخيوط المصري",
      fmt(lastWeek),
      "09:00 ص",
      2500,
      "paid",
      2500,
    );
    const pItems1 = [
      {
        name: "صوف ميرينو أبيض 100جم",
        qty: 50,
        unit: "piece",
        price: 30,
        cat: "خيوط صوف",
      },
      {
        name: "صوف أكريليك ملون 200جم",
        qty: 80,
        unit: "piece",
        price: 20,
        cat: "خيوط صوف",
      },
      {
        name: "صوف بيبي ناعم وردي",
        qty: 30,
        unit: "piece",
        price: 35,
        cat: "خيوط صوف",
      },
    ];
    for (const i of pItems1) {
      db.prepare(
        "INSERT OR IGNORE INTO purchase_invoice_items (id, invoice_id, product_name, barcode, quantity, unit, purchase_price, category) VALUES (?,?,?,?,?,?,?,?)",
      ).run(id("pitem"), pinv1Id, i.name, null, i.qty, i.unit, i.price, i.cat);
    }
    db.prepare(
      "INSERT OR IGNORE INTO purchase_invoices (id, invoice_number, supplier, date, time, total, status, paid_amount) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      pinv2Id,
      "PI-DEMO-002",
      "توريدات الحياكة",
      fmt(yesterday),
      "11:00 ص",
      1800,
      "partial",
      900,
    );
    const pItems2 = [
      {
        name: "قطن مرسرايز أبيض 50جم",
        qty: 60,
        unit: "piece",
        price: 15,
        cat: "خيوط قطن",
      },
      {
        name: "طقم إبر تريكو 7 مقاسات",
        qty: 10,
        unit: "piece",
        price: 60,
        cat: "إبر وأدوات",
      },
      {
        name: "خيط لوريكس ذهبي 25جم",
        qty: 40,
        unit: "piece",
        price: 18,
        cat: "خيوط مزخرفة",
      },
    ];
    for (const i of pItems2) {
      db.prepare(
        "INSERT OR IGNORE INTO purchase_invoice_items (id, invoice_id, product_name, barcode, quantity, unit, purchase_price, category) VALUES (?,?,?,?,?,?,?,?)",
      ).run(id("pitem"), pinv2Id, i.name, null, i.qty, i.unit, i.price, i.cat);
    }
    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      pinv2Id,
      "purchase",
      900,
      fmt(yesterday),
      "11:30 ص",
      "cash",
    );
    console.log("✔ Purchase Invoices: 2 فاتورة مشتريات");

    // ── Invoice due date (Phase C — for the unpaid remainder on PI-DEMO-002) ──
    db.prepare(
      "INSERT OR IGNORE INTO invoice_due_dates (id, invoice_id, due_date, created_at) VALUES (?,?,?,?)",
    ).run(
      id("due"),
      pinv2Id,
      fmt(new Date(today.getTime() + 20 * 86400000)),
      today.toISOString(),
    );
    console.log("✔ Invoice Due Dates: 1");

    // ── Customer Debts ────────────────────────────
    const debt1Id = id("debt");
    const debt2Id = id("debt");
    db.prepare(
      "INSERT OR IGNORE INTO customer_debts (id, customer_id, customer_name, invoice_id, invoice_number, total_amount, paid_amount, remaining_amount, created_date, last_updated, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      debt1Id,
      customers[0].id,
      customers[0].name,
      sales[1].id,
      "SL-DEMO-002",
      185,
      100,
      85,
      fmt(today),
      fmt(today),
      "دفعت نص المبلغ",
    );
    db.prepare(
      "UPDATE customers SET total_debt = total_debt + 85 WHERE id = ?",
    ).run(customers[0].id);
    // (checkout payment for debt1's invoice is now recorded above, as 'sale' —
    // no separate 'debt' row needed; the 85 remaining stays open for you to
    // test paying it off through the ديون العملاء UI)
    db.prepare(
      "INSERT OR IGNORE INTO customer_debts (id, customer_id, customer_name, invoice_id, invoice_number, total_amount, paid_amount, remaining_amount, created_date, last_updated, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      debt2Id,
      customers[1].id,
      customers[1].name,
      sales[2].id,
      "SL-DEMO-003",
      95,
      0,
      95,
      fmt(yesterday),
      fmt(yesterday),
      null,
    );
    db.prepare(
      "UPDATE customers SET total_debt = total_debt + 95 WHERE id = ?",
    ).run(customers[1].id);
    console.log("✔ Customer Debts: 2 دين");

    const sinv7Id = id("sinv");
    const debt3Id = id("debt");
    db.prepare(
      "INSERT OR IGNORE INTO sale_invoices (id, invoice_number, date, time, total, cashier) VALUES (?,?,?,?,?,?)",
    ).run(sinv7Id, "SL-DEMO-007", fmt(lastWeek), "12:00 م", 150, "الكاشير");
    db.prepare(
      "INSERT OR IGNORE INTO sale_invoice_items (id, invoice_id, product_id, name, price, quantity, barcode, is_weighted, line_total) VALUES (?,?,?,?,?,?,?,0,?)",
    ).run(
      id("sitem"),
      sinv7Id,
      products[3].id,
      products[3].name,
      55,
      2,
      products[3].barcode,
      110,
    );
    db.prepare(
      "INSERT OR IGNORE INTO sale_invoice_items (id, invoice_id, product_id, name, price, quantity, barcode, is_weighted, line_total) VALUES (?,?,?,?,?,?,?,0,?)",
    ).run(
      id("sitem"),
      sinv7Id,
      products[10].id,
      products[10].name,
      8,
      5,
      products[10].barcode,
      40,
    );
    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method, source, shift_id) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      sinv7Id,
      "sale",
      50,
      fmt(lastWeek),
      "12:00 م",
      "cash",
      "checkout",
      null,
    );
    db.prepare(
      "INSERT OR IGNORE INTO customer_debts (id, customer_id, customer_name, invoice_id, invoice_number, total_amount, paid_amount, remaining_amount, created_date, last_updated, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      debt3Id,
      customers[3].id,
      customers[3].name,
      sinv7Id,
      "SL-DEMO-007",
      150,
      50,
      100,
      fmt(lastWeek),
      fmt(lastWeek),
      "دفعت جزء واتفقنا على الباقي",
    );
    db.prepare(
      "UPDATE customers SET total_debt = total_debt + 100 WHERE id = ?",
    ).run(customers[3].id);
    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      sinv7Id,
      "sale",
      100,
      fmt(today),
      "11:00 ص",
      "vodafone",
      "سداد باقي الدين",
      "debt_settlement",
      shift2Id,
    );
    db.prepare(
      "UPDATE customer_debts SET paid_amount=150, remaining_amount=0, last_updated=? WHERE id=?",
    ).run(fmt(today), debt3Id);
    db.prepare(
      "UPDATE customers SET total_debt = MAX(0, total_debt - 100) WHERE id = ?",
    ).run(customers[3].id);
    console.log(
      "✔ SL-DEMO-007 — بيعت الأسبوع اللي فات، اتقفلت النهاردة (اختبار توقيت الإيراد)",
    );
    // ── Employees / salary history ─────────────────
    const twoMonthsAgo = fmt(new Date(today.getTime() - 60 * 86400000));
    const oneMonthAgo = fmt(new Date(today.getTime() - 30 * 86400000));
    db.prepare(
      "INSERT OR IGNORE INTO salary_history (id, user_id, amount, effective_from, created_at, notes) VALUES (?,?,?,?,?,?)",
    ).run(
      id("sal"),
      "user-staff-1",
      3000,
      twoMonthsAgo,
      twoMonthsAgo,
      "بداية التعيين",
    );
    db.prepare(
      "INSERT OR IGNORE INTO salary_history (id, user_id, amount, effective_from, created_at, notes) VALUES (?,?,?,?,?,?)",
    ).run(
      id("sal"),
      "user-staff-1",
      3500,
      oneMonthAgo,
      oneMonthAgo,
      "زيادة بعد شهر",
    );
    console.log("✔ Salary History: 2 سجل");

    // ── Expenses (uses the app's real default expense categories) ──
    const expCats = db.prepare("SELECT id, name FROM expense_categories").all();
    const catId = (name) => expCats.find((c) => c.name === name)?.id;
    const expenseSeed = [
      {
        cat: "إيجار",
        amount: 3500,
        date: fmt(today),
        desc: "إيجار المحل — الشهر الحالي",
      },
      {
        cat: "كهرباء",
        amount: 420,
        date: fmt(yesterday),
        desc: "فاتورة الكهرباء",
      },
      {
        cat: "إنترنت",
        amount: 250,
        date: fmt(lastWeek),
        desc: "اشتراك الإنترنت الشهري",
      },
      {
        cat: "صيانة وزيادات",
        amount: 180,
        date: fmt(yesterday),
        desc: "صيانة ماكينة الباركود",
      },
    ];
    let expenseCount = 0;
    for (const e of expenseSeed) {
      const cId = catId(e.cat);
      if (!cId) {
        console.warn(`⚠ تصنيف المصروفات "${e.cat}" مش موجود — اتخطى`);
        continue;
      }
      db.prepare(
        "INSERT OR IGNORE INTO expenses (id, category_id, amount, date, description, created_by, created_at) VALUES (?,?,?,?,?,?,?)",
      ).run(
        id("exp"),
        cId,
        e.amount,
        e.date,
        e.desc,
        "admin",
        `${e.date}T12:00:00`,
      );
      expenseCount++;
    }
    console.log(`✔ Expenses: ${expenseCount} مصروف`);

    // ── Alerts ──────────────────────────────────────
    db.prepare(
      "INSERT OR IGNORE INTO alerts (id, type, ref_id, message, is_read, due_date, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id("alert"),
      "low_stock",
      products[7].id,
      `المخزون منخفض: ${products[7].name} — باقي 5 كجم فقط`,
      0,
      null,
      today.toISOString(),
    );
    db.prepare(
      "INSERT OR IGNORE INTO alerts (id, type, ref_id, message, is_read, due_date, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id("alert"),
      "debt_due",
      debt2Id,
      `دين مستحق قريب — ${customers[1].name}`,
      0,
      fmt(new Date(today.getTime() + 3 * 86400000)),
      today.toISOString(),
    );
    console.log("✔ Alerts: 2");

    // ── Drivers ───────────────────────────────────
    const driver1Id = id("driver");
    const driver2Id = id("driver");
    db.prepare(
      "INSERT OR IGNORE INTO drivers (id, name, phone, is_active, created_at, driver_type, pays_next_day) VALUES (?,?,?,?,?,?,?)",
    ).run(
      driver1Id,
      "كريم السائق",
      "01511122233",
      1,
      twoMonthsAgo,
      "driver",
      0,
    );
    db.prepare(
      "INSERT OR IGNORE INTO drivers (id, name, phone, is_active, created_at, driver_type, pays_next_day) VALUES (?,?,?,?,?,?,?)",
    ).run(
      driver2Id,
      "محمود المندوب",
      "01611122244",
      1,
      oneMonthAgo,
      "driver",
      1,
    );
    console.log("✔ Drivers: 2");

    // ── Online customer addresses / phones ─────────
    db.prepare(
      "INSERT OR IGNORE INTO online_customers_addresses (id, customer_id, label, region, address_text, is_default, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id("addr"),
      customers[0].id,
      "المنزل",
      "المنصورة",
      "شارع الجمهورية، بجوار صيدلية النور",
      1,
      today.toISOString(),
    );
    db.prepare(
      "INSERT OR IGNORE INTO online_customers_addresses (id, customer_id, label, region, address_text, is_default, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id("addr"),
      customers[1].id,
      "الشغل",
      "القاهرة",
      "مدينة نصر، شارع مكرم عبيد",
      1,
      today.toISOString(),
    );
    db.prepare(
      "INSERT OR IGNORE INTO online_customers_addresses (id, customer_id, label, region, address_text, is_default, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id("addr"),
      customers[3].id,
      "المنزل",
      "طنطا",
      "شارع سعيد، عمارة 12",
      1,
      today.toISOString(),
    );

    db.prepare(
      "INSERT OR IGNORE INTO online_customer_phones (id, customer_id, phone, label, created_at) VALUES (?,?,?,?,?)",
    ).run(
      id("phone"),
      customers[0].id,
      customers[0].phone,
      "الأساسي",
      today.toISOString(),
    );
    db.prepare(
      "INSERT OR IGNORE INTO online_customer_phones (id, customer_id, phone, label, created_at) VALUES (?,?,?,?,?)",
    ).run(
      id("phone"),
      customers[1].id,
      customers[1].phone,
      "الأساسي",
      today.toISOString(),
    );
    db.prepare(
      "INSERT OR IGNORE INTO online_customer_phones (id, customer_id, phone, label, created_at) VALUES (?,?,?,?,?)",
    ).run(
      id("phone"),
      customers[3].id,
      customers[3].phone,
      "الأساسي",
      today.toISOString(),
    );
    console.log("✔ Online addresses/phones: 3 عنوان + 3 رقم");

    // ── Online Orders (full status coverage) ───────
    const insertOnlineOrder = db.prepare(`
      INSERT OR IGNORE INTO online_orders
      (id, order_number, daily_sequence, order_date, customer_id, customer_name, customer_phone,
       address_id, address_text, address_label, source, status, payment_method, payment_status,
       products_total, delivery_fee, grand_total, prepaid_amount, remaining_amount,
       driver_id, pre_selected_driver_id, requested_datetime, notes, created_at,
       dispatched_at, completed_at, created_by, sale_invoice_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertOnlineOrderItem = db.prepare(
      "INSERT OR IGNORE INTO online_order_items (id, order_id, product_id, name, price, quantity, line_total) VALUES (?,?,?,?,?,?,?)",
    );

    // Order A — NEW (whatsapp, cod)
    const orderAId = id("order");
    const aProductsTotal = 90; // 2x product[0]
    const aDeliveryFee = 20;
    const aBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.COD,
      aProductsTotal,
      aDeliveryFee,
    );
    insertOnlineOrder.run(
      orderAId,
      "ORD-DEMO-001",
      1,
      fmt(today),
      customers[3].id,
      customers[3].name,
      customers[3].phone,
      null,
      "شارع سعيد، عمارة 12",
      "المنزل",
      ORDER_SOURCE.WHATSAPP,
      ORDER_STATUS.NEW,
      ORDER_PAYMENT_METHOD.COD,
      ORDER_PAYMENT_STATUS.UNPAID,
      aProductsTotal,
      aDeliveryFee,
      aBreak.grandTotal,
      aBreak.prepaidAmount,
      aBreak.remainingAmount,
      null,
      null,
      `${fmt(today)}T18:00:00`,
      null,
      today.toISOString(),
      null,
      null,
      "admin",
      null,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderAId,
      products[0].id,
      products[0].name,
      45,
      2,
      90,
    );
    console.log("✔ Online Order A — جديد (NEW)");

    // Order B — PREPARING (facebook, split)
    const orderBId = id("order");
    const bProductsTotal = 37; // product[5] + product[8]
    const bDeliveryFee = 15;
    const bBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.SPLIT,
      bProductsTotal,
      bDeliveryFee,
    );
    insertOnlineOrder.run(
      orderBId,
      "ORD-DEMO-002",
      2,
      fmt(today),
      customers[0].id,
      customers[0].name,
      customers[0].phone,
      null,
      "شارع الجمهورية، بجوار صيدلية النور",
      "المنزل",
      ORDER_SOURCE.FACEBOOK,
      ORDER_STATUS.PREPARING,
      ORDER_PAYMENT_METHOD.SPLIT,
      ORDER_PAYMENT_STATUS.PARTIAL,
      bProductsTotal,
      bDeliveryFee,
      bBreak.grandTotal,
      bBreak.prepaidAmount,
      bBreak.remainingAmount,
      null,
      null,
      `${fmt(today)}T19:00:00`,
      null,
      today.toISOString(),
      null,
      null,
      "admin",
      null,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderBId,
      products[5].id,
      products[5].name,
      25,
      1,
      25,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderBId,
      products[8].id,
      products[8].name,
      12,
      1,
      12,
    );
    console.log("✔ Online Order B — قيد التجهيز (PREPARING)");

    // Order C — READY (phone, paid_online), driver pre-selected
    const orderCId = id("order");
    const cProductsTotal = 60; // product[11] + product[12]
    const cDeliveryFee = 20;
    const cBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.PAID_ONLINE,
      cProductsTotal,
      cDeliveryFee,
    );
    insertOnlineOrder.run(
      orderCId,
      "ORD-DEMO-003",
      3,
      fmt(today),
      customers[1].id,
      customers[1].name,
      customers[1].phone,
      null,
      "مدينة نصر، شارع مكرم عبيد",
      "الشغل",
      ORDER_SOURCE.PHONE,
      ORDER_STATUS.READY,
      ORDER_PAYMENT_METHOD.PAID_ONLINE,
      ORDER_PAYMENT_STATUS.PAID,
      cProductsTotal,
      cDeliveryFee,
      cBreak.grandTotal,
      cBreak.prepaidAmount,
      cBreak.remainingAmount,
      null,
      driver1Id,
      `${fmt(today)}T20:00:00`,
      "العميلة فضّلت التوصيل بالليل",
      today.toISOString(),
      null,
      null,
      "admin",
      null,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderCId,
      products[11].id,
      products[11].name,
      30,
      1,
      30,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderCId,
      products[12].id,
      products[12].name,
      30,
      1,
      30,
    );
    console.log("✔ Online Order C — جاهز (READY)");

    // Order D — DISPATCHED + delivered (instagram, paid_online), invoice created at dispatch
    const orderDId = id("order");
    const dInvoiceId = id("sinv");
    const dProductsTotal = 195; // 2x product[3] + 1x product[9]
    const dDeliveryFee = 25;
    const dBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.PAID_ONLINE,
      dProductsTotal,
      dDeliveryFee,
    );
    insertSaleWithShiftSource.run(
      dInvoiceId,
      "SL-DEMO-005",
      fmt(today),
      "05:00 م",
      dProductsTotal,
      "الكاشير",
      shift2Id,
      "online",
      0,
    );
    insertSaleItem.run(
      id("sitem"),
      dInvoiceId,
      products[3].id,
      products[3].name,
      55,
      2,
      products[3].barcode,
      110,
    );
    insertSaleItem.run(
      id("sitem"),
      dInvoiceId,
      products[9].id,
      products[9].name,
      85,
      1,
      products[9].barcode,
      85,
    );

    // Checkout payment for Order D — collected online (paid_online), same shift as dispatch
    db.prepare(
      "INSERT OR IGNORE INTO payment_records (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id("pay"),
      dInvoiceId,
      "sale",
      dProductsTotal,
      fmt(today),
      "05:00 م",
      "vodafone",
      "مدفوع أونلاين — ORD-DEMO-004",
      "checkout",
      shift2Id,
    );

    // Deduct stock for Order D (mirrors real dispatch() stock deduction —
    // Order F's stock stays untouched since dispatch-then-notReceived nets to zero)
    db.prepare("UPDATE products SET stock = stock - ? WHERE id=?").run(
      2,
      products[3].id,
    );
    db.prepare("UPDATE products SET stock = stock - ? WHERE id=?").run(
      1,
      products[9].id,
    );

    insertOnlineOrder.run(
      orderDId,
      "ORD-DEMO-004",
      4,
      fmt(today),
      customers[0].id,
      customers[0].name,
      customers[0].phone,
      null,
      "شارع الجمهورية، بجوار صيدلية النور",
      "المنزل",
      ORDER_SOURCE.INSTAGRAM,
      ORDER_STATUS.DISPATCHED,
      ORDER_PAYMENT_METHOD.PAID_ONLINE,
      ORDER_PAYMENT_STATUS.PAID,
      dProductsTotal,
      dDeliveryFee,
      dBreak.grandTotal,
      dBreak.prepaidAmount,
      dBreak.remainingAmount,
      driver1Id,
      driver1Id,
      `${fmt(today)}T13:00:00`,
      null,
      `${fmt(today)}T13:05:00`,
      `${fmt(today)}T14:00:00`,
      `${fmt(today)}T15:30:00`,
      "admin",
      dInvoiceId,
    );
    console.log("✔ Online Order D — تم التوصيل (DISPATCHED, delivered)");

    db.prepare(
      "UPDATE customers SET total_online_orders = total_online_orders + 1, successful_online_orders = successful_online_orders + 1 WHERE id = ?",
    ).run(customers[0].id);

    // Driver 1 settlement — shop owes driver the delivery fee (customer prepaid online)
    const settle1Id = id("settle");
    const settle2Id = id("settle");
    db.prepare(
      "INSERT OR IGNORE INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      settle1Id,
      driver1Id,
      orderDId,
      SETTLEMENT_TYPE.SHOP_OWES_DRIVER,
      dDeliveryFee,
      -dDeliveryFee,
      fmt(today),
      "15:30:00",
      "رسوم توصيل أونلاين مدفوعة مقدماً",
    );
    db.prepare(
      "INSERT OR IGNORE INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      settle2Id,
      driver1Id,
      orderDId,
      SETTLEMENT_TYPE.MANUAL_ADJUSTMENT,
      dDeliveryFee,
      0,
      fmt(today),
      "18:00:00",
      "تسوية آخر اليوم مع السائق",
    );
    console.log("✔ Driver Settlements: 2 (رصيد سائق 1)");

    // Order E — CANCELLED (other source, cod), before dispatch
    const orderEId = id("order");
    const eProductsTotal = 35;
    const eDeliveryFee = 15;
    const eBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.COD,
      eProductsTotal,
      eDeliveryFee,
    );
    insertOnlineOrder.run(
      orderEId,
      "ORD-DEMO-005",
      1,
      fmt(yesterday),
      customers[2].id,
      customers[2].name,
      customers[2].phone,
      null,
      "الإسكندرية",
      null,
      ORDER_SOURCE.OTHER,
      ORDER_STATUS.CANCELLED,
      ORDER_PAYMENT_METHOD.COD,
      ORDER_PAYMENT_STATUS.UNPAID,
      eProductsTotal,
      eDeliveryFee,
      eBreak.grandTotal,
      eBreak.prepaidAmount,
      eBreak.remainingAmount,
      null,
      null,
      `${fmt(yesterday)}T16:00:00`,
      "العميلة اتصلت وألغت الطلب",
      yesterday.toISOString(),
      null,
      null,
      "admin",
      null,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderEId,
      products[2].id,
      products[2].name,
      35,
      1,
      35,
    );
    db.prepare(
      "UPDATE customers SET total_online_orders = total_online_orders + 1, cancelled_online_orders = cancelled_online_orders + 1 WHERE id = ?",
    ).run(customers[2].id);
    console.log("✔ Online Order E — ملغي (CANCELLED)");

    // Order F — NOT_RECEIVED (whatsapp, cod), invoice created then soft-voided
    const orderFId = id("order");
    const fInvoiceId = id("sinv");
    const fProductsTotal = 33; // product[6] + product[10]
    const fDeliveryFee = 20;
    const fBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.COD,
      fProductsTotal,
      fDeliveryFee,
    );
    insertSaleWithShiftSource.run(
      fInvoiceId,
      "SL-DEMO-006",
      fmt(yesterday),
      "01:00 م",
      fProductsTotal,
      "الكاشير",
      shift1Id,
      "online",
      1,
    );
    insertSaleItem.run(
      id("sitem"),
      fInvoiceId,
      products[6].id,
      products[6].name,
      25,
      1,
      products[6].barcode,
      25,
    );
    insertSaleItem.run(
      id("sitem"),
      fInvoiceId,
      products[10].id,
      products[10].name,
      8,
      1,
      products[10].barcode,
      8,
    );
    insertOnlineOrder.run(
      orderFId,
      "ORD-DEMO-006",
      2,
      fmt(yesterday),
      customers[1].id,
      customers[1].name,
      customers[1].phone,
      null,
      "مدينة نصر، شارع مكرم عبيد",
      "الشغل",
      ORDER_SOURCE.WHATSAPP,
      ORDER_STATUS.NOT_RECEIVED,
      ORDER_PAYMENT_METHOD.COD,
      ORDER_PAYMENT_STATUS.UNPAID,
      fProductsTotal,
      fDeliveryFee,
      fBreak.grandTotal,
      fBreak.prepaidAmount,
      fBreak.remainingAmount,
      driver2Id,
      driver2Id,
      `${fmt(yesterday)}T12:00:00`,
      "العميلة رفضت الاستلام",
      yesterday.toISOString(),
      `${fmt(yesterday)}T12:30:00`,
      `${fmt(yesterday)}T13:30:00`,
      "admin",
      fInvoiceId,
    );
    db.prepare(
      "UPDATE customers SET total_online_orders = total_online_orders + 1, not_received_online_orders = not_received_online_orders + 1 WHERE id = ?",
    ).run(customers[1].id);
    console.log(
      "✔ Online Order F — لم يتم الاستلام (NOT_RECEIVED, فاتورة ملغاة)",
    );

    // Driver 2 — full realistic ledger: opening custody, order F custody + reversal, closing payment
    const settle3Id = id("settle");
    const settle4Id = id("settle");
    const settle5Id = id("settle");
    const settle6Id = id("settle");
    db.prepare(
      "INSERT OR IGNORE INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      settle3Id,
      driver2Id,
      null,
      SETTLEMENT_TYPE.CUSTODY_CHARGE,
      100,
      100,
      fmt(yesterday),
      "10:00:00",
      "عهدة توصيل أول اليوم",
    );
    db.prepare(
      "INSERT OR IGNORE INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      settle5Id,
      driver2Id,
      orderFId,
      SETTLEMENT_TYPE.CUSTODY_CHARGE,
      fProductsTotal,
      100 + fProductsTotal,
      fmt(yesterday),
      "12:30:00",
      `عهدة الطلب ${fBreak.orderNumber ?? "ORD-DEMO-006"}`,
    );
    db.prepare(
      "INSERT OR IGNORE INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      settle6Id,
      driver2Id,
      orderFId,
      SETTLEMENT_TYPE.MANUAL_ADJUSTMENT,
      -fProductsTotal,
      100,
      fmt(yesterday),
      "13:30:00",
      "عكس عهدة الطلب ORD-DEMO-006 — لم يُستلم",
    );
    db.prepare(
      "INSERT OR IGNORE INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      settle4Id,
      driver2Id,
      null,
      SETTLEMENT_TYPE.DRIVER_PAYMENT,
      100,
      0,
      fmt(yesterday),
      "17:00:00",
      "تسليم العهدة آخر اليوم",
    );
    console.log(
      "✔ Driver Settlements: 4 إضافي (رصيد سائق 2، شامل عهدة الطلب F)",
    );

    // Order G — PREPARING — demonstrates the stock-hold feature.
    // "قطن ماكرامي" (products[7]) has only 5 kg in stock; this order holds 3 kg,
    // leaving only 2 kg available for any other new/preparing/ready order until
    // this one is dispatched, cancelled, or marked not received.
    const orderGId = id("order");
    const gProductsTotal = 54; // 3kg x products[7] @ 18/kg
    const gDeliveryFee = 15;
    const gBreak = computePaymentBreakdown(
      ORDER_PAYMENT_METHOD.COD,
      gProductsTotal,
      gDeliveryFee,
    );
    insertOnlineOrder.run(
      orderGId,
      "ORD-DEMO-007",
      5,
      fmt(today),
      customers[2].id,
      customers[2].name,
      customers[2].phone,
      null,
      "الإسكندرية",
      null,
      ORDER_SOURCE.PHONE,
      ORDER_STATUS.PREPARING,
      ORDER_PAYMENT_METHOD.COD,
      ORDER_PAYMENT_STATUS.UNPAID,
      gProductsTotal,
      gDeliveryFee,
      gBreak.grandTotal,
      gBreak.prepaidAmount,
      gBreak.remainingAmount,
      null,
      null,
      `${fmt(today)}T21:00:00`,
      "طلب تجريبي لاختبار حجز المخزون — يحجز 3 كجم من أصل 5",
      today.toISOString(),
      null,
      null,
      "admin",
      null,
    );
    insertOnlineOrderItem.run(
      id("oitem"),
      orderGId,
      products[7].id,
      products[7].name,
      18,
      3,
      54,
    );
    console.log(
      "✔ Online Order G — جاري التجهيز (PREPARING) — يحجز 3 كجم قطن ماكرامي، المتاح فعلياً: 2 كجم فقط",
    );
  });
  seedTx();
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ تم إضافة البيانات التجريبية بنجاح!
📦 Categories        : 4
🧶 Products          : 13
👥 Customers          : 4
⏱  Shifts             : 2
🛒 Sales              : 6 فواتير (منها 2 أونلاين)
📥 Purchases          : 2 فواتير
💸 Debts              : 2
👔 Salary History     : 2
💵 Expenses           : 4
🔔 Alerts             : 2
🚚 Drivers            : 2
📬 Online Orders      : 7 (new / preparing x2 / ready / dispatched / cancelled / not_received)
💰 Driver Settlements : 6
🔒 Stock Hold Demo    : Order G holds 3/5 kg of قطن ماكرامي — try creating a new order >2kg for it, should fail
لمسح البيانات: node seed-demo.cjs --clear
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ── Entry Point ──────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--clear")) {
  clearDemo();
} else {
  seed();
}
