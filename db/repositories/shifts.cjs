const { generateId } = require("../helpers/ids.cjs");
const { formatDateYMD } = require("../../shared/dateRules.cjs");
const { buildDateFilter } = require("../helpers/dateFilter.cjs");
const { mapSaleInvoice } = require("./sales.cjs");
const { round } = require("../helpers/numbers.cjs");
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
function createShiftsDB(getDb) {
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
    const totals = { cash: 0, vodafone_cash: 0, instapay: 0 };
    for (const row of rows) {
      const method = (row.method ?? "").toLowerCase();
      if (method === "cash") totals.cash = round(row.total);
      else if (method === "vodafone") totals.vodafone_cash = round(row.total);
      else if (method === "instapay") totals.instapay = round(row.total);
    }
    return totals;
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
      const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);
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
          return new Date(shift.started_at) < tenHoursAgo;
        }
        return new Date(`${lastInv.date}T${lastInv.time}`) < tenHoursAgo;
      });
      const allStale = [...stale, ...sameDayStale];
      if (allStale.length === 0) return;
      const closeStmt = db.prepare(
        `UPDATE shifts SET
           status='closed',
           ended_at=?,
           total_cash=?,
           total_vodafone=?,
           total_instapay=?,
           total_invoices=?
         WHERE id=?`,
      );
      for (const shift of allStale) {
        const lastInv = db
          .prepare(
            "SELECT date, time FROM sale_invoices WHERE shift_id=? ORDER BY date DESC, time DESC LIMIT 1",
          )
          .get(shift.id);
        const endedAt = lastInv
          ? `${lastInv.date}T${lastInv.time}`
          : shift.started_at;
        const totals = calcShiftTotals(shift.id);
        const count = calcShiftInvoiceCount(shift.id);
        closeStmt.run(
          endedAt,
          totals.cash,
          totals.vodafone_cash,
          totals.instapay,
          count,
          shift.id,
        );
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
      const totals = calcShiftTotals(shiftId);
      const count = calcShiftInvoiceCount(shiftId);
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
      return mapShift(
        db.prepare("SELECT * FROM shifts WHERE id=?").get(shiftId),
      );
    },
    getInvoices(shiftId) {
      const db = getDb();
      const invoices = db
        .prepare(
          "SELECT * FROM sale_invoices WHERE shift_id=? AND voided=0 ORDER BY date DESC, time DESC",
        )
        .all(shiftId);
      return invoices.map((inv) => {
        const items = db
          .prepare("SELECT * FROM sale_invoice_items WHERE invoice_id=?")
          .all(inv.id);
        const payments = db
          .prepare(
            "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='sale' ORDER BY date ASC, time ASC",
          )
          .all(inv.id);
        return mapSaleInvoice(db, inv, items, payments);
      });
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
      return invoices.map((inv) => {
        const items = db
          .prepare("SELECT * FROM sale_invoice_items WHERE invoice_id=?")
          .all(inv.id);
        const payments = db
          .prepare(
            "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='sale' ORDER BY date ASC, time ASC",
          )
          .all(inv.id);
        return mapSaleInvoice(db, inv, items, payments);
      });
    },
    getSummary(shiftId) {
      const totals = calcShiftTotals(shiftId);
      const count = calcShiftInvoiceCount(shiftId);
      return { ...totals, totalInvoices: count };
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
