const pg = require("./pg");

/**
 * UserService - Handles user data operations
 * Single Responsibility: Manage user identity rows in Postgres.
 *
 * Previously this service persisted to a single `users.json` blob in S3.
 * It now writes to the `users` table (see migrations/003-users.sql) using
 * the shared pg pool. The public API is unchanged so callers don't break:
 *
 *   - readUsers()     -> { [id]: user } map (mirrors the old JSON shape)
 *   - writeUsers(obj) -> bulk replace (kept for backfill/admin use)
 *   - upsertUser(u)   -> insert or update one row
 *   - getDisplayName(id) -> string
 *
 * Admin (id === "admin") is intentionally NOT a row in this table — it is
 * reconstructed from the session in routes/auth.js. getDisplayName() short
 * -circuits to "Admin" for that id.
 */

let schemaReady = null;

/**
 * Ensure schema exists (idempotent, mirrors migrations/003-users.sql).
 * Same pattern as services/chat-db.js so first-call cold-starts work even
 * before someone runs the migration by hand.
 * @returns {Promise<void>}
 */
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pg
      .getPool()
      .query(
        `
        CREATE TABLE IF NOT EXISTS users (
          id            TEXT PRIMARY KEY,
          display_name  TEXT NOT NULL DEFAULT '',
          email         TEXT NOT NULL DEFAULT '',
          avatar        TEXT NOT NULL DEFAULT '',
          role          TEXT NOT NULL DEFAULT 'publisher',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_login    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      `
      )
      .catch((err) => {
        schemaReady = null; // allow retry on next call
        throw err;
      });
  }
  return schemaReady;
}

/**
 * Convert a DB row (snake_case) to the JS user shape (camelCase) the rest
 * of the app expects.
 */
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatar: row.avatar,
    role: row.role,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    lastLogin:
      row.last_login instanceof Date ? row.last_login.toISOString() : row.last_login,
  };
}

/**
 * Read all users.
 * Returns a map keyed by id so existing callers (e.g. services/page.js)
 * that do `users[pm.owner].displayName` keep working unchanged.
 * @returns {Promise<Object>}
 */
async function readUsers() {
  if (!pg.isEnabled()) return {};
  await ensureSchema();
  const { rows } = await pg.getPool().query(`SELECT * FROM users`);
  const out = {};
  for (const row of rows) out[row.id] = rowToUser(row);
  return out;
}

/**
 * Bulk replace all users. Kept for backfill scripts and tests; runs in a
 * transaction so partial failures don't leave a half-written table.
 * @param {Object} obj - User map keyed by id
 */
async function writeUsers(obj) {
  if (!pg.isEnabled()) return;
  await ensureSchema();
  const client = await pg.getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM users");
    for (const user of Object.values(obj || {})) {
      if (!user || !user.id) continue;
      await client.query(
        `INSERT INTO users (id, display_name, email, avatar, role, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), COALESCE($7, now()))`,
        [
          user.id,
          user.displayName || "",
          user.email || "",
          user.avatar || "",
          user.role || "publisher",
          user.createdAt || null,
          user.lastLogin || null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Insert or update a user. Called on every successful Google login —
 * touches `last_login`, preserves `created_at` for existing rows.
 * @param {Object} user - { id, displayName, email, avatar, role }
 */
async function upsertUser(user) {
  if (!user || !user.id) return;
  if (!pg.isEnabled()) {
    throw new Error("Postgres is not enabled (DATABASE_URL missing)");
  }
  await ensureSchema();
  await pg.getPool().query(
    `
    INSERT INTO users (id, display_name, email, avatar, role, created_at, last_login)
    VALUES ($1, $2, $3, $4, $5, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      email        = EXCLUDED.email,
      avatar       = EXCLUDED.avatar,
      role         = EXCLUDED.role,
      last_login   = now()
    `,
    [
      user.id,
      user.displayName || "",
      user.email || "",
      user.avatar || "",
      user.role || "publisher",
    ]
  );
}

/**
 * Get display name for a user. Falls back to the id so callers always
 * have something printable.
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function getDisplayName(userId) {
  if (userId === "admin") return "Admin";
  if (!pg.isEnabled()) return userId;
  await ensureSchema();
  const { rows } = await pg
    .getPool()
    .query(`SELECT display_name FROM users WHERE id = $1`, [userId]);
  return (rows[0] && rows[0].display_name) || userId;
}

module.exports = {
  readUsers,
  writeUsers,
  upsertUser,
  getDisplayName,
};
