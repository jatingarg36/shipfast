# View Counter

## Overview

Show a live view count on every published ShipFast page. Each page visit increments a counter stored in Redis; the count is displayed to visitors and surfaced in the publisher's dashboard. This gives creators immediate feedback on whether anyone is actually reading their work.

## Key Requirements

- Increment a per-page counter on every page request (Redis `INCR`)
- Display the count visibly on the page (e.g. "👁 1,234 views")
- Expose the count via the page metadata API so the dashboard can show it
- Counts must be durable across Redis restarts (periodic persistence or Redis AOF)
- No impact on page load time — counter update is fire-and-forget (async / non-blocking)
- Bot/crawler filtering: don't count requests from known crawlers (User-Agent check)

## User Stories

**As a publisher**, I want to see how many times my page has been viewed so I know whether my content is getting traction.

**As a visitor**, I want to see the view count on a page so I can gauge its popularity before spending time reading it.

**As a publisher**, I want view counts to be accurate even after I re-publish or update a page so my history isn't reset.

**As a publisher**, I want bots not to inflate my view count so I get a realistic picture of human interest.

## High-Level Architecture

```
Visitor request
      │
      ▼
  CDN / Edge (serve cached HTML)
      │
      ├──► [async] POST /api/views/:pageId
      │            │
      │            ▼
      │        API Server
      │            │
      │            ▼
      │        Redis INCR  shipfast:views:<pageId>
      │
      ▼
  Page renders with view count fetched from Redis
  (or embedded as a <script> hydration value at serve time)
```

**Key components:**

- **Redis key** — `shipfast:views:<pageId>` holds a simple integer counter. `INCR` is atomic and O(1).
- **API endpoint** — `POST /api/views/:pageId` increments the counter. Called fire-and-forget from the client-side so it never blocks page load.
- **Read path** — `GET /api/views/:pageId` returns `{ count: N }`. The page template inlines this value at render time (SSR) so the count is visible without a second network round-trip.
- **Bot filtering** — middleware checks `User-Agent` against a deny-list of known crawlers before incrementing.
- **Persistence** — enable Redis AOF (append-only file) or schedule a periodic `BGSAVE` so counts survive restarts. Alternatively, flush totals to the primary DB (Postgres/DynamoDB) every hour via a cron job.
- **Display** — a small UI component in the page footer shows the count, formatted with locale-aware number separators (e.g. `1,234`).
