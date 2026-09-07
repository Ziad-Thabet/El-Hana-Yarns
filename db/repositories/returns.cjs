const { generateId } = require("../helpers/ids.cjs");
const { nowDateTime } = require("../helpers/isoDates.cjs");
const { round, safeNumber } = require("../helpers/numbers.cjs");
const { stockUnitsForRow } = require("../../shared/stockUnits.cjs");

/**
 * Sale returns and voids.
 *
 * A sale that happened is a fact; a correction is a second fact that references
 * it. Returns are therefore their own document rather than an edit of the
 * original invoice, which keeps the audit trail intact and lets a customer come
 * back twice for two separate items.
 *
 * The refund is written as a NEGATIVE payment_records row against the original
 * invoice, mirroring the methods the customer actually paid with. That single
 * choice makes the cash drawer, the shift summary and every existing
 * "collected revenue" query net out with no changes to those queries.
 */

function mapReturn(row, items = []) {
  return {
    id: row.id,
    returnNumber: row.return_number,
    invoiceId: row.invoice_id,
    date: row.date,
    time: row.time,
    total: row.total,
    refundedCash: row.refunded_cash,
    debtReduced: row.debt_reduced,
    isFull: row.is_full === 1,
    reason: row.reason,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    shiftId: row.shift_id ?? null,
    createdAt: row.created_at,
    items: items.map((i) => ({
      id: i.id,
      invoiceItemId: i.invoice_item_id,
      productId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      lineTotal: i.line_total,
      restocked: i.restocked === 1,
    })),
  };
}

