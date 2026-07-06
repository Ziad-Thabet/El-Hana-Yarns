const { generateId } = require("../helpers/ids.cjs");
const images = require("../helpers/images.cjs");
const { nowDateTime } = require("../helpers/isoDates.cjs");
function mapDebt(row, payments = [], customerPhone = null) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    remainingAmount: row.remaining_amount,
    createdDate: row.created_date,
    lastUpdated: row.last_updated,
    notes: row.notes,
    paymentHistory: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      date: p.date,
      time: p.time,
      method: p.method,
      receiptImage: images.readImageAsBase64(p.receipt_image),
      notes: p.notes,
    })),
  };
}
function createDebtsDB(getDb) {
  const debtsDB = {
    getAll() {
      const db = getDb();
      return db
        .prepare("SELECT * FROM customer_debts ORDER BY created_date DESC")
        .all()
        .map((d) => {
          const payments = db
            .prepare(
              "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='sale' ORDER BY date ASC, time ASC",
            )
            .all(d.invoice_id);
          const customer = db
            .prepare("SELECT phone FROM customers WHERE id=?")
            .get(d.customer_id);
          return mapDebt(d, payments, customer?.phone ?? null);
        });
    },
    getById(id) {
      const db = getDb();
      const d = db.prepare("SELECT * FROM customer_debts WHERE id=?").get(id);
      if (!d) return null;
      const payments = db
        .prepare(
          "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='sale' ORDER BY date ASC, time ASC",
        )
        .all(d.invoice_id);
      const customer = db
        .prepare("SELECT phone FROM customers WHERE id=?")
        .get(d.customer_id);
      return mapDebt(d, payments, customer?.phone ?? null);
    },
    addPayment(debtId, paymentData) {
      const db = getDb();
      const debt = db
        .prepare("SELECT * FROM customer_debts WHERE id=?")
        .get(debtId);
      if (!debt) throw new Error("Debt not found");
      const newPaid = debt.paid_amount + paymentData.amount;
      const newRemaining = Math.max(0, debt.total_amount - newPaid);
      const { date, time } = nowDateTime();
      const debtReceiptPath = images.saveImage(
        paymentData.receiptImage,
        "receipt",
      );
      const payTx = db.transaction(() => {
        db.prepare(
          "UPDATE customer_debts SET paid_amount=?, remaining_amount=?, last_updated=? WHERE id=?",
        ).run(newPaid, newRemaining, date, debtId);
        db.prepare(
          "UPDATE customers SET total_debt = MAX(0, total_debt - ?), last_payment_date=? WHERE id=?",
        ).run(paymentData.amount, date, debt.customer_id);
        db.prepare(
          "INSERT INTO payment_records (id, ref_id, ref_type, amount, date, time, method, receipt_image, notes, source, shift_id) VALUES (?,?,'sale',?,?,?,?,?,?,'debt_settlement',?)",
        ).run(
          generateId("pay"),
          debt.invoice_id,
          paymentData.amount,
          paymentData.date ?? date,
          paymentData.time ?? time,
          paymentData.method ?? "cash",
          debtReceiptPath,
          paymentData.notes ?? null,
          paymentData.shiftId ?? null,
        );
      });
      payTx();
      return this.getById(debtId);
    },
    addBulkPayment(customerId, amount, paymentData) {
      const db = getDb();
      const customerDebts = db
        .prepare(
          "SELECT * FROM customer_debts WHERE customer_id=? AND remaining_amount > 0 ORDER BY created_date ASC",
        )
        .all(customerId);
      if (customerDebts.length === 0) {
        throw new Error("لا توجد فواتير متبقية لهذا العميل");
      }
      const totalRemaining = customerDebts.reduce(
        (s, d) => s + d.remaining_amount,
        0,
      );
      if (amount > totalRemaining) {
        throw new Error("المبلغ أكبر من إجمالي المتبقي على العميل");
      }
      const { date, time } = nowDateTime();
      const receiptPath = images.saveImage(paymentData.receiptImage, "receipt");
      let remainingToApply = amount;
      const affectedDebtIds = [];
      const bulkTx = db.transaction(() => {
        for (const debt of customerDebts) {
          if (remainingToApply <= 0) break;
          const applyAmount = Math.min(remainingToApply, debt.remaining_amount);
          const newPaid = debt.paid_amount + applyAmount;
          const newRemaining = Math.max(0, debt.total_amount - newPaid);
          db.prepare(
            "UPDATE customer_debts SET paid_amount=?, remaining_amount=?, last_updated=? WHERE id=?",
          ).run(newPaid, newRemaining, date, debt.id);
          db.prepare(
            "INSERT INTO payment_records (id, ref_id, ref_type, amount, date, time, method, receipt_image, notes, source, shift_id) VALUES (?,?,'sale',?,?,?,?,?,?,'debt_settlement',?)",
          ).run(
            generateId("pay"),
            debt.invoice_id,
            applyAmount,
            paymentData.date ?? date,
            paymentData.time ?? time,
            paymentData.method ?? "cash",
            receiptPath,
            paymentData.notes ?? null,
            paymentData.shiftId ?? null,
          );
          affectedDebtIds.push(debt.id);
          remainingToApply -= applyAmount;
        }
        db.prepare(
          "UPDATE customers SET total_debt = MAX(0, total_debt - ?), last_payment_date=? WHERE id=?",
        ).run(amount, date, customerId);
      });
      bulkTx();
      return affectedDebtIds.map((id) => this.getById(id));
    },
  };
  return debtsDB;
}
module.exports = { createDebtsDB, mapDebt };
