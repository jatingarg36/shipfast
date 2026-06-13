# ShipFast — System Architecture

A complete, ground-truth architecture of the ShipFast platform, derived from the
current source tree (`server.js`, `routes/`, `services/`, `middleware/`,
`templates/`, `migrations/`, `config.js`, `docker-compose.yml`, `vercel.json`,
and the in-repo `skills/shipfast-dev` reference docs).

---

## 1. Product, in one paragraph

ShipFast is a tiny Node/Express PaaS. A user pastes any HTML, JSX, or Markdown
code that Claude produced, picks a slug, and ShipFast hosts it at
`/p/{slug}`. Every page carries a "Shipfast" badge with a live view counter,
and authenticated viewers get a floating AI assistant pill that lets them chat
about the page with their own LLM key (key stays in the browser; only
transcripts are persisted server-side). Operators get a dashboard, password and
Google OAuth login, public/publisher access levels, and a small versioning +
restore system for republished pages.

---

## 2. Top-level deployment topology

```
                ┌──────────────────────────────────────────────┐
                │                Browser (visitor)             │
                │   /p/:slug  •  AI panel iframe  •  LLM call  │
                └──────────────┬───────────────────────────────┘
                               │ HTTPS
                               ▼
                ┌──────────────────────────────────────────────┐
                │           Vercel serverless function         │
                │            (server.js, @vercel/node)         │
                │                                              │
                │   Express + Passport + connect-redis         │
                │   Routes → Services → external stores        │
                └─────┬───────────────┬───────────────┬────────┘
                      │               │               │
                      ▼               ▼               ▼
              ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
              │  Redis       │ │  S3 bucket   │ │  Postgres      │
              │ (Upstash /   │ │ (AWS S3 or   │ │ (RDS / local)  │
              │  local)      │ │  MinIO)      │ │   optional     │
              │              │ │              │ │                │
              │ sessions     │ │ pages HTML   │ │ assistant_chats│
              │ view counts  │ │ meta.json    │ │ page_versions  │
              │              │ │ users.json   │ │                │
              │              │ │ chats/*.json │ │                │
              │              │ │ versions/*   │ │                │
              └──────────────┘ └──────────────┘ └────────────────┘

                       External (browser-direct, never via server)
                       ┌─────────────────────────────────────────┐
                       │  LLM provider (Anthropic / OpenAI /     │
                       │  Gemini) — called from the iframe panel │
                       │  using the visitor's localStorage key   │
                       └─────────────────────────────────────────┘
```

A single Express app handles every request. Vercel routes `/(.*)` to
`server.js` (`vercel.json`), so there is no static-file CDN layer — even page
HTML is served through the app so access control runs on every request.

Local development uses `docker-compose.yml` to stand up Redis, MinIO (S3
clone), and Postgres so the same code paths work without cloud creds.

---

## 3. Process layers (the rule that holds everything together)

```
config.js   ──►  validates env, computes feature flags, fails fast at boot
   │
   ▼
services/   ──►  pure business logic, no Express, no req/res
   │            (s3, user, page, content, views, versions, chat-db,
   │             chat-store, changelog, pg pool)
   ▼
middleware/ ──►  Express middleware (auth.js): getCurrentUser,
   │             requireAuth, requirePageOwner, canManagePage
   ▼
routes/     ──►  thin Express routers — wire HTTP → services
   │            (auth, api, pages, settings, assistant, changelog)
   ▼
templates/  ──►  HTML/CSS/JS string builders (dashboard, login, 404,
                 settings, changelog, assistant loader + iframe panel)
```

The cardinal rule (also enforced by the in-repo skill):

> Routes call services. Services call `services/s3.js` or the shared `pg` /
> Redis client. Nothing outside `services/s3.js` imports the AWS SDK, and
> nothing outside `services/pg.js` instantiates a Postgres pool.

`server.js` is ~140 lines: load config, build the Express app, connect Redis,
wire `connect-redis` sessions, configure Passport (password + Google OAuth),
mount routers, declare the dashboard route, listen.

---

## 4. Configuration and feature flags (`config.js`)

`config.js` loads `.env.local` (override) then `.env`, normalizes process env
into a single object, and **fails fast** at boot if any of these are missing:

- `SESSION_SECRET` (required)
- `REDIS_URL` (required)
- `S3_BUCKET` (required)

