const { safeNumber, round } = require("../helpers/numbers.cjs");
const {
  normalizeIsoDate,
} = require("../helpers/isoDates.cjs");
const {
  ORDER_STATUS,
} = require("../../shared/onlineOrdersEnums.cjs");

/**
 * The online order book: the lifecycle, the drivers, and the money in
 * transit with them.
 *
 * Split out of reports.cjs. The query bodies are unchanged; what they used to
 * reach for in an enclosing scope now arrives in the shared context.
 */
function createOnlineOrdersReport(ctx) {
  const {
    getDb,
  } = ctx;

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

  return generateOnlineOrdersReport;
}

module.exports = { createOnlineOrdersReport };
