/**
 * The payment methods the shop accepts.
 *
 * `payment_records.method` remains the source of truth for what was actually
 * collected — these rows describe those codes (label, ordering, whether they
 * behave like cash) rather than replacing them. That is what keeps this change
 * safe: no money moves through this table.
 */

/** Legacy shift columns, kept in step with the new child table. */
const LEGACY_COLUMN_BY_CODE = {
  cash: "total_cash",
  vodafone: "total_vodafone",
  instapay: "total_instapay",
};

/** The legacy JS key for a code, where it differs from the code itself. */
const LEGACY_KEY_BY_CODE = {
  cash: "cash",
  vodafone: "vodafone_cash",
  instapay: "instapay",
};

function mapMethod(row) {
  return {
    id: row.id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    kind: row.kind,
    isCash: row.kind === "cash",
    needsReceipt: row.needs_receipt === 1,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    isSystem: row.is_system === 1,
  };
}

function createPaymentMethodsDB(getDb) {
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      cache = getDb()
        .prepare("SELECT * FROM payment_methods ORDER BY sort_order, code")
        .all()
        .map(mapMethod);
    } catch {
      // Before the migration there is nothing to read; the callers fall back to
      // the legacy triplet.
      cache = [];
    }
    return cache;
  }

  const paymentMethodsDB = {
    invalidate() {
      cache = null;
    },
    getAll() {
      return load();
    },
    getActive() {
      return load().filter((m) => m.isActive);
    },
    byCode(code) {
      return load().find((m) => m.code === code) ?? null;
    },
    idForCode(code) {
      return paymentMethodsDB.byCode(code)?.id ?? null;
    },
    /** Rename, reorder or deactivate. Codes are immutable: they are the join
     *  key to every payment_records row ever written. */
    update(id, data) {
      const db = getDb();
      const existing = db
        .prepare("SELECT * FROM payment_methods WHERE id=?")
        .get(id);
      if (!existing) throw new Error("طريقة الدفع غير موجودة");
      if (existing.is_system === 1 && data.isActive === false) {
        throw new Error("لا يمكن تعطيل طريقة دفع أساسية");
      }
      db.prepare(
        `UPDATE payment_methods
            SET name_ar=?, name_en=?, needs_receipt=?, sort_order=?, is_active=?
          WHERE id=?`,
      ).run(
        data.nameAr ?? existing.name_ar,
        data.nameEn ?? existing.name_en,
        data.needsReceipt === undefined
          ? existing.needs_receipt
          : data.needsReceipt
            ? 1
            : 0,
        data.sortOrder ?? existing.sort_order,
        data.isActive === undefined ? existing.is_active : data.isActive ? 1 : 0,
        id,
      );
      paymentMethodsDB.invalidate();
      return mapMethod(
        db.prepare("SELECT * FROM payment_methods WHERE id=?").get(id),
      );
    },
  };

  return paymentMethodsDB;
}

module.exports = {
  createPaymentMethodsDB,
  LEGACY_COLUMN_BY_CODE,
  LEGACY_KEY_BY_CODE,
};