Computed flags:

- `IS_PRODUCTION` → `NODE_ENV === "production"` (drives the secure cookie flag).
- `GOOGLE_AUTH_ENABLED` → both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  are present and not the placeholder values.
- `ASSISTANT_ENABLED` → `DATABASE_URL` is set. The whole AI assistant feature
  is feature-flagged off without it, and the dependent routes return `503` if
  hit while disabled.

Other config: `PORT`, `PUBLISHER_PASSWORD`, `S3_REGION`/`AWS_REGION`.

---

## 5. Request lifecycle

For a typical authenticated `GET /p/cool-page`:

```
Browser → Express
   │
   ├─ express.json + urlencoded body parsers
   ├─ express-session (connect-redis store, 7-day cookie, sameSite=lax)
   ├─ passport.initialize + passport.session
   │     → req.user populated from session (admin or google-{id} publisher)
   │
   ├─ Routers mounted in this order in server.js:
   │     /            authRoutes      (login UI, /api/login, OAuth)
   │     /api         apiRoutes       (pages CRUD, /api/views/:slug, versions)
   │     /            settingsRoutes  (/settings shell)
   │     /            changelogRoutes (/changelog public page)
   │     /            assistantRoutes (/assistant.js, /assistant/panel,
   │                                   /api/assistant/chats*)
   │     /            pageRoutes      (/p/:slug serving)
   │     GET /        → dashboardHtml(user)
   │
   └─ pageRoutes handler for /p/:slug:
        1. s3.getText("pages/cool-page.html")              ── content
        2. pageService.getAccess("cool-page")              ── access level
        3. if access === "publisher" && !user → /login?next=…
        4. views.incrementView(redis, slug, ua)            ── fire-and-forget,
                                                              skipped for bots
                                                              and iframe loads
        5. views.getViewCount(redis, slug)                 ── for SSR badge
        6. inject scrollbar-hider + Shipfast badge + (if
           ASSISTANT_ENABLED && user) assistant loader tag
        7. return final HTML
```

Every response is HTML — there is no SPA shell; the dashboard is a single
server-rendered HTML page from `templates/dashboard.js`.

---

## 6. HTTP surface (every route the server exposes)

### 6.1 Authentication (`routes/auth.js`)

| Method | Path                       | Purpose                                          |
| ------ | -------------------------- | ------------------------------------------------ |
| GET    | `/login`                   | Render login UI (`loginHtml`)                    |
| POST   | `/api/login`               | Password login → hardcoded `admin` user          |
| POST   | `/api/logout`              | Destroy session, redirect to `/`                 |
| GET    | `/auth/google`             | Begin OAuth flow (`scope: profile email`)        |
| GET    | `/auth/google/callback`    | Finish OAuth, `upsertUser`, redirect to `next`   |

Password login produces `{ id: "admin", role: "admin" }` ephemerally from the
session. Google OAuth produces `{ id: "google-{profileId}", role: "publisher" }`
persisted in the Postgres `users` table via `userService.upsertUser`
(see `migrations/003-users.sql`). The `google-` prefix is load-bearing —
`meta.json` stores it as the page `owner` and the dashboard looks owners up
by that exact id. A one-shot backfill from the legacy `users.json` blob
lives at `scripts/backfill-users-from-s3.js`.

### 6.2 Pages API (`routes/api.js`)

| Method | Path                                            | Auth                  | Notes                                                                 |
| ------ | ----------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| GET    | `/api/pages`                                    | optional              | Lists pages filtered by viewer; attaches `views` via Redis `MGET`     |
| POST   | `/api/pages`                                    | requireAuth           | Create/update a page; snapshot prior content if changed               |
| GET    | `/api/pages/:slug(*)/raw`                       | requireAuth, owner    | Returns `{ slug, type, source, access }` for the editor               |
| GET    | `/api/pages/:slug(*)/exists`                    | optional              | `{ exists, canManage? }`                                              |
| PATCH  | `/api/pages/:slug(*)/access`                    | requirePageOwner      | Flip `public ↔ publisher`                                             |
| DELETE | `/api/pages/:slug(*)`                           | requirePageOwner      | Delete S3 object + meta row + all versions                            |
| GET    | `/api/views/:slug(*)`                           | none                  | Single-page view count                                                |
| GET    | `/api/pages/:slug(*)/versions`                  | versioning + owner    | List snapshots newest-first                                           |
| GET    | `/api/pages/:slug(*)/versions/:n`               | versioning + owner    | Fetch a version's raw HTML for preview/diff                           |
| POST   | `/api/pages/:slug(*)/versions/:n/restore`       | versioning + owner    | Snapshot current, then make version `n` live (undoable)               |

