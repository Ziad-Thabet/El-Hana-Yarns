const { safeNumber, round } = require("../helpers/numbers.cjs");
const { buildDateFilter, sqlWhere } = require("../helpers/dateFilter.cjs");
const { stockUnitsSql } = require("../../shared/stockUnits.cjs");
const {
  formatIsoDate,
  normalizeIsoDate,
  addDaysToIsoDate,
} = require("../helpers/isoDates.cjs");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function withVoidedFilter(clause, alias = "s") {
  const voidedCond = `${alias}.voided = 0`;
  return clause ? `${clause} AND ${voidedCond}` : voidedCond;
}
const LOW_STOCK_THRESHOLD = 10;

/**
 * Everything the six reports share.
 *
 * reports.cjs was 1470 lines holding a sales report, a purchases report, an
 * inventory report, a debts report, an online-orders report and a dashboard,
 * with the twenty-odd helpers they have in common threaded through the middle
 * of them. The reports have nothing to do with each other; the helpers are the
 * only reason they were in one file.
 *
 * This is that middle, built once and handed to each report.
 */
function createReportContext({
  getDb,
  productsDB,
  debtsDB,
  getEmployeesDB,
  settingsDB = null,
}) {
  const lowStockAt = () =>
    settingsDB?.getNumber("inventory.lowStockThreshold") ??
    LOW_STOCK_THRESHOLD;
  function computePercentChange(current, previous) {
    const currentValue = safeNumber(current);
    const previousValue = safeNumber(previous);
    if (previousValue === 0) {
      return currentValue === 0 ? 0 : 100;
    }
    return round(
      ((currentValue - previousValue) / Math.abs(previousValue)) * 100,
    );
  }
  function getPreviousPeriod(fromIso, toIso) {
    if (!fromIso || !toIso) return null;
    const start = new Date(`${fromIso}T00:00:00`);
    const end = new Date(`${toIso}T00:00:00`);
    const dayCount = Math.round((end - start) / MS_PER_DAY) + 1;
    const previousEnd = addDaysToIsoDate(fromIso, -1);
    const previousStart = addDaysToIsoDate(previousEnd, -dayCount + 1);
    return { previousStart, previousEnd, dayCount };
  }
  function getCollectedRevenueBreakdown(fromIso, toIso) {
    const db = getDb();
    const filter = buildDateFilter(fromIso, toIso, "pr");
    const rows = db
      .prepare(
        `SELECT pr.source as source, COALESCE(SUM(pr.amount),0) as total
         FROM payment_records pr
         JOIN sale_invoices si ON si.id = pr.ref_id
         WHERE pr.ref_type='sale' AND si.voided = 0
         ${filter.clause ? "AND " + filter.clause : ""}
         GROUP BY pr.source`,
      )
      .all(...filter.params);
    let checkout = 0;
    let debtSettlement = 0;
    for (const row of rows) {
      if (row.source === "debt_settlement")
        debtSettlement += safeNumber(row.total);
      else checkout += safeNumber(row.total);
    }
    return {
      total: round(checkout + debtSettlement),
      checkout: round(checkout),
      debtSettlement: round(debtSettlement),
    };
  }
  /**
   * What came back over a period.
   *
   * Taken from `sale_returns` rather than from the refund payment records: a
   * return against an unpaid invoice reduces the customer's debt instead of
   * paying money out, and the sale is worth less either way. Collected-revenue
   * figures already net the cash refunds, so they must not subtract this as
   * well — this is for the booked figures, which are invoice totals.
   */
  function getReturnsTotal(fromIso, toIso) {
    const db = getDb();
    const filter = buildDateFilter(fromIso, toIso, "r");
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(r.total),0) as total, COUNT(*) as count
           FROM sale_returns r
           JOIN sale_invoices si ON si.id = r.invoice_id
          WHERE si.voided = 0
          ${filter.clause ? "AND " + filter.clause : ""}`,
      )
      .get(...filter.params);
    return { total: round(safeNumber(row?.total)), count: safeNumber(row?.count) };
  }

  /** The same, per day, for the trend line. */
  function getReturnsByDate(fromIso, toIso) {
    const db = getDb();
    const filter = buildDateFilter(fromIso, toIso, "r");
    const rows = db
      .prepare(
        `SELECT r.date as date, COALESCE(SUM(r.total),0) as total
           FROM sale_returns r
           JOIN sale_invoices si ON si.id = r.invoice_id
          WHERE si.voided = 0
          ${filter.clause ? "AND " + filter.clause : ""}
          GROUP BY r.date`,
      )
      .all(...filter.params);
    return new Map(rows.map((r) => [r.date, round(safeNumber(r.total))]));
  }

  function getCollectedRevenue(fromIso, toIso) {
    return getCollectedRevenueBreakdown(fromIso, toIso).total;
  }
  /**
   * Average purchase cost per unit, keyed every way a sale line might be
   * matched to it.
   *
   * Matching used to be by barcode, falling back to the product's name. That
   * fails whenever the two sides spell the item differently — a supplier's
   * barcode against the shop's own, a renamed product — and a failed match is
   * silent: the cost comes out as zero, so the margin reads as 100% and the
   * shop is told every sale is pure profit. Both tables carry `product_id`
   * now, which is the only key that cannot drift, so it is tried first.
   */
  /**
   * What came back, per product, over a period.
   *
   * Returned goods stopped being revenue the moment they came back, and a
   * restocked unit was never sold, so both the money and the quantity have to
   * come off the per-product figures — otherwise the headline reads net while
   * the product breakdown underneath it reads gross, and the two cannot be
   * reconciled by anyone looking at them.
   *
   * Cost is treated separately: a restocked unit is back on the shelf, so its
   * cost is not cost of goods sold. Damaged stock that was refunded without
   * restocking stays a cost, because the shop really did lose it.
   */
  function getReturnsByProduct(fromIso, toIso) {
    const db = getDb();
    const filter = buildDateFilter(fromIso, toIso, "r");
    const rows = db
      .prepare(
        `SELECT ri.product_id AS productId,
                ri.name AS name,
                COALESCE(SUM(ri.line_total), 0) AS value,
                COALESCE(SUM(ri.quantity), 0) AS quantity,
                COALESCE(SUM(CASE WHEN ri.restocked = 1 THEN ri.quantity ELSE 0 END), 0) AS restocked
           FROM sale_return_items ri
           JOIN sale_returns r ON r.id = ri.return_id
           JOIN sale_invoices si ON si.id = r.invoice_id
          WHERE si.voided = 0
          ${filter.clause ? "AND " + filter.clause : ""}
          GROUP BY COALESCE(ri.product_id, ri.name)`,
      )
      .all(...filter.params);
    const map = new Map();
    for (const row of rows) {
      const entry = {
        value: round(safeNumber(row.value)),
        quantity: safeNumber(row.quantity),
        restocked: safeNumber(row.restocked),
      };
      // Indexed both ways, because the aggregates below group by whichever of
      // the two they have.
      if (row.productId) map.set(row.productId, entry);
      if (row.name && !map.has(row.name)) map.set(row.name, entry);
    }
    return map;
  }

  /** The entry for a row, whichever key it carries. */
  function returnsFor(map, row) {
    for (const key of [row.productId, row.name, row.itemKey]) {
      if (key && map.has(key)) return map.get(key);
    }
    return { value: 0, quantity: 0, restocked: 0 };
  }

  function getPurchaseCostMap(asOfIso = null) {
    const db = getDb();
    // Costs are averaged over purchases made up to the end of the period being
    // reported. Without the bound, buying the same yarn cheaper next month
    // would quietly rewrite last month's margin, and a report run twice would
    // not agree with itself.
    const bound = normalizeIsoDate(asOfIso);
    const rows = db
      .prepare(
        `SELECT pii.product_id as productId,
                NULLIF(pii.barcode, '') as barcode,
                pii.product_name as name,
                SUM(pii.purchase_price * pii.quantity) as totalCost,
                SUM(pii.quantity) as totalQty
           FROM purchase_invoice_items pii
           JOIN purchase_invoices pi ON pi.id = pii.invoice_id
          ${bound ? "WHERE pi.date <= ?" : ""}
          GROUP BY COALESCE(pii.product_id, NULLIF(pii.barcode, ''), pii.product_name)`,
      )
      .all(...(bound ? [bound] : []));
    const map = {};
    for (const row of rows) {
      if (!row.totalQty) continue;
      const perUnit = row.totalCost / row.totalQty;
      for (const key of [row.productId, row.barcode, row.name]) {
        // First writer wins per key, so a product_id match is never displaced
        // by a name collision from a different supplier line.
        if (key && map[key] === undefined) map[key] = perUnit;
      }
    }
    return map;
  }

  /** The cost of one unit of a sold line, tried by id, then barcode, then name. */
  function costPerUnitFor(costMap, row) {
    for (const key of [row.productId, row.barcode, row.itemKey, row.name]) {
      if (key && costMap[key] !== undefined) return costMap[key];
    }
    return 0;
  }
  function getPaymentAnalytics() {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT method, ref_type, SUM(amount) as amount, COUNT(*) as count FROM payment_records GROUP BY ref_type, method",
      )
      .all();
    const methods = rows.reduce((acc, row) => {
      const method = row.method || "unknown";
      const refType = row.ref_type || "unknown";
      const amount = safeNumber(row.amount);
      const count = safeNumber(row.count);
      acc[method] ??= { method, amount: 0, count: 0, refTypes: {} };
      acc[method].amount += amount;
      acc[method].count += count;
      if (!acc[method].refTypes[refType]) {
        acc[method].refTypes[refType] = { amount: 0, count: 0 };
      }
      acc[method].refTypes[refType].amount += amount;
      acc[method].refTypes[refType].count += count;
      return acc;
    }, {});
    const total = Object.values(methods).reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    return {
      methods: Object.values(methods).map((item) => ({
        method: item.method,
        amount: item.amount,
        count: item.count,
        share: total ? round((item.amount / total) * 100) : 0,
        byRefType: item.refTypes,
      })),
      totalAmount: total,
    };
  }
  function enrichCustomerSegments(customers) {
    const today = formatIsoDate(new Date());
    const ninetyDaysAgo = addDaysToIsoDate(today, -90);
    const thirtyDaysAgo = addDaysToIsoDate(today, -30);
    const withDebt = customers
      .filter((c) => c.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount);
    return {
      highValue: withDebt.slice(0, 5),
      atRisk: customers.filter(
        (c) =>
          c.remainingAmount > 0 &&
          (!c.lastPaymentDate || c.lastPaymentDate <= ninetyDaysAgo),
      ),
      regular: customers.filter(
        (c) =>
          c.remainingAmount > 0 &&
          c.lastPaymentDate &&
          c.lastPaymentDate >= thirtyDaysAgo,
      ),
      inactive: customers.filter((c) => c.remainingAmount === 0),
    };
  }
  function getSalesTrend(from, to) {
    const db = getDb();
    const filter = buildDateFilter(from, to, "s");
    const rows = db
      .prepare(
        `SELECT s.date as date, SUM(s.total) as revenue, COUNT(*) as invoices
         FROM sale_invoices s
         ${sqlWhere(withVoidedFilter(filter.clause))}
         GROUP BY s.date
         ORDER BY s.date ASC`,
      )
      .all(...filter.params);
    // A day's takings are what was sold less what came back that day.
    const returned = getReturnsByDate(from, to);
    return rows.map((row) => {
      const back = returned.get(row.date) ?? 0;
      return {
        date: row.date,
        revenue: round(safeNumber(row.revenue) - back),
        grossRevenue: round(safeNumber(row.revenue)),
        returned: back,
        invoices: safeNumber(row.invoices),
      };
    });
  }
  function getCollectedRevenueTrend(from, to) {
    const db = getDb();
    const filter = buildDateFilter(from, to, "pr");
    const rows = db
      .prepare(
        `SELECT pr.date as date, SUM(pr.amount) as revenue
         FROM payment_records pr
         JOIN sale_invoices si ON si.id = pr.ref_id
         WHERE pr.ref_type='sale' AND si.voided = 0
         ${filter.clause ? "AND " + filter.clause : ""}
         GROUP BY pr.date
         ORDER BY pr.date ASC`,
      )
      .all(...filter.params);
    return rows.map((row) => ({
      date: row.date,
      revenue: safeNumber(row.revenue),
    }));
  }
  function getPurchasesTrend(from, to) {
    const db = getDb();
    const filter = buildDateFilter(from, to, "p");
    const rows = db
      .prepare(
        `SELECT p.date as date, SUM(p.total) as spend, COUNT(*) as invoices
         FROM purchase_invoices p
         ${sqlWhere(filter.clause)}
         GROUP BY p.date
         ORDER BY p.date ASC`,
      )
      .all(...filter.params);
    return rows.map((row) => ({
      date: row.date,
      spend: safeNumber(row.spend),
      invoices: safeNumber(row.invoices),
    }));
  }
  function getInventoryMovement(windowDays = 90) {
    const db = getDb();
    const windowDate = addDaysToIsoDate(formatIsoDate(new Date()), -windowDays);
    const rows = db
      .prepare(
        `SELECT COALESCE(si.product_id, '') as productId,
                COALESCE(si.barcode, si.name) as itemKey,
                si.name as name,
                COALESCE(p.category, 'غير مصنفة') as category,
                SUM(${stockUnitsSql("si")}) as quantity,
                SUM(si.line_total) as revenue
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         LEFT JOIN products p ON si.product_id = p.id
         WHERE s.date >= ? AND s.voided = 0
         GROUP BY itemKey
         ORDER BY quantity DESC`,
      )
      .all(windowDate);
    const zeroMovementProducts = db
      .prepare(
        `SELECT p.id as productId, p.name as name, COALESCE(p.category, 'غير مصنفة') as category, p.stock as stock
         FROM products p
         WHERE p.stock > 0
           AND p.id NOT IN (
             SELECT DISTINCT si.product_id
             FROM sale_invoice_items si
             JOIN sale_invoices s ON si.invoice_id = s.id
             WHERE s.date >= ? AND s.voided = 0 AND si.product_id IS NOT NULL
           )
         ORDER BY p.stock DESC
         LIMIT 10`,
      )
      .all(windowDate)
      .map((row) => ({
        productId: row.productId,
        name: row.name,
        category: row.category,
        quantity: 0,
        revenue: 0,
      }));
    return {
      fastMoving: rows.slice(0, 10).map((row) => ({
        productId: row.productId || null,
        name: row.name,
        category: row.category,
        quantity: safeNumber(row.quantity),
        revenue: safeNumber(row.revenue),
      })),
      slowMoving:
        zeroMovementProducts.length > 0
          ? zeroMovementProducts
          : rows
              .slice(-10)
              .reverse()
              .map((row) => ({
                productId: row.productId || null,
                name: row.name,
                category: row.category,
                quantity: safeNumber(row.quantity),
                revenue: safeNumber(row.revenue),
              })),
    };
  }

  return {
    getDb,
    productsDB,
    debtsDB,
    getEmployeesDB,
    settingsDB,
    lowStockAt, computePercentChange, getPreviousPeriod, getCollectedRevenueBreakdown, getReturnsTotal, getReturnsByDate, getCollectedRevenue, getReturnsByProduct, returnsFor, getPurchaseCostMap, costPerUnitFor, getPaymentAnalytics, enrichCustomerSegments, getSalesTrend, getCollectedRevenueTrend, getPurchasesTrend, getInventoryMovement,
  };
}

module.exports = { createReportContext, withVoidedFilter };
