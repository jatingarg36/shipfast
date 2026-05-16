# ShipFast

A dead-simple web app to publish HTML pages built by Claude — paste, slug, done.

## Features

- **Publish any HTML** — paste Claude's output and give it a URL slug
- **Instant public links** — every page is live at `/p/your-slug`
- **Delete pages** — clean up old pages anytime
- **Zero database** — pages stored as plain `.html` files

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

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Environment variables

Create a local `.env` file or set these values in Vercel:

```env
SESSION_SECRET=your-secure-session-secret-here
REDIS_URL=redis://127.0.0.1:6379
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
PUBLISHER_PASSWORD=shipfast
```

- `SESSION_SECRET` is required and must stay stable across deployments.
- `REDIS_URL` is required for persistent session storage. Upstash Redis works with the same URL format.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google login.

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
├── server.js        # Express server + dashboard UI
├── vercel.json      # Vercel routing config
├── package.json
└── pages/           # Published HTML files live here (auto-created)
```

> **Note:** Vercel's serverless functions have an ephemeral filesystem — pages will reset on redeploy. For permanent storage, swap the `pages/` file store with a free [Vercel KV](https://vercel.com/docs/storage/vercel-kv) or [Supabase](https://supabase.com) database. See `server.js` comments for hook points.
