# ShipFast

A dead-simple web app to publish HTML pages built by Claude — paste, slug, done.

## Features

- **Publish any HTML** — paste Claude's output and give it a URL slug
- **Instant public links** — every page is live at `/p/your-slug`
- **View counter** — per-page view tracking (iframe traffic excluded)
- **In-page AI assistant** — drop-in widget that uses the visitor's own LLM key (key stays in the browser; only transcripts are persisted)
- **Authentication** — password + Google OAuth login
- **Access control** — public/publisher pages with permission management
- **S3 backed** — pages, metadata and users are synced to S3
- **Delete pages** — clean up old pages anytime

---

## Deploy to Vercel (1 minute)

### Option A — Vercel CLI

```bash
npm i -g vercel
cd ShipFast
vercel
```

Follow the prompts. Done — you'll get a `*.vercel.app` URL.

### Option B — GitHub + Vercel Dashboard

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import the repo — Vercel auto-detects the config
4. Hit **Deploy**

---

## Run locally

ShipFast depends on Redis (sessions), S3 (storage) and optionally Postgres (AI assistant chat). The `docker-compose.yml` ships local stand-ins for all three (Redis, MinIO, Postgres).

```bash
npm install
npm run services:up      # start redis + minio + postgres
npm run dev              # → http://localhost:3000
npm run services:down    # stop them when you're done
```

`migrations/` is auto-applied to the Postgres container on first boot.

---

## Environment variables

Create `.env` (or `.env.local` for local overrides) — see `.env.example`.

```env
# Required
SESSION_SECRET=your-secure-session-secret-here
REDIS_URL=redis://127.0.0.1:6379
S3_BUCKET=your-bucket-name

# S3 / S3-compatible storage
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# AWS_ENDPOINT_URL_S3=...   # set for MinIO or other S3-compatibles

# Auth
PUBLISHER_PASSWORD=shipfast
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# AI assistant (optional — feature is off unless DATABASE_URL is set)
DATABASE_URL=postgres://shipfast:shipfast@localhost:5432/shipfast
```

- `SESSION_SECRET`, `REDIS_URL`, and `S3_BUCKET` are required — the server fails fast on startup if any are missing.
- `REDIS_URL` works with Upstash Redis as-is.
- Google login activates when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set.
- The AI assistant activates when `DATABASE_URL` is set. The visitor's LLM API key **never** touches the server — only chat transcripts are persisted.

---

## How to use

1. Ask Claude to build any HTML page
2. Copy the full HTML
3. Open your app → paste HTML → enter a slug → **Publish**
4. Share `/p/your-slug` with anyone

---

## Project structure

```
ShipFast/
├── server.js                 # Express entry point
├── config.js                 # Environment & config management
├── docker-compose.yml        # Redis + MinIO + Postgres for local dev
├── vercel.json               # Vercel routing config
├── package.json
│
├── services/                 # Business logic (reusable, testable)
│   ├── s3.js                # S3 operations abstraction
│   ├── user.js              # User management
│   ├── page.js              # Page metadata & listing
│   ├── content.js           # Content type detection
│   ├── views.js             # View counter
│   ├── chat-db.js           # Postgres access for assistant chats
│   └── chat-store.js        # Chat transcript persistence
│
├── routes/                   # API endpoints
│   ├── auth.js              # Auth endpoints (/login, /api/login)
│   ├── api.js               # Page API routes (/api/pages/*)
│   ├── pages.js             # Page serving (/p/:slug)
│   ├── assistant.js         # AI assistant widget + chat API
│   └── settings.js          # User settings
│
├── middleware/
│   └── auth.js              # Authentication & authorization
│
├── templates/                # HTML generation
│   ├── auth.js              # Login page
│   ├── pages.js             # 404 page
│   ├── dashboard.js         # Dashboard + CSS + JS
│   └── assistant.js         # AI assistant widget
│
├── migrations/              # Postgres schema (auto-applied locally)
├── tests/                   # node:test suite (`npm test`)
└── REFACTORING_SUMMARY.md   # Detailed architecture guide
```

See [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) for detailed architecture documentation.

---

## Storage

- **Pages, metadata, users** — synced to S3 (`S3_BUCKET`). MinIO works as a drop-in via `AWS_ENDPOINT_URL_S3`.
- **Sessions** — Redis (`REDIS_URL`).
- **AI assistant chats** — Postgres (`DATABASE_URL`).
- **Vercel note** — serverless functions have ephemeral filesystems, so S3 is the source of truth for page content in production.

---

## Tests

```bash
npm test
```