The slug pattern `:slug(*)` allows `/` inside slugs, which becomes nested S3
keys like `pages/docs/intro.html`.

### 6.3 Page serving (`routes/pages.js`)

| Method | Path        | Purpose                                                              |
| ------ | ----------- | -------------------------------------------------------------------- |
| GET    | `/p/:slug(*)` | Serve a page, enforce access, inject badge + (optional) assistant tag |

Inside the handler:

- Reads the wrapped HTML from S3.
- If `access === "publisher"` and no user → redirect to login with `next`.
- Increments the view counter except when `sec-fetch-dest === "iframe"` (so the
  dashboard's preview thumbnails don't pollute counts) and except for known
  bots (the User-Agent allowlist lives in `services/views.js`).
- SSR-reads the count for the inline badge label, formats it (`1.2K`, `3.4M`).
- Injects, just before the last `</body>`:
  1. A scrollbar-hider style block.
  2. The Shipfast badge (`a` with inline styles, links to `/`, shows count).
  3. The assistant loader `<script src="/assistant.js" data-slug="…" defer>` —
     only when `ASSISTANT_ENABLED` *and* the viewer is authenticated.

### 6.4 Settings, changelog, dashboard

- `GET /settings` (`routes/settings.js`) — auth-required, renders the shell.
  The assistant API key UI lives entirely in client JS and persists to
  `localStorage`; the server never sees it.
- `GET /changelog` (`routes/changelog.js`) — public, renders parsed entries
  from `CHANGELOG.md` (parsing in `services/changelog.js` with mtime-based
  cache invalidation).
- `GET /` (declared inline in `server.js`) — renders `dashboardHtml(user)`.
  The dashboard is a single self-contained HTML page that calls `/api/pages`
  for its data.

### 6.5 AI assistant (`routes/assistant.js`)

| Method | Path                                  | Auth                          | Purpose                                  |
| ------ | ------------------------------------- | ----------------------------- | ---------------------------------------- |
| GET    | `/assistant.js`                       | public                        | Loader injected into `/p/:slug`          |
| GET    | `/assistant/panel?slug=…`             | requireAuth                   | Iframe panel HTML                        |
| GET    | `/api/assistant/chats?slug=…`         | inline 401 + assistant flag   | List my chats for a page                 |
| POST   | `/api/assistant/chats`                | inline 401 + assistant flag   | Create chat, return `{ chatId }`         |
| GET    | `/api/assistant/chats/:id`            | inline 401 + assistant flag   | Full transcript (ownership-scoped)       |
| POST   | `/api/assistant/chats/:id/messages`   | inline 401 + assistant flag   | Append `[{role, content, selection?}]`   |
| DELETE | `/api/assistant/chats/:id`            | inline 401 + assistant flag   | Delete row + S3 snapshot                 |

The inline 401 middleware exists because `requireAuth` inspects
`req.path.startsWith("/api/")` to decide between JSON 401 and an HTML
redirect — but inside a sub-router mounted at `/api/assistant`, `req.path` is
relative (`/chats`), so the API branch wouldn't fire. The sub-router uses its
own auth check to always return JSON 401 to unauthenticated API callers.

---

## 7. Authentication and access control

Identities. Exactly two shapes ever land on `req.user`:

```js
// Password login
{ id: "admin", displayName: "Admin", role: "admin" }

// Google OAuth (persisted in users.json)
{ id: "google-<profile.id>", displayName, email, avatar,
  role: "publisher", createdAt, lastLogin }
```

Access levels per page (stored in `meta.json`):

- `"public"` — anyone with the URL can view.
- `"publisher"` — must be logged in (any role). Default if not set.

The complete access matrix:

| Viewer                | `public` page | `publisher` page         | Manage (PATCH/DELETE/versions) |
| --------------------- | ------------- | ------------------------ | ------------------------------ |
| Anonymous             | view          | redirect to `/login`     | 401                            |
| Publisher, not owner  | view          | view                     | 403                            |
| Publisher, owner      | view          | view                     | allowed                        |
| Admin                 | view          | view                     | allowed (any page)             |

