const { safeNumber, round } = require("../helpers/numbers.cjs");
const {
  normalizeIsoDate,
} = require("../helpers/isoDates.cjs");

/**
 * Who owes what, and for how long they have owed it.
 *
 * Split out of reports.cjs. The query bodies are unchanged; what they used to
 * reach for in an enclosing scope now arrives in the shared context.
 */
function createDebtsReport(ctx) {
  const {
    getDb,
    debtsDB,
    getPaymentAnalytics,
    enrichCustomerSegments,
  } = ctx;

  function generateDebtsReport() {
    const db = getDb();
    const debts = debtsDB.getAll();
    const totalRemaining = round(
      debts.reduce((sum, debt) => sum + safeNumber(debt.remainingAmount), 0),
    );
    const byCustomer = debts.reduce((map, debt) => {
      const key = debt.customerName || "غير معروف";
      if (!map[key]) {
        map[key] = {
          customerName: key,
          remainingAmount: 0,
          totalAmount: 0,
          debtCount: 0,
        };
      }
      map[key].remainingAmount += safeNumber(debt.remainingAmount);
      map[key].totalAmount += safeNumber(debt.totalAmount);
      map[key].debtCount += 1;
      return map;
    }, {});
    const customerSummary = Object.values(byCustomer).sort(
      (a, b) => b.remainingAmount - a.remainingAmount,
    );
    const paymentAnalytics = getPaymentAnalytics();
    const segments = enrichCustomerSegments(
      db
        .prepare(
          `SELECT c.id, c.name, COALESCE(SUM(d.remaining_amount),0) as remainingAmount, c.last_payment_date as lastPaymentDate FROM customers c LEFT JOIN customer_debts d ON c.id = d.customer_id GROUP BY c.id`,
        )
        .all()
        .map((row) => ({
          id: row.id,
          name: row.name,
          remainingAmount: safeNumber(row.remainingAmount),
          lastPaymentDate: normalizeIsoDate(row.lastPaymentDate) || null,
        })),
    );
    return {
      type: "debts",
      debts,
      totalRemaining,
      analytics: {
        customerSummary,
        segments,
        paymentAnalytics,
        topDebtors: customerSummary.slice(0, 10),
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        debtCount: debts.length,
        totalRemaining,
      },
    };
  }

  return generateDebtsReport;
}

module.exports = { createDebtsReport };
