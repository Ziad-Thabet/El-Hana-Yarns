function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}
module.exports = { safeNumber, round };
