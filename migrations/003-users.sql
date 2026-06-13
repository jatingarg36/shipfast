-- Users: identity records for publishers (and any future provider).
-- Admin (password login) is intentionally NOT stored here — that identity is
-- reconstructed from the session each request (see routes/auth.js).
--
-- `id` keeps the load-bearing `"google-<profile.id>"` shape used by
-- meta.json's `owner` field, so existing page rows keep resolving to the
-- same identity after the migration.

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
