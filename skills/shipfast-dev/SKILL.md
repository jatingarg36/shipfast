---
name: shipfast-dev
description: Navigate and contribute to the ShipFast codebase — a Node/Express PaaS for publishing HTML/JSX/Markdown pages built by Claude. Use this skill whenever the user is working in the ShipFast repo: adding endpoints, services, middleware, templates, or features; touching pages/, routes/, services/, middleware/, templates/, config.js, or server.js; debugging auth, S3, Redis, view counts, or the AI assistant; reading feature specs in features/; or asking architectural questions about the project. Trigger even when the user does not explicitly say "ShipFast" — the cue is files like services/page.js, routes/api.js, the meta.json layout, or talk of slugs, publishers, public/publisher access, the assistant widget, or the fork/views/expiry features.
---

# ShipFast Developer Skill

ShipFast is an Express app that lets users paste HTML (or JSX, or Markdown) Claude generated and publish it at `/p/:slug`. The codebase is intentionally layered: `config → services → middleware → routes → templates`. Most contribution mistakes come from skipping a layer — putting business logic in a route handler, calling the S3 SDK directly, or putting HTML inside a service. Stick to the layering and the architecture stays cheap to extend.

This file is the map. For deep dives (auth/access rules, S3 key layout, content-type pipeline, AI assistant invariants), follow the pointers into `references/`.

## When to use this skill

Use it whenever the user is working in the ShipFast repo. Concrete cues:

- They opened, mentioned, or are editing anything under `services/`, `routes/`, `middleware/`, `templates/`, `pages/`, or `features/`.
- They reference ShipFast concepts: slugs, publisher vs public access, the `/p/:slug` route, the dashboard, the floating assistant pill, view counts, fork/remix.
- They ask "where does X live" or "how do I add an endpoint / a new content type / a new auth provider".
- They paste an error from `server.js`, Redis, S3, or Passport.

If the task is generic Node/Express help unrelated to this repo, you don't need this skill.

## Architecture in one screen

```
server.js              entry point (~140 lines) — wires Express, session, passport, mounts routers
config.js              env loading + validation (SESSION_SECRET, REDIS_URL, S3_BUCKET required at boot)

services/              pure business logic — no Express, no req/res
  s3.js                S3 wrapper: getText/putText/deleteObject/list
  user.js              Postgres users table (readUsers/writeUsers/upsertUser/getDisplayName)
  page.js              meta.json on S3 (listPages/getPageMeta/setPageMeta/deletePageMeta/getAccess)
  content.js           detectType(html|jsx|md) + wrapJsx + wrapMarkdown
  views.js             Redis view counters (incrementView/getViewCount/getViewCounts/isBot)
  chat-db.js           Postgres assistant_chats table (lazy pool, schema bootstrap, ownership-scoped queries)
  chat-store.js        S3-backed chat transcripts (server-built keys, message validation)

middleware/
  auth.js              getCurrentUser/isAdmin/canManagePage + requireAuth/requirePageOwner

routes/                Express routers — thin glue, no business logic
  auth.js              /login, /api/login, /api/logout, /auth/google[/callback]
  api.js               /api/pages CRUD, /api/pages/:slug/{raw,exists,access}, /api/views/:slug
  pages.js             GET /p/:slug — serves pages, enforces access, injects badge + assistant tag
  settings.js          GET /settings (shell only; assistant key stays client-side)
  assistant.js         /assistant.js loader, /assistant/panel, /api/assistant/chats*

templates/             HTML strings (CSS + JS inlined); kept out of routes
  auth.js              login page
  pages.js             404 page
  dashboard.js         main dashboard
  settings.js          settings shell
  assistant/           loader.js + panel/{index,styles,markup,script}.js

migrations/            SQL files auto-loaded by Postgres on first boot via docker-entrypoint-initdb.d
features/              markdown specs for in-flight features (versioning, fork, expiry, custom domains, …)
tests/                 node --test runner; tests/views.test.js is the shape to follow
```

The big rule: **routes consume services, services consume `services/s3.js` or the shared `services/pg.js` pool — never the AWS SDK or `pg` directly**. If you find yourself importing `@aws-sdk/client-s3` outside `services/s3.js`, or constructing a `pg` `Pool` outside `services/pg.js`, you're about to violate the layering. The current Postgres-touching services are `services/user.js`, `services/chat-db.js`, and `services/versions.js`; each takes its pool from `pg.getPool()`.

