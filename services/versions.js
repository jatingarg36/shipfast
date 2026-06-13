const s3Service = require("./s3");
const pg = require("./pg");

/**
 * VersionsService — per-page version history (snapshots + restore).
 *
 * Metadata is in Postgres (table `page_versions`, see migrations/002-page-versions.sql).
 * Snapshot HTML lives in S3 at `pages/versions/{slug}/v{n}.html` — Postgres
 * stores only the s3_key + ancillary fields (label, type, timestamp).
 *
 * The retention cap is enforced by the application after each insert: rows
 * beyond MAX_VERSIONS for a given slug are deleted oldest-first along with
 * their S3 snapshots.
 *
 * When DATABASE_URL is not configured, versioning is silently disabled:
 *   - snapshotCurrent() is a no-op (returns null)
 *   - listVersions() returns []
 *   - getVersionContent() returns null
 *   - deleteAllForSlug() is a no-op
 * Page publishing itself is never blocked by versioning being off.
 */

const MAX_VERSIONS = 5;
const MAX_LABEL_LEN = 80;

/** S3 key where a snapshot's HTML body is stored. */
function snapshotKey(slug, n) {
  return `pages/versions/${slug}/v${n}.html`;
}

/** Sanitize a user-supplied version label. */
function cleanLabel(label) {
  if (typeof label !== "string") return "";
  const trimmed = label.trim();
  return trimmed.length > MAX_LABEL_LEN
    ? trimmed.slice(0, MAX_LABEL_LEN)
    : trimmed;
}

/** True when versioning is wired up (DATABASE_URL set). */
function isEnabled() {
  return pg.isEnabled();
}

let schemaReady = null;

/**
 * Idempotently create the page_versions table on first use. Mirrors
 * migrations/002-page-versions.sql so dev environments without a migration
 * runner still work.
 */
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pg
      .getPool()
      .query(
        `
        CREATE TABLE IF NOT EXISTS page_versions (
          id            BIGSERIAL PRIMARY KEY,
          slug          TEXT NOT NULL,
          version_n     INT  NOT NULL,
          s3_key        TEXT NOT NULL,
          label         TEXT NOT NULL DEFAULT '',
          content_type  TEXT NOT NULL DEFAULT 'html',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (slug, version_n)
        );
        CREATE INDEX IF NOT EXISTS idx_page_versions_slug_n
          ON page_versions (slug, version_n DESC);
        `
      )
      .catch((err) => {
        schemaReady = null; // allow retry next call
        throw err;
      });
  }
  return schemaReady;
}

/**
 * List versions for a slug, newest first.
 * @param {string} slug
 * @returns {Promise<Array<{n,createdAt,label,type,key}>>}
 */
