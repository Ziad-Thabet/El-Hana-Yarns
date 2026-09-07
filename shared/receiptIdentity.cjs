/**
 * Shop identity as it appears on a receipt, and the paper size derived from it.
 *
 * Shared between the renderer (which builds the receipt HTML and its preview)
 * and the main process (which sets the Electron print page size), so the
 * configured width cannot mean one thing to the printer and another to the
 * layout — it previously existed as three independent copies of "80mm".
 */

/** Blank fields must emit nothing at all; receipt paper is not free. */
function buildShopHeaderLines(shop = {}) {
  const lines = [];
  const tagline = String(shop.tagline ?? "").trim();
  const address = String(shop.address ?? "").trim();
  const phone = String(shop.phone ?? "").trim();
  if (tagline) lines.push({ icon: "", text: tagline });
  if (address) lines.push({ icon: "📍", text: address });
  if (phone) lines.push({ icon: "📞", text: phone });
  return lines;
}

/** "Name — tagline", or just the name when there is no tagline. */
function buildShopFooterLine(shop = {}) {
  const name = String(shop.name ?? "").trim();
  const tagline = String(shop.tagline ?? "").trim();
  if (!name) return tagline;
  return tagline ? `${name} — ${tagline}` : name;
}

/**
 * Electron's print API takes microns. Height stays at the A4-ish roll length;
 * only the width is configurable, because that is what the paper dictates.
 */
const RECEIPT_HEIGHT_MICRONS = 297000;
const DEFAULT_WIDTH_MM = 80;

function receiptPageSize(widthMm) {
  const mm = Number(widthMm);
  const safe = Number.isFinite(mm) && mm > 0 ? mm : DEFAULT_WIDTH_MM;
  return { width: Math.round(safe * 1000), height: RECEIPT_HEIGHT_MICRONS };
}

module.exports = {
  buildShopHeaderLines,
  buildShopFooterLine,
  receiptPageSize,
  DEFAULT_WIDTH_MM,
};
