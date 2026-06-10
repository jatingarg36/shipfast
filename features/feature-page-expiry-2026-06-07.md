# Page Expiry

## Overview

Publishers can set a time-to-live (TTL) on any page they deploy. When the TTL expires, the page is automatically deleted and the URL returns a 404. This is useful for time-sensitive content like event landing pages, limited-time demos, client previews, or one-off promotions.

## Key Requirements

- Publisher can set an expiry date/time (or a relative duration, e.g. "7 days") at publish time or any time after
- Expiry is stored in S3 object metadata (or a lightweight DB record) alongside the page
- A scheduled cron job (runs hourly or daily) scans for expired pages and deletes them from S3 and any CDN cache
- Expired pages return a clean 410 Gone (or 404) response — not a blank page
- Publisher receives an optional email notification before expiry (e.g. 24 hours prior)
- Publisher can extend, change, or remove expiry at any time from their dashboard

## User Stories

**As a publisher:**
- I want to set an expiry when I upload a page, so I don't have to remember to take it down manually
- I want to extend the expiry if my event gets postponed, without re-deploying the page
- I want to receive a heads-up email before my page disappears, so I can act if needed

**As a viewer:**
- When I visit an expired page, I want a clear, friendly message explaining it's no longer available — not a generic server error

## High-Level Architecture

```
Publisher Dashboard
  └─ Set/edit expiry date → stored in DB (page_expiry_at) + S3 object metadata x-amz-expiry

Cron Job (runs hourly)
  └─ Query DB for pages where page_expiry_at <= now()
  └─ For each expired page:
       ├─ Delete S3 object (HTML + assets)
       ├─ Purge CDN cache for the page URL
       ├─ Mark page as deleted in DB
       └─ (Optional) Send expiry notification email

Serve Layer
  └─ On request: check if page is marked deleted → return 410 Gone with a styled expiry page
```

**Key implementation notes:**
- S3 has native object expiry via `x-amz-expiry` / lifecycle rules — can be used as a fallback, but DB-driven deletion gives more control (clean 410, email notification, audit trail)
- Cron can be a simple Lambda on EventBridge or a lightweight background worker
- Expiry page (410) should be a branded ShipFast template, not a raw HTTP error
