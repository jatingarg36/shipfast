-- Tags: grouping labels for pages, with a maintained per-tag document count so
-- the dashboard can order tags by popularity without scanning every page.
--
-- Tags live alongside folders as a way to group pages. The S3 meta.json remains
-- the source of truth for which tags a page has today (see services/page.js);
-- these tables are a relational index whose job is to keep an authoritative,
-- query-friendly `doc_count` per tag. When the slug-metadata DB migration lands,
-- meta.json goes away and these tables become the single source of truth.
--
-- Two tables:
--   tags       — one row per distinct tag, with a denormalized doc_count kept in
--                sync by triggers on page_tags (no app-side counting needed).
--   page_tags  — association between a page slug and a tag.
--
-- Tag names are stored case-sensitively in their display form (e.g.
-- "MachineLearning"), but uniqueness and matching are case-insensitive via the
-- normalized `tag_key` (= lower(name)). This matches the API's case-insensitive
-- filtering while preserving the publisher's chosen casing for display.

CREATE TABLE IF NOT EXISTS tags (
  tag_key     TEXT PRIMARY KEY,                 -- lower(name); the match/dedup key
  name        TEXT NOT NULL,                    -- canonical display form
  doc_count   INT  NOT NULL DEFAULT 0,          -- maintained by triggers below
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_tags (
  slug        TEXT NOT NULL,
  tag_key     TEXT NOT NULL REFERENCES tags(tag_key) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, tag_key)
);

-- Find every page carrying a given tag.
CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags (tag_key);

-- Order-by-popularity: highest doc_count first, name as a stable tiebreak.
CREATE INDEX IF NOT EXISTS idx_tags_doc_count ON tags (doc_count DESC, name ASC);

-- ── Keep tags.doc_count in sync with page_tags ──────────────────────────────
-- A trigger maintains the count so reads are a single indexed scan of `tags`.
-- On the last reference being removed, the tag row is deleted so empty tags
-- don't linger in the rail.
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
