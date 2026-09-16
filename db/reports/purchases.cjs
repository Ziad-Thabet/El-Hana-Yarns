const { safeNumber, round } = require("../helpers/numbers.cjs");
const { buildDateFilter, sqlWhere } = require("../helpers/dateFilter.cjs");

/**
 * What was bought over a period, and what is still owed for it.
 *
 * Split out of reports.cjs. The query bodies are unchanged; what they used to
 * reach for in an enclosing scope now arrives in the shared context.
 */
function createPurchasesReport(ctx) {
  const {
    getDb,
    computePercentChange,
    getPreviousPeriod,
    getPaymentAnalytics,
    getPurchasesTrend,
  } = ctx;

  function generatePurchasesReport(from, to) {
    const db = getDb();
    const dateFilter = buildDateFilter(from, to, "p");
    const stats = db
      .prepare(
        `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(total - paid_amount),0) as unpaid FROM purchase_invoices p ${sqlWhere(dateFilter.clause)}`,
      )
      .get(...dateFilter.params);
    const supplierPerformance = db
      .prepare(
        `SELECT supplier, SUM(total) as spend, SUM(paid_amount) as paid, SUM(total - paid_amount) as unpaid, COUNT(*) as invoices
         FROM purchase_invoices p
         ${sqlWhere(dateFilter.clause)}
         GROUP BY supplier
         ORDER BY spend DESC`,
      )
      .all(...dateFilter.params)
      .map((row) => ({
        supplier: row.supplier,
        spend: safeNumber(row.spend),
        paid: safeNumber(row.paid),
        unpaid: safeNumber(row.unpaid),
        invoices: safeNumber(row.invoices),
      }));
    const trend = getPurchasesTrend(from, to);
    const comparison = (() => {
      if (!dateFilter.from || !dateFilter.to) return null;
      const previous = getPreviousPeriod(dateFilter.from, dateFilter.to);
      if (!previous) return null;
      const prevStats = db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM purchase_invoices WHERE date BETWEEN ? AND ?`,
        )
        .get(previous.previousStart, previous.previousEnd);
      return {
        currentPeriod: {
          from: dateFilter.from,
          to: dateFilter.to,
          spend: safeNumber(stats.total),
          invoices: safeNumber(stats.count),
        },
        previousPeriod: {
          from: previous.previousStart,
          to: previous.previousEnd,
          spend: safeNumber(prevStats.total),
          invoices: safeNumber(prevStats.count),
        },
        spendChange: computePercentChange(stats.total, prevStats.total),
        invoiceChange: computePercentChange(stats.count, prevStats.count),
      };
    })();
    return {
      type: "purchases",
      stats: {
        total: safeNumber(stats.total),
        count: safeNumber(stats.count),
        paid: safeNumber(stats.paid),
        unpaid: safeNumber(stats.unpaid),
      },
      analytics: {
        supplierPerformance,
        trend,
        comparison,
        paymentAnalytics: getPaymentAnalytics(),
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange: { from: dateFilter.from, to: dateFilter.to },
        recordCounts: {
          purchaseInvoices: safeNumber(stats.count),
          suppliers: supplierPerformance.length,
        },
      },
    };
  }

  return generatePurchasesReport;
}

module.exports = { createPurchasesReport };
