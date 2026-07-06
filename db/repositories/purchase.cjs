const { generateId } = require("../helpers/ids.cjs");
const images = require("../helpers/images.cjs");
const { nowDateTime } = require("../helpers/isoDates.cjs");
function mapPurchaseInvoice(inv, items, payments) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    supplier: inv.supplier,
    date: inv.date,
    time: inv.time,
    total: inv.total,
    status: inv.status,
    paidAmount: inv.paid_amount,
    dueDate: inv.due_date ?? null,
    receiptImage: images.readImageAsBase64(inv.receipt_image),
    items: items.map((i) => ({
      id: i.id,
      productName: i.product_name,
      barcode: i.barcode,
      quantity: i.quantity,
      unit: i.unit,
      purchasePrice: i.purchase_price,
      itemTotal: i.item_total ?? i.purchase_price * i.quantity,
      category: i.category,
    })),
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
function createPurchaseDB(getDb, productsDB) {
  function generateInvoiceNumber() {
    const db = getDb();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const datePrefix = `PI-${y}${m}${d}`;
    const last = db
      .prepare(
        "SELECT invoice_number FROM purchase_invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1",
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
  const purchaseDB = {
   getAll() {
      const db = getDb();
      const invoices = db
        .prepare(
          `SELECT pi.*, idd.due_date AS due_date
           FROM purchase_invoices pi
           LEFT JOIN invoice_due_dates idd ON idd.invoice_id = pi.id
           ORDER BY pi.date DESC, pi.time DESC`,
        )
        .all();
      return invoices.map((inv) => {
        const items = db
          .prepare("SELECT * FROM purchase_invoice_items WHERE invoice_id=?")
          .all(inv.id);
        const payments = db
          .prepare(
            "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='purchase'",
          )
          .all(inv.id);
        return mapPurchaseInvoice(inv, items, payments);
      });
    },
   getById(id) {
      const db = getDb();
      const inv = db
        .prepare(
          `SELECT pi.*, idd.due_date AS due_date
           FROM purchase_invoices pi
           LEFT JOIN invoice_due_dates idd ON idd.invoice_id = pi.id
           WHERE pi.id=?`,
        )
        .get(id);
      if (!inv) return null;
      const items = db
        .prepare("SELECT * FROM purchase_invoice_items WHERE invoice_id=?")
        .all(id);
      const payments = db
        .prepare(
          "SELECT * FROM payment_records WHERE ref_id=? AND ref_type='purchase'",
        )
        .all(id);
      return mapPurchaseInvoice(inv, items, payments);
    },
    save(data) {
      const db = getDb();
      const id = data.id ?? generateId("pinv");
      const { date, time } = nowDateTime();
      const invoiceNumber =
        data.invoiceNumber?.trim() || generateInvoiceNumber();
      const status =
        data.paidAmount >= data.total
          ? "paid"
          : data.paidAmount > 0
            ? "partial"
            : "unpaid";
      const receiptPath = images.saveImage(data.receiptImage, "receipt");
      const saveTx = db.transaction(() => {
        db.prepare(
          "INSERT INTO purchase_invoices (id, invoice_number, supplier, date, time, total, status, paid_amount, receipt_image) VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          invoiceNumber,
          data.supplier,
          data.date ?? date,
          data.time ?? time,
          data.total ?? 0,
          data.status ?? status,
          data.paidAmount ?? 0,
          receiptPath,
        );
        for (const item of data.items ?? []) {
          const itemTotal =
            item.itemTotal ?? item.purchasePrice * item.quantity;
          const unitPrice = item.quantity > 0 ? itemTotal / item.quantity : 0;
          db.prepare(
            "INSERT INTO purchase_invoice_items (id, invoice_id, product_name, barcode, quantity, unit, purchase_price, item_total, category) VALUES (?,?,?,?,?,?,?,?,?)",
          ).run(
            generateId("pitem"),
            id,
            item.productName,
            item.barcode ?? null,
            item.quantity,
            item.unit ?? "piece",
            unitPrice,
            itemTotal,
            item.category ?? null,
          );
          let existing = null;
          if (item.barcode) {
            existing = db
              .prepare("SELECT id FROM products WHERE barcode=?")
              .get(item.barcode);
          }
          if (!existing && !item.barcode && item.productName) {
            existing = db
              .prepare("SELECT id FROM products WHERE name=?")
              .get(item.productName);
          }
          if (existing) productsDB.addStock(existing.id, item.quantity);
        }
        if (data.paidAmount > 0) {
          db.prepare(
            "INSERT INTO payment_records (id, ref_id, ref_type, amount, date, time, method, receipt_image) VALUES (?,?,'purchase',?,?,?,?,?)",
          ).run(
            generateId("pay"),
            id,
            data.paidAmount,
            data.date ?? date,
            data.time ?? time,
            data.method ?? "cash",
            receiptPath,
          );
        }
      });
      saveTx();
      return this.getById(id);
    },
    addPayment(invoiceId, paymentData) {
      const db = getDb();
      const inv = db
        .prepare("SELECT * FROM purchase_invoices WHERE id=?")
        .get(invoiceId);
      if (!inv) throw new Error("Invoice not found");
      const newPaid = inv.paid_amount + paymentData.amount;
      const newStatus = newPaid >= inv.total ? "paid" : "partial";
      const { date, time } = nowDateTime();
      const payReceiptPath = images.saveImage(
        paymentData.receiptImage,
        "receipt",
      );
      const payTx = db.transaction(() => {
        db.prepare(
          "UPDATE purchase_invoices SET paid_amount=?, status=? WHERE id=?",
        ).run(newPaid, newStatus, invoiceId);
        db.prepare(
          "INSERT INTO payment_records (id, ref_id, ref_type, amount, date, time, method, receipt_image, notes) VALUES (?,?,'purchase',?,?,?,?,?,?)",
        ).run(
          generateId("pay"),
          invoiceId,
          paymentData.amount,
          paymentData.date ?? date,
          paymentData.time ?? time,
          paymentData.method ?? "cash",
          payReceiptPath,
          paymentData.notes ?? null,
        );
      });
      payTx();
      return this.getById(invoiceId);
    },
    delete(id) {
      getDb().prepare("DELETE FROM purchase_invoices WHERE id=?").run(id);
      return { success: true };
    },
  };
  return purchaseDB;
}
module.exports = { createPurchaseDB };