Listing in `GET /api/pages` filters by the same rules: anon → public only;
publisher → own + public; admin → everything.

Middleware helpers (`middleware/auth.js`):

- `getCurrentUser(req)` — sync read of `req.user` or `null`.
- `isAdmin(req)` — sugar for `role === "admin"`.
- `canManagePage(req, slug)` — admin OR `meta.owner === user.id` (does I/O).
- `requireAuth` — `next()` or `401` (API) or redirect to `/login?next=…`.
- `requirePageOwner` — auth + ownership; returns 401/redirect/403/next.

Session cookies are httpOnly, sameSite=lax, `secure` in production, 7-day
maxAge, signed with `SESSION_SECRET`, persisted in Redis via `connect-redis`.

---

## 8. Storage architecture

The system uses three stores, each with a clearly bounded role.

### 8.1 S3 — durable content and JSON indexes

All access through `services/s3.js` (`getText`, `putText`, `deleteObject`,
`list`). The bucket is configurable via `S3_BUCKET`; MinIO is a drop-in for
local via `AWS_ENDPOINT_URL_S3`.

| Key                                       | Owner service              | Contents                                                                                                  |
| ----------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pages/{slug}.html`                       | `routes/api.js`            | Served HTML. Already wrapped (Babel+React for jsx, themed article for md, raw for html).                  |
| `pages/versions/{slug}/v{n}.html`         | `services/versions.js`     | Historical snapshots, written *after* the Postgres row exists (so a row always points to a real object).  |
| `meta.json`                               | `services/page.js`         | `{ [slug]: { title, description, type, access, owner, createdAt, updated } }` index.                      |
| `users.json`                              | `services/user.js`         | `{ [userId]: { id, displayName, email, avatar, role, createdAt, lastLogin } }` index.                     |
| `chats/{userId}/{slug}/{chatId}.json`     | `services/chat-store.js`   | Assistant transcript snapshot `{ chatId, messages: [{role, content, selection?, ts}] }`. Keys server-built. |

Notes that bite if forgotten:

- `meta.json` and `users.json` are **read-modify-write** JSON blobs — fine at
  current scale, would become a contention point at tens of thousands of pages.
- `s3.putText` always writes `Content-Type: text/plain; charset=utf-8` so S3
  never serves anything directly; every response flows through Express where
  access control runs.
- Slug nesting (`docs/intro`) is allowed and translates into S3 prefixes.
- Legacy `meta.json` entries may be bare strings (just the access level);
  `pageService.getPageMeta` normalizes them to `{ access, owner: "admin" }`.

### 8.2 Redis — counters and sessions

One shared `redis` client lives on `app.locals.redisClient`. Two consumers:

- `connect-redis` for `express-session`.
- `services/views.js` for `shipfast:views:{slug}` counters
  (`INCR`/`GET`/`MGET`). Bot UAs are filtered before incrementing, iframe
  requests are excluded by route, and reads use try/catch with a 0 fallback so
  Redis outages never break page serving.

The cardinal rule for Redis: page serving must never block on it.

### 8.3 Postgres — relational metadata (feature-flagged)

Only used when `DATABASE_URL` is set (`ASSISTANT_ENABLED`). Shared lazy pool in
`services/pg.js` (`max: 3`, suitable for serverless cold starts; use RDS
Proxy/PgBouncer at higher concurrency). Two tables:

```sql
-- migrations/001-assistant-chats.sql
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

-- migrations/002-page-versions.sql
CREATE TABLE page_versions (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT NOT NULL,
  version_n     INT  NOT NULL,
  s3_key        TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT '',
  content_type  TEXT NOT NULL DEFAULT 'html',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version_n)
);
CREATE INDEX idx_page_versions_slug_n
  ON page_versions (slug, version_n DESC);