async function listVersions(slug) {
  if (!isEnabled()) return [];
  await ensureSchema();
  const { rows } = await pg.getPool().query(
    `SELECT version_n, s3_key, label, content_type, created_at
       FROM page_versions
      WHERE slug = $1
      ORDER BY version_n DESC`,
    [slug]
  );
  return rows.map((r) => ({
    n: r.version_n,
    key: r.s3_key,
    label: r.label || "",
    type: r.content_type || "html",
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));
}

/**
 * Fetch one version's HTML content (from S3, via the s3_key recorded in DB).
 * @returns {Promise<string|null>}
 */
async function getVersionContent(slug, n) {
  if (!isEnabled()) return null;
  await ensureSchema();
  const { rows } = await pg.getPool().query(
    `SELECT s3_key FROM page_versions WHERE slug = $1 AND version_n = $2`,
    [slug, n]
  );
  if (!rows[0]) return null;
  return s3Service.getText(rows[0].s3_key);
}

/**
 * Snapshot the current live HTML as the next version, then prune any rows
 * beyond MAX_VERSIONS for this slug. Returns the inserted row, or null when
 * versioning is disabled or there's no content to snapshot.
 *
 * @param {string} slug
 * @param {string} currentContent
 * @param {string} [type]
 * @param {string} [label]
 * @returns {Promise<{n,key,createdAt,label,type}|null>}
 */
async function snapshotCurrent(slug, currentContent, type, label) {
  if (currentContent == null || currentContent === "") return null;
  if (!isEnabled()) return null;
  await ensureSchema();
  const pool = pg.getPool();

  // Determine next version_n. There's a UNIQUE(slug, version_n) constraint, so
  // if two republishes race we'll occasionally hit a duplicate-key error;
  // retry once. (Strict serializability isn't worth the lock overhead here.)
  //
  // Order: write S3 *before* the DB insert, so a committed row always points
  // to a real object. The failure mode is an orphaned S3 object (row never
  // inserted) — cheaper to clean up than a dangling row that 404s on restore.
  // On a retry after unique-violation, the previously-written object for the
  // losing version_n is orphaned; lifecycle rules sweep it.
  const safeLabel = cleanLabel(label);
  const safeType = type || "html";
  let inserted = null;
  for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(version_n), 0) AS max_n FROM page_versions WHERE slug = $1`,
      [slug]
    );
    const nextN = Number(maxRows[0].max_n) + 1;
    const key = snapshotKey(slug, nextN);
    await s3Service.putText(key, currentContent);
    try {
      const { rows } = await pool.query(
        `INSERT INTO page_versions (slug, version_n, s3_key, label, content_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING version_n, s3_key, label, content_type, created_at`,
        [slug, nextN, key, safeLabel, safeType]
      );
      inserted = rows[0];
    } catch (err) {
      // Unique-violation on race — loop will recompute nextN. The S3 object
      // just written at `key` is now orphaned; accept that (see comment above).
      if (err && err.code === "23505" && attempt === 0) continue;
      throw err;
    }
  }
  if (!inserted) return null;

  // Prune oldest rows + their S3 objects if we exceeded the cap.
  // Sort newest-first, skip the MAX_VERSIONS we keep, delete what's left.
  const { rows: extras } = await pool.query(
    `SELECT version_n, s3_key
       FROM page_versions
      WHERE slug = $1
      ORDER BY version_n DESC
      OFFSET $2`,
    [slug, MAX_VERSIONS]
  );
  if (extras.length) {
    const ns = extras.map((e) => e.version_n);
    await pool.query(
      `DELETE FROM page_versions WHERE slug = $1 AND version_n = ANY($2::int[])`,
      [slug, ns]
    );
    for (const e of extras) {
      try {
        await s3Service.deleteObject(e.s3_key);
      } catch (err) {
        console.error("versions.snapshotCurrent prune S3 delete error:", err);
      }
    }
  }

  return {
    n: inserted.version_n,
    key: inserted.s3_key,
    label: inserted.label || "",
    type: inserted.content_type || "html",
    createdAt:
      inserted.created_at instanceof Date
        ? inserted.created_at.toISOString()
        : inserted.created_at,
  };
}

/**
 * Delete all versions for a slug (rows + S3 objects). Called when the live
 * page is deleted.
 */
async function deleteAllForSlug(slug) {
  if (!isEnabled()) return;
  await ensureSchema();
  const pool = pg.getPool();
  const { rows } = await pool.query(
    `DELETE FROM page_versions WHERE slug = $1 RETURNING s3_key`,
    [slug]
  );
  for (const r of rows) {
    try {
      await s3Service.deleteObject(r.s3_key);
    } catch (err) {
      console.error("versions.deleteAllForSlug S3 delete error:", err);
    }
  }
}

module.exports = {
  MAX_VERSIONS,
  MAX_LABEL_LEN,
  snapshotKey,
  cleanLabel,
  isEnabled,
  ensureSchema,
  listVersions,
  getVersionContent,
  snapshotCurrent,
  deleteAllForSlug,
};
