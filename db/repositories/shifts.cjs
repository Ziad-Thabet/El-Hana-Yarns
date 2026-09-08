const { generateId } = require("../helpers/ids.cjs");
const { formatDateYMD } = require("../../shared/dateRules.cjs");
const { buildDateFilter } = require("../helpers/dateFilter.cjs");
const { hydrateSaleInvoices } = require("./sales.cjs");
const { round } = require("../helpers/numbers.cjs");
const {
  LEGACY_KEY_BY_CODE,
} = require("./paymentMethods.cjs");
function mapShift(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    totalCash: row.total_cash,
    totalVodafone: row.total_vodafone,
    totalInstapay: row.total_instapay,
    totalInvoices: row.total_invoices,
    status: row.status,
  };
}
const STALE_SHIFT_HOURS = 10;
function createShiftsDB(getDb, settingsDB = null, paymentMethodsDB = null) {
  const staleHours = () =>
    settingsDB?.getNumber("shift.staleHours") ?? STALE_SHIFT_HOURS;
  function getOpenShift(userId, date) {
    const db = getDb();
    return (
      db
        .prepare(
          "SELECT * FROM shifts WHERE user_id=? AND date=? AND status='open' LIMIT 1",
        )
        .get(userId, date) ?? null
    );
  }
  function calcShiftTotals(shiftId) {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT pr.method, SUM(pr.amount) as total
         FROM payment_records pr
         LEFT JOIN sale_invoices si ON si.id = pr.ref_id
         WHERE pr.ref_type = 'sale' AND pr.shift_id = ?
           AND (si.voided IS NULL OR si.voided = 0)
         GROUP BY pr.method`,
      )
      .all(shiftId);
    // Refunds are stored as negative payment_records against the original
    // invoice, so they subtract here without any special casing — money leaving
    // the drawer today is counted against today's shift even when the sale it
    // reverses belongs to an earlier one.
    // Keyed by the method code exactly as it appears in payment_records, so a
    // method the shop adds later needs no code change here.
    const byCode = {};
    for (const row of rows) {
      const code = (row.method ?? "").toLowerCase();
      if (!code) continue;
      byCode[code] = round((byCode[code] ?? 0) + row.total);
    }

    // The legacy triplet is DERIVED from byCode rather than computed
    // separately. Two independent calculations of the same figure is precisely
    // how they drift apart; this way they cannot disagree by construction.
    const legacy = { cash: 0, vodafone_cash: 0, instapay: 0 };
    for (const [code, key] of Object.entries(LEGACY_KEY_BY_CODE)) {
      legacy[key] = byCode[code] ?? 0;
    }
    return { ...legacy, byCode };
  }
  function calcShiftInvoiceCount(shiftId) {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM sale_invoices WHERE shift_id=? AND voided=0",
      )
      .get(shiftId);
    return row?.cnt ?? 0;
  }
  /** Mirrors the totals into shift_totals alongside the legacy columns. */
  function writeShiftTotals(db, shiftId, byCode) {
    if (!paymentMethodsDB) return;
    const upsert = db.prepare(
      `INSERT INTO shift_totals (shift_id, method_id, amount)
       VALUES (?,?,?)
       ON CONFLICT(shift_id, method_id) DO UPDATE SET amount=excluded.amount`,
    );
    for (const [code, amount] of Object.entries(byCode)) {
      const methodId = paymentMethodsDB.idForCode(code);
      // A code with no matching method row is skipped rather than guessed at:
      // the legacy columns still carry the figure, so nothing is lost.
      if (!methodId) {
        console.warn(`[Shifts] no payment method registered for "${code}"`);
        continue;
      }
      upsert.run(shiftId, methodId, amount);
    }
  }

  /**
   * The single place a shift is closed.
   *
   * The same UPDATE previously existed three times — here in `end()`, in
   * `autoCloseStale()`, and again in employees.setActive() when deactivating a
   * user with an open shift. Three writers of the same financial totals is how
   * they drift apart, so every path now funnels through this one.
   */
  function closeShift(db, shiftId, endedAt) {
    const totals = calcShiftTotals(shiftId);
    const count = calcShiftInvoiceCount(shiftId);
    writeShiftTotals(db, shiftId, totals.byCode);
    db.prepare(
      `UPDATE shifts SET
         status='closed',
         ended_at=?,
         total_cash=?,
         total_vodafone=?,
         total_instapay=?,
         total_invoices=?
       WHERE id=?`,
    ).run(
      endedAt,
      totals.cash,
      totals.vodafone_cash,
      totals.instapay,
      count,
      shiftId,
    );
    return mapShift(db.prepare("SELECT * FROM shifts WHERE id=?").get(shiftId));
  }

  const shiftsDB = {
    create(userId, date, startedAt) {
      const db = getDb();
      const id = generateId("shft");
      db.prepare(
        `INSERT INTO shifts (id, user_id, date, started_at, status,
          total_cash, total_vodafone, total_instapay, total_invoices)
         VALUES (?, ?, ?, ?, 'open', 0, 0, 0, 0)`,
      ).run(id, userId, date, startedAt);
      return mapShift(db.prepare("SELECT * FROM shifts WHERE id=?").get(id));
    },
    getActive(userId, date) {
      return mapShift(getOpenShift(userId, date));
    },
    getByUserAndDate(userId, date) {
      return getDb()
        .prepare(
          "SELECT * FROM shifts WHERE user_id=? AND date=? ORDER BY started_at ASC",
        )
        .all(userId, date)
        .map(mapShift);
    },
    getOrCreate(userId, date, nowIso, firstLoginAt = null) {
      const existing = getOpenShift(userId, date);
      if (existing) return mapShift(existing);
      shiftsDB.autoCloseStale(userId, date);
      const startedAt = firstLoginAt ?? nowIso;
      return shiftsDB.create(userId, date, startedAt);
    },
    autoCloseStale(userId = null, currentDate = null) {
      const db = getDb();
      const now = new Date();
      if (!currentDate) {
        currentDate = formatDateYMD(now);
      }
      const stale = userId
        ? db
            .prepare(
              "SELECT s.*, u.role FROM shifts s LEFT JOIN users u ON s.user_id=u.id WHERE s.user_id=? AND s.date < ? AND s.status='open'",
            )
            .all(userId, currentDate)
        : db
            .prepare(
              "SELECT s.*, u.role FROM shifts s LEFT JOIN users u ON s.user_id=u.id WHERE s.date < ? AND s.status='open'",
            )
            .all(currentDate);
      const staleCutoff = new Date(
        now.getTime() - staleHours() * 60 * 60 * 1000,
      );
      const sameDayCandidates = db
        .prepare(
          "SELECT s.*, u.role FROM shifts s LEFT JOIN users u ON s.user_id=u.id WHERE s.date = ? AND s.status = 'open'" +
            (userId ? " AND s.user_id = ?" : ""),
        )
        .all(...(userId ? [currentDate, userId] : [currentDate]));
      const sameDayStale = sameDayCandidates.filter((shift) => {
        if (shift.role === "admin") return false;
        const lastInv = db
          .prepare(
            "SELECT date, time FROM sale_invoices WHERE shift_id=? ORDER BY date DESC, time DESC LIMIT 1",
          )
          .get(shift.id);
        if (!lastInv) {
          return new Date(shift.started_at) < staleCutoff;
        }
        return new Date(`${lastInv.date}T${lastInv.time}`) < staleCutoff;
      });
      const allStale = [...stale, ...sameDayStale];
      if (allStale.length === 0) return;
      for (const shift of allStale) {
        const lastInv = db
          .prepare(
            "SELECT date, time FROM sale_invoices WHERE shift_id=? ORDER BY date DESC, time DESC LIMIT 1",
          )
          .get(shift.id);
        const endedAt = lastInv
          ? `${lastInv.date}T${lastInv.time}`
          : shift.started_at;
        closeShift(db, shift.id, endedAt);
        console.log(
          `✅ Auto-closed shift ${shift.id} (user: ${shift.user_id}, role: ${shift.role ?? "?"}, date: ${shift.date})`,
        );
      }
    },
    end(shiftId, endedAt) {
      const db = getDb();
      const shift = db
        .prepare("SELECT * FROM shifts WHERE id=? AND status='open'")
        .get(shiftId);
      if (!shift) throw new Error("shift_not_found_or_already_closed");
      return closeShift(db, shiftId, endedAt);
    },
    /**
     * Closes an open shift without requiring it to be the caller's own —
     * used when deactivating a user who still has one open.
     */
    closeIfOpen(shiftId, endedAt) {
      const db = getDb();
      const shift = db
        .prepare("SELECT id FROM shifts WHERE id=? AND status='open'")
        .get(shiftId);
      if (!shift) return null;
      return closeShift(db, shiftId, endedAt);
    },
    getInvoices(shiftId) {
      const db = getDb();
      const invoices = db
        .prepare(
          "SELECT * FROM sale_invoices WHERE shift_id=? AND voided=0 ORDER BY date DESC, time DESC",
        )
        .all(shiftId);
      return hydrateSaleInvoices(db, invoices);
    },
    getAllInvoices(from, to) {
      const db = getDb();
      const { clause, params } = buildDateFilter(from, to);
      const where = clause
        ? `WHERE ${clause} AND voided = 0`
        : "WHERE voided = 0";
      const invoices = db
        .prepare(
          `SELECT * FROM sale_invoices ${where} ORDER BY date DESC, time DESC`,
        )
        .all(...params);
      return hydrateSaleInvoices(db, invoices);
    },
    getSummary(shiftId) {
      const totals = calcShiftTotals(shiftId);
      const count = calcShiftInvoiceCount(shiftId);
      return { ...totals, totalInvoices: count };
    },
    /** What shift_totals holds, for reconciling it against the legacy columns. */
    getStoredTotals(shiftId) {
      const db = getDb();
      const rows = db
        .prepare(
          `SELECT pm.code, st.amount
             FROM shift_totals st
             JOIN payment_methods pm ON pm.id = st.method_id
            WHERE st.shift_id = ?`,
        )
        .all(shiftId);
      const byCode = {};
      for (const row of rows) byCode[row.code] = row.amount;
      return byCode;
    },
  };
  return shiftsDB;
}

function createEnsureActiveShift(shiftsDB) {
  return function ensureActiveShift(userId, date, nowIso) {
    return shiftsDB.getOrCreate(userId, date, nowIso);
  };
}

module.exports = { createShiftsDB, mapShift, createEnsureActiveShift };
