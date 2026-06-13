const pg = require("./pg");

/**
 * TagsStore — relational index of page tags with a maintained doc_count.
 *
 * Source of truth for *which* tags a page has is still S3 meta.json (see
 * services/page.js). This store's job is to keep an authoritative, ordered
 * `doc_count` per tag so the dashboard can show tags ranked by popularity
 * without scanning every page. Schema: migrations/004-tags.sql.
 *
 * When DATABASE_URL is not configured this is silently disabled:
 *   - setTagsForPage()/removeAllForSlug() are no-ops
 *   - listTagsByCount() returns []
 * Callers fall back to deriving counts from the page list (see tags.countTags).
 * Page publishing is never blocked by this store.
 */

/** True when the tag index is wired up (DATABASE_URL set). */
function isEnabled() {
  return pg.isEnabled();
}

let schemaReady = null;

/**
 * Idempotently create the tags/page_tags tables + count trigger on first use.
 * Mirrors migrations/004-tags.sql so dev environments without a migration
 * runner still work.
 */
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pg
      .getPool()
      .query(
        `
        CREATE TABLE IF NOT EXISTS tags (
          tag_key     TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          doc_count   INT  NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS page_tags (
          slug        TEXT NOT NULL,
          tag_key     TEXT NOT NULL REFERENCES tags(tag_key) ON DELETE CASCADE,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (slug, tag_key)
        );
        CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags (tag_key);
        CREATE INDEX IF NOT EXISTS idx_tags_doc_count ON tags (doc_count DESC, name ASC);
        CREATE OR REPLACE FUNCTION bump_tag_count() RETURNS trigger AS $$
        BEGIN
          IF (TG_OP = 'INSERT') THEN
            UPDATE tags SET doc_count = doc_count + 1 WHERE tag_key = NEW.tag_key;
            RETURN NEW;
          ELSIF (TG_OP = 'DELETE') THEN
            UPDATE tags SET doc_count = doc_count - 1 WHERE tag_key = OLD.tag_key;
            DELETE FROM tags WHERE tag_key = OLD.tag_key AND doc_count <= 0;
            RETURN OLD;
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trg_page_tags_count ON page_tags;
        CREATE TRIGGER trg_page_tags_count
          AFTER INSERT OR DELETE ON page_tags
          FOR EACH ROW EXECUTE FUNCTION bump_tag_count();
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
 * Replace the tag set for a page. Upserts tag rows (preserving display casing),
 * then swaps the page's associations inside a transaction; the count trigger
 * keeps doc_count correct.
 *
 * @param {string} slug
 * @param {string[]} tags - already-validated display-form tags
 */
async function setTagsForPage(slug, tags) {
  if (!isEnabled()) return;
  await ensureSchema();
  const pool = pg.getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Upsert tag rows. ON CONFLICT keeps the first-seen display casing.
    for (const name of tags) {
      await client.query(
        `INSERT INTO tags (tag_key, name) VALUES (lower($1), $1)
         ON CONFLICT (tag_key) DO NOTHING`,
        [name]
      );
    }
    // Swap associations: clear this page's rows, then re-add. The trigger nets
    // out unchanged tags (−1 then +1) and correctly adjusts added/removed ones.
    await client.query(`DELETE FROM page_tags WHERE slug = $1`, [slug]);
    for (const name of tags) {
      await client.query(
        `INSERT INTO page_tags (slug, tag_key) VALUES ($1, lower($2))
         ON CONFLICT DO NOTHING`,
        [slug, name]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove all tag associations for a page (e.g. on delete). Trigger decrements
 * each affected tag's count and prunes any that reach zero.
 * @param {string} slug
 */
async function removeAllForSlug(slug) {
  if (!isEnabled()) return;
  await ensureSchema();
  await pg.getPool().query(`DELETE FROM page_tags WHERE slug = $1`, [slug]);
}

/**
 * List tags ordered by document count (desc), name as tiebreak.
 * @returns {Promise<Array<{ name: string, count: number }>>}
 */
async function listTagsByCount() {
  if (!isEnabled()) return [];
  await ensureSchema();
  const { rows } = await pg.getPool().query(
    `SELECT name, doc_count FROM tags
      WHERE doc_count > 0
      ORDER BY doc_count DESC, name ASC`
  );
  return rows.map((r) => ({ name: r.name, count: Number(r.doc_count) }));
}

module.exports = {
  isEnabled,
  ensureSchema,
  setTagsForPage,
  removeAllForSlug,
  listTagsByCount,
};
