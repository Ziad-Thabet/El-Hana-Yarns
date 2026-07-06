const { generateId } = require("../helpers/ids.cjs");
const { nowDateTime, normalizeIsoDate } = require("../helpers/isoDates.cjs");
const images = require("../helpers/images.cjs");
const { safeNumber } = require("../helpers/numbers.cjs");
function mapSaleInvoice(db, inv, items, payments = []) {
  const debt = db
    .prepare(
      "SELECT total_amount, paid_amount, remaining_amount FROM customer_debts WHERE invoice_id=? LIMIT 1",
    )
    .get(inv.id);
  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    date: inv.date,
    time: inv.time,
    total: inv.total,
    cashier: inv.cashier,
    shiftId: inv.shift_id ?? null,
    paymentMethod: payments[0]?.method ?? inv.payment_method ?? null,
    paidAmount: debt ? debt.paid_amount : undefined,
    remainingAmount: debt ? debt.remaining_amount : undefined,
    paymentHistory: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      date: p.date,
      time: p.time,
      method: p.method,
      receiptImage: images.readImageAsBase64(p.receipt_image),
      notes: p.notes,
    })),
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      barcode: i.barcode,
      isWeighted: i.is_weighted === 1,
      weightGrams: i.weight_grams,
      measureAmount: i.measure_amount,
      measureUnit: i.measure_unit,
      pricePerKg: i.price_per_kg,
      lineTotal: i.line_total,
    })),
  };
}
function createSalesDB(getDb, productsDB) {
  const salesDB = {
    getAll() {
      const db = getDb();
      return db
        .prepare(
          "SELECT * FROM sale_invoices WHERE voided=0 ORDER BY date DESC, time DESC",
        )
        .all()
        .map((inv) => {
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
    getById(id) {
      const db = getDb();
      const inv = db.prepare("SELECT * FROM sale_invoices WHERE id=?").get(id);
      if (!inv) return null;
      const items = db
        .prepare("SELECT * FROM sale_invoice_items WHERE invoice_id=?")
        .all(inv.id);
      const payments = db
        .prepare(
          "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='sale' ORDER BY date ASC, time ASC",
        )
        .all(id);
      return mapSaleInvoice(db, inv, items, payments);
    },
    complete(checkoutData) {
      const db = getDb();
      const id = generateId("sinv");
      const { date, time } = nowDateTime();
      const invoiceNumber = `SL-${Date.now()}`;
      const shiftId = checkoutData.shiftId ?? null;
      const totalPaid = checkoutData.totalPaid ?? checkoutData.total ?? 0;
      const remainingDebt = Math.max(0, (checkoutData.total ?? 0) - totalPaid);
      const changeDue = Math.max(0, totalPaid - (checkoutData.total ?? 0));
      const rawSplits = Array.isArray(checkoutData.paymentSplits)
        ? checkoutData.paymentSplits.filter((s) => (s?.amount ?? 0) > 0)
        : [];
      const splits =
        rawSplits.length > 0
          ? rawSplits
          : totalPaid > 0
            ? [
                {
                  method: checkoutData.paymentMethod ?? "cash",
                  amount: totalPaid,
                  receiptImage: null,
                },
              ]
            : [];
      let changeRemaining = changeDue;
      const recordedSplits = splits.map((split) => {
        let amount = split.amount ?? 0;
        if (changeRemaining > 0 && (split.method ?? "cash") === "cash") {
          const deduct = Math.min(amount, changeRemaining);
          amount -= deduct;
          changeRemaining -= deduct;
        }
        return { ...split, amount };
      });
      let createdDebt = null;
      const completeTx = db.transaction(() => {
        db.prepare(
          "INSERT INTO sale_invoices (id, invoice_number, date, time, total, cashier, shift_id) VALUES (?,?,?,?,?,?,?)",
        ).run(
          id,
          invoiceNumber,
          date,
          time,
          checkoutData.total ?? 0,
          checkoutData.cashier ?? "الكاشير",
          shiftId,
        );
        for (const split of recordedSplits) {
          const splitReceiptPath = images.saveImage(
            split.receiptImage ?? null,
            "receipt",
          );
          db.prepare(
            "INSERT INTO payment_records (id, ref_id, ref_type, amount, date, time, method, receipt_image, source, shift_id) VALUES (?,?,'sale',?,?,?,?,?,'checkout',?)",
          ).run(
            generateId("pay"),
            id,
            split.amount ?? 0,
            date,
            time,
            split.method ?? "cash",
            splitReceiptPath,
            shiftId,
          );
        }
        for (const item of checkoutData.items ?? []) {
          db.prepare(
            "INSERT INTO sale_invoice_items (id, invoice_id, product_id, name, price, quantity, barcode, is_weighted, weight_grams, measure_amount, measure_unit, price_per_kg, line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            generateId("sitem"),
            id,
            item.productId ?? null,
            item.name,
            item.price,
            item.quantity ?? 1,
            item.barcode ?? null,
            item.isWeighted ? 1 : 0,
            item.weightGrams ?? null,
            item.measureAmount ?? null,
            item.measureUnit ?? null,
            item.pricePerKg ?? null,
            item.lineTotal ?? item.price,
          );
          if (item.productId) {
            const deduct = item.isWeighted
              ? (item.weightGrams ?? 0)
              : (item.quantity ?? 1);
            productsDB.deductStock(item.productId, deduct);
          }
        }
        if (remainingDebt > 0) {
          const customerInfo = checkoutData.customerInfo ?? {};
          const phone = customerInfo.phone?.trim?.() || null;
          const name = customerInfo.name?.trim?.() || "عميل غير معروف";
          let customerId = null;
          if (phone) {
            const existing = db
              .prepare("SELECT id FROM customers WHERE phone=?")
              .get(phone);
            customerId = existing?.id ?? null;
          }
          if (!customerId) {
            customerId = generateId("cust");
            db.prepare(
              "INSERT INTO customers (id, name, phone, address, total_debt) VALUES (?,?,?,?,0)",
            ).run(customerId, name, phone, customerInfo.address ?? null);
          }
          const debtId = generateId("debt");
          db.prepare(
            "INSERT INTO customer_debts (id, customer_id, customer_name, invoice_id, invoice_number, total_amount, paid_amount, remaining_amount, created_date, last_updated, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            debtId,
            customerId,
            name,
            id,
            invoiceNumber,
            checkoutData.total ?? 0,
            totalPaid,
            remainingDebt,
            date,
            date,
            customerInfo.notes ?? null,
          );
          db.prepare(
            "UPDATE customers SET total_debt = total_debt + ? WHERE id=?",
          ).run(remainingDebt, customerId);
          createdDebt = { id: debtId, customerId };
        }
      });
      completeTx();
      return {
        id,
        invoiceNumber,
        changeDue,
        remainingDebt,
        debt: createdDebt,
      };
    },
    getBySource(source, from, to) {
      const db = getDb();
      const fromIso = normalizeIsoDate(from);
      const toIso = normalizeIsoDate(to);
      let query, params;
      if (source === "online") {
        query = `SELECT si.* FROM sale_invoices si
          INNER JOIN online_orders oo ON oo.sale_invoice_id = si.id
          WHERE si.voided = 0`;
      } else {
        query = `SELECT si.* FROM sale_invoices si
          LEFT JOIN online_orders oo ON oo.sale_invoice_id = si.id
          WHERE oo.id IS NULL AND si.voided = 0`;
      }
      if (fromIso && toIso) {
        query += " AND si.date BETWEEN ? AND ?";
        params = [fromIso, toIso];
      } else if (fromIso) {
        query += " AND si.date >= ?";
        params = [fromIso];
      } else if (toIso) {
        query += " AND si.date <= ?";
        params = [toIso];
      } else {
        params = [];
      }
      query += " ORDER BY si.date DESC, si.time DESC";
      return db
        .prepare(query)
        .all(...params)
        .map((inv) => {
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
    getStats(from, to) {
      const db = getDb();
      const fromIso = normalizeIsoDate(from);
      const toIso = normalizeIsoDate(to);
      if (fromIso && toIso) {
        const row = db
          .prepare(
            "SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_invoices WHERE voided=0 AND date BETWEEN ? AND ?",
          )
          .get(fromIso, toIso);
        return { total: safeNumber(row?.total), count: safeNumber(row?.count) };
      }
      if (fromIso) {
        const row = db
          .prepare(
            "SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_invoices WHERE voided=0 AND date >= ?",
          )
          .get(fromIso);
        return { total: safeNumber(row?.total), count: safeNumber(row?.count) };
      }
      if (toIso) {
        const row = db
          .prepare(
            "SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_invoices WHERE voided=0 AND date <= ?",
          )
          .get(toIso);
        return { total: safeNumber(row?.total), count: safeNumber(row?.count) };
      }
      const row = db
        .prepare(
          "SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_invoices WHERE voided=0",
        )
        .get();
      return { total: safeNumber(row?.total), count: safeNumber(row?.count) };
    },
  };
  return salesDB;
}
module.exports = { createSalesDB, mapSaleInvoice };
