-- Page versions: metadata for the edit/re-publish feature.
-- Snapshot HTML lives in S3 at the key recorded in s3_key; this row holds the
-- index. Up to versions.MAX_VERSIONS rows are kept per slug (older rows are
-- pruned by the application after each successful snapshot).

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