```

Both services also `ensureSchema()` idempotently on first use so dev
environments without a migration runner still work.

Postgres-specific invariants:

- **Every chat query is scoped by `user_id`.** Cross-user access is prevented
  by construction — there are no admin-override branches.
- `page_versions` is capped at `MAX_VERSIONS = 5` per slug; older rows are
  pruned oldest-first after each insert, and their S3 objects are deleted.
- `snapshotCurrent` writes the DB row *before* the S3 body. A failure between
  the two leaves a dangling row pointing at a missing object — accepted
  trade-off to avoid orphaned S3 objects.

### 8.4 Why this split

> Catalogues that need querying → Postgres. Catalogues that just need point
> lookup → S3 JSON blob. Content → S3. Counters + ephemeral state → Redis.

Applied to the conceptual model:

- *Catalogue of pages* → `meta.json` (S3)
- *Content of pages* → `pages/{slug}.html` (S3)
- *Catalogue of users* → `users.json` (S3)
- *Popularity of pages* → counters (Redis)
- *Sessions* → Redis
- *Catalogue of chats* → `assistant_chats` (Postgres)
- *Content of chats* → `chats/.../{chatId}.json` (S3)
- *Catalogue of versions* → `page_versions` (Postgres)
- *Content of versions* → `pages/versions/{slug}/v{n}.html` (S3)

---

## 9. Content pipeline (`services/content.js`)

The publish path turns a raw paste into a wrapped, self-contained HTML
document, and the editor path reverses it.

```
POST /api/pages { slug, html, access?, versionLabel? }
   │
   ├─ slug sanitized to a-z0-9-_, kept lowercase, slash-separated segments
   ├─ existingRaw = s3.getText(pages/{slug}.html)
   ├─ if existing && !canManagePage  →  403
   │
   ├─ detectType(html)  →  "html" | "jsx" | "md"
   │     strong html signals first; otherwise count md vs jsx hint patterns;
   │     tie-break jsx > md > html
   │
   ├─ extract title (jsx: document.title or <title>; md: first H1; html: <title>)
   ├─ extract description (html: meta or first long <p>; truncated to 150 chars)
   │
   ├─ wrap content:
   │     jsx  →  full HTML doc + React 18 + ReactDOM + Babel-standalone +
   │             Tailwind CDN, hooks destructured from React, export-default
   │             stripped, render fallback (App/Main/Page/Home/Dashboard),
   │             marker `<!-- page-type:jsx -->`
   │     md   →  full HTML doc + dark themed article + marked-rendered body +
   │             marker `<!-- page-type:md -->` +
   │             `<!-- md-source:{base64(mdSource)} -->` for round-trip
   │     html →  stored as-is (absence of marker IS the marker)
   │
   ├─ if existing && contentChanged: versions.snapshotCurrent(prev) — failures
   │   logged but NEVER block the new publish
   │
   ├─ s3.putText(pages/{slug}.html, wrappedContent)
   ├─ pageService.setPageMeta(slug, { title, description, type, updated,
   │                                  access?, owner? if new, createdAt? if new })
   └─ return { ok, slug, url, type, access, owner }
