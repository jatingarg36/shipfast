const config = require("../config");

/**
 * Shared Postgres pool.
 *
 * Used by services that persist relational metadata (assistant chats, page
 * versions). Connection-pool sizing is serverless-friendly; use RDS Proxy /
 * PgBouncer in production for high concurrency.
 *
 * Pool creation is lazy — the `pg` driver is only required when a feature
 * that needs it is actually invoked.
 */

let pool = null;

/**
 * @returns {boolean} true when a DATABASE_URL is configured
 */
function isEnabled() {
  return !!config.DATABASE_URL;
}

/**
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (!isEnabled()) {
    throw new Error("Postgres is not enabled (DATABASE_URL missing)");
  }
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => console.error("pg pool error:", err));
  }
  return pool;
}

/** Test/internal: drop cached pool so a fresh getPool() creates a new one. */
function _reset() {
  pool = null;
}

module.exports = { isEnabled, getPool, _reset };
