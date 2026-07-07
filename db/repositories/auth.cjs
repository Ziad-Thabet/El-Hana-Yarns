const bcryptjs = require("bcryptjs");
const { generateId } = require("../helpers/ids.cjs");

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const BCRYPT_SALT_ROUNDS = 12;

function isValidUsername(username) {
  return (
    typeof username === "string" &&
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH
  );
}
function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

function createAuthDB(getDb) {
  return {
    login(username, password) {
      const db = getDb();
      if (!username || !password) return null;
      username = username.trim();
      if (!isValidUsername(username)) return null;
      if (!isValidPassword(password)) return null;
      const user = db
        .prepare("SELECT * FROM users WHERE username=?")
        .get(username);
      if (!user) return null;
      const passwordHash = user.password_hash || user.password;
      if (!passwordHash) return null;
      let passwordValid = false;
      if (user.password_hash) {
        passwordValid = bcryptjs.compareSync(password, user.password_hash);
      } else if (user.password) {
        passwordValid = password === user.password;
      }
      if (!passwordValid) return null;
      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
      };
    },
    hasAnyUsers() {
      const db = getDb();
      const count = db.prepare("SELECT COUNT(*) as c FROM users").get();
      return count.c > 0;
    },
    register(username, password, displayName) {
      const db = getDb();
      if (this.hasAnyUsers()) {
        throw new Error("تم إعداد النظام بالفعل");
      }
      if (!username || typeof username !== "string") {
        throw new Error("اسم المستخدم مطلوب");
      }
      username = username.trim();
      if (!isValidUsername(username)) {
        throw new Error(
          `اسم المستخدم يجب أن يكون ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} حرف`,
        );
      }
      if (!isValidPassword(password)) {
        throw new Error(
          `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} حرف`,
        );
      }
      const passwordHash = bcryptjs.hashSync(password, BCRYPT_SALT_ROUNDS);
      const userId = generateId("user");
      const finalDisplayName = (displayName || username).trim() || username;
      db.prepare(
        "INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at) VALUES (?,?,?,?,?,1,?)",
      ).run(
        userId,
        username,
        passwordHash,
        finalDisplayName,
        "admin",
        new Date().toISOString(),
      );
      return {
        userId,
        username,
        role: "admin",
        displayName: finalDisplayName,
      };
    },
    getUsers() {
      const db = getDb();
      return db
        .prepare("SELECT id, username, display_name, role FROM users")
        .all();
    },
    changePassword(userId, newPassword) {
      const db = getDb();
      if (!newPassword || !userId) {
        throw new Error("Missing required fields");
      }
      const password = newPassword.trim();
      if (!isValidPassword(password)) {
        throw new Error(
          `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
        );
      }
      const passwordHash = bcryptjs.hashSync(password, BCRYPT_SALT_ROUNDS);
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
        passwordHash,
        userId,
      );
      return { success: true };
    },
  };
}
module.exports = { createAuthDB };
