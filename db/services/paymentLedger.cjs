const { generateId } = require("../helpers/ids.cjs");
const { safeNumber, round } = require("../helpers/numbers.cjs");

/**
 * The one place a payment is written.
 *
 * `payment_records` is the shop's ledger: takings, refunds, debt collections
 * and supplier payments all land in it, and almost every figure the system
 * reports is derived from it. Until now eleven statements across five
 * repositories wrote to it directly, each remembering for itself which
 * `ref_type` to use, which `source` tag, whether to attach the shift, and —
 * for a refund — that the amount is stored negative.
 *
 * That is a lot to remember correctly eleven times, and twice it was not:
 * payments were written with no shift attached, making them invisible to every
 * shift summary, and the refund sign convention exists only as a convention.
 * Each of those cost a defect. This module turns the conventions into the only
 * way to write a row.
 *
 * Columns are deliberately listed once, in full. A caller that has no receipt
 * or no note passes nothing and gets NULL, exactly as the old statements did
 * by omitting the column.
 */

/** What a payment is *for*, which is what the reports group by. */
const SOURCE = {
  /** Money taken at the point of sale, or on dispatch of an online order. */
  CHECKOUT: "checkout",
  /** A later collection against a debt the sale already booked as revenue. */
  DEBT_SETTLEMENT: "debt_settlement",
  /** Money handed back for returned goods. Always a negative amount. */
  REFUND: "refund",
};

/** Which ledger a row belongs to. */
const REF_TYPE = {
  SALE: "sale",
  PURCHASE: "purchase",
  DEBT: "debt",
};

const INSERT_SQL = `
  INSERT INTO payment_records
    (id, ref_id, ref_type, amount, date, time, method, receipt_image, notes, source, shift_id)
  VALUES
    (@id, @refId, @refType, @amount, @date, @time, @method, @receiptImage, @notes, @source, @shiftId)
`;

function createPaymentLedger(getDb) {
  /**
   * Writes one row. Everything else in this module is a named way of calling
   * this with the right conventions already applied.
   */
  function insert({
    refId,
    refType,
    amount,
    date,
    time,
    method,
    receiptImage = null,
    notes = null,
    source = null,
    shiftId = null,
  }) {
    // Validated before coercion: safeNumber turns anything unparseable into
    // zero, which would write a silent zero payment rather than complain.
    const value = Number(amount);
    if (!Number.isFinite(value)) throw new Error("payment_amount_invalid");
    if (!refId) throw new Error("payment_ref_required");

    const id = generateId("pay");
    getDb()
      .prepare(INSERT_SQL)
      .run({
        id,
        refId,
        refType,
        // Rounded here so no caller can push a third decimal into the ledger;
        // money is whole cents, and an accounting invariant already asserts it.
        amount: round(value),
        date,
        time,
        method: method ?? "cash",
        receiptImage,
        notes,
        source,
        shiftId,
      });
    return id;
  }

  return {
    SOURCE,
    REF_TYPE,

    /**
     * Money taken for a sale at the counter or on dispatch. The shift matters:
     * a collection with no shift is invisible to that shift's summary and to
     * the drawer count at closing.
     */
    recordSaleCollection({
      invoiceId,
      amount,
      method,
      date,
      time,
      shiftId = null,
      receiptImage = null,
      notes = null,
    }) {
      return insert({
        refId: invoiceId,
        refType: REF_TYPE.SALE,
        amount,
        date,
        time,
        method,
        receiptImage,
        notes,
        source: SOURCE.CHECKOUT,
        shiftId,
      });
    },

    /**
     * Money handed back for returned goods.
     *
     * Takes a positive amount and stores it negative. That is the convention
     * every total in the system depends on — shift takings, collected revenue
     * and the drawer all subtract refunds simply by summing the column — and
     * it is far too easy to get backwards at a call site.
     */
    recordRefund({ invoiceId, amount, method, date, time, shiftId = null, notes = null }) {
      const value = Math.abs(safeNumber(amount));
      return insert({
        refId: invoiceId,
        refType: REF_TYPE.SALE,
        amount: -value,
        date,
        time,
        method,
        notes,
        source: SOURCE.REFUND,
        shiftId,
      });
    },

    /**
     * A later collection against a debt.
     *
     * Recorded against the *invoice*, not the debt row, because the sale
     * booked the revenue when it happened; this is the money arriving. The
     * `debt_settlement` source is what keeps reports from counting the same
     * pound twice.
     */
    recordDebtSettlement({
      invoiceId,
      amount,
      method,
      date,
      time,
      shiftId = null,
      receiptImage = null,
      notes = null,
    }) {
      return insert({
        refId: invoiceId,
        refType: REF_TYPE.SALE,
        amount,
        date,
        time,
        method,
        receiptImage,
        notes,
        source: SOURCE.DEBT_SETTLEMENT,
        shiftId,
      });
    },

    /**
     * Money paid to a supplier against a purchase invoice.
     *
     * Carries no `source` and no shift, matching what the purchase repository
     * has always written: these are not takings, and the reports that read
     * them filter on `ref_type='purchase'` alone.
     */
    recordPurchasePayment({
      invoiceId,
      amount,
      method,
      date,
      time,
      receiptImage = null,
      notes = null,
    }) {
      return insert({
        refId: invoiceId,
        refType: REF_TYPE.PURCHASE,
        amount,
        date,
        time,
        method,
        receiptImage,
        notes,
      });
    },
  };
}

module.exports = { createPaymentLedger, SOURCE, REF_TYPE };
