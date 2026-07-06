const { formatDateYMD } = require("./shared/dateRules.cjs");
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

    this.firstLoginMap = new Map();
  }

  _recordFirstLogin(userId) {
    const today = formatDateYMD(new Date());
    const existing = this.firstLoginMap.get(userId);
    if (existing && existing.date === today) {
      return existing.loginAt;
    }
    const loginAt = new Date().toISOString();
    this.firstLoginMap.set(userId, { date: today, loginAt });
    return loginAt;
  }

  getFirstLoginAt(userId) {
    const today = formatDateYMD(new Date());
    const entry = this.firstLoginMap.get(userId);
    if (entry && entry.date === today) return entry.loginAt;
    return null;
  }
  create(userId, username, role, displayName) {
    const sessionId = `sess_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    const firstLoginAt = this._recordFirstLogin(userId);
    this.sessions.set(sessionId, {
      userId,
      username,
      role,
      displayName,
      createdAt: now,
      expiresAt: now + this.sessionTimeout,
      firstLoginAt,
    });
    return sessionId;
  }
  get(sessionId) {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.destroy(sessionId);
      return null;
    }
    return {
      sessionId,
      userId: session.userId,
      username: session.username,
      role: session.role,
      displayName: session.displayName,
      startedAt:
        session.firstLoginAt ?? new Date(session.createdAt).toISOString(),
    };
  }

  getAll() {
    const active = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (Date.now() <= session.expiresAt) {
        active.push({
          sessionId,
          userId: session.userId,
          username: session.username,
          role: session.role,
          displayName: session.displayName,
          startedAt:
            session.firstLoginAt ?? new Date(session.createdAt).toISOString(),
        });
      } else {
        this.sessions.delete(sessionId);
      }
    }
    return active;
  }
  exists(sessionId) {
    return this.get(sessionId) !== null;
  }
  destroy(sessionId) {
    this.sessions.delete(sessionId);
  }
  destroyAll() {
    this.sessions.clear();
  }
  count() {
    return this.sessions.size;
  }
}
module.exports = new SessionManager();
