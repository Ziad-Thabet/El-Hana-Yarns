const { safeNumber, round } = require("../helpers/numbers.cjs");
const { stockUnitsSql } = require("../../shared/stockUnits.cjs");

/**
 * The figures behind the end-of-day report.
 *
 * Everything is scoped to an explicit date range and nothing reads "now", so
 * re-exporting a past day always produces the same workbook. That is what makes
 * the export safe to run again after the fact — and it is why the caller must
 * pass a date rather than letting this decide what "today" means.
 *
 * These are aggregate queries deliberately: the list endpoints hydrate items,
 * payments and debts per invoice, which is the right shape for a screen and the
 * wrong shape for a report over a whole day.
 */
function createEndOfDayDB(getDb, settingsDB = null) {
  const lowStockAt = () =>
    settingsDB?.getNumber("inventory.lowStockThreshold") ?? 10;

  function shopIdentity() {
    return {
      name: settingsDB?.getString("shop.name") ?? "",
      tagline: settingsDB?.getString("shop.tagline") ?? "",
      address: settingsDB?.getString("shop.address") ?? "",
      phone: settingsDB?.getString("shop.phone") ?? "",
    };
  }

  /** Money actually collected, split by method, net of refunds. */
  function collectedByMethod(db, from, to) {
    return db
      .prepare(
        `SELECT pr.method AS method,
                COALESCE(SUM(pr.amount), 0) AS amount,
                COUNT(*) AS entries
           FROM payment_records pr
           JOIN sale_invoices si ON si.id = pr.ref_id
          WHERE pr.ref_type = 'sale'
            AND si.voided = 0
            AND pr.date BETWEEN ? AND ?
          GROUP BY pr.method
          ORDER BY amount DESC`,
      )
      .all(from, to)
      .map((r) => ({
        method: r.method ?? "unknown",
        amount: round(safeNumber(r.amount)),
        entries: safeNumber(r.entries),
      }));
  }

  function salesInvoices(db, from, to) {
    return db
      .prepare(
        `SELECT si.id, si.invoice_number, si.date, si.time, si.total,
                si.cashier, si.source, si.return_status,
                (SELECT COUNT(*) FROM sale_invoice_items i WHERE i.invoice_id = si.id) AS line_count,
                (SELECT COALESCE(SUM(p.amount), 0) FROM payment_records p
                  WHERE p.ref_id = si.id AND p.ref_type = 'sale') AS paid,
                (SELECT GROUP_CONCAT(DISTINCT p.method) FROM payment_records p
                  WHERE p.ref_id = si.id AND p.ref_type = 'sale' AND p.amount > 0) AS methods,
                (SELECT d.remaining_amount FROM customer_debts d
                  WHERE d.invoice_id = si.id LIMIT 1) AS remaining,
                (SELECT d.customer_name FROM customer_debts d
                  WHERE d.invoice_id = si.id LIMIT 1) AS customer
           FROM sale_invoices si
          WHERE si.voided = 0 AND si.date BETWEEN ? AND ?
          ORDER BY si.date, si.time`,
      )
      .all(from, to)
      .map((r) => ({
        invoiceNumber: r.invoice_number,
        date: r.date,
        time: r.time,
        cashier: r.cashier,
        source: r.source ?? "pos",
        lineCount: safeNumber(r.line_count),
        total: round(safeNumber(r.total)),
        paid: round(safeNumber(r.paid)),
        remaining: round(safeNumber(r.remaining)),
        methods: r.methods ?? "",
        customer: r.customer ?? "",
        returnStatus: r.return_status ?? "none",
      }));
  }

  /** One row per sold line — the sheet an owner actually pivots on. */
  function soldLines(db, from, to) {
    return db
      .prepare(
        `SELECT si.date AS date, si.time AS time, si.invoice_number AS invoice_number,
                it.name AS name,
                COALESCE(p.category, '') AS category,
                COALESCE(it.measure_unit, p.unit, 'piece') AS unit,
                ${stockUnitsSql("it")} AS quantity,
                it.price AS unit_price,
                it.line_total AS line_total,
                it.product_id AS product_id
           FROM sale_invoice_items it
           JOIN sale_invoices si ON si.id = it.invoice_id
           LEFT JOIN products p ON p.id = it.product_id
          WHERE si.voided = 0 AND si.date BETWEEN ? AND ?
          ORDER BY si.date, si.time`,
      )
      .all(from, to)
      .map((r) => ({
        date: r.date,
        time: r.time,
        invoiceNumber: r.invoice_number,
        name: r.name,
        category: r.category,
        unit: r.unit,
        quantity: round(safeNumber(r.quantity), 3),
        unitPrice: round(safeNumber(r.unit_price)),
        lineTotal: round(safeNumber(r.line_total)),
        productId: r.product_id,
      }));
  }

  /** Per product: what left the shelf, what came back, where it stands now. */
  function inventoryMovement(db, from, to) {
    return db
      .prepare(
        `SELECT p.id, p.name, COALESCE(p.category, '') AS category,
                COALESCE(p.unit, 'piece') AS unit, p.stock AS closing_stock,
                COALESCE((
                  SELECT SUM(${stockUnitsSql("it")}) FROM sale_invoice_items it
                   JOIN sale_invoices si ON si.id = it.invoice_id
                  WHERE it.product_id = p.id AND si.voided = 0
                    AND si.date BETWEEN ? AND ?
                ), 0) AS sold,
                COALESCE((
                  SELECT SUM(ri.quantity) FROM sale_return_items ri
                   JOIN sale_returns r ON r.id = ri.return_id
                  WHERE ri.product_id = p.id AND ri.restocked = 1
                    AND r.date BETWEEN ? AND ?
                ), 0) AS returned,
                COALESCE((
                  SELECT SUM(pi.quantity) FROM purchase_invoice_items pi
                   JOIN purchase_invoices inv ON inv.id = pi.invoice_id
                  WHERE pi.product_id = p.id AND inv.date BETWEEN ? AND ?
                ), 0) AS received
           FROM products p
          ORDER BY sold DESC, p.name`,
      )
      .all(from, to, from, to, from, to)
      .map((r) => {
        const sold = round(safeNumber(r.sold), 3);
        const returned = round(safeNumber(r.returned), 3);
        const received = round(safeNumber(r.received), 3);
        const closing = round(safeNumber(r.closing_stock), 3);
        return {
          name: r.name,
          category: r.category,
          unit: r.unit,
          sold,
          returned,
          received,
          closingStock: closing,
          // Derived, not stored: where the shelf must have started for these
          // movements to end where it did.
          openingStock: round(closing + sold - returned - received, 3),
        };
      });
  }

  function stockAlerts(db, from, to) {
    const threshold = lowStockAt();
    const days = Math.max(
      1,
      Math.round(
        (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000,
      ) + 1,
    );
    return db
      .prepare(
        `SELECT p.name, COALESCE(p.category, '') AS category,
                COALESCE(p.unit, 'piece') AS unit, p.stock,
                COALESCE((
                  SELECT SUM(${stockUnitsSql("it")}) FROM sale_invoice_items it
                   JOIN sale_invoices si ON si.id = it.invoice_id
                  WHERE it.product_id = p.id AND si.voided = 0
                    AND si.date BETWEEN ? AND ?
                ), 0) AS sold
           FROM products p
          WHERE p.stock < ?
          ORDER BY p.stock ASC`,
      )
      .all(from, to, threshold)
      .map((r) => {
        const sold = safeNumber(r.sold);
        const perDay = sold / days;
        return {
          name: r.name,
          category: r.category,
          unit: r.unit,
          stock: round(safeNumber(r.stock), 3),
          soldInPeriod: round(sold, 3),
          // Blank rather than Infinity when nothing sold: "no idea" is more
          // honest than a number that looks like a forecast.
          daysOfCover: perDay > 0 ? round(safeNumber(r.stock) / perDay, 1) : null,
          status: safeNumber(r.stock) <= 0 ? "out" : "low",
        };
      });
  }

  function onlineOrders(db, from, to) {
    return db
      .prepare(
        `SELECT o.order_number, o.order_date, o.status, o.payment_method,
                o.payment_status, o.products_total, o.delivery_fee,
                o.grand_total, o.prepaid_amount, o.remaining_amount,
                o.customer_name, COALESCE(d.name, '') AS driver
           FROM online_orders o
           LEFT JOIN drivers d ON d.id = o.driver_id
          WHERE o.order_date BETWEEN ? AND ?
          ORDER BY o.order_date, o.daily_sequence`,
      )
      .all(from, to)
      .map((r) => ({
        orderNumber: r.order_number,
        date: r.order_date,
        status: r.status,
        customer: r.customer_name,
        driver: r.driver,
        paymentMethod: r.payment_method,
        paymentStatus: r.payment_status,
        productsTotal: round(safeNumber(r.products_total)),
        deliveryFee: round(safeNumber(r.delivery_fee)),
        grandTotal: round(safeNumber(r.grand_total)),
        prepaid: round(safeNumber(r.prepaid_amount)),
        remaining: round(safeNumber(r.remaining_amount)),
      }));
  }

  function debts(db, from, to) {
    const created = db
      .prepare(
        `SELECT COALESCE(SUM(remaining_amount), 0) AS total, COUNT(*) AS count
           FROM customer_debts WHERE created_date BETWEEN ? AND ?`,
      )
      .get(from, to);
    const collected = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM payment_records
          WHERE source = 'debt_settlement' AND date BETWEEN ? AND ?`,
      )
      .get(from, to);
    // Aged by how long the balance has been outstanding, as of the report date.
    const aging = db
      .prepare(
        `SELECT customer_name, invoice_number, total_amount, paid_amount,
                remaining_amount, created_date,
                CAST(julianday(?) - julianday(created_date) AS INTEGER) AS age_days
           FROM customer_debts
          WHERE remaining_amount > 0 AND created_date <= ?
          ORDER BY age_days DESC`,
      )
      .all(to, to)
      .map((r) => {
        const age = safeNumber(r.age_days);
        const bucket = age <= 30 ? "0-30" : age <= 60 ? "31-60" : age <= 90 ? "61-90" : "90+";
        return {
          customer: r.customer_name,
          invoiceNumber: r.invoice_number,
          total: round(safeNumber(r.total_amount)),
          paid: round(safeNumber(r.paid_amount)),
          remaining: round(safeNumber(r.remaining_amount)),
          createdDate: r.created_date,
          ageDays: age,
          bucket,
        };
      });
    return {
      createdTotal: round(safeNumber(created?.total)),
      createdCount: safeNumber(created?.count),
      collectedTotal: round(safeNumber(collected?.total)),
      outstandingTotal: round(aging.reduce((s, d) => s + d.remaining, 0)),
      aging,
    };
  }

  function expenses(db, from, to) {
    return db
      .prepare(
        `SELECT e.date, COALESCE(c.name, '') AS category, e.amount,
                COALESCE(e.description, '') AS description,
                COALESCE(u.display_name, e.created_by) AS created_by
           FROM expenses e
           LEFT JOIN expense_categories c ON c.id = e.category_id
           LEFT JOIN users u ON u.id = e.created_by
          WHERE e.date BETWEEN ? AND ?
          ORDER BY e.date, c.name`,
      )
      .all(from, to)
      .map((r) => ({
        date: r.date,
        category: r.category,
        amount: round(safeNumber(r.amount)),
        description: r.description,
        createdBy: r.created_by,
      }));
  }

  function purchases(db, from, to) {
    return db
      .prepare(
        `SELECT invoice_number, supplier, date, total, paid_amount, status
           FROM purchase_invoices
          WHERE date BETWEEN ? AND ?
          ORDER BY date`,
      )
      .all(from, to)
      .map((r) => ({
        invoiceNumber: r.invoice_number,
        supplier: r.supplier,
        date: r.date,
        total: round(safeNumber(r.total)),
        paid: round(safeNumber(r.paid_amount)),
        outstanding: round(safeNumber(r.total) - safeNumber(r.paid_amount)),
        status: r.status,
      }));
  }

  function returns(db, from, to) {
    return db
      .prepare(
        `SELECT r.return_number, r.date, r.time, r.total, r.refunded_cash,
                r.debt_reduced, r.is_full, COALESCE(r.reason, '') AS reason,
                COALESCE(u.display_name, r.created_by) AS created_by,
                si.invoice_number AS invoice_number
           FROM sale_returns r
           LEFT JOIN users u ON u.id = r.created_by
           LEFT JOIN sale_invoices si ON si.id = r.invoice_id
          WHERE r.date BETWEEN ? AND ?
          ORDER BY r.date, r.time`,
      )
      .all(from, to)
      .map((r) => ({
        returnNumber: r.return_number,
        invoiceNumber: r.invoice_number ?? "",
        date: r.date,
        time: r.time,
        total: round(safeNumber(r.total)),
        refundedCash: round(safeNumber(r.refunded_cash)),
        debtReduced: round(safeNumber(r.debt_reduced)),
        isFull: r.is_full === 1,
        reason: r.reason,
        createdBy: r.created_by,
      }));
  }

  function shifts(db, from, to) {
    return db
      .prepare(
        `SELECT s.id, s.date, s.started_at, s.ended_at, s.status,
                s.total_cash, s.total_vodafone, s.total_instapay, s.total_invoices,
                COALESCE(u.display_name, s.user_id) AS user
           FROM shifts s
           LEFT JOIN users u ON u.id = s.user_id
          WHERE s.date BETWEEN ? AND ?
          ORDER BY s.date, s.started_at`,
      )
      .all(from, to)
      .map((r) => ({
        date: r.date,
        user: r.user,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        status: r.status,
        cash: round(safeNumber(r.total_cash)),
        vodafone: round(safeNumber(r.total_vodafone)),
        instapay: round(safeNumber(r.total_instapay)),
        invoices: safeNumber(r.total_invoices),
      }));
  }

  return {
    /**
     * @param {string} from YYYY-MM-DD
     * @param {string} to   YYYY-MM-DD (same as `from` for a single day)
     */
    build(from, to = from) {
      if (!from || !to) throw new Error("يجب تحديد تاريخ التقرير");
      const db = getDb();

      const invoices = salesInvoices(db, from, to);
      const lines = soldLines(db, from, to);
      const collected = collectedByMethod(db, from, to);
      const returnRows = returns(db, from, to);
      const expenseRows = expenses(db, from, to);
      const purchaseRows = purchases(db, from, to);
      const debtInfo = debts(db, from, to);
      const alerts = stockAlerts(db, from, to);

      const grossSales = round(invoices.reduce((s, i) => s + i.total, 0));
      const returnedTotal = round(returnRows.reduce((s, r) => s + r.total, 0));
      const collectedTotal = round(collected.reduce((s, c) => s + c.amount, 0));
      const expensesTotal = round(expenseRows.reduce((s, e) => s + e.amount, 0));
      const purchasesPaid = round(purchaseRows.reduce((s, p) => s + p.paid, 0));

      return {
        meta: {
          from,
          to,
          isSingleDay: from === to,
          generatedAt: new Date().toISOString(),
          shop: shopIdentity(),
          lowStockThreshold: lowStockAt(),
        },
        summary: {
          grossSales,
          netSales: round(grossSales - returnedTotal),
          returnedTotal,
          returnsCount: returnRows.length,
          collectedTotal,
          collectedByMethod: collected,
          invoiceCount: invoices.length,
          itemsSold: round(lines.reduce((s, l) => s + l.quantity, 0), 3),
          averageBasket: invoices.length
            ? round(grossSales / invoices.length)
            : 0,
          debtCreated: debtInfo.createdTotal,
          debtCollected: debtInfo.collectedTotal,
          debtOutstanding: debtInfo.outstandingTotal,
          expensesTotal,
          purchasesPaid,
          // Cash actually in hand, before expenses paid out of the drawer.
          netCashPosition: round(collectedTotal - expensesTotal - purchasesPaid),
          outOfStockCount: alerts.filter((a) => a.status === "out").length,
          lowStockCount: alerts.filter((a) => a.status === "low").length,
        },
        invoices,
        lines,
        returns: returnRows,
        inventory: inventoryMovement(db, from, to),
        alerts,
        onlineOrders: onlineOrders(db, from, to),
        debts: debtInfo,
        expenses: expenseRows,
        purchases: purchaseRows,
        shifts: shifts(db, from, to),
      };
    },
  };
}

module.exports = { createEndOfDayDB };
