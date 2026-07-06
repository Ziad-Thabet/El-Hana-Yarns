const { generateId } = require("../helpers/ids.cjs");
const { formatDateYMD } = require("../../shared/dateRules.cjs");
const OVERDUE_INVOICE_DAYS = 7;
const STALE_SHIFT_HOURS = 10;
function createAlertsDB(getDb, shiftsDB) {
  return {
    getAll() {
      const db = getDb();
      return db
        .prepare(
          "SELECT * FROM alerts WHERE is_read=0 ORDER BY created_at DESC",
        )
        .all();
    },
    markRead(id) {
      const db = getDb();
      db.prepare("UPDATE alerts SET is_read=1 WHERE id=?").run(id);
      return { success: true };
    },
    markAllRead() {
      const db = getDb();
      db.prepare("UPDATE alerts SET is_read=1 WHERE is_read=0").run();
      return { success: true };
    },
    setInvoiceDueDate(invoiceId, dueDate) {
      const db = getDb();
      const existing = db
        .prepare("SELECT id FROM invoice_due_dates WHERE invoice_id=?")
        .get(invoiceId);
      const now = new Date().toISOString();
      if (existing) {
        db.prepare(
          "UPDATE invoice_due_dates SET due_date=? WHERE invoice_id=?",
        ).run(dueDate, invoiceId);
      } else {
        db.prepare(
          "INSERT INTO invoice_due_dates (id, invoice_id, due_date, created_at) VALUES (?,?,?,?)",
        ).run(generateId("idd"), invoiceId, dueDate, now);
      }
      return { success: true };
    },

    runChecks() {
      const db = getDb();
      const now = new Date();
      const today = formatDateYMD(now);
      const sevenDaysAgo = formatDateYMD(
        new Date(now - OVERDUE_INVOICE_DAYS * 24 * 60 * 60 * 1000),
      );
      const insertAlert = db.prepare(
        `INSERT OR IGNORE INTO alerts (id, type, ref_id, message, is_read, due_date, created_at)
         VALUES (?,?,?,?,0,?,?)`,
      );

      const overdueInvoices = db
        .prepare(
          `SELECT id, invoice_number, supplier FROM purchase_invoices
           WHERE status IN ('unpaid','partial') AND date <= ?`,
        )
        .all(sevenDaysAgo);
      for (const inv of overdueInvoices) {
        insertAlert.run(
          generateId("alrt"),
          "invoice_overdue",
          inv.id,
          `فاتورة شراء متأخرة: ${inv.invoice_number} — ${inv.supplier}`,
          null,
          now.toISOString(),
        );
      }
      const dueToday = db
        .prepare(
          `SELECT idd.invoice_id, pi.invoice_number, pi.supplier
           FROM invoice_due_dates idd
           LEFT JOIN purchase_invoices pi ON pi.id = idd.invoice_id
           WHERE idd.due_date = ?`,
        )
        .all(today);
      for (const inv of dueToday) {
        insertAlert.run(
          generateId("alrt"),
          "invoice_due",
          inv.invoice_id,
          `موعد دفع اليوم: ${inv.invoice_number} — ${inv.supplier}`,
          today,
          now.toISOString(),
        );
      }
      const lowStock = db
        .prepare(
          `SELECT id, name, stock FROM products
           WHERE stock = 0`,
        )
        .all();
      for (const p of lowStock) {
        insertAlert.run(
          generateId("alrt"),
          "out_of_stock",
          p.id,
          `المنتج "${p.name}" نفد من المخزون`,
          null,
          now.toISOString(),
        );
      }
      const tenHoursAgo = new Date(now - STALE_SHIFT_HOURS * 60 * 60 * 1000);
      const openStaffShifts = db
        .prepare(
          `SELECT s.*, u.display_name
           FROM shifts s
           LEFT JOIN users u ON s.user_id = u.id
           WHERE s.status='open' AND u.role='staff'`,
        )
        .all();
      for (const shift of openStaffShifts) {
        const lastInv = db
          .prepare(
            "SELECT date, time FROM sale_invoices WHERE shift_id=? ORDER BY date DESC, time DESC LIMIT 1",
          )
          .get(shift.id);
        const refTime = lastInv
          ? new Date(`${lastInv.date}T${lastInv.time}`)
          : new Date(shift.started_at);
        if (refTime < tenHoursAgo) {
          insertAlert.run(
            generateId("alrt"),
            "shift_open",
            shift.id,
            `شيفت مفتوح منذ أكثر من 10 ساعات — ${shift.display_name}`,
            null,
            now.toISOString(),
          );
          shiftsDB.autoCloseStale(shift.user_id, today);
        }
      }
      console.log("✅ alertsDB.runChecks() completed");
    },
  };
}
module.exports = { createAlertsDB };
