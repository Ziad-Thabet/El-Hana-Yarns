/**
 * The declaration of every configurable setting.
 *
 * This registry — not the database — is the source of truth for what a setting
 * is, what it defaults to, and what values are legal. The `settings` table
 * stores only *overrides*, so a missing row is never a failure, defaults ship
 * with the binary, and adding a setting needs no data migration.
 *
 * Every default here is exactly the literal it replaced, so introducing this
 * module changes no behaviour.
 */

const GROUP = {
  SHOP: "shop",
  RECEIPT: "receipt",
  INVENTORY: "inventory",
  SHIFT: "shift",
  ALERTS: "alerts",
  SECURITY: "security",
  BACKUP: "backup",
  BARCODE: "barcode",
};

/**
 * scope: "main"   — only the Electron main process reads it
 *        "client" — only the renderer reads it
 *        "both"   — both do
 */
const SETTINGS = {
  // ── Shop identity ────────────────────────────────────────────────────────
  "shop.name": {
    type: "string", default: "الهنا للخيوط", group: GROUP.SHOP, scope: "both", maxLength: 120,
  },
  "shop.tagline": {
    type: "string", default: "خيوط تريكو وكروشيه", group: GROUP.SHOP, scope: "both", maxLength: 160, allowEmpty: true,
  },
  "shop.address": {
    type: "string", default: "", group: GROUP.SHOP, scope: "both", maxLength: 240, allowEmpty: true,
  },
  "shop.phone": {
    type: "string", default: "", group: GROUP.SHOP, scope: "both", maxLength: 60, allowEmpty: true,
  },

  // ── Receipt ──────────────────────────────────────────────────────────────
  "receipt.widthMm": {
    type: "number", default: 80, min: 40, max: 210, integer: true, group: GROUP.RECEIPT, scope: "both",
  },
  "receipt.footerNote": {
    type: "string", default: "", group: GROUP.RECEIPT, scope: "client", maxLength: 200, allowEmpty: true,
  },

  // ── Inventory ────────────────────────────────────────────────────────────
  // Two deliberately separate rules. `lowStockThreshold` drives the amber
  // "running low" warning in reports and product lists; `outOfStockThreshold`
  // decides when an alert is actually raised. Collapsing them into one value
  // would silently change when the shop gets notified.
  "inventory.lowStockThreshold": {
    type: "number", default: 10, min: 0, max: 1000000, group: GROUP.INVENTORY, scope: "both",
  },
  "inventory.outOfStockThreshold": {
    type: "number", default: 0, min: 0, max: 1000000, group: GROUP.INVENTORY, scope: "main",
  },

  // ── Shifts ───────────────────────────────────────────────────────────────
  "shift.staleHours": {
    type: "number", default: 10, min: 1, max: 168, group: GROUP.SHIFT, scope: "both",
  },

  // ── Alerts ───────────────────────────────────────────────────────────────
  "alerts.overdueInvoiceDays": {
    type: "number", default: 7, min: 1, max: 365, integer: true, group: GROUP.ALERTS, scope: "main",
  },
  "alerts.checkIntervalMinutes": {
    type: "number", default: 30, min: 1, max: 1440, integer: true, group: GROUP.ALERTS, scope: "main",
  },

  // ── Security ─────────────────────────────────────────────────────────────
  // Minimums are not cosmetic: a zero here would lock every account out or
  // expire every session instantly.
  "security.sessionTimeoutHours": {
    type: "number", default: 24, min: 1, max: 720, group: GROUP.SECURITY, scope: "main",
  },
  "security.maxLoginAttempts": {
    type: "number", default: 5, min: 1, max: 100, integer: true, group: GROUP.SECURITY, scope: "main",
  },
  "security.lockoutMinutes": {
    type: "number", default: 5, min: 1, max: 1440, group: GROUP.SECURITY, scope: "main",
  },

  // ── Backup ───────────────────────────────────────────────────────────────
  "backup.retentionCount": {
    type: "number", default: 30, min: 1, max: 1000, integer: true, group: GROUP.BACKUP, scope: "main",
  },
  "backup.intervalHours": {
    type: "number", default: 4, min: 1, max: 168, group: GROUP.BACKUP, scope: "main",
  },

  // ── Barcode ──────────────────────────────────────────────────────────────
  "barcode.internalPrefix": {
    type: "string", default: "20", group: GROUP.BARCODE, scope: "main", pattern: /^\d{1,3}$/,
  },
};

const KEYS = Object.keys(SETTINGS);

function definitionFor(key) {
  return SETTINGS[key] ?? null;
}

function defaultFor(key) {
  return SETTINGS[key]?.default;
}

/**
 * Brings a raw value into range for its definition.
 * Returns `{ value, ok, reason }` — `ok` is false when the input could not be
 * used at all and the default was substituted.
 */
function coerce(key, raw) {
  const def = SETTINGS[key];
  if (!def) return { value: undefined, ok: false, reason: "unknown key" };

  if (def.type === "number") {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) {
      return { value: def.default, ok: false, reason: "not a number" };
    }
    let value = def.integer ? Math.round(num) : num;
    let ok = true;
    let reason = null;
    if (def.min !== undefined && value < def.min) {
      value = def.min;
      ok = false;
      reason = `below minimum ${def.min}`;
    }
    if (def.max !== undefined && value > def.max) {
      value = def.max;
      ok = false;
      reason = `above maximum ${def.max}`;
    }
    return { value, ok, reason };
  }

  if (def.type === "boolean") {
    if (typeof raw === "boolean") return { value: raw, ok: true, reason: null };
    if (raw === "true" || raw === 1 || raw === "1") return { value: true, ok: true, reason: null };
    if (raw === "false" || raw === 0 || raw === "0") return { value: false, ok: true, reason: null };
    return { value: def.default, ok: false, reason: "not a boolean" };
  }

  // string
  if (typeof raw !== "string") {
    return { value: def.default, ok: false, reason: "not a string" };
  }
  const trimmed = raw.trim();
  if (!trimmed && !def.allowEmpty) {
    return { value: def.default, ok: false, reason: "must not be empty" };
  }
  if (def.maxLength !== undefined && trimmed.length > def.maxLength) {
    return { value: trimmed.slice(0, def.maxLength), ok: false, reason: `longer than ${def.maxLength}` };
  }
  if (def.pattern && trimmed && !def.pattern.test(trimmed)) {
    return { value: def.default, ok: false, reason: "does not match the expected format" };
  }
  return { value: trimmed, ok: true, reason: null };
}

/** Every key whose value the renderer is allowed to see. */
function clientKeys() {
  return KEYS.filter((k) => SETTINGS[k].scope !== "main");
}

function defaults() {
  const out = {};
  for (const key of KEYS) out[key] = SETTINGS[key].default;
  return out;
}

module.exports = { SETTINGS, KEYS, GROUP, definitionFor, defaultFor, coerce, clientKeys, defaults };
