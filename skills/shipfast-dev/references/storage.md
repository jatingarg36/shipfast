# Storage Layout — S3, Redis, Postgres

Three stores, each owning a specific kind of data. The split is deliberate; mixing them is the most common architectural mistake.

## S3 — durable content

Bucket name from `config.S3_BUCKET`. All keys are flat strings (no leading slash). All reads/writes go through `services/s3.js` — never call the AWS SDK directly elsewhere.

| Key                                  | Owner service        | What it holds                                                 |
| ------------------------------------ | -------------------- | ------------------------------------------------------------- |
| `pages/{slug}.html`                  | `routes/api.js`      | The served HTML for a page. Already wrapped if jsx/md.        |
| `meta.json`                          | `services/page.js`   | Object keyed by slug: `{ title, description, type, access, owner, createdAt, updated }` per page. |
| `users.json`                         | `services/user.js`   | Object keyed by user id: `{ id, displayName, email, avatar, role, createdAt, lastLogin }` per user. |
| `chats/{userId}/{slug}/{chatId}.json`| `services/chat-store.js` | Full assistant chat transcript: `{ chatId, messages: [{role, content, selection?, ts}] }`. Server-built keys only. |

A few things worth knowing:

**The `meta.json` index is read-modify-write.** `pageService.setPageMeta` reads the whole blob, merges the update, writes it back. This is fine because writes are infrequent (page publish/access change) and the file is small. If page counts ever grow into the tens of thousands, this becomes a hotspot — move to per-page metadata files or migrate to Postgres.

**Slug nesting.** Slugs can contain `/` (the route uses `:slug(*)` to allow it), so a page like `docs/intro` lands at `pages/docs/intro.html` in S3. That's allowed but be careful with prefix listing.

**Legacy data shape.** Early `meta.json` entries were bare strings (just the access level). `getPageMeta` normalizes those to `{ access, owner: "admin" }`. New writes always use the object shape — but if you're iterating over `meta.json` directly, handle the string case (`if (typeof entry === "string")`).

**No content type for non-HTML.** `s3Service.putText` always writes `Content-Type: text/plain; charset=utf-8`. That's intentional — we don't want S3 serving anything directly; everything goes through the Express app where access control is enforced.

## Redis — counters and sessions

Connection from `config.REDIS_URL`. The same client instance is shared by `connect-redis` (sessions) and `services/views.js` (counters), via `req.app.locals.redisClient`.

| Key                       | Owner                  | Purpose                                       |
| ------------------------- | ---------------------- | --------------------------------------------- |
| `shipfast:views:{slug}`   | `services/views.js`    | Page view counter. Incremented with `INCR`.   |
| (session keys, prefix from connect-redis defaults) | `express-session` | Server-side session storage. |

The cardinal rule: **page serving must never block on Redis**. View counter increments are fire-and-forget (`routes/pages.js` doesn't `await` them in the critical path). View counter reads use try/catch with a 0 fallback. If Redis goes down, pages still serve.

Why Redis for view counts and not Postgres? Atomic `INCR`, no schema, and the data is fine to lose in a worst case. Postgres would mean a hot row + index maintenance for every page view; Redis hands us this for free.

Adding new counters (fork count, like count, etc.)? Prefix the key with `shipfast:` and add it to `services/views.js` or a sibling counter service. Don't sprawl Redis access across route handlers.

## Postgres — assistant chat metadata

Connection from `config.DATABASE_URL`. **Only used when `ASSISTANT_ENABLED` is true.** Pool is lazy-initialized in `services/chat-db.js` — keep it that way so the absence of `DATABASE_URL` doesn't break the rest of the app.

Schema (lives in `migrations/001-assistant-chats.sql`, also created at runtime by `chat-db.ensureSchema()`):

```sql
CREATE TABLE assistant_chats (
  id              UUID PRIMARY KEY,
  user_id         TEXT NOT NULL,
  page_slug       TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT 'New chat',
  message_count   INT  NOT NULL DEFAULT 0,
  snapshot_s3_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chats_user_page
  ON assistant_chats (user_id, page_slug, updated_at DESC);
```

**Every query is scoped by `user_id`.** Look at `chat-db.js` — `WHERE user_id = $1 AND ...` appears in every read. This is how cross-user access is prevented by construction, not by a separate authz check. If you add a new query, keep the `user_id` predicate. Don't add a "for admin" branch — admins should not be able to read other users' chats.

**Why split metadata from transcripts?** Listing chats for a sidebar needs SQL (`ORDER BY updated_at DESC LIMIT 100`). Full transcripts can be megabytes and would make `assistant_chats` huge if stored inline. So metadata in Postgres (indexed, queryable, small), transcript blobs in S3 (cheap, durable, big).

**Snapshot keys are server-built.** Client posts `slug`, server generates a UUID and builds `chats/{userId}/{slug}/{chatId}.json`. The client never supplies an S3 key. If a route ever accepts a key from the body, that's the security regression to flag.

## Why this split exists

The shape of each store reflects what it's good at:

- **S3** — durable, cheap, no schema, fine for "JSON blob keyed by an obvious id". Hit it when you need objects with names and don't need to query across them.
- **Redis** — fast, atomic, ephemeral-tolerant. Hit it for counters, rate limits, ephemeral sessions, anything where "lose it in a crash" is acceptable.
- **Postgres** — schema, joins, transactions, indexes. Hit it when you need to query *across* records (list, sort, filter, aggregate).

When you're tempted to mix these, ask: "if this data is lost, what breaks?" That tells you the durability requirement. Then: "do I need to query across records?" That tells you if you need SQL. The answers should sort you into the right store.

## A useful mental model

If you map the storage to the conceptual model:

- The *catalogue* of pages → `meta.json` in S3
- The *content* of pages → `pages/{slug}.html` in S3
- The *catalogue* of users → `users.json` in S3
- The *popularity* of pages → counters in Redis
- The *ephemeral* state (sessions) → Redis
- The *catalogue* of chats → `assistant_chats` in Postgres
- The *content* of chats → `chats/.../{chatId}.json` in S3

Notice the pattern: catalogues that need querying go to Postgres, catalogues that just need point lookup go to S3 JSON blobs, content always goes to S3, and ephemeral counters/sessions go to Redis. Apply this lens to new features and the right storage almost always falls out.