function createReturnsDB(getDb, productsDB) {
  function generateReturnNumber(db, date) {
    const prefix = `RT-${date.replace(/-/g, "")}`;
    const last = db
      .prepare(
        "SELECT return_number FROM sale_returns WHERE return_number LIKE ? ORDER BY return_number DESC LIMIT 1",
      )
      .get(`${prefix}-%`);
    let seq = 1;
    if (last) {
      const parsed = parseInt(last.return_number.split("-").pop(), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
    return `${prefix}-${String(seq).padStart(3, "0")}`;
  }

  function getItemsForReturn(db, returnId) {
    return db
      .prepare("SELECT * FROM sale_return_items WHERE return_id=?")
      .all(returnId);
  }

  const returnsDB = {
    getForInvoice(invoiceId) {
      const db = getDb();
      return db
        .prepare(
          `SELECT r.*, u.display_name AS created_by_name
             FROM sale_returns r
             LEFT JOIN users u ON u.id = r.created_by
            WHERE r.invoice_id = ?
            ORDER BY r.date DESC, r.time DESC`,
        )
        .all(invoiceId)
        .map((row) => mapReturn(row, getItemsForReturn(db, row.id)));
    },

    /**
     * Invoice lines with the quantity already returned subtracted, so the UI
     * can never offer more than is actually outstanding.
     */
    getReturnableLines(invoiceId) {
      const db = getDb();
      const invoice = db
        .prepare("SELECT * FROM sale_invoices WHERE id=?")
        .get(invoiceId);
      if (!invoice) throw new Error("الفاتورة غير موجودة");

      const rows = db
        .prepare("SELECT * FROM sale_invoice_items WHERE invoice_id=?")
        .all(invoiceId);

      return rows.map((row) => {
        const soldUnits = stockUnitsForRow(row);
        const returned = safeNumber(
          db
            .prepare(
              `SELECT COALESCE(SUM(ri.quantity),0) AS q
                 FROM sale_return_items ri
                 JOIN sale_returns r ON r.id = ri.return_id
                WHERE ri.invoice_item_id = ?`,
            )
            .get(row.id)?.q,
        );
        return {
          invoiceItemId: row.id,
          productId: row.product_id,
          name: row.name,
          isWeighted: row.is_weighted === 1,
          measureUnit: row.measure_unit,
          soldQuantity: round(soldUnits, 3),
          returnedQuantity: round(returned, 3),
          returnableQuantity: round(Math.max(0, soldUnits - returned), 3),
          lineTotal: row.line_total,
          // Value per stock unit, derived from the recorded line total so a
          // partial return can never drift from what was actually charged.
          unitValue: soldUnits > 0 ? row.line_total / soldUnits : 0,
        };
      });
    },

    /**
     * @param lines [{ invoiceItemId, quantity, restock }]
     */
    create(invoiceId, { lines = [], reason = null, userId, shiftId = null }) {
      const db = getDb();
      const invoice = db
        .prepare("SELECT * FROM sale_invoices WHERE id=?")
        .get(invoiceId);
      if (!invoice) throw new Error("الفاتورة غير موجودة");
      if (invoice.voided === 1) {
        throw new Error("لا يمكن استرجاع فاتورة ملغاة");
      }
      if (!userId) throw new Error("لا يمكن تسجيل مرتجع بدون مستخدم");

      const returnable = returnsDB.getReturnableLines(invoiceId);
      const byId = new Map(returnable.map((l) => [l.invoiceItemId, l]));

      const prepared = [];
      for (const line of lines) {
        const source = byId.get(line.invoiceItemId);
        if (!source) throw new Error("صنف غير موجود في الفاتورة");
        const quantity = safeNumber(line.quantity);
        if (quantity <= 0) continue;
        if (quantity > source.returnableQuantity + 1e-6) {
          throw new Error(
            `الكمية المرتجعة لـ "${source.name}" أكبر من المتبقي (${source.returnableQuantity})`,
          );
        }
        prepared.push({
          source,
          quantity,
          restock: line.restock !== false,
          lineTotal: round(source.unitValue * quantity),
        });
      }
      if (prepared.length === 0) {
        throw new Error("لم يتم تحديد أي أصناف للاسترجاع");
      }

      const refundTotal = round(
        prepared.reduce((sum, p) => sum + p.lineTotal, 0),
      );
      const { date, time } = nowDateTime();
      const returnId = generateId("sret");
      const returnNumber = generateReturnNumber(db, date);

      // Anything still owed on this invoice is written off before cash moves —
      // you cannot hand back money the customer never paid.
      const debt = db
        .prepare(
          "SELECT * FROM customer_debts WHERE invoice_id=? ORDER BY created_date ASC LIMIT 1",
        )
        .get(invoiceId);
      const outstanding = debt ? safeNumber(debt.remaining_amount) : 0;
      const debtReduced = round(Math.min(refundTotal, outstanding));
      const cashRefund = round(refundTotal - debtReduced);

      // Mirror the methods actually collected, pro rata.
      const collected = db
        .prepare(
          `SELECT method, SUM(amount) AS amount
             FROM payment_records
            WHERE ref_id=? AND ref_type='sale' AND amount > 0
            GROUP BY method
            ORDER BY amount DESC`,
        )
        .all(invoiceId);
      const collectedTotal = collected.reduce(
        (sum, row) => sum + safeNumber(row.amount),
        0,
      );

      const refundSplits = [];
      if (cashRefund > 0) {
        if (collectedTotal <= 0) {
          refundSplits.push({ method: "cash", amount: cashRefund });
        } else {
          let allocated = 0;
          collected.forEach((row, index) => {
            const isLast = index === collected.length - 1;
            const share = isLast
              ? round(cashRefund - allocated)
              : round((safeNumber(row.amount) / collectedTotal) * cashRefund);
            if (share > 0) {
              refundSplits.push({ method: row.method, amount: share });
              allocated = round(allocated + share);
            }
          });
        }
      }

      const totalReturnableValue = returnable.reduce(
        (sum, l) => sum + l.unitValue * l.returnableQuantity,
        0,
      );
      const isFull = refundTotal >= round(totalReturnableValue) - 0.01;

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO sale_returns
             (id, return_number, invoice_id, date, time, total, refunded_cash,
              debt_reduced, is_full, reason, created_by, shift_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          returnId,
          returnNumber,
          invoiceId,
          date,
          time,
          refundTotal,
          cashRefund,
          debtReduced,
          isFull ? 1 : 0,
          reason,
          userId,
          shiftId,
          new Date().toISOString(),
        );

        const insertItem = db.prepare(
          `INSERT INTO sale_return_items
             (id, return_id, invoice_item_id, product_id, name, quantity, line_total, restocked)
           VALUES (?,?,?,?,?,?,?,?)`,
        );
        for (const entry of prepared) {
          insertItem.run(
            generateId("sritem"),
            returnId,
            entry.source.invoiceItemId,
            entry.source.productId,
            entry.source.name,
            entry.quantity,
            entry.lineTotal,
            entry.restock ? 1 : 0,
          );
          // Damaged goods are refunded without going back on the shelf.
          if (entry.restock && entry.source.productId) {
            productsDB.addStock(entry.source.productId, entry.quantity);
          }
        }

        const insertPayment = db.prepare(
          `INSERT INTO payment_records
             (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id)
           VALUES (?,?,'sale',?,?,?,?,?,'refund',?)`,
        );
        for (const split of refundSplits) {
          insertPayment.run(
            generateId("pay"),
            invoiceId,
            -split.amount,
            date,
            time,
            split.method,
            `مرتجع ${returnNumber}`,
            shiftId,
          );
        }

        if (debtReduced > 0 && debt) {
          const newTotal = round(safeNumber(debt.total_amount) - debtReduced);
          const newRemaining = round(
            Math.max(0, safeNumber(debt.remaining_amount) - debtReduced),
          );
          db.prepare(
            "UPDATE customer_debts SET total_amount=?, remaining_amount=?, last_updated=? WHERE id=?",
          ).run(newTotal, newRemaining, date, debt.id);
          db.prepare(
            "UPDATE customers SET total_debt = MAX(0, total_debt - ?) WHERE id=?",
          ).run(debtReduced, debt.customer_id);
        }

        const stillReturnable = returnsDB
          .getReturnableLines(invoiceId)
          .reduce((sum, l) => sum + l.returnableQuantity, 0);
        db.prepare("UPDATE sale_invoices SET return_status=? WHERE id=?").run(
          stillReturnable <= 1e-6 ? "full" : "partial",
          invoiceId,
        );
      });
      tx();

      return {
        ...returnsDB.getById(returnId),
        refundSplits,
      };
    },

    /** Returns every outstanding line and restocks all of it. */
    voidInvoice(invoiceId, { reason = null, userId, shiftId = null }) {
      const lines = returnsDB
        .getReturnableLines(invoiceId)
        .filter((l) => l.returnableQuantity > 0)
        .map((l) => ({
          invoiceItemId: l.invoiceItemId,
          quantity: l.returnableQuantity,
          restock: true,
        }));
      if (lines.length === 0) {
        throw new Error("لا توجد أصناف متبقية للاسترجاع في هذه الفاتورة");
      }
      return returnsDB.create(invoiceId, { lines, reason, userId, shiftId });
    },

    getById(id) {
      const db = getDb();
      const row = db
        .prepare(
          `SELECT r.*, u.display_name AS created_by_name
             FROM sale_returns r
             LEFT JOIN users u ON u.id = r.created_by
            WHERE r.id = ?`,
        )
        .get(id);
      if (!row) return null;
      return mapReturn(row, getItemsForReturn(db, id));
    },

    getAll(from = null, to = null) {
      const db = getDb();
      const clauses = [];
      const params = [];
      if (from) {
        clauses.push("r.date >= ?");
        params.push(from);
      }
      if (to) {
        clauses.push("r.date <= ?");
        params.push(to);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      return db
        .prepare(
          `SELECT r.*, u.display_name AS created_by_name
             FROM sale_returns r
             LEFT JOIN users u ON u.id = r.created_by
             ${where}
            ORDER BY r.date DESC, r.time DESC`,
        )
        .all(...params)
        .map((row) => mapReturn(row, getItemsForReturn(db, row.id)));
    },
  };

  return returnsDB;
}

module.exports = { createReturnsDB, mapReturn };
