# ShipFast

A dead-simple web app to publish HTML pages built by Claude — paste, slug, done.

## Features

- **Publish any HTML** — paste Claude's output and give it a URL slug
- **Instant public links** — every page is live at `/p/your-slug`
- **Delete pages** — clean up old pages anytime
- **Authentication** — password + Google OAuth login
- **Access control** — public/publisher pages with permission management
- **S3 backed** — optional persistent storage via AWS S3

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
# Optional: S3 bucket for persistent storage
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
# AWS credentials are read from environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
```

- `SESSION_SECRET` is required and must stay stable across deployments.
- `REDIS_URL` is required for persistent session storage. Upstash Redis works with the same URL format.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google login.
- `S3_BUCKET` (optional): when set, ShipFast will sync `pages/`, `meta.json` and `users.json` with the bucket. Configure `S3_REGION` and AWS credentials as usual.

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
├── server.js           # Express entry point (~60 lines)
├── config.js           # Environment & config management
├── vercel.json         # Vercel routing config
├── package.json
│
├── services/           # Business logic (reusable, testable)
│   ├── s3.js          # S3 operations abstraction
│   ├── user.js        # User management
│   ├── page.js        # Page metadata & listing
│   └── content.js     # Content type detection
│
├── routes/             # API endpoints
│   ├── auth.js        # Auth endpoints (/login, /api/login)
│   ├── api.js         # Page API routes (/api/pages/*)
│   └── pages.js       # Page serving (/p/:slug)
│
├── middleware/         # Express middleware
│   └── auth.js        # Authentication & authorization
│
├── templates/          # HTML generation
│   ├── auth.js        # Login page
│   ├── pages.js       # 404 page
│   └── dashboard.js   # Dashboard + CSS + JS
│
└── REFACTORING_SUMMARY.md  # Detailed architecture guide
```

**Architecture highlights:**
- **Modular design** — 12+ focused files (SOLID principles)
- **Separation of concerns** — Services, routes, middleware, templates all isolated
- **Testable** — Services are pure business logic, easy to unit test
- **Extensible** — Add features by composing existing modules

See [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) for detailed architecture documentation.

---

## Storage

- **Default**: Files stored in `pages/` directory
- **S3 optional**: Set `S3_BUCKET` + AWS credentials for persistent cloud storage
- **Vercel Note**: Serverless functions have ephemeral filesystems. Use S3 for production deployments.
