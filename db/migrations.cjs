/**
 * Versioned schema migrations.
 *
 * Everything before this file was a hand-maintained list of `PRAGMA table_info`
 * checks that swallowed their own errors, so a half-applied schema change let
 * the app boot anyway. Migrations here are ordered, run inside a transaction,
 * tracked with `PRAGMA user_version`, and are allowed to throw — a database
 * that cannot be migrated must stop the app rather than serve wrong data.
 *
 * The legacy idempotent `createTables()` / ALTER helpers in database.cjs still
 * bring a database up to the baseline shape. New schema work belongs here.
 */

/** Reconstructs a column's DDL from PRAGMA table_info so a rebuilt table keeps
 *  exactly the columns it had, including ones added by ALTER over time. */
function columnDdl(col, isSinglePk) {
  let ddl = `"${col.name}" ${col.type || "TEXT"}`;
  if (isSinglePk) ddl += " PRIMARY KEY";
  if (col.notnull) ddl += " NOT NULL";
  if (col.dflt_value !== null && col.dflt_value !== undefined) {
    ddl += ` DEFAULT ${col.dflt_value}`;
  }
  return ddl;
}

/**
 * Adds foreign keys to an existing table.
 *
 * SQLite has no ALTER TABLE ADD CONSTRAINT, so the table is rebuilt following
 * the procedure from the SQLite docs. The new definition is derived from the
 * live schema rather than written out by hand, so it cannot drift from what is
 * actually there: columns come from table_info, UNIQUE constraints from
 * index_list entries with origin 'u', and explicit indexes are replayed from
 * their original CREATE statements.
 *
 * Caller must have foreign_keys OFF and must not be inside a transaction.
 */
function rebuildTableWithForeignKeys(db, table, foreignKeys) {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (cols.length === 0) return false;

  const pkCols = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  const singlePk = pkCols.length === 1 ? pkCols[0].name : null;

  const indexes = db.prepare(`PRAGMA index_list("${table}")`).all();
  const uniqueConstraints = [];
  for (const idx of indexes) {
    if (idx.origin !== "u" || idx.partial) continue;
    const parts = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
    uniqueConstraints.push(parts.map((p) => `"${p.name}"`).join(", "));
  }

  // Explicit CREATE INDEX statements (origin 'c'), plus any partial unique
  // indexes, which are always created explicitly rather than inline.
  const indexSql = db
    .prepare(
      `SELECT sql FROM sqlite_master
        WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`,
    )
    .all(table)
    .map((row) => row.sql);

  const tmp = `__migrate_${table}`;
  const defs = [
    ...cols.map((c) => columnDdl(c, c.name === singlePk)),
    ...uniqueConstraints.map((c) => `UNIQUE (${c})`),
    ...(pkCols.length > 1
      ? [`PRIMARY KEY (${pkCols.map((c) => `"${c.name}"`).join(", ")})`]
      : []),
    ...foreignKeys.map(
      (fk) =>
        `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}"("${fk.on || "id"}")` +
        ` ON DELETE ${fk.onDelete}`,
    ),
  ];
  const columnList = cols.map((c) => `"${c.name}"`).join(", ");

  db.exec(`CREATE TABLE "${tmp}" (\n  ${defs.join(",\n  ")}\n)`);
  db.exec(
    `INSERT INTO "${tmp}" (${columnList}) SELECT ${columnList} FROM "${table}"`,
  );
  db.exec(`DROP TABLE "${table}"`);
  db.exec(`ALTER TABLE "${tmp}" RENAME TO "${table}"`);
  for (const sql of indexSql) db.exec(sql);
  return true;
}

/**
 * Referential rules, chosen to protect financial history:
 *   CASCADE  — detail that has no meaning without its parent (invoice lines)
 *   RESTRICT — anything whose removal would rewrite past reports (a product,
 *              customer or user that already appears in history)
 *   SET NULL — optional associations (a shift, a driver)
 * `payment_records.ref_id` and `alerts.ref_id` are polymorphic and therefore
 * cannot carry a foreign key; they are cleaned up explicitly in code instead.
 */