## How storage is split

There are three stores and each owns a specific kind of data. Mixing them is the most common architectural mistake.

- **S3** — durable content + JSON blobs. Keys you'll see: `pages/{slug}.html`, `meta.json` (page metadata index), `chats/{userId}/{slug}/{chatId}.json` (assistant transcripts). Everything user-visible lives here.
- **Redis** — counters and sessions. View counters under `shipfast:views:{slug}`; Express session store via `connect-redis`. Treat Redis as ephemeral: never make page serving block on it (see `routes/pages.js` — view increment is fire-and-forget).
- **Postgres** — relational metadata. Tables: `users` (publisher identity, see migration 003), `assistant_chats` (chat index for the AI assistant), `page_versions` (snapshot index for edit/re-publish). All transcripts and page HTML still live in S3; Postgres holds only the queryable index rows. Assistant + versioning features are gated on `DATABASE_URL`; the `users` table is required whenever Google OAuth is on.

When adding a new feature, ask: what's the durability/queryability story? Counters and rate limits → Redis. Bulk content and JSON indexes → S3. Anything you'd want to run SQL across (history, leaderboards, search) → Postgres. See `references/storage.md` for the full S3 key layout and rationale.

## Auth and access — the rules that bite

Two auth surfaces, two access levels. They compose, and getting the combination wrong is the most common security bug.

- Two **identities**: password login → `{ id: "admin", role: "admin" }`; Google OAuth → `{ id: "google-{profileId}", role: "publisher" }`. `admin` can manage every page; publishers can only manage their own.
- Two page **access levels**: `public` (anyone with the URL) and `publisher` (must be logged in). Stored in `meta.json` per slug, default `publisher`.
- Listing endpoint `GET /api/pages` filters by viewer: anon → public only; publisher → own + public; admin → all. The dashboard depends on this.
- `routes/pages.js` redirects unauthenticated viewers of `publisher` pages to `/login?next=…` — don't change that without thinking about share links.

Use the helpers in `middleware/auth.js`: `requireAuth` for "must be logged in", `requirePageOwner` for "must own this slug (or be admin)", `canManagePage(req, slug)` when you need an `if`. Don't write your own session check; you'll miss the API-vs-HTML 401-vs-redirect branch.

Edge case worth remembering: `requireAuth` looks at `req.path` to decide between JSON 401 and redirect — but inside a sub-router (`routes/assistant.js`), `req.path` is relative and doesn't start with `/api/`. That's why `assistant.js` has its own inline `401` middleware. Follow that pattern if you add a sub-router.

For the full matrix (who can do what, anonymous vs publisher vs admin, public vs publisher pages), see `references/auth.md`.

## Content pipeline — html, jsx, md

`POST /api/pages` accepts a raw `html` string and a `slug`. `services/content.js` detects which of three types it is and wraps it for serving:

- **html** — stored as-is. Title pulled from `<title>`, description from `<meta name="description">` or first long `<p>`.
- **jsx** — wrapped in a Babel-standalone template that pulls React 18 + Tailwind from unpkg/cdn; ES module imports are stripped, hooks destructured from `React`, and the default export is auto-rendered. Marker comment `<!-- page-type:jsx -->` in the file is how `/raw` knows to un-wrap.
- **md** — `marked` renders body HTML; original source is base64-encoded into `<!-- md-source:… -->` so the editor can round-trip the raw markdown.

When adding a new content type (TSX, Vue, MDX, etc.), add a `detectType()` signal *and* a `wrap…()` function in the same file, then mirror the un-wrap path in the `GET /api/pages/:slug/raw` handler in `routes/api.js`. The marker-comment convention is load-bearing — keep it.

Detection is heuristic and lossy by design. If a user pastes ambiguous code, jsx wins over md wins over html. Don't add expensive AST parsing here; speed matters because this is on the publish hot path.

See `references/content-pipeline.md` for the exact regex set, the round-trip story, and how the badge + assistant loader get injected on serve.

## AI assistant — the security model is the feature

The assistant is feature-flagged on `DATABASE_URL`. Read the invariants before touching any of it; they are the whole reason the feature is shaped the way it is.

