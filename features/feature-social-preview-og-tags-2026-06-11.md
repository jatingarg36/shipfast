# Social Preview (OG Tags)

## Overview

Automatically generate or let publishers set Open Graph metadata (title, description, image) for each ShipFast page so that link previews render correctly when shared on Slack, X (Twitter), LinkedIn, iMessage, and similar platforms.

## Key Requirements

- Server-side rendering of `<meta property="og:*">` and `<meta name="twitter:*">` tags in the page's `<head>` at serve time (not via JS, since crawlers don't execute JS).
- Support for at least: `og:title`, `og:description`, `og:url`, `og:image`, `twitter:card`.
- **Auto-mode**: parse the page's `<title>` and first `<meta name="description">` on upload; use those as defaults.
- **Manual override**: let the publisher set custom title, description, and an OG image URL in the page settings UI.
- OG image: accept a user-supplied URL, or fall back to a generic ShipFast branded card (can be a static image to start).

## User Stories

- **As a publisher**, when I share my page URL in Slack, I want a rich preview (title + description + image thumbnail) to appear, so recipients understand what they're clicking before they visit.
- **As a publisher**, when auto-detected metadata doesn't match what I want, I want to manually set a custom title and description for social cards without touching my page's HTML.
- **As a viewer**, when I see a shared ShipFast link on X or LinkedIn, I want to see a recognizable preview so I can decide whether to click.

## High-Level Architecture

```
Upload flow (existing):
  Client → POST /upload → store HTML in S3

New: metadata extraction at upload time
  /upload handler → parse HTML (server-side, e.g. with Go's golang.org/x/net/html or a lightweight HTML parser)
                  → extract <title> and <meta name="description">
                  → store as JSON sidecar in S3 (e.g. pages/{id}/meta.json)

Serve flow:
  GET /{slug} → fetch page HTML from S3
              → fetch meta.json sidecar
              → inject <meta og:*> tags into <head> before streaming response to client

Settings UI (optional override):
  Publisher edits og_title / og_description / og_image_url
  → PATCH /pages/{id}/meta → update meta.json in S3

OG image fallback:
  Use a static branded PNG hosted on ShipFast CDN
  (dynamic image generation with canvas/puppeteer can be a follow-on)
```

**Data stored in `meta.json`:**
```json
{
  "title": "My Awesome Demo",
  "description": "A quick interactive walkthrough of the feature.",
  "og_image_url": "https://cdn.shipfast.io/og-default.png",
  "overridden": false
}
```

**Dependencies:** No new services required. HTML parsing happens in the existing upload handler. S3 sidecar is a cheap addition. Meta injection is a string operation at serve time.