```

The editor path (`GET /api/pages/:slug/raw`) reads the stored HTML, looks at
the marker comment, and either unwraps the Babel-wrapped JSX or base64-decodes
the markdown source, returning `{ slug, type, source, access }`. The marker
comment is load-bearing — changing its format breaks the editor for every
existing page of that type.

Adding a new content type requires (1) detection signals in `detectType`, (2)
a `wrap{Type}()` that emits a marker, (3) an unwrap branch in
`/api/pages/:slug/raw`, (4) title/description extraction tweaks if the source
has a different convention.

---

## 10. View counter pipeline (`services/views.js`)

```
GET /p/:slug
   │
   ├─ if sec-fetch-dest === "iframe": skip increment
   │     (dashboard thumbnails are iframes; they shouldn't pollute counts)
   ├─ if isBot(ua): skip increment
   │     (UA matched against a regex list: bot/crawl/spider/slurp/
   │      facebookexternalhit/twitterbot/linkedinbot/whatsapp/telegrambot/
   │      applebot/googlebot/bingbot/duckduckbot/baiduspider/yandexbot/
   │      semrushbot/ahrefsbot)
   ├─ redis.INCR shipfast:views:{slug}  — fire-and-forget, no await
   ├─ redis.GET for SSR badge value     — try/catch, fallback 0
   └─ format: < 1K → toLocaleString; ≥1K → "X.XK"; ≥1M → "X.XM"
```

Dashboard listing batches reads with a single `MGET` over all visible slugs.

---

## 11. Versioning and restore (`services/versions.js`)

Triggers on republish: `POST /api/pages` detects that the wrapped content
differs from what's in S3 and calls `versions.snapshotCurrent` with the
*previous* live content. The snapshot:

1. `SELECT MAX(version_n)` for the slug, compute `nextN`.
2. `INSERT INTO page_versions (...) VALUES (...) RETURNING ...`. If a race
   triggers a `23505` unique-violation, the loop retries once.
3. `s3.putText` the snapshot HTML at `pages/versions/{slug}/v{n}.html`.
4. Prune everything beyond `MAX_VERSIONS = 5` newest-first: delete the rows
   and try to delete the S3 objects (best-effort; logged on failure).

Restore (`POST /api/pages/:slug/versions/:n/restore`):

1. Fetch the target snapshot content (from S3 via the recorded `s3_key`).
2. Snapshot the *current* live HTML as a new version with label
   `"Before restore to v{n}"` (so the restore itself is undoable).
3. `s3.putText` the target content as the live page.
4. Touch `meta.updated`.

Delete (`DELETE /api/pages/:slug`) also calls
`versions.deleteAllForSlug(slug)` to remove rows and snapshot objects.

When `DATABASE_URL` is unset, versioning silently becomes a no-op:
`snapshotCurrent` returns null, listings return `[]`, the version routes
return `503` via the `requireVersioning` gate. Publishing is never blocked by
versioning being off.

---

## 12. AI assistant (security model is the feature)

The defining decision: **the user's LLM API key never reaches the ShipFast
server.** Every other shape of this feature follows.

```
Page in browser
   │
   ├─ <script src="/assistant.js" data-slug=…> (loader, public, no secrets)
   │     ├─ Floating "✨ AI" pill, layout pusher (push on wide, overlay on
   │     │   medium, full-width drawer on mobile)
   │     ├─ Text-selection → "Ask AI about this" pill
   │     └─ Creates same-origin iframe → /assistant/panel?slug=…
   │
   ├─ Iframe panel (authenticated, sandboxed allow-scripts allow-same-origin
   │  allow-forms allow-top-navigation-by-user-activation):
   │     ├─ Reads API key + provider + model from localStorage
   │     ├─ Persists conversation through ShipFast:
   │     │     POST /api/assistant/chats             → { chatId }
   │     │     POST /api/assistant/chats/:id/messages
   │     │     GET  /api/assistant/chats?slug=…
   │     │     GET  /api/assistant/chats/:id
   │     │     DELETE /api/assistant/chats/:id
   │     ├─ Calls the LLM provider directly from the browser
   │     │  (Anthropic/OpenAI/Gemini) with the local key in the auth header
   │     └─ postMessage bridge → loader sends page context
   │        (title, URL, page text capped ~8KB) and selection text
   └─ Server never sees the key, never proxies the LLM call.
```

### Server-side invariants (enforced in code today)

1. **No API key touches the server.** Nothing in `routes/assistant.js`,
   `services/chat-db.js`, or `services/chat-store.js` accepts or stores a key.
2. **Every Postgres query is scoped by `user_id`.** Cross-user reads are
   structurally impossible. No admin-override branches.
3. **S3 keys are server-built from authenticated identity.** Pattern:
   `chats/{user.id}/{slug}/{chatId}.json` — `user.id` from `req.user`,
   `chatId` from `crypto.randomUUID()`. Clients never send a key/path.
   `chatStore.sanitizeSegment` is a defense-in-depth strip for path chars.
4. **The loader is public; everything else is authed.** `/assistant.js` is
   cacheable; `/assistant/panel` and `/api/assistant/*` require auth.
5. **Sub-router 401 quirk handled inline** (`req.path` is relative inside a
   sub-router so `requireAuth`'s `/api/`-prefix check fails — the assistant
   API uses its own JSON 401 middleware).
6. **Transcripts are bounded**: `MAX_MESSAGES_PER_APPEND = 20`,
   `MAX_APPEND_BYTES = 64 * 1024`, `MAX_SNAPSHOT_MESSAGES = 500` (older
   messages dropped on append).
7. **Append is read-modify-write**, last-write-wins. Assumes single active
   writer per chat — true today because a user has one panel open at a time.
   Multi-device sync would require version tokens or moving the transcript to
   Postgres.

---

## 13. Templates layer

`templates/` exports pure functions that return HTML strings. No `req`/`res`,
no DB access. The pieces:

- `auth.js` — login page (`loginHtml(next, error)`).
- `pages.js` — 404 page (`notFoundHtml()`).
- `dashboard.js` — the single-file dashboard (inline CSS + JS that calls
  `/api/pages`, embeds the user object as JSON).
- `settings.js` — settings shell with the entirely client-side assistant-key
  section.
- `changelog.js` — public changelog renderer over `services/changelog.js`.
- `assistant/` — split for clarity:
  - `loader.js` — the `/assistant.js` source (pill + iframe + selection
    affordance + responsive layout: push on wide, overlay on medium, drawer
    on mobile; backdrop, scroll lock, postMessage bridge).
  - `panel/index.js` — composes the iframe document from real `panel.html`
    and `styles.css` files plus the in-iframe runtime built in `script.js`
    (which uses `prompt.js` for the system prompt). Files are read once at
    module load; restart the server to pick up edits.

---

## 14. Local development and deployment

Local stack via `docker-compose.yml`:

- `redis:7-alpine` on `6379`.
- `minio/minio` on `9000` (S3 API) and `9001` (console). `minio-init`
  container creates the `shipfast-local` bucket on first start.
- `postgres:16-alpine` on `5432` with `./migrations` mounted into
  `docker-entrypoint-initdb.d`, so SQL files run on first boot.

Workflow:

```bash
npm install
npm run services:up      # redis + minio + postgres
npm run dev              # node server.js
npm test                 # node --test tests/**/*.test.js
npm run services:down
```

Vercel deployment (`vercel.json`):

- `@vercel/node` builds `server.js`.
- One catch-all route maps `/(.*)` → `/server.js`.
- Filesystem is ephemeral, so `pages/` contents do not persist across
  invocations — S3 is required in production. The `pages/` and `users.json`
  files in the repo are local dev fixtures only.

---

## 15. Test approach

`tests/` uses Node 18+ built-in `node --test`. Existing files cover the
features most likely to regress under refactors: `views.test.js`,
`versions.test.js`, `assistant.test.js`. The shape: pass connection-bound
dependencies as parameters (e.g., a fake `redisClient`), assert
deterministic behavior, never hit real S3/Redis/Postgres. Services were
designed to be testable in isolation; a service that's hard to test usually
means a dependency needs to be lifted from import to parameter.

---

## 16. Feature pipeline (specs in `features/`)

The `features/` directory holds in-flight feature designs (`feature-{slug}-
{YYYY-MM-DD}.md`):

- ai-assistant (2026-06-10) — already shipped, see section 12.
- basic-analytics-dashboard (2026-06-08)
- custom-domains (2026-06-06)
- edit-republish-versioning (2026-06-13) — implemented as section 11.
- fork-remix (2026-06-10)
- page-expiry (2026-06-07)
- password-protected-pages (2026-06-12)
- shared-publish-access (2026-06-05)
- social-preview-og-tags (2026-06-11)
- view-counter (2026-06-04) — shipped, see section 10.

Specs follow a consistent structure (Overview → Requirements → User stories →
High-level architecture → Edge cases) and exist for alignment before code.

---

## 17. Summary — how it all fits

1. A single Express app, deployed serverless on Vercel, handles every request
   so access control can run on every byte served.
2. Three stores own non-overlapping concerns: S3 for content + JSON indexes,
   Redis for counters + sessions, Postgres for relational metadata that needs
   SQL (chat catalogue, version catalogue).
3. Layering is strict: config → services → middleware → routes → templates.
   Routes do not import the AWS SDK or `pg`; that boundary is the architecture.
4. Two auth identities (admin via password, publisher via Google OAuth) and
   two page-access levels (public, publisher) compose into a small access
   matrix enforced by a handful of middleware helpers.
5. The content pipeline detects html/jsx/md, wraps with a marker comment, and
   un-wraps on edit. Versioning snapshots the previous live content on
   republish; up to five versions kept per slug; restore is itself undoable.
6. The AI assistant is feature-flagged off until Postgres is wired up. The
   user's LLM key never reaches the server — that single invariant shapes the
   whole feature: client-side key storage, browser-direct LLM calls, server
   only persists transcripts in S3 + metadata in Postgres scoped by `user_id`.
