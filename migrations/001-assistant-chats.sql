-- AI Assistant: chat metadata
-- Transcripts (snapshots) live in S3; this table holds metadata + the snapshot's
-- S3 key. Never store presigned URLs (they expire) — sign/read on demand.

CREATE TABLE IF NOT EXISTS assistant_chats (
  id              UUID PRIMARY KEY,
  user_id         TEXT NOT NULL,
  page_slug       TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT 'New chat',
  message_count   INT  NOT NULL DEFAULT 0,
  snapshot_s3_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_page
  ON assistant_chats (user_id, page_slug, updated_at DESC);
