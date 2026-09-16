const { safeNumber, round } = require("../helpers/numbers.cjs");
const { buildDateFilter, sqlWhere } = require("../helpers/dateFilter.cjs");
const { stockUnitsSql } = require("../../shared/stockUnits.cjs");
const {
  normalizeIsoDate,
} = require("../helpers/isoDates.cjs");

/**
 * What was sold over a period: takings, top products, per-product
 * performance, customer behaviour and the comparison with the period before.
 *
 * Split out of reports.cjs. The query bodies are unchanged; what they used to
 * reach for in an enclosing scope now arrives in the shared context.
 */
const { withVoidedFilter } = require("./context.cjs");

function createSalesReport(ctx) {
  const {
    getDb,
    computePercentChange,
    getPreviousPeriod,
    getCollectedRevenueBreakdown,
    getReturnsTotal,
    getCollectedRevenue,
    getReturnsByProduct,
    returnsFor,
    getPurchaseCostMap,
    costPerUnitFor,
    getPaymentAnalytics,
    enrichCustomerSegments,
    getSalesTrend,
  } = ctx;

  function generateSalesReport(from, to) {
    const db = getDb();
    const dateFilter = buildDateFilter(from, to, "s");
    const stats = db
      .prepare(
        `SELECT COALESCE(SUM(s.total),0) as total, COUNT(*) as count
         FROM sale_invoices s
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}`,
      )
      .get(...dateFilter.params);
    const collectedBreakdown = getCollectedRevenueBreakdown(from, to);
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
         LIMIT 10`,
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
    const productRows = db
      .prepare(
        `SELECT COALESCE(si.barcode, si.name) as itemKey,
                si.product_id as productId,
                si.name as name,
                si.barcode as barcode,
                COALESCE(p.category, 'غير مصنفة') as category,
                SUM(si.line_total) as revenue,
                SUM(${stockUnitsSql("si")}) as quantity,
                AVG(si.price) as averagePrice,
                COUNT(DISTINCT si.invoice_id) as invoiceCount
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         LEFT JOIN products p ON si.product_id = p.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY COALESCE(si.product_id, si.barcode, si.name)
         ORDER BY revenue DESC`,
      )
      .all(...dateFilter.params);
    const purchaseCostMap = getPurchaseCostMap(to);
    const returnsByProduct = getReturnsByProduct(from, to);
    const productPerformance = productRows.map((row) => {
      const back = returnsFor(returnsByProduct, row);
      const costPerUnit = costPerUnitFor(purchaseCostMap, row);
      const netQuantity = round(safeNumber(row.quantity) - back.quantity, 3);
      const netRevenue = round(safeNumber(row.revenue) - back.value);
      // Restocked units are on the shelf again, so they are not a cost.
      const estimatedCost = round(
        costPerUnit * Math.max(0, safeNumber(row.quantity) - back.restocked),
      );
      const grossProfit = netRevenue - estimatedCost;
      return {
        name: row.name,
        barcode: row.barcode || null,
        category: row.category,
        revenue: netRevenue,
        grossRevenue: safeNumber(row.revenue),
        returned: back.value,
        quantity: netQuantity,
        soldQuantity: safeNumber(row.quantity),
        returnedQuantity: back.quantity,
        averagePrice: round(row.averagePrice),
        estimatedCost: round(estimatedCost),
        grossProfit: round(grossProfit),
        grossMargin: netRevenue ? round((grossProfit / netRevenue) * 100) : 0,
        invoiceCount: safeNumber(row.invoiceCount),
      };
    });
    const returnsInPeriod = getReturnsTotal(from, to);
    // Booked revenue is what the invoices say; a returned sale is not revenue,
    // so the figure the report leads with subtracts it. The gross is kept
    // alongside, because "sold 505, 127 came back" is the story, not "378".
    const grossRevenue = safeNumber(stats.total);
    const totalRevenue = round(grossRevenue - returnsInPeriod.total);
    const categoryPerformance = db
      .prepare(
        `SELECT COALESCE(p.category, 'غير مصنفة') as category,
                SUM(si.line_total) as revenue,
                SUM(${stockUnitsSql("si")}) as quantity,
                COUNT(DISTINCT si.invoice_id) as invoices
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         LEFT JOIN products p ON si.product_id = p.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY category
         ORDER BY revenue DESC`,
      )
      .all(...dateFilter.params)
      .map((row) => ({
        category: row.category,
        revenue: safeNumber(row.revenue),
        quantity: safeNumber(row.quantity),
        invoices: safeNumber(row.invoices),
        revenueShare: totalRevenue
          ? round((safeNumber(row.revenue) / totalRevenue) * 100)
          : 0,
      }));
    const lineItems = db
      .prepare(
        `SELECT SUM(quantity) as totalQuantity, COUNT(*) as lineCount
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}`,
      )
      .get(...dateFilter.params);
    const invoiceAnalytics = {
      averageTransactionValue: stats.count
        ? round(stats.total / stats.count)
        : 0,
      averageUnitsPerInvoice: stats.count
        ? round(lineItems.totalQuantity / stats.count)
        : 0,
      averageUnitPrice: lineItems.totalQuantity
        ? round(stats.total / lineItems.totalQuantity)
        : 0,
      totalQuantity: safeNumber(lineItems.totalQuantity),
      invoiceCount: safeNumber(stats.count),
    };
    const comparison = (() => {
      if (!dateFilter.from || !dateFilter.to) return null;
      const previous = getPreviousPeriod(dateFilter.from, dateFilter.to);
      if (!previous) return null;
      const prevStats = db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_invoices WHERE voided = 0 AND date BETWEEN ? AND ?`,
        )
        .get(previous.previousStart, previous.previousEnd);
      const prevReturns = getReturnsTotal(
        previous.previousStart,
        previous.previousEnd,
      );
      const prevBooked = round(safeNumber(prevStats.total) - prevReturns.total);
      const prevCollectedRevenue = getCollectedRevenue(
        previous.previousStart,
        previous.previousEnd,
      );
      return {
        currentPeriod: {
          from: dateFilter.from,
          to: dateFilter.to,
          revenue: collectedBreakdown.total,
          bookedRevenue: totalRevenue,
          grossRevenue,
          returned: returnsInPeriod.total,
          returnCount: returnsInPeriod.count,
          invoices: safeNumber(stats.count),
        },
        previousPeriod: {
          from: previous.previousStart,
          to: previous.previousEnd,
          revenue: prevCollectedRevenue,
          bookedRevenue: prevBooked,
          invoices: safeNumber(prevStats.count),
        },
        revenueChange: computePercentChange(
          collectedBreakdown.total,
          prevCollectedRevenue,
        ),
        bookedRevenueChange: computePercentChange(totalRevenue, prevBooked),
        invoiceChange: computePercentChange(stats.count, prevStats.count),
      };
    })();
    const paymentAnalytics = getPaymentAnalytics();
    const customerRows = db
      .prepare(
        `SELECT c.id, c.name, c.total_debt as totalDebt,
                c.last_payment_date as lastPaymentDate,
                COALESCE(SUM(d.remaining_amount),0) as remainingAmount,
                COUNT(d.id) as debtCount
         FROM customers c
         LEFT JOIN customer_debts d ON c.id = d.customer_id
         GROUP BY c.id
         ORDER BY remainingAmount DESC`,
      )
      .all()
      .map((row) => ({
        id: row.id,
        name: row.name,
        totalDebt: safeNumber(row.totalDebt),
        lastPaymentDate: normalizeIsoDate(row.lastPaymentDate) || null,
        remainingAmount: safeNumber(row.remainingAmount),
        debtCount: safeNumber(row.debtCount),
      }));
    return {
      type: "sales",
      stats: {
        total: collectedBreakdown.total,
        bookedRevenue: totalRevenue,
        grossRevenue,
        returned: returnsInPeriod.total,
        returnCount: returnsInPeriod.count,
        collectedFromCheckout: collectedBreakdown.checkout,
        collectedFromDebtSettlement: collectedBreakdown.debtSettlement,
        count: safeNumber(stats.count),
      },
      topProducts,
      analytics: {
        invoiceAnalytics,
        productPerformance,
        categoryPerformance,
        paymentAnalytics,
        customerAnalytics: {
          customers: customerRows,
          segments: enrichCustomerSegments(customerRows),
        },
        trend: getSalesTrend(from, to),
        comparisons: comparison,
        businessHealth: {
          revenueGrowth: comparison?.revenueChange ?? 0,
          transactionGrowth: comparison?.invoiceChange ?? 0,
          averageMargin: productPerformance.length
            ? round(
                productPerformance.reduce(
                  (sum, item) => sum + item.grossMargin,
                  0,
                ) / productPerformance.length,
              )
            : 0,
          topCategories: categoryPerformance.slice(0, 3),
        },
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange: { from: dateFilter.from, to: dateFilter.to },
        recordCounts: {
          saleInvoices: safeNumber(stats.count),
          saleItems: productRows.length,
        },
      },
    };
  }

  return generateSalesReport;
}

module.exports = { createSalesReport };
