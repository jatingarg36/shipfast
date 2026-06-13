const pg = require("./pg");

/**
 * TagsStore — relational index of page tags with maintained counts.
 *
 * Source of truth for *which* tags a page has is still S3 meta.json (see
 * services/page.js). This store's job is to keep authoritative, ordered counts
 * per tag — split by access level so a public viewer never sees counts from
 * publisher-gated pages. Schema: migrations/004-tags.sql.
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
          tag_key         TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          public_count    INT  NOT NULL DEFAULT 0,
          publisher_count INT  NOT NULL DEFAULT 0,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS page_tags (
          slug        TEXT NOT NULL,
          tag_key     TEXT NOT NULL REFERENCES tags(tag_key) ON DELETE CASCADE,
          access      TEXT NOT NULL DEFAULT 'publisher',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (slug, tag_key)
        );
        CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags (tag_key);
        CREATE INDEX IF NOT EXISTS idx_tags_public_count ON tags (public_count DESC, name ASC);
        CREATE INDEX IF NOT EXISTS idx_tags_total_count ON tags ((public_count + publisher_count) DESC, name ASC);
        CREATE OR REPLACE FUNCTION bump_tag_count() RETURNS trigger AS $$
        BEGIN
          IF (TG_OP = 'INSERT') THEN
            IF NEW.access = 'public' THEN
              UPDATE tags SET public_count = public_count + 1 WHERE tag_key = NEW.tag_key;
            ELSE
              UPDATE tags SET publisher_count = publisher_count + 1 WHERE tag_key = NEW.tag_key;
            END IF;
            RETURN NEW;
          ELSIF (TG_OP = 'DELETE') THEN
            IF OLD.access = 'public' THEN
              UPDATE tags SET public_count = public_count - 1 WHERE tag_key = OLD.tag_key;
            ELSE
              UPDATE tags SET publisher_count = publisher_count - 1 WHERE tag_key = OLD.tag_key;
            END IF;
            DELETE FROM tags
              WHERE tag_key = OLD.tag_key AND public_count <= 0 AND publisher_count <= 0;
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
 * keeps the per-access counts correct.
 *
 * Call this whenever a page's tags OR its access level changes, so the tag is
 * counted in the right bucket (public vs publisher).
 *
 * @param {string} slug
 * @param {string[]} tags - already-validated display-form tags
 * @param {string} access - the page's access level ('public' | 'publisher')
 */
async function setTagsForPage(slug, tags, access) {
  if (!isEnabled()) return;
  await ensureSchema();
  const bucket = access === "public" ? "public" : "publisher";
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
    // Swap associations: clear this page's rows, then re-add with the current
    // access. The trigger nets out unchanged tags (−1 then +1, possibly across
    // buckets on an access change) and adjusts added/removed ones.
    await client.query(`DELETE FROM page_tags WHERE slug = $1`, [slug]);
    for (const name of tags) {
      await client.query(
        `INSERT INTO page_tags (slug, tag_key, access) VALUES ($1, lower($2), $3)
         ON CONFLICT DO NOTHING`,
        [slug, name, bucket]
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
 *
 * @param {"public"|"all"} [scope="all"] - "public" counts only public pages
 *   (for anonymous viewers); "all" counts public + publisher pages.
 * @returns {Promise<Array<{ name: string, count: number }>>}
 */
async function listTagsByCount(scope = "all") {
  if (!isEnabled()) return [];
  await ensureSchema();
  const countExpr =
    scope === "public" ? "public_count" : "(public_count + publisher_count)";
  const { rows } = await pg.getPool().query(
    `SELECT name, ${countExpr} AS count FROM tags
      WHERE ${countExpr} > 0
      ORDER BY ${countExpr} DESC, name ASC`
  );
  return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

module.exports = {
  isEnabled,
  ensureSchema,
  setTagsForPage,
  removeAllForSlug,
  listTagsByCount,
};
