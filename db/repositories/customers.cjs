const { generateId } = require("../helpers/ids.cjs");
const { nowDateTime } = require("../helpers/isoDates.cjs");
const { mapDebt } = require("./debts.cjs");
function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    totalDebt: row.total_debt,
    lastPaymentDate: row.last_payment_date,
  };
}
function mapAddress(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label,
    region: row.region,
    addressText: row.address_text,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
  };
}
function mapPhone(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    phone: row.phone,
    label: row.label,
    createdAt: row.created_at,
  };
}
function clearDefaultAddress(db, customerId) {
  db.prepare(
    "UPDATE online_customers_addresses SET is_default=0 WHERE customer_id=?",
  ).run(customerId);
}
function generateDebtInvoiceNumber(db, dateStr) {
  const datePrefix = `DEBT-${dateStr.replace(/-/g, "")}`;
  const last = db
    .prepare(
      "SELECT invoice_number FROM customer_debts WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1",
    )
    .get(`${datePrefix}-%`);
  let seq = 1;
  if (last) {
    const parts = last.invoice_number.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${datePrefix}-${String(seq).padStart(3, "0")}`;
}

function createCustomersDB(getDb, debtsDB) {
  return {
    getAll() {
      return getDb()
        .prepare("SELECT * FROM customers ORDER BY name")
        .all()
        .map(mapCustomer);
    },
    getById(id) {
      const row = getDb().prepare("SELECT * FROM customers WHERE id=?").get(id);
      return row ? mapCustomer(row) : null;
    },
    getByPhone(phone) {
      const row = getDb()
        .prepare("SELECT * FROM customers WHERE phone=?")
        .get(phone);
      return row ? mapCustomer(row) : null;
    },
    create(data) {
      const id = generateId("cust");
      getDb()
        .prepare(
          "INSERT INTO customers (id, name, phone, address, total_debt) VALUES (?,?,?,?,0)",
        )
        .run(id, data.name, data.phone ?? null, data.address ?? null);
      return this.getById(id);
    },
    update(id, data) {
      getDb()
        .prepare("UPDATE customers SET name=?, phone=?, address=? WHERE id=?")
        .run(data.name, data.phone ?? null, data.address ?? null, id);
      return this.getById(id);
    },
    delete(id) {
      getDb().prepare("DELETE FROM customers WHERE id=?").run(id);
      return { success: true };
    },
    getDebts(customerId) {
      const customer = getDb()
        .prepare("SELECT phone FROM customers WHERE id=?")
        .get(customerId);
      return getDb()
        .prepare(
          "SELECT * FROM customer_debts WHERE customer_id=? ORDER BY created_date DESC",
        )
        .all(customerId)
        .map((d) => mapDebt(d, [], customer?.phone ?? null));
    },
    addDebt(data) {
      const db = getDb();
      const id = generateId("debt");
      const { date } = nowDateTime();
      const remaining = data.totalAmount - (data.paidAmount ?? 0);
      const addDebtTx = db.transaction(() => {
        const invoiceNumber =
          data.invoiceNumber?.trim() || generateDebtInvoiceNumber(db, date);
        db.prepare(
          "INSERT INTO customer_debts (id, customer_id, customer_name, invoice_id, invoice_number, total_amount, paid_amount, remaining_amount, created_date, last_updated, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          data.customerId,
          data.customerName,
          data.invoiceId ?? null,
          invoiceNumber,
          data.totalAmount,
          data.paidAmount ?? 0,
          remaining,
          date,
          date,
          data.notes ?? null,
        );
        db.prepare(
          "UPDATE customers SET total_debt = total_debt + ? WHERE id=?",
        ).run(remaining, data.customerId);
      });
      addDebtTx();
      return debtsDB.getById(id);
    },
    getByAnyPhone(phone) {
      const db = getDb();
      const direct = db
        .prepare("SELECT * FROM customers WHERE phone=?")
        .get(phone);
      if (direct) return mapCustomer(direct);
      const viaExtra = db
        .prepare(
          "SELECT c.* FROM customers c JOIN online_customer_phones p ON p.customer_id = c.id WHERE p.phone=?",
        )
        .get(phone);
      return viaExtra ? mapCustomer(viaExtra) : null;
    },
    getAddresses(customerId) {
      return getDb()
        .prepare(
          "SELECT * FROM online_customers_addresses WHERE customer_id=? ORDER BY is_default DESC, created_at DESC",
        )
        .all(customerId)
        .map(mapAddress);
    },
    addAddress(customerId, data) {
      const db = getDb();
      const id = generateId("addr");
      const { date, time } = nowDateTime();
      const createdAt = `${date}T${time}`;
      const isDefault = data.isDefault ? 1 : 0;
      const tx = db.transaction(() => {
        if (isDefault) {
          clearDefaultAddress(db, customerId);
        }
        db.prepare(
          "INSERT INTO online_customers_addresses (id, customer_id, label, region, address_text, is_default, created_at) VALUES (?,?,?,?,?,?,?)",
        ).run(
          id,
          customerId,
          data.label ?? null,
          data.region ?? null,
          data.addressText,
          isDefault,
          createdAt,
        );
      });
      tx();
      return mapAddress(
        db
          .prepare("SELECT * FROM online_customers_addresses WHERE id=?")
          .get(id),
      );
    },
    updateAddress(addressId, data) {
      const db = getDb();
      const existing = db
        .prepare("SELECT * FROM online_customers_addresses WHERE id=?")
        .get(addressId);
      if (!existing) return null;
      const isDefault = data.isDefault ? 1 : 0;
      const tx = db.transaction(() => {
        if (isDefault) {
          clearDefaultAddress(db, existing.customer_id);
        }
        db.prepare(
          "UPDATE online_customers_addresses SET label=?, region=?, address_text=?, is_default=? WHERE id=?",
        ).run(
          data.label ?? null,
          data.region ?? null,
          data.addressText,
          isDefault,
          addressId,
        );
      });
      tx();
      return mapAddress(
        db
          .prepare("SELECT * FROM online_customers_addresses WHERE id=?")
          .get(addressId),
      );
    },
    deleteAddress(addressId) {
      getDb()
        .prepare("DELETE FROM online_customers_addresses WHERE id=?")
        .run(addressId);
      return { success: true };
    },
    setDefaultAddress(customerId, addressId) {
      const db = getDb();
      const tx = db.transaction(() => {
        clearDefaultAddress(db, customerId);
        db.prepare(
          "UPDATE online_customers_addresses SET is_default=1 WHERE id=? AND customer_id=?",
        ).run(addressId, customerId);
      });
      tx();
      return db
        .prepare(
          "SELECT * FROM online_customers_addresses WHERE customer_id=? ORDER BY is_default DESC, created_at DESC",
        )
        .all(customerId)
        .map(mapAddress);
    },
    getPhones(customerId) {
      return getDb()
        .prepare(
          "SELECT * FROM online_customer_phones WHERE customer_id=? ORDER BY created_at DESC",
        )
        .all(customerId)
        .map(mapPhone);
    },
    addPhone(customerId, data) {
      const db = getDb();
      const id = generateId("phone");
      const { date, time } = nowDateTime();
      const createdAt = `${date}T${time}`;
      db.prepare(
        "INSERT INTO online_customer_phones (id, customer_id, phone, label, created_at) VALUES (?,?,?,?,?)",
      ).run(id, customerId, data.phone, data.label ?? null, createdAt);
      return mapPhone(
        db.prepare("SELECT * FROM online_customer_phones WHERE id=?").get(id),
      );
    },
    updatePhone(phoneId, data) {
      const db = getDb();
      db.prepare(
        "UPDATE online_customer_phones SET phone=?, label=? WHERE id=?",
      ).run(data.phone, data.label ?? null, phoneId);
      return mapPhone(
        db
          .prepare("SELECT * FROM online_customer_phones WHERE id=?")
          .get(phoneId),
      );
    },
    deletePhone(phoneId) {
      getDb()
        .prepare("DELETE FROM online_customer_phones WHERE id=?")
        .run(phoneId);
      return { success: true };
    },
    getProfile(customerId) {
      const db = getDb();
      const customerRow = db
        .prepare("SELECT * FROM customers WHERE id=?")
        .get(customerId);
      if (!customerRow) return null;
      const addresses = db
        .prepare(
          "SELECT * FROM online_customers_addresses WHERE customer_id=? ORDER BY is_default DESC, created_at DESC",
        )
        .all(customerId)
        .map(mapAddress);
      const phones = db
        .prepare(
          "SELECT * FROM online_customer_phones WHERE customer_id=? ORDER BY created_at DESC",
        )
        .all(customerId)
        .map(mapPhone);
      return { customer: mapCustomer(customerRow), addresses, phones };
    },
  };
}
module.exports = { createCustomersDB };
