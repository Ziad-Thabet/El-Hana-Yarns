const { safeNumber, round } = require("../helpers/numbers.cjs");
const { buildDateFilter, sqlWhere } = require("../helpers/dateFilter.cjs");
const { stockUnitsSql } = require("../../shared/stockUnits.cjs");
const {
  ORDER_PAYMENT_STATUS,
  SETTLEMENT_TYPE,
} = require("../../shared/onlineOrdersEnums.cjs");

/**
 * The single screen: takings, profit, stock and debt, with the period
 * before it for comparison.
 *
 * Split out of reports.cjs. The query bodies are unchanged; what they used to
 * reach for in an enclosing scope now arrives in the shared context.
 */
const { withVoidedFilter } = require("./context.cjs");

function createDashboardReport(ctx) {
  const {
    getDb,
    getEmployeesDB,
    lowStockAt,
    computePercentChange,
    getPreviousPeriod,
    getCollectedRevenueBreakdown,
    getReturnsTotal,
    getCollectedRevenue,
    getReturnsByProduct,
    returnsFor,
    getPurchaseCostMap,
    costPerUnitFor,
    getSalesTrend,
    getCollectedRevenueTrend,
    getPurchasesTrend,
  } = ctx;

  function generateDashboardReport(from, to) {
    const db = getDb();
    const dateFilter = buildDateFilter(from, to, "s");
    const salesStats = db
      .prepare(
        `SELECT COALESCE(SUM(total),0) as revenue, COUNT(*) as invoices
         FROM sale_invoices s
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}`,
      )
      .get(...dateFilter.params);
    // What the shop kept: invoice totals less what came back. Declared here
    // because the period comparison below reads it.
    const dashboardReturns = getReturnsTotal(from, to);
    const grossBookedRevenue = safeNumber(salesStats.revenue);
    const totalRevenue = round(grossBookedRevenue - dashboardReturns.total);
    const purchaseFilter = buildDateFilter(from, to, "p");
    const purchaseStats = db
      .prepare(
        `SELECT COALESCE(SUM(total),0) as spend, COALESCE(SUM(total - paid_amount),0) as unpaid
         FROM purchase_invoices p
         ${sqlWhere(purchaseFilter.clause)}`,
      )
      .get(...purchaseFilter.params);

    // ── Complete cash movement — every IN/OUT source in the system ──
    // NOTE: sale_invoices.total is booked as revenue at invoice-creation time
    // (POS checkout, or online-order dispatch) for the FULL sale amount —
    // including any portion left as customer debt, and including COD/partial
    // amounts a driver is still holding in custody. So anything that is just
    // the LATER collection of money already booked as revenue (debt payments,
    // a driver settling a custody balance) must NOT be added again here —
    // that would double-count the same جنيه twice.
    const expenseFilter = buildDateFilter(from, to, "e");
    const expensesRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount),0) as total
         FROM expenses e
         ${sqlWhere(expenseFilter.clause)}`,
      )
      .get(...expenseFilter.params);

    const purchasePaymentFilter = buildDateFilter(from, to, "pr");
    const purchasesPaidRow = db
      .prepare(
        `SELECT COALESCE(SUM(pr.amount),0) as total
         FROM payment_records pr
         WHERE pr.ref_type='purchase'
         ${purchasePaymentFilter.clause ? "AND " + purchasePaymentFilter.clause : ""}`,
      )
      .get(...purchasePaymentFilter.params);

    const collectedBreakdown = getCollectedRevenueBreakdown(from, to);
    const collectedRevenue = collectedBreakdown.total;

    const settlementFilter = buildDateFilter(from, to, "ds");
    const settlementRows = db
      .prepare(
        `SELECT type, amount FROM driver_settlements ds
         ${sqlWhere(settlementFilter.clause)}`,
      )
      .all(...settlementFilter.params);

    const driverPaymentRows = settlementRows.filter(
      (r) => r.type === SETTLEMENT_TYPE.DRIVER_PAYMENT,
    );
    const driverFeesPaid = driverPaymentRows
      .filter((r) => r.amount > 0)
      .reduce((sum, r) => sum + r.amount, 0);
    const driverCustodyCollected = driverPaymentRows
      .filter((r) => r.amount < 0)
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);

    const refundStats = db
      .prepare(
        `SELECT COALESCE(SUM(prepaid_amount),0) as total, COUNT(*) as count
         FROM online_orders WHERE payment_status = ?`,
      )
      .get(ORDER_PAYMENT_STATUS.REFUND_REQUIRED);

    let salariesTotal = 0;
    const staffRows = db.prepare("SELECT id FROM users").all();
    for (const staff of staffRows) {
      try {
        const summary = getEmployeesDB().getSalarySummary(staff.id, from, to);
        salariesTotal += summary.totalEarned;
      } catch {
        /* ignore */
      }
    }

    const expensesTotal = safeNumber(expensesRow?.total);
    const purchasesPaidActual = safeNumber(purchasesPaidRow?.total);
    const pendingRefunds = safeNumber(refundStats?.total);
    const pendingRefundsCount = safeNumber(refundStats?.count);
    const trueNetProfit = round(
      collectedRevenue -
        expensesTotal -
        salariesTotal -
        purchasesPaidActual -
        driverFeesPaid,
    );
    const debtStats = db
      .prepare(
        `SELECT COALESCE(SUM(remaining_amount),0) as totalDebt,
                COUNT(*) as debtCount
         FROM customer_debts
         WHERE remaining_amount > 0`,
      )
      .get();
    const inventoryStats = db
      .prepare(
        `SELECT COUNT(*) as productCount,
                COUNT(CASE WHEN stock <= 0 THEN 1 END) as outOfStock,
                COUNT(CASE WHEN stock > 0 AND stock < ? THEN 1 END) as lowStock
         FROM products`,
      )
      .get(lowStockAt());
    const comparison = (() => {
      if (!dateFilter.from || !dateFilter.to) return null;
      const previous = getPreviousPeriod(dateFilter.from, dateFilter.to);
      if (!previous) return null;
      const prevSales = db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as revenue, COUNT(*) as invoices
           FROM sale_invoices WHERE voided = 0 AND date BETWEEN ? AND ?`,
        )
        .get(previous.previousStart, previous.previousEnd);
      const prevBookedRevenue = round(
        safeNumber(prevSales.revenue) -
          getReturnsTotal(previous.previousStart, previous.previousEnd).total,
      );
      const prevPurchases = db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as spend
           FROM purchase_invoices WHERE date BETWEEN ? AND ?`,
        )
        .get(previous.previousStart, previous.previousEnd);
      const prevCollectedRevenue = getCollectedRevenue(
        previous.previousStart,
        previous.previousEnd,
      );
      return {
        revenueChange: computePercentChange(
          collectedRevenue,
          prevCollectedRevenue,
        ),
        bookedRevenueChange: computePercentChange(
          totalRevenue,
          prevBookedRevenue,
        ),
        invoiceChange: computePercentChange(
          salesStats.invoices,
          prevSales.invoices,
        ),
        spendChange: computePercentChange(
          purchaseStats.spend,
          prevPurchases.spend,
        ),
        previousPeriod: {
          from: previous.previousStart,
          to: previous.previousEnd,
          revenue: prevBookedRevenue,
          collectedRevenue: prevCollectedRevenue,
          invoices: safeNumber(prevSales.invoices),
          spend: safeNumber(prevPurchases.spend),
        },
      };
    })();
    const salesTrend = getSalesTrend(from, to);
    const collectedTrend = getCollectedRevenueTrend(from, to);
    const purchasesTrend = getPurchasesTrend(from, to);
    const trendMap = {};
    for (const row of salesTrend) {
      trendMap[row.date] ??= {
        date: row.date,
        revenue: 0,
        spend: 0,
        invoices: 0,
      };
      trendMap[row.date].invoices = row.invoices;
    }
    for (const row of collectedTrend) {
      trendMap[row.date] ??= {
        date: row.date,
        revenue: 0,
        spend: 0,
        invoices: 0,
      };
      trendMap[row.date].revenue = row.revenue;
    }
    for (const row of purchasesTrend) {
      trendMap[row.date] ??= {
        date: row.date,
        revenue: 0,
        spend: 0,
        invoices: 0,
      };
      trendMap[row.date].spend = row.spend;
    }
    const combinedTrend = Object.values(trendMap).sort((a, b) =>
      a.date < b.date ? -1 : 1,
    );
    const topProductReturns = getReturnsByProduct(from, to);
    const topProducts = db
      .prepare(
        `SELECT si.name as name,
                si.product_id as productId,
                SUM(si.line_total) as revenue,
                SUM(${stockUnitsSql("si")}) as sold
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY si.name
         ORDER BY revenue DESC
         LIMIT 5`,
      )

      .all(...dateFilter.params)
      .map((row) => {
        const back = returnsFor(topProductReturns, row);
        return {
          name: row.name,
          revenue: round(safeNumber(row.revenue) - back.value),
          grossRevenue: safeNumber(row.revenue),
          sold: round(safeNumber(row.sold) - back.quantity, 3),
          returned: back.value,
        };
      });
    const categoryBreakdown = db
      .prepare(
        `SELECT COALESCE(p.category, 'غير مصنفة') as category,
                SUM(si.line_total) as revenue
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         LEFT JOIN products p ON si.product_id = p.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY category
         ORDER BY revenue DESC
         LIMIT 6`,
      )

      .all(...dateFilter.params)
      .map((row) => ({
        category: row.category,
        revenue: safeNumber(row.revenue),
        share: totalRevenue
          ? round((safeNumber(row.revenue) / totalRevenue) * 100)
          : 0,
      }));

    const paymentMethodsFilter = buildDateFilter(from, to, "pr");
    const paymentMethods = db
      .prepare(
        `SELECT pr.method as method, SUM(pr.amount) as amount, COUNT(*) as count
         FROM payment_records pr
         JOIN sale_invoices si ON si.id = pr.ref_id
         WHERE pr.ref_type = 'sale' AND si.voided = 0
         ${paymentMethodsFilter.clause ? "AND " + paymentMethodsFilter.clause : ""}
         GROUP BY pr.method
         ORDER BY amount DESC`,
      )
      .all(...paymentMethodsFilter.params)

      .map((row) => ({
        method: row.method,
        amount: safeNumber(row.amount),
        count: safeNumber(row.count),
      }));
    const topDebtors = db
      .prepare(
        `SELECT c.name, COALESCE(SUM(d.remaining_amount),0) as remaining
         FROM customer_debts d
         JOIN customers c ON d.customer_id = c.id
         WHERE d.remaining_amount > 0
         GROUP BY d.customer_id
         ORDER BY remaining DESC
         LIMIT 5`,
      )
      .all()
      .map((row) => ({
        name: row.name,
        remaining: safeNumber(row.remaining),
      }));
    const purchaseCostMap = getPurchaseCostMap(to);
    const productRows = db
      .prepare(
        `SELECT COALESCE(si.barcode, si.name) as itemKey,
                si.product_id as productId,
                si.barcode as barcode,
                si.name as name,
                SUM(si.line_total) as revenue,
                SUM(${stockUnitsSql("si")}) as quantity
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY COALESCE(si.product_id, si.barcode, si.name)`,
      )
      .all(...dateFilter.params);
    const dashboardReturnsByProduct = getReturnsByProduct(from, to);
    const totalCost = productRows.reduce((sum, row) => {
      const costPerUnit = costPerUnitFor(purchaseCostMap, row);
      // A restocked unit is back on the shelf, so it is not a cost of goods
      // sold. Damaged stock refunded without restocking stays a cost.
      const back = returnsFor(dashboardReturnsByProduct, row);
      const soldForGood = Math.max(0, safeNumber(row.quantity) - back.restocked);
      return sum + costPerUnit * soldForGood;
    }, 0);
    const grossProfit = round(totalRevenue - totalCost);
    const grossMargin = totalRevenue
      ? round((grossProfit / totalRevenue) * 100)
      : 0;
    return {
      type: "dashboard",
      kpis: {
        revenue: collectedRevenue,
        bookedRevenue: totalRevenue,
        grossRevenue: grossBookedRevenue,
        returned: dashboardReturns.total,
        returnCount: dashboardReturns.count,
        invoices: safeNumber(salesStats.invoices),
        spend: safeNumber(purchaseStats.spend),
        unpaidPurchases: safeNumber(purchaseStats.unpaid),
        totalDebt: safeNumber(debtStats.totalDebt),
        debtCount: safeNumber(debtStats.debtCount),
        grossProfit,
        grossMargin,
        productCount: safeNumber(inventoryStats.productCount),
        outOfStock: safeNumber(inventoryStats.outOfStock),
        lowStock: safeNumber(inventoryStats.lowStock),
        averageTransactionValue: salesStats.invoices
          ? round(totalRevenue / salesStats.invoices)
          : 0,
        expensesTotal,
        salariesTotal: round(salariesTotal),
        purchasesPaidActual,
        trueNetProfit,
        collectedFromCheckout: collectedBreakdown.checkout,
        collectedFromDebtSettlement: collectedBreakdown.debtSettlement,
        driverCustodyCollected: round(driverCustodyCollected),
        driverFeesPaid: round(driverFeesPaid),
        pendingRefunds,
        pendingRefundsCount,
      },
      comparison,
      combinedTrend,
      topProducts,
      categoryBreakdown,
      paymentMethods,
      topDebtors,
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange: { from: dateFilter.from ?? null, to: dateFilter.to ?? null },
      },
    };
  }

  return generateDashboardReport;
}

module.exports = { createDashboardReport };
