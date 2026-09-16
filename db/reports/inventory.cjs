const { safeNumber, round } = require("../helpers/numbers.cjs");

/**
 * What is on the shelves, what it is worth, and what is not moving.
 *
 * Split out of reports.cjs. The query bodies are unchanged; what they used to
 * reach for in an enclosing scope now arrives in the shared context.
 */
function createInventoryReport(ctx) {
  const {
    productsDB,
    lowStockAt,
    getPurchaseCostMap,
    costPerUnitFor,
    getInventoryMovement,
  } = ctx;

  function generateInventoryReport() {
    const products = productsDB.getAll();
    const lowStockLimit = lowStockAt();
    const lowStock = products.filter((p) => p.stock < lowStockLimit);
    const outOfStock = products.filter((p) => p.stock <= 0);
    const purchaseCostMap = getPurchaseCostMap();
    const inventoryValueRetail = products.reduce(
      (sum, product) =>
        sum + safeNumber(product.stock) * safeNumber(product.price),
      0,
    );
    const inventoryValueCost = products.reduce((sum, product) => {
      const unitCost = costPerUnitFor(purchaseCostMap, {
        productId: product.id,
        barcode: product.barcode,
        name: product.name,
      });
      return sum + safeNumber(product.stock) * unitCost;
    }, 0);
    const movement = getInventoryMovement(90);
    const overstockItems = products
      .filter((product) => product.stock > 0)
      .map((product) => ({
        ...product,
        estimatedCost: round(
          costPerUnitFor(purchaseCostMap, {
            productId: product.id,
            barcode: product.barcode,
            name: product.name,
          }) * safeNumber(product.stock),
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

  return generateInventoryReport;
}

module.exports = { createInventoryReport };