const FOREIGN_KEYS = {
  sale_invoice_items: [
    { column: "invoice_id", references: "sale_invoices", onDelete: "CASCADE" },
    { column: "product_id", references: "products", onDelete: "RESTRICT" },
  ],
  purchase_invoice_items: [
    {
      column: "invoice_id",
      references: "purchase_invoices",
      onDelete: "CASCADE",
    },
    { column: "product_id", references: "products", onDelete: "RESTRICT" },
  ],
  customer_debts: [
    { column: "customer_id", references: "customers", onDelete: "RESTRICT" },
    { column: "invoice_id", references: "sale_invoices", onDelete: "CASCADE" },
  ],
  sale_invoices: [
    { column: "shift_id", references: "shifts", onDelete: "SET NULL" },
  ],
  payment_records: [
    { column: "shift_id", references: "shifts", onDelete: "SET NULL" },
  ],
  shifts: [{ column: "user_id", references: "users", onDelete: "RESTRICT" }],
  salary_history: [
    { column: "user_id", references: "users", onDelete: "CASCADE" },
  ],
  expenses: [
    {
      column: "category_id",
      references: "expense_categories",
      onDelete: "RESTRICT",
    },
    { column: "created_by", references: "users", onDelete: "RESTRICT" },
  ],
  invoice_due_dates: [
    {
      column: "invoice_id",
      references: "purchase_invoices",
      onDelete: "CASCADE",
    },
  ],
  online_orders: [
    { column: "customer_id", references: "customers", onDelete: "RESTRICT" },
    { column: "driver_id", references: "drivers", onDelete: "SET NULL" },
    {
      column: "sale_invoice_id",
      references: "sale_invoices",
      onDelete: "SET NULL",
    },
    { column: "created_by", references: "users", onDelete: "RESTRICT" },
  ],
  online_order_items: [
    { column: "order_id", references: "online_orders", onDelete: "CASCADE" },
    { column: "product_id", references: "products", onDelete: "RESTRICT" },
  ],
  driver_settlements: [
    { column: "driver_id", references: "drivers", onDelete: "RESTRICT" },
    { column: "order_id", references: "online_orders", onDelete: "SET NULL" },
  ],
  online_customers_addresses: [
    { column: "customer_id", references: "customers", onDelete: "CASCADE" },
  ],
  online_customer_phones: [
    { column: "customer_id", references: "customers", onDelete: "CASCADE" },
  ],
};

/** Child references with no surviving parent, deleted before the constraint
 *  that would reject them is added. */
const ORPHAN_CLEANUPS = [
  ["sale_invoice_items", "invoice_id", "sale_invoices"],
  ["sale_invoice_items", "product_id", "products"],
  ["purchase_invoice_items", "invoice_id", "purchase_invoices"],
  ["customer_debts", "customer_id", "customers"],
  ["customer_debts", "invoice_id", "sale_invoices"],
  ["salary_history", "user_id", "users"],
  ["expenses", "category_id", "expense_categories"],
  ["invoice_due_dates", "invoice_id", "purchase_invoices"],
  ["online_order_items", "order_id", "online_orders"],
  ["driver_settlements", "driver_id", "drivers"],
  ["online_customers_addresses", "customer_id", "customers"],
  ["online_customer_phones", "customer_id", "customers"],
];

/** Optional references that are blanked rather than deleting the whole row. */
const NULL_OUT_CLEANUPS = [
  ["sale_invoices", "shift_id", "shifts"],
  ["payment_records", "shift_id", "shifts"],
  ["online_orders", "driver_id", "drivers"],
  ["online_orders", "sale_invoice_id", "sale_invoices"],
  ["purchase_invoice_items", "product_id", "products"],
  ["online_order_items", "product_id", "products"],
  ["driver_settlements", "order_id", "online_orders"],
];

function tableExists(db, table) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
}

function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .some((c) => c.name === column);
}

/**
 * Before the C1 fix, `expenses.created_by` and `online_orders.created_by` were
 * written as the literal string "admin" rather than a user id. Point them at a
 * real admin account so the new foreign key can be satisfied without losing the
 * record of who entered them.
 */
function remapLegacyCreatedBy(db, report) {
  const admin = db
    .prepare(
      "SELECT id FROM users WHERE role='admin' ORDER BY created_at IS NULL, created_at ASC, id ASC LIMIT 1",
    )
    .get();
  for (const table of ["expenses", "online_orders"]) {
    if (!tableExists(db, table) || !hasColumn(db, table, "created_by")) continue;
    const stale = db
      .prepare(
        `SELECT COUNT(*) c FROM "${table}" ch
          WHERE ch.created_by IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ch.created_by)`,
      )
      .get().c;
    if (stale === 0) continue;
    if (!admin) {
      throw new Error(
        `Cannot migrate ${table}.created_by: ${stale} rows reference a missing user and no admin account exists to reassign them to`,
      );
    }
    db.prepare(
      `UPDATE "${table}" SET created_by = ?
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = "${table}".created_by)`,
    ).run(admin.id);
    report.remapped.push(`${table}.created_by: ${stale} → ${admin.id}`);
  }
}

