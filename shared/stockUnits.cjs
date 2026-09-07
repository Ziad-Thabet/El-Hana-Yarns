/**
 * How much stock a single sale/order line consumes.
 *
 * Products are stocked in their own unit: pieces for `unit: "piece"`, kilograms
 * for `unit: "weight"`, metres for `unit: "meter"`. For anything other than a
 * piece the cart stores `quantity = 1` and puts the real amount in
 * `measureAmount` (and, for weight only, `weightGrams` — which despite its name
 * holds KILOGRAMS, matching how stock is recorded).
 *
 * Reading `quantity` for a weighted line therefore always yields 1, no matter
 * how many kilos were sold. Every place that deducts, restores, reserves or
 * validates stock must go through this module so the units cannot drift apart
 * again.
 */

function toPositiveNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/** Stock units for a camelCase line (cart item, mapped order item). */
function stockUnitsFor(item) {
  if (!item) return 0;
  const quantity = toPositiveNumber(item.quantity, 1);
  if (!item.isWeighted) return quantity;
  // measureAmount covers weight and metre lines; weightGrams is the older
  // weight-only field. Fall back to quantity rather than 0 so a malformed row
  // under-deducts by one unit instead of silently deducting nothing.
  return toPositiveNumber(item.measureAmount, toPositiveNumber(item.weightGrams, quantity));
}

/** Stock units for a raw snake_case database row. */
function stockUnitsForRow(row) {
  if (!row) return 0;
  return stockUnitsFor({
    quantity: row.quantity,
    isWeighted: row.is_weighted === 1,
    measureAmount: row.measure_amount,
    weightGrams: row.weight_grams,
  });
}

/**
 * The same rule as a SQL expression, for aggregate queries that reserve or
 * total stock without loading rows into JS.
 */
function stockUnitsSql(alias) {
  const col = (name) => (alias ? `${alias}.${name}` : name);
  return `CASE WHEN ${col("is_weighted")} = 1
               THEN COALESCE(${col("measure_amount")}, ${col("weight_grams")}, ${col("quantity")})
               ELSE ${col("quantity")} END`;
}

module.exports = { stockUnitsFor, stockUnitsForRow, stockUnitsSql };
