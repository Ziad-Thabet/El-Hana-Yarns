const path = require("path");
const fs = require("fs");

/**
 * Database backup / restore.
 *
 * Uses SQLite's `VACUUM INTO`, which writes a transactionally consistent,
 * compacted copy of the live database in one synchronous step. That matters
 * here for two reasons: a plain file copy of a WAL database can miss committed
 * pages still sitting in the -wal sidecar, and being synchronous lets us take a
 * snapshot *before* schema migrations run, while the app is still single
 * threaded at startup.
 */

const BACKUP_DIR_NAME = "backups";
const MAX_BACKUPS = 30;
const FILE_PREFIX = "backup-";
const FILE_SUFFIX = ".db";
// Reasons are part of the filename so the folder is readable without the app.
const REASONS = ["startup", "periodic", "manual", "pre-restore", "pre-migration"];

function pad(n) {
  return String(n).padStart(2, "0");
}

// Millisecond precision: two backups taken in the same second (a manual click
// right after a scheduled run) must not collide, because VACUUM INTO refuses to
// write to an existing path.
function timestampFor(date) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` +
    String(date.getMilliseconds()).padStart(3, "0")
  );
}

function parseFileName(fileName) {
  if (!fileName.startsWith(FILE_PREFIX) || !fileName.endsWith(FILE_SUFFIX)) {
    return null;
  }
  const core = fileName.slice(FILE_PREFIX.length, -FILE_SUFFIX.length);
  const match = core.match(/^(\d{8})-(\d{6,9})-(.+)$/);
  if (!match) return null;
  const [, ymd, hms, reason] = match;
  const iso =
    `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` +
    `T${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}`;
  return { date: ymd, createdAt: iso, reason };
}

function createBackupManager({ getDb, closeDb, dbPath, dataDir }) {
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);

  function ensureDir() {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  }

  function list() {
    ensureDir();
    return fs
      .readdirSync(backupDir)
      .map((fileName) => {
        const parsed = parseFileName(fileName);
        if (!parsed) return null;
        let size = 0;
        try {
          size = fs.statSync(path.join(backupDir, fileName)).size;
        } catch {
          return null;
        }
        return { fileName, size, ...parsed };
      })
      .filter(Boolean)
      .sort((a, b) => b.fileName.localeCompare(a.fileName));
  }

  function prune(max = MAX_BACKUPS) {
    const all = list();
    let removed = 0;
    for (const entry of all.slice(max)) {
      try {
        fs.unlinkSync(path.join(backupDir, entry.fileName));
        removed++;
      } catch {
        /* a locked file will be pruned on a later run */
      }
    }
    return removed;
  }

  function create(reason = "manual") {
    if (!REASONS.includes(reason)) reason = "manual";
    ensureDir();
    let fileName = null;
    let dest = null;
    // Timestamps are millisecond-precise, so a collision means the clock has
    // not advanced yet; wait for the next millisecond rather than failing.
    for (let attempt = 0; attempt < 50; attempt++) {
      fileName = `${FILE_PREFIX}${timestampFor(new Date())}-${reason}${FILE_SUFFIX}`;
      dest = path.join(backupDir, fileName);
      if (!fs.existsSync(dest)) break;
      dest = null;
    }
    if (!dest) {
      throw new Error("تعذر إنشاء اسم فريد للنسخة الاحتياطية");
    }
    getDb().prepare("VACUUM INTO ?").run(dest);
    prune();
    const size = fs.statSync(dest).size;
    console.log(`✅ Backup written: ${fileName} (${size} bytes)`);
    return { fileName, size, ...parseFileName(fileName) };
  }

  /** At most one backup of this reason per calendar day. */
  function createDaily(reason) {
    const today = timestampFor(new Date()).slice(0, 8);
    if (list().some((b) => b.reason === reason && b.date === today)) return null;
    return create(reason);
  }

  function integrityCheck() {
    const rows = getDb().pragma("integrity_check");
    const result = rows?.[0]?.integrity_check ?? "unknown";
    if (result !== "ok") {
      console.error(`❌ Database integrity_check returned: ${result}`);
    }
    return result;
  }

  function resolveBackupPath(fileName) {
    if (typeof fileName !== "string" || !parseFileName(fileName)) {
      throw new Error("اسم ملف النسخة الاحتياطية غير صالح");
    }
    const full = path.join(backupDir, fileName);
    // Defence in depth: the name is already pattern-checked, but never let a
    // crafted value escape the backups folder.
    if (path.dirname(path.resolve(full)) !== path.resolve(backupDir)) {
      throw new Error("مسار النسخة الاحتياطية غير صالح");
    }
    if (!fs.existsSync(full)) {
      throw new Error("النسخة الاحتياطية غير موجودة");
    }
    return full;
  }

  /**
   * Replaces the live database with a backup. The caller must restart the app
   * afterwards — every prepared statement and repository still points at the
   * connection this closes.
   */
  function restore(fileName) {
    const source = resolveBackupPath(fileName);

    // Refuse to restore a corrupt file.
    const Database = require("better-sqlite3");
    const probe = new Database(source, { readonly: true });
    try {
      const result = probe.pragma("integrity_check")?.[0]?.integrity_check;
      if (result !== "ok") {
        throw new Error(`النسخة الاحتياطية تالفة (${result})`);
      }
    } finally {
      probe.close();
    }

    // Snapshot what we are about to overwrite, so a mistaken restore is undoable.
    const safety = create("pre-restore");
    closeDb();

    fs.copyFileSync(source, dbPath);
    // Stale sidecars would be replayed on top of the restored file.
    for (const suffix of ["-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
    }
    console.log(`✅ Restored database from ${fileName}`);
    return {
      restored: fileName,
      safetyBackup: safety?.fileName ?? null,
      requiresRestart: true,
    };
  }

  return {
    backupDir,
    list,
    create,
    createDaily,
    prune,
    restore,
    integrityCheck,
  };
}

module.exports = { createBackupManager, MAX_BACKUPS };
