const { safeNumber, round } = require("../helpers/numbers.cjs");
const { buildDateFilter, sqlWhere } = require("../helpers/dateFilter.cjs");
const {
  formatIsoDate,
  normalizeIsoDate,
  addDaysToIsoDate,
} = require("../helpers/isoDates.cjs");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const {
  ORDER_STATUS,
  ORDER_PAYMENT_STATUS,
  SETTLEMENT_TYPE,
} = require("../../shared/onlineOrdersEnums.cjs");
function withVoidedFilter(clause, alias = "s") {
  const voidedCond = `${alias}.voided = 0`;
  return clause ? `${clause} AND ${voidedCond}` : voidedCond;
}
function createReportsDB(getDb, productsDB, debtsDB, getEmployeesDB) {
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
  function getCollectedRevenue(fromIso, toIso) {
    return getCollectedRevenueBreakdown(fromIso, toIso).total;
  }
  function getPurchaseCostMap() {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT COALESCE(NULLIF(barcode, ''), product_name) as itemKey, SUM(purchase_price * quantity) as totalCost, SUM(quantity) as totalQty FROM purchase_invoice_items GROUP BY itemKey",
      )
      .all();
    return rows.reduce((map, row) => {
      const key = row.itemKey || "unknown";
      map[key] = row.totalQty ? row.totalCost / row.totalQty : 0;
      return map;
    }, {});
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
    return rows.map((row) => ({
      date: row.date,
      revenue: safeNumber(row.revenue),
      invoices: safeNumber(row.invoices),
    }));
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
                SUM(si.quantity) as quantity,
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
    const topProducts = db
      .prepare(
        `SELECT si.name as name, SUM(si.line_total) as revenue, SUM(si.quantity) as sold
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY si.name
         ORDER BY revenue DESC
         LIMIT 10`,
      )
      .all(...dateFilter.params)
      .map((row) => ({
        name: row.name,
        revenue: safeNumber(row.revenue),
        sold: safeNumber(row.sold),
      }));
    const productRows = db
      .prepare(
        `SELECT COALESCE(si.barcode, si.name) as itemKey,
                si.name as name,
                si.barcode as barcode,
                COALESCE(p.category, 'غير مصنفة') as category,
                SUM(si.line_total) as revenue,
                SUM(si.quantity) as quantity,
                AVG(si.price) as averagePrice,
                COUNT(DISTINCT si.invoice_id) as invoiceCount
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         LEFT JOIN products p ON si.product_id = p.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY itemKey
         ORDER BY revenue DESC`,
      )
      .all(...dateFilter.params);
    const purchaseCostMap = getPurchaseCostMap();
    const productPerformance = productRows.map((row) => {
      const costKey =
        row.barcode && purchaseCostMap[row.barcode] ? row.barcode : row.itemKey;
      const costPerUnit = purchaseCostMap[costKey] ?? 0;
      const estimatedCost = costPerUnit * safeNumber(row.quantity);
      const grossProfit = safeNumber(row.revenue) - estimatedCost;
      return {
        name: row.name,
        barcode: row.barcode || null,
        category: row.category,
        revenue: safeNumber(row.revenue),
        quantity: safeNumber(row.quantity),
        averagePrice: round(row.averagePrice),
        estimatedCost: round(estimatedCost),
        grossProfit: round(grossProfit),
        grossMargin: row.revenue ? round((grossProfit / row.revenue) * 100) : 0,
        invoiceCount: safeNumber(row.invoiceCount),
      };
    });
    const totalRevenue = safeNumber(stats.total);
    const categoryPerformance = db
      .prepare(
        `SELECT COALESCE(p.category, 'غير مصنفة') as category,
                SUM(si.line_total) as revenue,
                SUM(si.quantity) as quantity,
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
      const prevCollectedRevenue = getCollectedRevenue(
        previous.previousStart,
        previous.previousEnd,
      );
      return {
        currentPeriod: {
          from: dateFilter.from,
          to: dateFilter.to,
          revenue: collectedBreakdown.total,
          bookedRevenue: safeNumber(stats.total),
          invoices: safeNumber(stats.count),
        },
        previousPeriod: {
          from: previous.previousStart,
          to: previous.previousEnd,
          revenue: prevCollectedRevenue,
          bookedRevenue: safeNumber(prevStats.total),
          invoices: safeNumber(prevStats.count),
        },
        revenueChange: computePercentChange(
          collectedBreakdown.total,
          prevCollectedRevenue,
        ),
        bookedRevenueChange: computePercentChange(stats.total, prevStats.total),
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
        bookedRevenue: safeNumber(stats.total),
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
  function generateInventoryReport() {
    const products = productsDB.getAll();
    const lowStock = products.filter((p) => p.stock < 10);
    const outOfStock = products.filter((p) => p.stock <= 0);
    const purchaseCostMap = getPurchaseCostMap();
    const inventoryValueRetail = products.reduce(
      (sum, product) =>
        sum + safeNumber(product.stock) * safeNumber(product.price),
      0,
    );
    const inventoryValueCost = products.reduce((sum, product) => {
      const key = product.barcode || product.name;
      const unitCost = purchaseCostMap[key] ?? 0;
      return sum + safeNumber(product.stock) * unitCost;
    }, 0);
    const movement = getInventoryMovement(90);
    const overstockItems = products
      .filter((product) => product.stock > 0)
      .map((product) => ({
        ...product,
        estimatedCost: round(
          (purchaseCostMap[product.barcode || product.name] ?? 0) *
            safeNumber(product.stock),
        ),
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);
    return {
      type: "inventory",
      products,
      lowStock,
      analytics: {
        totals: {
          inventoryValueRetail: round(inventoryValueRetail),
          inventoryValueCost: round(inventoryValueCost),
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
          productCount: products.length,
        },
        movement,
        overstockItems,
        health: {
          lowStockRate: products.length
            ? round((lowStock.length / products.length) * 100)
            : 0,
          outOfStockRate: products.length
            ? round((outOfStock.length / products.length) * 100)
            : 0,
        },
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        productCount: products.length,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
      },
    };
  }
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
  function buildOrderDateWhere(from, to) {
    const fromIso = normalizeIsoDate(from);
    const toIso = normalizeIsoDate(to);
    const conditions = [];
    const params = [];
    if (fromIso) {
      conditions.push("order_date >= ?");
      params.push(fromIso);
    }
    if (toIso) {
      conditions.push("order_date <= ?");
      params.push(toIso);
    }
    return {
      clause: conditions.join(" AND "),
      params,
      from: fromIso,
      to: toIso,
    };
  }
  function generateOnlineOrdersReport(from, to) {
    const db = getDb();
    const dateFilter = buildOrderDateWhere(from, to);
    const where = dateFilter.clause ? `WHERE ${dateFilter.clause}` : "";

    const statusRows = db
      .prepare(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(products_total),0) as revenue
         FROM online_orders ${where}
         GROUP BY status`,
      )
      .all(...dateFilter.params);

    const statusBreakdown = statusRows.map((row) => ({
      status: row.status,
      count: safeNumber(row.count),
      revenue: safeNumber(row.revenue),
    }));

    const totalOrders = statusBreakdown.reduce((s, r) => s + r.count, 0);
    const dispatchedRow = statusBreakdown.find(
      (r) => r.status === ORDER_STATUS.DISPATCHED,
    );
    const cancelledRow = statusBreakdown.find(
      (r) => r.status === ORDER_STATUS.CANCELLED,
    );
    const notReceivedRow = statusBreakdown.find(
      (r) => r.status === ORDER_STATUS.NOT_RECEIVED,
    );

    const sourceRows = db
      .prepare(
        `SELECT source, COUNT(*) as count,
                COALESCE(SUM(CASE WHEN status = ? THEN products_total ELSE 0 END),0) as revenue
         FROM online_orders ${where}
         GROUP BY source
         ORDER BY count DESC`,
      )
      .all(ORDER_STATUS.DISPATCHED, ...dateFilter.params);
    const sourceBreakdown = sourceRows.map((row) => ({
      source: row.source,
      count: safeNumber(row.count),
      revenue: safeNumber(row.revenue),
    }));

    const paymentRows = db
      .prepare(
        `SELECT payment_method, COUNT(*) as count,
                COALESCE(SUM(CASE WHEN status = ? THEN products_total ELSE 0 END),0) as revenue
         FROM online_orders ${where}
         GROUP BY payment_method
         ORDER BY count DESC`,
      )
      .all(ORDER_STATUS.DISPATCHED, ...dateFilter.params);
    const paymentMethodBreakdown = paymentRows.map((row) => ({
      paymentMethod: row.payment_method,
      count: safeNumber(row.count),
      revenue: safeNumber(row.revenue),
    }));

    const topCustomerRows = db
      .prepare(
        `SELECT oo.customer_id as customerId, oo.customer_name as customerName,
                COUNT(*) as orderCount,
                COALESCE(SUM(CASE WHEN oo.status = ? THEN oo.products_total ELSE 0 END),0) as totalSpent,
                c.trust_level as trustLevel
         FROM online_orders oo
         LEFT JOIN customers c ON c.id = oo.customer_id
         ${where}
         GROUP BY oo.customer_id, oo.customer_name
         ORDER BY totalSpent DESC
         LIMIT 10`,
      )
      .all(ORDER_STATUS.DISPATCHED, ...dateFilter.params);
    const topCustomers = topCustomerRows.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      orderCount: safeNumber(row.orderCount),
      totalSpent: safeNumber(row.totalSpent),
      trustLevel: row.trustLevel ?? null,
    }));

    const driverDateClause = dateFilter.clause
      ? `AND ${dateFilter.clause}`
      : "";
    const driverRows = db
      .prepare(
        `SELECT d.id, d.name, d.is_active as isActive,
                COUNT(oo.id) as deliveries,
                COALESCE(SUM(oo.grand_total),0) as revenue
         FROM drivers d
         LEFT JOIN online_orders oo
           ON oo.driver_id = d.id AND oo.status = '${ORDER_STATUS.DISPATCHED}' ${driverDateClause}
         GROUP BY d.id
         ORDER BY revenue DESC`,
      )
      .all(...dateFilter.params);
    const driverPerformance = driverRows.map((row) => {
      const balanceRow = db
        .prepare(
          "SELECT balance_after FROM driver_settlements WHERE driver_id=? ORDER BY date DESC, time DESC LIMIT 1",
        )
        .get(row.id);
      return {
        driverId: row.id,
        driverName: row.name,
        isActive: row.isActive === 1,
        deliveries: safeNumber(row.deliveries),
        revenue: safeNumber(row.revenue),
        currentBalance: balanceRow ? safeNumber(balanceRow.balance_after) : 0,
      };
    });

    const dispatchedCount = dispatchedRow?.count ?? 0;
    const cancelledCount = cancelledRow?.count ?? 0;
    const notReceivedCount = notReceivedRow?.count ?? 0;
    const revenue = dispatchedRow?.revenue ?? 0;
    const averageOrderValue = dispatchedCount
      ? round(revenue / dispatchedCount)
      : 0;
    const successRate = totalOrders
      ? round((dispatchedCount / totalOrders) * 100)
      : 0;
    const cancellationRate = totalOrders
      ? round((cancelledCount / totalOrders) * 100)
      : 0;
    const notReceivedRate = totalOrders
      ? round((notReceivedCount / totalOrders) * 100)
      : 0;

    const trustRows = db
      .prepare(
        `SELECT c.trust_level as trustLevel, COUNT(DISTINCT oo.customer_id) as count
         FROM online_orders oo
         JOIN customers c ON c.id = oo.customer_id
         ${where}
         GROUP BY c.trust_level`,
      )
      .all(...dateFilter.params);
    const customerDistribution = {
      vip: 0,
      regular: 0,
      warning: 0,
      high_risk: 0,
    };
    for (const row of trustRows) {
      const key = row.trustLevel;
      if (
        key &&
        Object.prototype.hasOwnProperty.call(customerDistribution, key)
      ) {
        customerDistribution[key] = safeNumber(row.count);
      }
    }

    const areaRows = db
      .prepare(
        `SELECT address_text as area, COUNT(*) as count,
                COALESCE(SUM(CASE WHEN status = ? THEN products_total ELSE 0 END),0) as revenue
         FROM online_orders ${where}
         GROUP BY address_text
         ORDER BY count DESC
         LIMIT 10`,
      )
      .all(ORDER_STATUS.DISPATCHED, ...dateFilter.params);
    const topAreas = areaRows.map((row) => ({
      area: row.area,
      count: safeNumber(row.count),
      revenue: safeNumber(row.revenue),
    }));

    const driverSettlementTotals = driverPerformance.reduce(
      (acc, d) => {
        if (d.currentBalance > 0) acc.totalOwedToShop += d.currentBalance;
        else if (d.currentBalance < 0)
          acc.totalOwedToDrivers += Math.abs(d.currentBalance);
        return acc;
      },
      { totalOwedToShop: 0, totalOwedToDrivers: 0 },
    );
    driverSettlementTotals.totalOwedToShop = round(
      driverSettlementTotals.totalOwedToShop,
    );
    driverSettlementTotals.totalOwedToDrivers = round(
      driverSettlementTotals.totalOwedToDrivers,
    );
    return {
      type: "online_orders",
      stats: {
        totalOrders,
        dispatchedCount,
        cancelledCount,
        notReceivedCount,
        revenue,
        averageOrderValue,
        successRate,
        cancellationRate,
        notReceivedRate,
      },
      analytics: {
        statusBreakdown,
        sourceBreakdown,
        paymentMethodBreakdown,
        topCustomers,
        driverPerformance,
        customerDistribution,
        topAreas,
        driverSettlementTotals,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange: { from: dateFilter.from ?? null, to: dateFilter.to ?? null },
      },
    };
  }
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
                COUNT(CASE WHEN stock > 0 AND stock < 10 THEN 1 END) as lowStock
         FROM products`,
      )
      .get();
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
          salesStats.revenue,
          prevSales.revenue,
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
          revenue: safeNumber(prevSales.revenue),
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
    const topProducts = db
      .prepare(
        `SELECT si.name as name,
                SUM(si.line_total) as revenue,
                SUM(si.quantity) as sold
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY si.name
         ORDER BY revenue DESC
         LIMIT 5`,
      )

      .all(...dateFilter.params)
      .map((row) => ({
        name: row.name,
        revenue: safeNumber(row.revenue),
        sold: safeNumber(row.sold),
      }));
    const totalRevenue = safeNumber(salesStats.revenue);
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
    const purchaseCostMap = getPurchaseCostMap();
    const productRows = db
      .prepare(
        `SELECT COALESCE(si.barcode, si.name) as itemKey,
                SUM(si.line_total) as revenue,
                SUM(si.quantity) as quantity
         FROM sale_invoice_items si
         JOIN sale_invoices s ON si.invoice_id = s.id
         ${sqlWhere(withVoidedFilter(dateFilter.clause))}
         GROUP BY itemKey`,
      )
      .all(...dateFilter.params);
    const totalCost = productRows.reduce((sum, row) => {
      const costPerUnit = purchaseCostMap[row.itemKey] ?? 0;
      return sum + costPerUnit * safeNumber(row.quantity);
    }, 0);
    const grossProfit = round(totalRevenue - totalCost);
    const grossMargin = totalRevenue
      ? round((grossProfit / totalRevenue) * 100)
      : 0;
    return {
      type: "dashboard",
      kpis: {
        revenue: collectedRevenue,
        bookedRevenue: safeNumber(salesStats.revenue),
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
          ? round(salesStats.revenue / salesStats.invoices)
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
  return {
    generate(reportData) {
      if (!reportData || typeof reportData !== "object") {
        throw new Error("Invalid report request");
      }
      const { type, from, to } = reportData;
      if (type === "sales") {
        return generateSalesReport(from, to);
      }
      if (type === "purchases") {
        return generatePurchasesReport(from, to);
      }
      if (type === "inventory") {
        return generateInventoryReport();
      }
      if (type === "debts") {
        return generateDebtsReport();
      }
      if (type === "dashboard") {
        return generateDashboardReport(from, to);
      }
      if (type === "online_orders") {
        return generateOnlineOrdersReport(from, to);
      }
      return { type, data: [] };
    },
  };
}
module.exports = { createReportsDB };
