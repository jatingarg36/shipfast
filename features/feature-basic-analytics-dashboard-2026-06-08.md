# Basic Analytics Dashboard

## Overview

Per-page view analytics for ShipFast publishers. Tracks how many times each page has been viewed over time, displayed as a simple bar chart. No third-party tracking — all data lives in-house using Redis daily buckets.

## Key Requirements

- Track view count per page per day (Redis INCR on each page load)
- Dashboard showing views over a configurable time range (last 7 / 30 days)
- Bar chart visualization — daily granularity
- Total view count summary per page
- Data accessible only to the page owner
- No external analytics scripts injected into published pages

## User Stories

**As a publisher**, I want to see how many views my page has received each day so I know if my content is getting traction.

**As a publisher**, I want to compare views across my pages so I can focus on what's working.

**As a publisher**, I want a simple, clean view count without complex funnels or events — just raw page views.

## High-Level Architecture

```
Page load
  └─> ShipFast server (edge handler)
        └─> Redis INCR  page:{slug}:views:{YYYY-MM-DD}
              └─> TTL set to 90 days (auto-expire old buckets)

Dashboard API  GET /api/pages/:slug/analytics?range=30d
  └─> Redis MGET  page:{slug}:views:{date} × N days
        └─> Return [{date, views}] array to frontend

Frontend
  └─> Fetch analytics on dashboard load
        └─> Render bar chart (lightweight, e.g. Chart.js or custom SVG)
              └─> Show total + daily breakdown
```

**Data store:** Redis (already in use for view counters)
**API:** New `/analytics` endpoint on existing pages router
**Auth:** Session cookie — only owner can query their page analytics
**Retention:** 90-day rolling window; older buckets auto-expire via Redis TTL

## Open Questions

- Should anonymous visitors be de-duped (e.g., by IP hash) or count every hit?
- Do we show analytics inline on the page list, or as a separate drill-down view?
- Should the chart be visible only to the owner, or optionally public?
