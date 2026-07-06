const { generateId } = require("../helpers/ids.cjs");
const { buildDateFilter } = require("../helpers/dateFilter.cjs");
function createExpensesDB(getDb, employeesDB) {
  const expensesDB = {
    getCategories() {
      return getDb()
        .prepare(
          "SELECT * FROM expense_categories ORDER BY is_default DESC, name",
        )
        .all();
    },
    createCategory(name) {
      const id = generateId("excat");
      const now = new Date().toISOString();
      getDb()
        .prepare(
          "INSERT INTO expense_categories (id, name, is_default, created_at) VALUES (?,?,0,?)",
        )
        .run(id, name.trim(), now);
      return { id, name: name.trim(), isDefault: false };
    },
    deleteCategory(id) {
      const db = getDb();
      const used = db
        .prepare("SELECT COUNT(*) as c FROM expenses WHERE category_id=?")
        .get(id);
      if (used.c > 0) throw new Error("category_has_expenses");
      db.prepare("DELETE FROM expense_categories WHERE id=?").run(id);
      return { success: true };
    },
    add(data) {
      const id = generateId("exp");
      const now = new Date().toISOString();
      getDb()
        .prepare(
          `INSERT INTO expenses (id, category_id, amount, date, description, created_by, created_at)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          data.categoryId,
          data.amount,
          data.date,
          data.description ?? null,
          data.createdBy,
          now,
        );
      return this.getById(id);
    },
    getById(id) {
      return (
        getDb().prepare("SELECT * FROM expenses WHERE id=?").get(id) ?? null
      );
    },
    getAll(from = null, to = null) {
      const { clause, params } = buildDateFilter(from, to);
      const where = clause ? `WHERE ${clause}` : "";
      return getDb()
        .prepare(
          `SELECT e.*, ec.name AS category_name
           FROM expenses e
           LEFT JOIN expense_categories ec ON e.category_id = ec.id
           ${where}
           ORDER BY e.date DESC, e.created_at DESC`,
        )
        .all(...params)
        .map((r) => ({
          id: r.id,
          categoryId: r.category_id,
          categoryName: r.category_name,
          amount: r.amount,
          date: r.date,
          description: r.description,
          createdBy: r.created_by,
          createdAt: r.created_at,
        }));
    },
    delete(id) {
      getDb().prepare("DELETE FROM expenses WHERE id=?").run(id);
      return { success: true };
    },

    getNetSummary(from, to) {
      const db = getDb();
      const { clause, params } = buildDateFilter(from, to);
      const where = clause ? `WHERE ${clause}` : "";
      const collectedFilter = buildDateFilter(from, to, "pr");
      const collectedRow = db
        .prepare(
          `SELECT COALESCE(SUM(pr.amount),0) AS total
           FROM payment_records pr
           JOIN sale_invoices si ON si.id = pr.ref_id
           WHERE pr.ref_type='sale' AND si.voided = 0
           ${collectedFilter.clause ? "AND " + collectedFilter.clause : ""}`,
        )
        .get(...collectedFilter.params);
      const salesRow = { total: collectedRow.total };
      const expRows = db
        .prepare(
          `SELECT ec.name AS category_name, COALESCE(SUM(e.amount),0) AS total
           FROM expenses e
           LEFT JOIN expense_categories ec ON e.category_id = ec.id
           ${where ? where.replace("date", "e.date") : ""}
           GROUP BY e.category_id`,
        )
        .all(...params);
      const purchaseRow = db
        .prepare(
          `SELECT COALESCE(SUM(pr.amount),0) AS total
           FROM payment_records pr
           WHERE pr.ref_type='purchase'
           ${from ? " AND pr.date >= ?" : ""}
           ${to ? " AND pr.date <= ?" : ""}`,
        )
        .get(...[from, to].filter(Boolean));
      let salariesTotal = 0;
      const staffRows = db.prepare("SELECT id FROM users").all();
      for (const staff of staffRows) {
        try {
          const summary = employeesDB.getSalarySummary(staff.id, from, to);
          salariesTotal += summary.totalEarned;
        } catch {
          /* ignore */
        }
      }
      const totalExpenses = expRows.reduce((s, r) => s + r.total, 0);
      const net =
        (salesRow.total ?? 0) -
        totalExpenses -
        (purchaseRow.total ?? 0) -
        salariesTotal;
      return {
        revenue: salesRow.total ?? 0,
        expenses: expRows.map((r) => ({
          category: r.category_name,
          total: r.total,
        })),
        totalExpenses,
        purchasesPaid: purchaseRow.total ?? 0,
        salaries: +salariesTotal.toFixed(2),
        net: +net.toFixed(2),
      };
    },
  };
  return expensesDB;
}
module.exports = { createExpensesDB };
