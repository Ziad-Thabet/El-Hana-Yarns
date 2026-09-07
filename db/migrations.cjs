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
