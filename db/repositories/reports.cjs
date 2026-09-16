const { createReportContext } = require("../reports/context.cjs");
const { createSalesReport } = require("../reports/sales.cjs");
const { createPurchasesReport } = require("../reports/purchases.cjs");
const { createInventoryReport } = require("../reports/inventory.cjs");
const { createDebtsReport } = require("../reports/debts.cjs");
const { createOnlineOrdersReport } = require("../reports/onlineOrders.cjs");
const { createDashboardReport } = require("../reports/dashboard.cjs");

/**
 * The reports, behind one door.
 *
 * Each report is its own module now; this builds the context they share and
 * maps a requested type to the one that answers it. A new report is a new file
 * and one line here, rather than another few hundred lines in the middle of
 * the last one.
 */
function createReportsDB(
  getDb,
  productsDB,
  debtsDB,
  getEmployeesDB,
  settingsDB = null,
) {
  const ctx = createReportContext({
    getDb,
    productsDB,
    debtsDB,
    getEmployeesDB,
    settingsDB,
  });

  const REPORTS = {
    sales: createSalesReport(ctx),
    purchases: createPurchasesReport(ctx),
    inventory: createInventoryReport(ctx),
    debts: createDebtsReport(ctx),
    online_orders: createOnlineOrdersReport(ctx),
    dashboard: createDashboardReport(ctx),
  };

  return {
    generate(reportData) {
      if (!reportData || typeof reportData !== "object") {
        throw new Error("Invalid report request");
      }
      const { type, from, to } = reportData;
      const report = REPORTS[type];
      // An unknown type has always answered with an empty payload rather than
      // throwing, and a screen somewhere may rely on that.
      if (!report) return { type, data: [] };
      return report(from, to);
    },
  };
}

module.exports = { createReportsDB };
