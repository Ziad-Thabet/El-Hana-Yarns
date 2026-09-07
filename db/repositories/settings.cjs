const {
  SETTINGS,
  KEYS,
  coerce,
  defaultFor,
  definitionFor,
  clientKeys,
} = require("../../shared/settingsSchema.cjs");

/**
 * Configurable operating rules.
 *
 * Values are read on hot paths — report generation, alert sweeps, every barcode
 * — so the whole table is cached in memory after the first read and the cache
 * is dropped on any write. That is one query per process lifetime plus one per
 * change, rather than one per lookup.
 *
 * Reads never throw. A corrupt, missing or out-of-range row falls back to the
 * compiled default and logs; a settings lookup must not be able to stop a sale.
 */
function createSettingsDB(getDb) {
  /** @type {Map<string, unknown> | null} */
  let cache = null;

  function load() {
    if (cache) return cache;
    const next = new Map();
    try {
      const rows = getDb().prepare("SELECT key, value FROM settings").all();
      for (const row of rows) {
        if (!definitionFor(row.key)) continue; // stale key from an older build
        let parsed;
        try {
          parsed = JSON.parse(row.value);
        } catch {
          console.warn(`[Settings] "${row.key}" is not valid JSON — using the default`);
          continue;
        }
        const { value, ok, reason } = coerce(row.key, parsed);
        if (!ok) {
          console.warn(`[Settings] "${row.key}" ${reason} — clamped to ${JSON.stringify(value)}`);
        }
        next.set(row.key, value);
      }
    } catch (err) {
      // A missing table (first run, before migrations) is not an error here.
      console.warn(`[Settings] falling back to defaults: ${err.message}`);
    }
    cache = next;
    return cache;
  }

  const settingsDB = {
    /** Drops the cache; the next read repopulates it. */
    invalidate() {
      cache = null;
    },

    get(key) {
      const stored = load().get(key);
      return stored === undefined ? defaultFor(key) : stored;
    },

    getNumber(key) {
      const value = settingsDB.get(key);
      return typeof value === "number" ? value : Number(defaultFor(key));
    },

    getString(key) {
      const value = settingsDB.get(key);
      return typeof value === "string" ? value : String(defaultFor(key) ?? "");
    },

    getBool(key) {
      const value = settingsDB.get(key);
      return typeof value === "boolean" ? value : Boolean(defaultFor(key));
    },

    /** Every key with its effective value — defaults included. */
    getAll() {
      const stored = load();
      return KEYS.map((key) => {
        const def = SETTINGS[key];
        return {
          key,
          value: stored.has(key) ? stored.get(key) : def.default,
          defaultValue: def.default,
          type: def.type,
          group: def.group,
          isCustomised: stored.has(key),
          min: def.min ?? null,
          max: def.max ?? null,
        };
      });
    },

    /** The subset the renderer is allowed to read, as a flat key/value map. */
    getClient() {
      const stored = load();
      const out = {};
      for (const key of clientKeys()) {
        out[key] = stored.has(key) ? stored.get(key) : SETTINGS[key].default;
      }
      return out;
    },

    /**
     * Writes one setting. Out-of-range input is clamped rather than rejected,
     * so a mistyped value narrows to something safe instead of failing — but an
     * unknown key is a programming error and does throw.
     */
    set(key, rawValue, actorUserId = null) {
      if (!definitionFor(key)) throw new Error(`إعداد غير معروف: ${key}`);
      const { value } = coerce(key, rawValue);
      getDb()
        .prepare(
          `INSERT INTO settings (key, value, updated_at, updated_by)
           VALUES (?,?,?,?)
           ON CONFLICT(key) DO UPDATE SET
             value=excluded.value,
             updated_at=excluded.updated_at,
             updated_by=excluded.updated_by`,
        )
        .run(key, JSON.stringify(value), new Date().toISOString(), actorUserId);
      settingsDB.invalidate();
      return { key, value };
    },

    /** Writes several settings in one transaction. */
    setMany(entries, actorUserId = null) {
      const db = getDb();
      const pairs = Object.entries(entries ?? {});
      for (const [key] of pairs) {
        if (!definitionFor(key)) throw new Error(`إعداد غير معروف: ${key}`);
      }
      const applied = [];
      db.transaction(() => {
        for (const [key, rawValue] of pairs) {
          applied.push(settingsDB.set(key, rawValue, actorUserId));
        }
      })();
      settingsDB.invalidate();
      return applied;
    },

    /** Restores a key to its compiled default by removing the override. */
    reset(key) {
      if (!definitionFor(key)) throw new Error(`إعداد غير معروف: ${key}`);
      getDb().prepare("DELETE FROM settings WHERE key=?").run(key);
      settingsDB.invalidate();
      return { key, value: defaultFor(key) };
    },

    /** The values the non-repository main-process singletons need. */
    runtimeConfig() {
      return {
        sessionTimeoutMs: settingsDB.getNumber("security.sessionTimeoutHours") * 60 * 60 * 1000,
        maxLoginAttempts: settingsDB.getNumber("security.maxLoginAttempts"),
        lockoutDurationMs: settingsDB.getNumber("security.lockoutMinutes") * 60 * 1000,
        maxBackups: settingsDB.getNumber("backup.retentionCount"),
        backupIntervalMs: settingsDB.getNumber("backup.intervalHours") * 60 * 60 * 1000,
        alertIntervalMs: settingsDB.getNumber("alerts.checkIntervalMinutes") * 60 * 1000,
        receiptWidthMm: settingsDB.getNumber("receipt.widthMm"),
      };
    },
  };

  return settingsDB;
}

module.exports = { createSettingsDB };
