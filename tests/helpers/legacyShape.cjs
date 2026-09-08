/**
 * Rewinds a database to the shape it had before the versioned migrations ran.
 *
 * The fixture is built through the application's own bring-up, so it arrives
 * fully migrated — which is right for every suite except the one that tests the
 * migrations themselves. That suite needs a database that still looks like the
 * shop's did before the upgrade: no foreign keys, and a schema version of zero.
 *
 * Rather than keep a copy of the old schema around to rot, the old shape is
 * derived from the current one by stripping the FOREIGN KEY clauses out of each
 * table definition. The migration under test then rebuilds them from its own
 * declarations, which is exactly what it does on a real shop's database.
 */

/** Removes FOREIGN KEY clauses from a CREATE TABLE statement. */
function withoutForeignKeys(sql) {
  const stripped = sql
    .split("\n")
    .filter((line) => !/^\s*FOREIGN KEY\b/i.test(line))
    .join("\n");
  // Dropping the last constraint leaves a dangling comma before the closing
  // parenthesis, which SQLite will not parse.
  return stripped.replace(/,(\s*)\)\s*$/, "$1)");
}

function toLegacyShape(db) {
  const tables = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .filter((t) => t.sql && /FOREIGN KEY/i.test(t.sql));

  // Indexes belong to their table and go with it when it is dropped, so they
  // have to be replayed afterwards.
  const indexes = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL",
    )
    .all()
    .map((r) => r.sql);

  db.pragma("foreign_keys = OFF");
  const rebuild = db.transaction(() => {
    for (const { name, sql } of tables) {
      const temp = `${name}__legacy`;
      const columns = db
        .pragma(`table_info(${name})`)
        .map((c) => `"${c.name}"`)
        .join(", ");
      db.exec(
        withoutForeignKeys(sql).replace(
          new RegExp(`CREATE TABLE\\s+"?${name}"?`, "i"),
          `CREATE TABLE "${temp}"`,
        ),
      );
      db.exec(`INSERT INTO "${temp}" (${columns}) SELECT ${columns} FROM "${name}"`);
      db.exec(`DROP TABLE "${name}"`);
      db.exec(`ALTER TABLE "${temp}" RENAME TO "${name}"`);
    }
    for (const sql of indexes) {
      try {
        db.exec(sql.replace(/^CREATE (UNIQUE )?INDEX /i, "CREATE $1INDEX IF NOT EXISTS "));
      } catch {
        // An index over a table that no longer exists is not our problem here.
      }
    }
    db.pragma("user_version = 0");
  });
  rebuild();
  db.pragma("foreign_keys = ON");
}

module.exports = { toLegacyShape, withoutForeignKeys };