function addForeignKeys(db) {
  const report = { deleted: [], nulled: [], remapped: [], rebuilt: [] };

  for (const [table, column, parent] of ORPHAN_CLEANUPS) {
    if (!tableExists(db, table) || !hasColumn(db, table, column)) continue;
    const result = db
      .prepare(
        `DELETE FROM "${table}"
          WHERE "${column}" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "${parent}" p WHERE p.id = "${table}"."${column}")`,
      )
      .run();
    if (result.changes > 0) {
      report.deleted.push(`${table}.${column}: ${result.changes}`);
    }
  }

  for (const [table, column, parent] of NULL_OUT_CLEANUPS) {
    if (!tableExists(db, table) || !hasColumn(db, table, column)) continue;
    const result = db
      .prepare(
        `UPDATE "${table}" SET "${column}" = NULL
          WHERE "${column}" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "${parent}" p WHERE p.id = "${table}"."${column}")`,
      )
      .run();
    if (result.changes > 0) {
      report.nulled.push(`${table}.${column}: ${result.changes}`);
    }
  }

  remapLegacyCreatedBy(db, report);

  for (const [table, keys] of Object.entries(FOREIGN_KEYS)) {
    if (!tableExists(db, table)) continue;
    const applicable = keys.filter((fk) => hasColumn(db, table, fk.column));
    if (applicable.length === 0) continue;
    if (rebuildTableWithForeignKeys(db, table, applicable)) {
      report.rebuilt.push(table);
    }
  }
  return report;
}

