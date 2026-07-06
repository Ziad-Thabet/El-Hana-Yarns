const { normalizeIsoDate } = require("./isoDates.cjs");
function sqlWhere(clause) {
  return clause ? `WHERE ${clause}` : "";
}
function buildDateFilter(from, to, alias = "") {
  const field = alias ? `${alias}.date` : "date";
  const conditions = [];
  const params = [];
  const fromIso = normalizeIsoDate(from);
  const toIso = normalizeIsoDate(to);
  if (fromIso) {
    conditions.push(`${field} >= ?`);
    params.push(fromIso);
  }
  if (toIso) {
    conditions.push(`${field} <= ?`);
    params.push(toIso);
  }
  return {
    clause: conditions.join(" AND "),
    params,
    from: fromIso,
    to: toIso,
  };
}
module.exports = { buildDateFilter, sqlWhere };
