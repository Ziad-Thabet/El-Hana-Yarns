/**
 * Sequential, human-readable document numbers: PREFIX-YYYYMMDD-NNN.
 *
 * These used to be `PREFIX-${Date.now()}`, which is neither readable nor
 * sortable by eye — and, because `invoice_number` is UNIQUE, two documents
 * created in the same millisecond collided and failed the insert outright.
 *
 * Call inside the same transaction as the insert so the read and write of the
 * sequence cannot interleave.
 */
function nextDocumentNumber(db, { table, column, prefix, date }) {
  const datePrefix = `${prefix}-${date.replace(/-/g, "")}`;
  // MAX over the numeric suffix, not the text. Ordering by the column itself
  // compares lexically, where "999" sorts above "1000" — so past the 999th
  // document of a day the sequence would stall and regenerate a number that
  // already exists, violating the UNIQUE constraint.
  const row = db
    .prepare(
      `SELECT MAX(CAST(substr(${column}, ?) AS INTEGER)) AS seq
         FROM ${table}
        WHERE ${column} LIKE ?`,
    )
    .get(datePrefix.length + 2, `${datePrefix}-%`);

  const sequence = (Number(row?.seq) || 0) + 1;
  // Pads to three digits for readability but widens naturally beyond 999.
  return `${datePrefix}-${String(sequence).padStart(3, "0")}`;
}

module.exports = { nextDocumentNumber };