- **The user's LLM API key never reaches this server.** It's stored in `localStorage` and used directly from the browser to call the provider. Server code that touches an API key is a regression.
- Server stores only transcripts (S3) and metadata (Postgres). Both are scoped by `user_id` in every query — no cross-user reads are possible by construction.
- S3 keys for transcripts are *server-built* from authenticated identity (`chats/{userId}/{slug}/{chatId}.json`). The client never supplies a key or path.
- The loader script (`/assistant.js`) is public and contains no secrets; the panel and chat API require auth.
- Auth on the chat sub-router uses an inline 401 middleware (see "Auth" section above for why `requireAuth` doesn't work there).

Touch `routes/assistant.js`, `services/chat-db.js`, `services/chat-store.js` only with the invariants front of mind. The full threat model and key-handling rationale is in `references/assistant.md`.

## Adding things — recipes

These are the four most common contribution shapes. Follow the recipe and the layering takes care of itself.

**Add an API endpoint** — open `routes/api.js`. If the logic fits an existing service, call it. If it needs new business logic, add a function in the appropriate service first (`page.js` for metadata, `s3.js` for raw object ops, etc.), then call it from the route. Use `requireAuth` / `requirePageOwner` from `middleware/auth.js` for access control.

**Add a service** — new file in `services/`. Pure functions, no Express imports, no `req`/`res`. Take dependencies (like `redisClient`) as parameters when they're connection-bound; import `s3Service`/`pageService` directly when they're project-level singletons. Mirror the JSDoc style of existing services — `@param` / `@returns` blocks help downstream callers.

**Add a content type** — extend `detectType()` in `services/content.js` with new signals, add a `wrap{Type}()` function, add an un-wrap branch in `GET /api/pages/:slug/raw` (routes/api.js). Use a unique HTML comment marker like `<!-- page-type:tsx -->` so round-tripping works.

**Add an auth provider** — Passport strategy goes in `server.js` next to the Google one (it's small enough to live there). Route handler goes in `routes/auth.js`. `upsertUser()` on first login. New users default to `role: "publisher"`.

**Add a feature spec** — drop a markdown file in `features/` named `feature-{slug}-{YYYY-MM-DD}.md` (match the existing convention). Use the structure you'll see in the other files: Overview → Key Requirements → User Stories → High-Level Architecture (with an ASCII flow) → Edge Cases. Specs are not implementation — they're for alignment before code.

## Local development

```bash
npm install
npm run services:up   # docker compose: redis + minio (S3-compatible) + postgres
npm run dev           # restart manually after edits
npm test              # node --test tests/**/*.test.js
```

Local `.env.local` overrides `.env` (see `config.js` — it loads `.env.local` first with `override: true`). For local S3 against MinIO, point `S3_BUCKET=shipfast-local`, use `S3_REGION=us-east-1`, and set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` to `minioadmin`/`minioadmin`. For local Postgres (assistant feature), set `DATABASE_URL=postgres://shipfast:shipfast@localhost:5432/shipfast`. The `migrations/` folder is mounted into Postgres so DDL runs on first boot.

If the assistant feature stays off in your local env, almost everything else still works — the codebase only fails fast on `SESSION_SECRET`, `REDIS_URL`, and `S3_BUCKET`.

## Testing

`node --test` is the runner (Node 18+ built-in). `tests/views.test.js` is the canonical shape: mock the connection-bound dependency at the call site (the test passes a fake `redisClient`), keep assertions deterministic, and never hit real S3/Redis/Postgres. Services were designed to be testable in isolation; if a service is hard to test, the dependency injection probably needs to move from import to parameter.

## Deployment notes

The repo deploys to Vercel as a serverless function (see `vercel.json`). Two things to keep in mind: filesystem is ephemeral, so `pages/` directory contents don't persist across invocations — S3 is required in production. And serverless cold starts mean keeping the `pg` Pool small (`max: 3`) and lazy-initializing it inside `chat-db.js` — don't move it to module-top.

## What this skill does not cover

Look elsewhere for: writing the HTML/JSX/MD pages themselves (that's the *content* the platform hosts, not the platform). Same for prompt-engineering Claude to produce ShipFast-friendly pages. If the user asks "how should this page be structured", that's a different conversation.

## References

- `references/auth.md` — full access-control matrix, helper semantics, sub-router gotcha
- `references/storage.md` — S3 key layout, Redis keyspace, Postgres schema and why each store owns what
- `references/content-pipeline.md` — detectType signals, wrap/unwrap round-trip, badge + assistant injection
- `references/assistant.md` — AI assistant threat model and security invariants
