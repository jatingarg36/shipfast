-- Tags: grouping labels for pages, with maintained per-tag document counts so
-- the dashboard can order tags by popularity without scanning every page.
--
-- Counts are split by access level so a public/anonymous viewer never sees or
-- counts tags that exist only on publisher-gated pages:
--   public_count    — pages with access = 'public'
--   publisher_count — pages with access = 'publisher' (login required)
-- Anonymous viewers read public_count; authenticated viewers read the sum.
--
-- The S3 meta.json remains the source of truth for which tags/access a page
-- has today (see services/page.js); these tables are a relational index whose
-- job is to keep authoritative, query-friendly counts. When the slug-metadata
-- DB migration lands, these tables become the single source of truth.
--
-- Two tables:
--   tags       — one row per distinct tag, with denormalized counts kept in
--                sync by triggers on page_tags (no app-side counting needed).
--   page_tags  — association between a page slug and a tag, carrying the page's
--                access level so the trigger knows which bucket to adjust.
--
-- Tag names are stored case-sensitively in their display form (e.g.
-- "MachineLearning"), but uniqueness and matching are case-insensitive via the
-- normalized `tag_key` (= lower(name)).

CREATE TABLE IF NOT EXISTS tags (
  tag_key         TEXT PRIMARY KEY,                 -- lower(name); the match/dedup key
  name            TEXT NOT NULL,                    -- canonical display form
  public_count    INT  NOT NULL DEFAULT 0,          -- maintained by triggers below
  publisher_count INT  NOT NULL DEFAULT 0,          -- maintained by triggers below
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_tags (
  slug        TEXT NOT NULL,
  tag_key     TEXT NOT NULL REFERENCES tags(tag_key) ON DELETE CASCADE,
  access      TEXT NOT NULL DEFAULT 'publisher',    -- 'public' | 'publisher'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, tag_key)
);

-- Find every page carrying a given tag.
CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags (tag_key);

-- Order-by-popularity indexes: highest count first, name as a stable tiebreak.
-- Public viewers order by public_count; authenticated viewers by the total.
CREATE INDEX IF NOT EXISTS idx_tags_public_count
  ON tags (public_count DESC, name ASC);
CREATE INDEX IF NOT EXISTS idx_tags_total_count
  ON tags ((public_count + publisher_count) DESC, name ASC);

-- ── Keep tags.{public,publisher}_count in sync with page_tags ────────────────
-- The trigger adjusts the bucket matching the row's access level, so reads are
-- a single indexed scan of `tags`. When both counts reach zero the tag row is
-- removed so empty tags don't linger in the rail.
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
