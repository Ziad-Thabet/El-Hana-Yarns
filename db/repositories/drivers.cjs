const { generateId } = require("../helpers/ids.cjs");
const { nowDateTime } = require("../helpers/isoDates.cjs");
const { round } = require("../helpers/numbers.cjs");
const { buildDateFilter } = require("../helpers/dateFilter.cjs");
const { SETTLEMENT_TYPE } = require("../../shared/onlineOrdersEnums.cjs");

function mapDriver(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    isActive: row.is_active === 1,
    driverType: row.driver_type ?? "driver",
    paysNextDay: row.pays_next_day === 1,
    createdAt: row.created_at,
  };
}

function mapSettlement(row) {
  return {
    id: row.id,
    driverId: row.driver_id,
    orderId: row.order_id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    date: row.date,
    time: row.time,
    notes: row.notes,
  };
}

function createDriversDB(getDb) {
  function getLastBalance(db, driverId) {
    const row = db
      .prepare(
        "SELECT balance_after FROM driver_settlements WHERE driver_id=? ORDER BY date DESC, time DESC LIMIT 1",
      )
      .get(driverId);
    return row ? row.balance_after : 0;
  }

  const driversDB = {
    getAll() {
      return getDb()
        .prepare("SELECT * FROM drivers ORDER BY name")
        .all()
        .map(mapDriver);
    },

    getActive() {
      return getDb()
        .prepare("SELECT * FROM drivers WHERE is_active=1 ORDER BY name")
        .all()
        .map(mapDriver);
    },

    getById(id) {
      const row = getDb().prepare("SELECT * FROM drivers WHERE id=?").get(id);
      return mapDriver(row);
    },

    create(data) {
      const db = getDb();
      const id = generateId("drv");
      const { date, time } = nowDateTime();
      db.prepare(
        "INSERT INTO drivers (id, name, phone, is_active, driver_type, pays_next_day, created_at) VALUES (?,?,?,1,?,?,?)",
      ).run(
        id,
        data.name,
        data.phone,
        data.driverType ?? "driver",
        data.paysNextDay ? 1 : 0,
        `${date} ${time}`,
      );
      return this.getById(id);
    },

    update(id, data) {
      const db = getDb();
      db.prepare(
        "UPDATE drivers SET name=?, phone=?, is_active=?, driver_type=?, pays_next_day=? WHERE id=?",
      ).run(
        data.name,
        data.phone,
        data.isActive ? 1 : 0,
        data.driverType ?? "driver",
        data.paysNextDay ? 1 : 0,
        id,
      );
      return this.getById(id);
    },

    getSummary(driverId, from, to) {
      const db = getDb();
      const { clause, params } = buildDateFilter(from, to);
      const conditions = ["driver_id=?"];
      const allParams = [driverId];
      if (clause) {
        conditions.push(clause);
        allParams.push(...params);
      }
      const where = `WHERE ${conditions.join(" AND ")}`;
      const rows = db
        .prepare(
          `SELECT type, COUNT(*) as count, COALESCE(SUM(amount),0) as total
         FROM driver_settlements ${where} GROUP BY type`,
        )
        .all(...allParams);
      const byType = {};
      for (const r of rows) byType[r.type] = { count: r.count, total: r.total };
      const custody = byType["custody_charge"] ?? { count: 0, total: 0 };
      const shopOwes = byType["shop_owes_driver"] ?? { count: 0, total: 0 };
      const driverPaymentRows = db
        .prepare(
          `SELECT amount FROM driver_settlements WHERE driver_id=? AND type=?
           ${clause ? "AND " + clause : ""}`,
        )
        .all(driverId, "driver_payment", ...params);
      const totalFeesPaid = driverPaymentRows
        .filter((r) => r.amount > 0)
        .reduce((s, r) => s + r.amount, 0);
      const totalCustodyPaidBack = driverPaymentRows
        .filter((r) => r.amount < 0)
        .reduce((s, r) => s + Math.abs(r.amount), 0);
      return {
        deliveriesCount: custody.count,
        totalCollected: round(custody.total),
        totalDriverFees: round(Math.abs(shopOwes.total)),
        totalFeesPaid: round(totalFeesPaid),
        totalPaidBack: round(totalCustodyPaidBack),
        currentBalance: round(this.getBalance(driverId)),
      };
    },

    getBalance(driverId) {
      return round(getLastBalance(getDb(), driverId));
    },

    recordSettlement(driverId, entry) {
      const db = getDb();
      const id = generateId("dsettle");
      const { date, time } = nowDateTime();
      const prevBalance = getLastBalance(db, driverId);
      const balanceAfter = round(prevBalance + entry.amount);
      db.prepare(
        `INSERT INTO driver_settlements (id, driver_id, order_id, type, amount, balance_after, date, time, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        driverId,
        entry.orderId ?? null,
        entry.type,
        entry.amount,
        balanceAfter,
        date,
        time,
        entry.notes ?? null,
      );
      return mapSettlement(
        db.prepare("SELECT * FROM driver_settlements WHERE id=?").get(id),
      );
    },

    registerManualPayment(driverId, amount, notes) {
      const currentBalance = this.getBalance(driverId);
      if (currentBalance === 0) {
        throw new Error("لا يوجد رصيد مستحق على المندوب أو على المحل حالياً");
      }
      // الدفع دائماً يقرّب الرصيد من الصفر — الاتجاه يتحدد تلقائياً من علامة الرصيد الحالي
      const signedAmount = currentBalance > 0 ? -amount : amount;
      return this.recordSettlement(driverId, {
        orderId: null,
        type: SETTLEMENT_TYPE.DRIVER_PAYMENT,
        amount: signedAmount,
        notes: notes ?? "تسوية يدوية",
      });
    },

    getLedger(driverId, filters = {}) {
      const db = getDb();
      const { clause, params } = buildDateFilter(filters.from, filters.to);
      const conditions = ["driver_id=?"];
      const allParams = [driverId];
      if (clause) {
        conditions.push(clause);
        allParams.push(...params);
      }
      return db
        .prepare(
          `SELECT * FROM driver_settlements WHERE ${conditions.join(" AND ")} ORDER BY date DESC, time DESC`,
        )
        .all(...allParams)
        .map(mapSettlement);
    },
  };

  return driversDB;
}

module.exports = { createDriversDB, mapDriver };
