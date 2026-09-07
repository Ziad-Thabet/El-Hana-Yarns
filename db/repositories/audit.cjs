const { generateId } = require("../helpers/ids.cjs");
const { formatDateYMD } = require("../../shared/dateRules.cjs");
const { PASSWORD_KEYS } = require("../../audit-descriptors.cjs");

/**
 * Append-only record of who did what.
 *
 * Writes are best-effort by design: a failure here logs and is swallowed,
 * because losing an audit row is bad but turning a completed sale into an IPC
 * error is worse. The table's triggers make an accidental UPDATE or DELETE
 * impossible, so the realistic failure mode is a disk problem, not a bug.
 */

const MAX_DETAIL_CHARS = 4000;

/** Removes anything that must never reach the log, at any depth. */
function redactValue(value, keys, depth = 0) {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactValue(v, keys, depth + 1));
  }
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (keys.includes(key)) {
      out[key] = "[redacted]";
      continue;
    }
    // Base64 images would bloat the log to no purpose.
    if (typeof inner === "string" && inner.startsWith("data:")) {
      out[key] = "[image]";
      continue;
    }
    out[key] = redactValue(inner, keys, depth + 1);
  }
  return out;
}

function serialiseDetail(detail, redactKeys) {
  if (detail === undefined || detail === null) return null;
  try {
    const safe = redactValue(detail, redactKeys);
    const json = JSON.stringify(safe);
    if (!json) return null;
    return json.length > MAX_DETAIL_CHARS
      ? `${json.slice(0, MAX_DETAIL_CHARS)}…`
      : json;
  } catch {
    return null;
  }
}

function mapRow(row) {
  let detail = null;
  if (row.detail) {
    try {
      detail = JSON.parse(row.detail);
    } catch {
      detail = row.detail;
    }
  }
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    date: row.date,
    actorUserId: row.actor_user_id,
    actorUsername: row.actor_username,
    actorRole: row.actor_role,
    channel: row.channel,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    summary: row.summary,
    detail,
    status: row.status,
    error: row.error,
  };
}

function createAuditDB(getDb) {
  const auditDB = {
    /** Never throws: auditing must not be able to fail an operation. */
    write(entry) {
      try {
        const now = new Date();
        getDb()
          .prepare(
            `INSERT INTO audit_log
               (id, occurred_at, date, actor_user_id, actor_username, actor_role,
                channel, action, entity, entity_id, summary, detail, status, error)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            generateId("aud"),
            now.toISOString(),
            formatDateYMD(now),
            entry.actorUserId ?? null,
            entry.actorUsername || "system",
            entry.actorRole ?? null,
            entry.channel,
            entry.action,
            entry.entity,
            entry.entityId ?? null,
            entry.summary ?? null,
            serialiseDetail(entry.detail, entry.redact ?? PASSWORD_KEYS),
            entry.status ?? "ok",
            entry.error ?? null,
          );
        return true;
      } catch (err) {
        console.error("[Audit] failed to record entry:", err.message);
        return false;
      }
    },

    query(filters = {}) {
      const db = getDb();
      const clauses = [];
      const params = [];
      if (filters.from) {
        clauses.push("date >= ?");
        params.push(filters.from);
      }
      if (filters.to) {
        clauses.push("date <= ?");
        params.push(filters.to);
      }
      if (filters.actorUserId) {
        clauses.push("actor_user_id = ?");
        params.push(filters.actorUserId);
      }
      if (filters.action) {
        clauses.push("action = ?");
        params.push(filters.action);
      }
      if (filters.entity) {
        clauses.push("entity = ?");
        params.push(filters.entity);
      }
      if (filters.entityId) {
        clauses.push("entity_id = ?");
        params.push(filters.entityId);
      }
      if (filters.status) {
        clauses.push("status = ?");
        params.push(filters.status);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      // Always bounded: this table only grows.
      const limit = Math.min(Math.max(Number(filters.limit) || 200, 1), 1000);
      const offset = Math.max(Number(filters.offset) || 0, 0);

      const total = db
        .prepare(`SELECT COUNT(*) c FROM audit_log ${where}`)
        .get(...params).c;
      const rows = db
        .prepare(
          // rowid breaks ties: occurred_at is only millisecond-precise, and an
          // unstable order under LIMIT/OFFSET can skip or repeat rows between
          // pages.
          `SELECT * FROM audit_log ${where}
            ORDER BY occurred_at DESC, rowid DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset);
      return { total, limit, offset, entries: rows.map(mapRow) };
    },

    /** Distinct values, for the viewer's filter dropdowns. */
    getFilterOptions() {
      const db = getDb();
      return {
        actions: db
          .prepare("SELECT DISTINCT action FROM audit_log ORDER BY action")
          .all()
          .map((r) => r.action),
        actors: db
          .prepare(
            `SELECT DISTINCT actor_user_id AS id, actor_username AS username
               FROM audit_log
              WHERE actor_user_id IS NOT NULL
              ORDER BY actor_username`,
          )
          .all(),
      };
    },
  };

  return auditDB;
}

module.exports = { createAuditDB, redactValue };