const MIGRATIONS = [
  {
    version: 1,
    name: "foreign-keys",
    /** Rebuilds tables, so it manages its own transaction and pragmas. */
    manualTransaction: true,
    up(db) {
      const hadForeignKeys = db.pragma("foreign_keys", { simple: true });
      // Constraints must be off while tables are dropped and recreated, and
      // legacy_alter_table stops RENAME from rewriting references in the tables
      // we have not rebuilt yet.
      db.pragma("foreign_keys = OFF");
      db.pragma("legacy_alter_table = ON");
      let report;
      try {
        db.exec("BEGIN");
        report = addForeignKeys(db);
        const violations = db.pragma("foreign_key_check");
        if (violations.length > 0) {
          throw new Error(
            `foreign_key_check reported ${violations.length} violation(s): ` +
              JSON.stringify(violations.slice(0, 5)),
          );
        }
        db.pragma("user_version = 1");
        db.exec("COMMIT");
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* already rolled back */
        }
        throw err;
      } finally {
        db.pragma("legacy_alter_table = OFF");
        if (hadForeignKeys) db.pragma("foreign_keys = ON");
      }
      for (const line of report.deleted) {
        console.log(`   removed orphaned rows — ${line}`);
      }
      for (const line of report.nulled) {
        console.log(`   cleared dangling reference — ${line}`);
      }
      for (const line of report.remapped) {
        console.log(`   reassigned — ${line}`);
      }
      console.log(
        `   foreign keys added to ${report.rebuilt.length} tables: ${report.rebuilt.join(", ")}`,
      );
    },
  },
  {
    version: 2,
    name: "sale-returns",
    up(db) {
      // Returns are recorded as their own document rather than by editing the
      // original invoice: a sale that happened is a fact, and the correction is
      // a second fact that references it. The refund itself is a negative
      // payment_records row against the original invoice, so the cash drawer
      // and every existing "collected revenue" query net out automatically.
      db.exec(`
        CREATE TABLE IF NOT EXISTS sale_returns (
          id             TEXT PRIMARY KEY,
          return_number  TEXT NOT NULL UNIQUE,
          invoice_id     TEXT NOT NULL,
          date           TEXT NOT NULL,
          time           TEXT NOT NULL,
          total          REAL NOT NULL,
          refunded_cash  REAL NOT NULL DEFAULT 0,
          debt_reduced   REAL NOT NULL DEFAULT 0,
          is_full        INTEGER NOT NULL DEFAULT 0,
          reason         TEXT,
          created_by     TEXT NOT NULL,
          shift_id       TEXT,
          created_at     TEXT NOT NULL,
          FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY (shift_id)   REFERENCES shifts(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sale_returns_invoice ON sale_returns(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_sale_returns_date    ON sale_returns(date);
        CREATE INDEX IF NOT EXISTS idx_sale_returns_shift   ON sale_returns(shift_id);

        CREATE TABLE IF NOT EXISTS sale_return_items (
          id              TEXT PRIMARY KEY,
          return_id       TEXT NOT NULL,
          invoice_item_id TEXT,
          product_id      TEXT,
          name            TEXT NOT NULL,
          quantity        REAL NOT NULL,
          line_total      REAL NOT NULL,
          restocked       INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (return_id)  REFERENCES sale_returns(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(return_id);
      `);
      const cols = db.prepare("PRAGMA table_info(sale_invoices)").all();
      if (!cols.some((c) => c.name === "return_status")) {
        // 'none' | 'partial' | 'full'. Deliberately not reusing `voided`: the
        // shift and revenue queries exclude voided invoices, which would hide
        // the refund payment along with the sale.
        db.exec(
          "ALTER TABLE sale_invoices ADD COLUMN return_status TEXT NOT NULL DEFAULT 'none'",
        );
      }
    },
  },
  {
    version: 3,
    name: "settings",
    up(db) {
      // Stores overrides only. The registry in shared/settingsSchema.cjs owns
      // the defaults, so an absent row means "unchanged" rather than "broken",
      // and a new setting needs no data migration.
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by TEXT
        );
      `);
    },
  },
  {
    version: 4,
    name: "audit-log",
    up(db) {
      // Deliberately no foreign key on actor_user_id: RESTRICT would block ever
      // deleting a user, and CASCADE would erase the trail of what they did.
      // The denormalised actor_username is the point — it survives the account.
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id             TEXT PRIMARY KEY,
          occurred_at    TEXT NOT NULL,
          date           TEXT NOT NULL,
          actor_user_id  TEXT,
          actor_username TEXT NOT NULL,
          actor_role     TEXT,
          channel        TEXT NOT NULL,
          action         TEXT NOT NULL,
          entity         TEXT NOT NULL,
          entity_id      TEXT,
          summary        TEXT,
          detail         TEXT,
          status         TEXT NOT NULL DEFAULT 'ok',
          error          TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_date     ON audit_log(date);
        CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log(actor_user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_entity   ON audit_log(entity, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_occurred ON audit_log(occurred_at DESC);

        -- Append-only enforced by the database rather than by discipline: an
        -- audit trail that application code can quietly rewrite is not one.
        CREATE TRIGGER IF NOT EXISTS audit_log_no_update
        BEFORE UPDATE ON audit_log
        BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

        CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
        BEFORE DELETE ON audit_log
        BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
      `);
    },
  },
  {
    version: 5,
    name: "roles-and-capabilities",
    up(db) {
      // `users.role` keeps holding the role id, so every existing 'admin' and
      // 'staff' row is already correct — no data migration, and a database
      // opened by an older build still works.
      //
      // Deliberately no foreign key from users.role to roles.id: that would
      // force a rebuild of the one table half the schema references, to buy
      // what a repository-level check gives for free.
      db.exec(`
        CREATE TABLE IF NOT EXISTS roles (
          id          TEXT PRIMARY KEY,
          name_ar     TEXT NOT NULL,
          name_en     TEXT NOT NULL,
          is_system   INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS role_capabilities (
          role_id    TEXT NOT NULL,
          capability TEXT NOT NULL,
          PRIMARY KEY (role_id, capability),
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        );
      `);

      const now = new Date().toISOString();
      const insertRole = db.prepare(
        `INSERT OR IGNORE INTO roles (id, name_ar, name_en, is_system, description, created_at)
         VALUES (?,?,?,?,?,?)`,
      );
      insertRole.run("admin", "مسؤول", "Administrator", 1, "صلاحيات كاملة", now);
      insertRole.run("staff", "كاشير", "Cashier", 1, "البيع والعملاء", now);

      const insertCap = db.prepare(
        "INSERT OR IGNORE INTO role_capabilities (role_id, capability) VALUES (?,?)",
      );
      // '*' rather than an enumerated list: an admin that has to be granted
      // each new capability is an admin who silently loses access whenever a
      // feature is added.
      insertCap.run("admin", "*");

      // The cashier set is derived from today's behaviour: exactly the channels
      // that are currently permission "any". Seeding it from the live map keeps
      // the effective permissions provably unchanged.
      const { CHANNEL_PERMISSIONS } = require("../ipc-channels.cjs");
      const { CHANNEL_CAPABILITY } = require("../ipc-channels.cjs");
      for (const [channel, permission] of Object.entries(CHANNEL_PERMISSIONS)) {
        if (permission !== "any") continue;
        insertCap.run("staff", CHANNEL_CAPABILITY[channel] ?? channel);
      }
    },
  },
  {
    version: 6,
    name: "payment-methods",
    up(db) {
      // `code` matches payment_records.method exactly — that column is the
      // source of truth for what was actually collected, and shift totals are
      // derived from it. These tables describe and denormalise it; they do not
      // replace it.
      db.exec(`
        CREATE TABLE IF NOT EXISTS payment_methods (
          id            TEXT PRIMARY KEY,
          code          TEXT NOT NULL UNIQUE,
          name_ar       TEXT NOT NULL,
          name_en       TEXT NOT NULL,
          kind          TEXT NOT NULL DEFAULT 'digital',
          needs_receipt INTEGER NOT NULL DEFAULT 0,
          sort_order    INTEGER NOT NULL DEFAULT 0,
          is_active     INTEGER NOT NULL DEFAULT 1,
          is_system     INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS shift_totals (
          shift_id  TEXT NOT NULL,
          method_id TEXT NOT NULL,
          amount    REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (shift_id, method_id),
          FOREIGN KEY (shift_id)  REFERENCES shifts(id)          ON DELETE CASCADE,
          FOREIGN KEY (method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_shift_totals_method ON shift_totals(method_id);
      `);

      const seed = db.prepare(
        `INSERT OR IGNORE INTO payment_methods
           (id, code, name_ar, name_en, kind, needs_receipt, sort_order, is_active, is_system)
         VALUES (?,?,?,?,?,?,?,1,1)`,
      );
      // `kind` drives behaviour rather than decoration: change is only ever
      // given from a cash method, and non-cash payments prompt for a receipt.
      seed.run("pm_cash", "cash", "نقدي", "Cash", "cash", 0, 0);
      seed.run("pm_vodafone", "vodafone", "فودافون كاش", "Vodafone Cash", "digital", 1, 1);
      seed.run("pm_instapay", "instapay", "إنستاباي", "InstaPay", "digital", 1, 2);

      // Backfill from the three legacy columns. They stay authoritative for
      // reads until the two have been reconciled on real data over a full
      // reporting period, so this is a parallel copy rather than a cutover.
      for (const [methodId, column] of [
        ["pm_cash", "total_cash"],
        ["pm_vodafone", "total_vodafone"],
        ["pm_instapay", "total_instapay"],
      ]) {
        db.prepare(
          `INSERT OR IGNORE INTO shift_totals (shift_id, method_id, amount)
           SELECT id, ?, COALESCE(${column}, 0) FROM shifts`,
        ).run(methodId);
      }
    },
  },
  {
    version: 7,
    name: "cash-count",
    up(db) {
      // Closing a register is a count, not a calculation: the cashier says what
      // is physically in the drawer and the difference against what should be
      // there is recorded. Nulls are meaningful — a shift closed automatically,
      // or by deactivating its owner, was never counted, and must not be shown
      // as counted zero.
      const columns = new Set(
        db.pragma("table_info(shifts)").map((c) => c.name),
      );
      const add = (name, decl) => {
        if (!columns.has(name)) {
          db.exec(`ALTER TABLE shifts ADD COLUMN ${name} ${decl}`);
        }
      };
      add("opening_float", "REAL NOT NULL DEFAULT 0");
      add("counted_cash", "REAL");
      add("expected_cash", "REAL");
      add("cash_variance", "REAL");
      add("close_note", "TEXT");
      // No foreign key: ALTER TABLE cannot add one, and rebuilding the table
      // half the schema references to record who pressed close is not a trade
      // worth making. The id is denormalised the same way the audit log's is.
      add("closed_by", "TEXT");
    },
  },
];

function getSchemaVersion(db) {
  return db.pragma("user_version", { simple: true });
}

/**
 * Applies every migration newer than the database's recorded version.
 * Throws — callers must not continue with a partially migrated schema.
 */
function runMigrations(db) {
  const current = getSchemaVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > current);
  if (pending.length === 0) return { from: current, to: current, applied: [] };

  console.log(
    `▶ Applying ${pending.length} schema migration(s) from version ${current}`,
  );
  const applied = [];
  for (const migration of pending) {
    console.log(`  → v${migration.version} ${migration.name}`);
    if (migration.manualTransaction) {
      migration.up(db);
    } else {
      db.transaction(() => {
        migration.up(db);
        db.pragma(`user_version = ${migration.version}`);
      })();
    }
    applied.push(migration.name);
  }
  const to = getSchemaVersion(db);
  console.log(`✅ Schema is now at version ${to}`);
  return { from: current, to, applied };
}

module.exports = {
  runMigrations,
  getSchemaVersion,
  rebuildTableWithForeignKeys,
  MIGRATIONS,
  FOREIGN_KEYS,
};
