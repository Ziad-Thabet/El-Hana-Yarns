const bcryptjs = require("bcryptjs");
const { generateId } = require("../helpers/ids.cjs");
const { buildDateFilter } = require("../helpers/dateFilter.cjs");
const {
  formatDateYMD,
  workDaysInMonth,
} = require("../../shared/dateRules.cjs");
const { mapShift } = require("./shifts.cjs");
function createEmployeesDB(getDb, shiftsDB) {
  const employeesDB = {
    getAll() {
      return getDb()
        .prepare(
          `SELECT u.id, u.username, u.display_name, u.role,
                  u.is_active, u.salary_type, u.daily_hours, u.created_at,
                  sh.amount AS current_salary
           FROM users u
           LEFT JOIN (
             SELECT user_id, amount,
                    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY effective_from DESC) AS rn
             FROM salary_history
           ) sh ON sh.user_id = u.id AND sh.rn = 1
           ORDER BY u.display_name`,
        )
        .all()
        .map((r) => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          role: r.role,
          isActive: r.is_active === 1,
          salaryType: r.salary_type,
          dailyHours: r.daily_hours,
          createdAt: r.created_at,
          currentSalary: r.current_salary ?? null,
        }));
    },
    getById(id) {
      const r = getDb().prepare("SELECT * FROM users WHERE id=?").get(id);
      if (!r) return null;
      return {
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        role: r.role,
        isActive: r.is_active === 1,
        salaryType: r.salary_type,
        dailyHours: r.daily_hours,
        createdAt: r.created_at,
      };
    },
    create(data) {
      if (!data.username || !data.password || !data.displayName) {
        throw new Error("missing_required_fields");
      }
      const db = getDb();
      const username = data.username.trim();
      const password = data.password.trim();
      if (username.length < 3) throw new Error("username_too_short");
      if (password.length < 8) throw new Error("password_too_short");
      const existing = db
        .prepare("SELECT id FROM users WHERE username=?")
        .get(username);
      if (existing) throw new Error("username_already_exists");
      const id = generateId("user");
      const hash = bcryptjs.hashSync(password, 12);
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO users (id, username, password_hash, display_name, role,
          is_active, salary_type, daily_hours, created_at)
         VALUES (?,?,?,?,?,1,?,?,?)`,
      ).run(
        id,
        username,
        hash,
        data.displayName,
        data.role ?? "staff",
        data.salaryType ?? "monthly",
        data.dailyHours ?? 8,
        now,
      );
      // First salary record
      if (data.salary) {
        this.setSalary(id, data.salary, now.slice(0, 10), "راتب ابتدائي");
      }
      return this.getById(id);
    },
    update(id, data) {
      const fields = [];
      const vals = [];
      if (data.displayName !== undefined) {
        fields.push("display_name=?");
        vals.push(data.displayName);
      }
      if (data.salaryType !== undefined) {
        fields.push("salary_type=?");
        vals.push(data.salaryType);
      }
      if (data.dailyHours !== undefined) {
        fields.push("daily_hours=?");
        vals.push(data.dailyHours);
      }
      if (fields.length === 0) throw new Error("no_fields_to_update");
      vals.push(id);
      getDb()
        .prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`)
        .run(...vals);
      return this.getById(id);
    },
    setSalary(userId, amount, effectiveFrom, notes = null) {
      const id = generateId("sal");
      const now = new Date().toISOString();
      getDb()
        .prepare(
          `INSERT INTO salary_history (id, user_id, amount, effective_from, created_at, notes)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(id, userId, amount, effectiveFrom, now, notes);
      return { id, userId, amount, effectiveFrom };
    },
    getSalaryHistory(userId) {
      return getDb()
        .prepare(
          "SELECT * FROM salary_history WHERE user_id=? ORDER BY effective_from DESC",
        )
        .all(userId);
    },
    setActive(userId, isActive) {
      const db = getDb();
      // Admin cannot deactivate themselves — enforced by electron-main
      db.prepare("UPDATE users SET is_active=? WHERE id=?").run(
        isActive ? 1 : 0,
        userId,
      );
      // If deactivated, close their open shift
      if (!isActive) {
        const today = formatDateYMD(new Date());
        const openShift = db
          .prepare("SELECT * FROM shifts WHERE user_id=? AND status='open'")
          .get(userId);
        if (openShift) {
          const summary = shiftsDB.getSummary(openShift.id);
          db.prepare(
            `UPDATE shifts SET status='closed', ended_at=?,
             total_cash=?, total_vodafone=?, total_instapay=?, total_invoices=?
             WHERE id=?`,
          ).run(
            new Date().toISOString(),
            summary.cash,
            summary.vodafone_cash,
            summary.instapay,
            summary.totalInvoices,
            openShift.id,
          );
        }
      }
      return { success: true };
    },
    changePassword(userId, newPassword) {
      const password = newPassword.trim();
      if (password.length < 8) throw new Error("password_too_short");
      const hash = bcryptjs.hashSync(password, 12);
      getDb()
        .prepare("UPDATE users SET password_hash=? WHERE id=?")
        .run(hash, userId);
      return { success: true };
    },
    getShifts(userId, from = null, to = null) {
      const { clause, params } = buildDateFilter(from, to, "s.date");
      const where = `WHERE s.user_id=?${clause ? " AND " + clause : ""}`;
      return getDb()
        .prepare(
          `SELECT s.* FROM shifts s ${where} ORDER BY s.date DESC, s.started_at DESC`,
        )
        .all(userId, ...params)
        .map(mapShift);
    },
    getShiftInvoices(shiftId) {
      return shiftsDB.getInvoices(shiftId);
    },

    getSalarySummary(userId, from, to) {
      const db = getDb();
      const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
      if (!user) throw new Error("user_not_found");
      const { clause, params } = buildDateFilter(from, to, "");
      const where = `WHERE user_id=? AND status='closed'${clause ? " AND " + clause : ""}`;
      const shifts = db
        .prepare(`SELECT * FROM shifts ${where} ORDER BY date`)
        .all(userId, ...params);
      let totalHours = 0;
      const shiftDetails = [];
      for (const shift of shifts) {
        // Salary effective on the shift date
        const salaryRow = db
          .prepare(
            "SELECT amount FROM salary_history WHERE user_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1",
          )
          .get(userId, shift.date);
        const salary = salaryRow?.amount ?? 0;
        const startMs = shift.started_at
          ? new Date(shift.started_at).getTime()
          : 0;
        const endMs = shift.ended_at ? new Date(shift.ended_at).getTime() : 0;
        const hours =
          startMs && endMs ? Math.max(0, (endMs - startMs) / 3_600_000) : 0;
        // Calculate hourly salary based on salary type
        let hourlyRate = 0;
        if (salary > 0) {
          const shiftDate = new Date(shift.date);
          if (user.salary_type === "weekly") {
            hourlyRate = salary / (6 * (user.daily_hours ?? 8));
          } else {
            const y = shiftDate.getFullYear();
            const m = shiftDate.getMonth() + 1;
            const workDays = workDaysInMonth(y, m);
            const workHours = workDays * (user.daily_hours ?? 8);
            hourlyRate = salary / workHours;
          }
        }
        const earned = hours * hourlyRate;
        totalHours += hours;
        shiftDetails.push({
          shiftId: shift.id,
          date: shift.date,
          hours: +hours.toFixed(2),
          salary,
          hourlyRate: +hourlyRate.toFixed(4),
          earned: +earned.toFixed(2),
        });
      }
      const totalEarned = shiftDetails.reduce((s, d) => s + d.earned, 0);
      return {
        userId,
        from,
        to,
        totalHours: +totalHours.toFixed(2),
        totalEarned: +totalEarned.toFixed(2),
        salaryType: user.salary_type,
        dailyHours: user.daily_hours,
        shifts: shiftDetails,
      };
    },
  };
  return employeesDB;
}
module.exports = { createEmployeesDB };
