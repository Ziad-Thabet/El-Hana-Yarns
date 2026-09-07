const { CHANNEL_CAPABILITY } = require("../../ipc-channels.cjs");

/**
 * Roles and the capabilities they grant.
 *
 * The permission check runs on every privileged IPC call, so the role → set
 * mapping is cached in memory and dropped on any write. Sessions cache only the
 * *role id*, never the capability set — that way editing what a role can do
 * takes effect immediately, without anyone having to sign out and in again.
 *
 * The wildcard '*' matches everything. Admin holds it rather than an enumerated
 * list, because an admin who must be granted each new capability is an admin
 * who silently loses access whenever a feature is added.
 */

const WILDCARD = "*";
const FALLBACK_ADMIN_ROLE = "admin";

function createRolesDB(getDb) {
  /** @type {Map<string, Set<string>> | null} */
  let cache = null;

  function load() {
    if (cache) return cache;
    const next = new Map();
    try {
      for (const row of getDb()
        .prepare("SELECT role_id, capability FROM role_capabilities")
        .all()) {
        const set = next.get(row.role_id) ?? new Set();
        set.add(row.capability);
        next.set(row.role_id, set);
      }
    } catch (err) {
      // Missing table (a database opened before this migration) must not lock
      // anyone out; hasCapability falls back below.
      console.warn(`[Roles] capability lookup unavailable: ${err.message}`);
    }
    cache = next;
    return cache;
  }

  const rolesDB = {
    invalidate() {
      cache = null;
    },

    /**
     * Whether a role grants a capability.
     *
     * If the roles data is missing or empty — a half-migrated or hand-edited
     * database — this falls back to treating the literal 'admin' role as
     * all-powerful. The owner must never be locked out of their own shop by a
     * schema problem.
     */
    hasCapability(roleId, capability) {
      if (!roleId) return false;
      const byRole = load();
      if (byRole.size === 0) return roleId === FALLBACK_ADMIN_ROLE;
      const granted = byRole.get(roleId);
      if (!granted) return roleId === FALLBACK_ADMIN_ROLE;
      return granted.has(WILDCARD) || granted.has(capability);
    },

    /** Every capability a role holds, expanded for the renderer. */
    capabilitiesFor(roleId) {
      const granted = load().get(roleId);
      if (!granted) {
        return roleId === FALLBACK_ADMIN_ROLE ? [WILDCARD] : [];
      }
      return [...granted];
    },

    /** All capabilities the app knows about, for a future role editor. */
    knownCapabilities() {
      return [...new Set(Object.values(CHANNEL_CAPABILITY))].sort();
    },

    getAll() {
      const db = getDb();
      const roles = db
        .prepare("SELECT * FROM roles ORDER BY is_system DESC, name_ar")
        .all();
      return roles.map((role) => ({
        id: role.id,
        nameAr: role.name_ar,
        nameEn: role.name_en,
        isSystem: role.is_system === 1,
        description: role.description,
        capabilities: rolesDB.capabilitiesFor(role.id),
      }));
    },

    exists(roleId) {
      try {
        return !!getDb().prepare("SELECT 1 FROM roles WHERE id=?").get(roleId);
      } catch {
        // Before the migration, the two legacy roles are the only valid ones.
        return roleId === "admin" || roleId === "staff";
      }
    },
  };

  return rolesDB;
}

module.exports = { createRolesDB, WILDCARD };
