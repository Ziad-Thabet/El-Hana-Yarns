const { generateId } = require("../helpers/ids.cjs");
const { nowDateTime } = require("../helpers/isoDates.cjs");
const { buildDateFilter } = require("../helpers/dateFilter.cjs");
const { safeNumber, round } = require("../helpers/numbers.cjs");

/**
 * The cash book: every movement of money in or out of the drawer that is not a
 * sale.
 *
 * Sales and refunds already live in `payment_records`, which is where the till
 * gets most of its traffic. This covers the rest — a supplier paid in cash, the
 * electricity bill, change brought in to start the day, takings walked to the
 * bank — and it is what makes the drawer count at closing mean something. Until
 * these were recorded, the expected figure counted only sales, so a till short
 * by exactly the electricity bill read as a cashier's mistake every evening.
 *
 * Movements are never edited or deleted. A mistake is corrected by an opposing
 * movement, the way a cash book is corrected: both the error and its correction
 * stay visible, and the running total is always the sum of what was recorded.
 */
function mapMovement(row) {
  if (!row) return null;
  return {
    id: row.id,
    direction: row.direction,
    amount: safeNumber(row.amount),
    reason: row.reason,
    date: row.date,
    time: row.time,
    shiftId: row.shift_id ?? null,
    refType: row.ref_type ?? null,
    refId: row.ref_id ?? null,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
    /** Signed, so a list can be summed without branching on direction. */
    signedAmount: round(
      row.direction === "out" ? -safeNumber(row.amount) : safeNumber(row.amount),
    ),
  };
}

const SELECT = `
  SELECT cm.*, u.display_name AS created_by_name
    FROM cash_movements cm
    LEFT JOIN users u ON u.id = cm.created_by
`;

function createCashMovementsDB(getDb) {
  return {
    /**
     * Records a movement. `direction` says which way the money went; `amount`
     * is always positive, because "minus fifty out" is a question nobody should
     * have to answer at a till.
     */
    record({
      direction,
      amount,
      reason,
      shiftId = null,
      refType = null,
      refId = null,
      createdBy,
      date = null,
      time = null,
    }) {
      if (direction !== "in" && direction !== "out") {
        throw new Error("cash_direction_invalid");
      }
      const value = round(safeNumber(amount));
      if (!(value > 0)) throw new Error("cash_amount_required");
      const text = (reason ?? "").toString().trim();
      if (!text) throw new Error("cash_reason_required");
      if (!createdBy) throw new Error("cash_actor_required");

      const now = nowDateTime();
      const id = generateId("cash");
      getDb()
        .prepare(
          `INSERT INTO cash_movements
             (id, direction, amount, reason, date, time, shift_id, ref_type, ref_id, created_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          direction,
          value,
          text.slice(0, 300),
          date ?? now.date,
          time ?? now.time,
          shiftId,
          refType,
          refId,
          createdBy,
          new Date().toISOString(),
        );
      return this.getById(id);
    },

    getById(id) {
      return mapMovement(
        getDb()
          .prepare(`${SELECT} WHERE cm.id = ?`)
          .get(id),
      );
    },

    /** Everything recorded in a date range, newest first. */
    getAll(from = null, to = null) {
      const { clause, params } = buildDateFilter(from, to, "cm");
      return getDb()
        .prepare(
          `${SELECT} ${clause ? `WHERE ${clause}` : ""}
           ORDER BY cm.date DESC, cm.time DESC, cm.rowid DESC`,
        )
        .all(...params)
        .map(mapMovement);
    },

    getByShift(shiftId) {
      return getDb()
        .prepare(`${SELECT} WHERE cm.shift_id = ? ORDER BY cm.time ASC, cm.rowid ASC`)
        .all(shiftId)
        .map(mapMovement);
    },

    /**
     * The net effect on a shift's drawer: what was put in, less what was taken
     * out. This is the term the expected-cash calculation was missing.
     */
    netForShift(shiftId) {
      const row = getDb()
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN direction='in'  THEN amount ELSE 0 END), 0) AS paidIn,
             COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END), 0) AS paidOut
           FROM cash_movements WHERE shift_id = ?`,
        )
        .get(shiftId);
      const paidIn = round(safeNumber(row?.paidIn));
      const paidOut = round(safeNumber(row?.paidOut));
      return { paidIn, paidOut, net: round(paidIn - paidOut) };
    },

    /** The same, for a date range rather than a shift — used by reporting. */
    netForRange(from, to) {
      const { clause, params } = buildDateFilter(from, to);
      const row = getDb()
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN direction='in'  THEN amount ELSE 0 END), 0) AS paidIn,
             COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END), 0) AS paidOut,
             COUNT(*) AS count
           FROM cash_movements ${clause ? `WHERE ${clause}` : ""}`,
        )
        .get(...params);
      const paidIn = round(safeNumber(row?.paidIn));
      const paidOut = round(safeNumber(row?.paidOut));
      return {
        paidIn,
        paidOut,
        net: round(paidIn - paidOut),
        count: safeNumber(row?.count),
      };
    },

    /** Movements recorded against one expense or purchase. */
    getByRef(refType, refId) {
      return getDb()
        .prepare(`${SELECT} WHERE cm.ref_type = ? AND cm.ref_id = ?`)
        .all(refType, refId)
        .map(mapMovement);
    },
  };
}

module.exports = { createCashMovementsDB, mapMovement };
