/**
 * ESM mirror of shared/stockUnits.cjs — keep both in sync.
 *
 * How much stock a single sale/order line consumes. Products are stocked in
 * their own unit: pieces, kilograms, or metres. For anything other than a piece
 * the cart stores `quantity = 1` and puts the real amount in `measureAmount`
 * (and, for weight only, `weightGrams` — which despite its name holds
 * KILOGRAMS). Reading `quantity` for a weighted line therefore always yields 1.
 */

function toPositiveNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/** Stock units for a camelCase line (cart item, mapped order item). */
export function stockUnitsFor(item) {
  if (!item) return 0;
  const quantity = toPositiveNumber(item.quantity, 1);
  if (!item.isWeighted) return quantity;
  return toPositiveNumber(
    item.measureAmount,
    toPositiveNumber(item.weightGrams, quantity),
  );
}
