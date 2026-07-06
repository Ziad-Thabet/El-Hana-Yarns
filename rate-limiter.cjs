
class RateLimiter {
  constructor() {
    // Map<username, { attempts, lockedUntil }>
    this.attempts = new Map();
    this.maxAttempts = 5;
    this.lockoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
  }
  
  isLocked(username) {
    if (!username) return false;
    const record = this.attempts.get(username);
    if (!record) return false;
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      return true;
    }
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
      this.attempts.delete(username);
      return false;
    }
    return false;
  }

  getLockoutTimeRemaining(username) {
    if (!username) return null;
    const record = this.attempts.get(username);
    if (!record || !record.lockedUntil) return null;
    const now = Date.now();
    if (now >= record.lockedUntil) {
      return null;
    }
    return Math.ceil((record.lockedUntil - now) / 1000);
  }

  recordFailedAttempt(username) {
    if (!username) return false;
    let record = this.attempts.get(username) || {
      attempts: 0,
      lockedUntil: null,
    };
    record.attempts++;
    if (record.attempts >= this.maxAttempts) {
      record.lockedUntil = Date.now() + this.lockoutDuration;
      this.attempts.set(username, record);
      return true; // Now locked
    }
    this.attempts.set(username, record);
    return false; // Not locked yet
  }
 
  reset(username) {
    if (!username) return;
    this.attempts.delete(username);
  }
 
  getAttemptCount(username) {
    if (!username) return 0;
    const record = this.attempts.get(username);
    return record ? record.attempts : 0;
  }
 
  debug() {
    const data = {};
    for (const [username, record] of this.attempts.entries()) {
      data[username] = {
        attempts: record.attempts,
        lockedUntil: record.lockedUntil,
        remaining: record.lockedUntil
          ? Math.ceil((record.lockedUntil - Date.now()) / 1000)
          : null,
      };
    }
    return data;
  }
}
module.exports = new RateLimiter();