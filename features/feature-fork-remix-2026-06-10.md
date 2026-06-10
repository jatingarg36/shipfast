# Fork / Remix a Page

## Overview

Any viewer of a public ShipFast page can fork it into their own account with a single click. The fork creates an independent copy they own and can modify freely, while the original page remains unchanged. This creates a viral growth loop where good pages naturally spread and spawn variations.

## Key Requirements

- **Fork action** — visible to any authenticated user viewing a public page; hidden for private/password-protected pages
- **One-click copy** — server-side S3 object copy; no re-upload required
- **Ownership transfer** — forked page is owned by the forking user, not the original author
- **Fork attribution** — optionally display "Forked from [original page]" on the copy
- **Independent lifecycle** — forked page can be edited, published, or deleted without affecting the source
- **Rate limiting** — prevent abuse (e.g. max N forks per user per hour)

## User Stories

- **As a viewer**, I see a "Fork this page" button on any public page so I can grab a copy and adapt it for my own use.
- **As a publisher**, I can see how many times my page has been forked (fork count displayed alongside view count).
- **As a forking user**, after forking I'm immediately taken to my copy in an edit-ready state.
- **As a publisher**, I can opt out of allowing forks on my page via a page settings toggle.

## High-Level Architecture

```
Viewer clicks "Fork"
        │
        ▼
POST /api/pages/:id/fork
        │
        ├─ Auth check (must be logged in)
        ├─ Source page visibility check (must be public + forkable)
        ├─ S3 CopyObject: pages/{src-owner}/{page-id}/ → pages/{forker-id}/{new-page-id}/
        ├─ DB: insert new page record (owner = forker, forked_from = src page id)
        └─ Return new page URL
        │
        ▼
Redirect to /dashboard or /edit/:new-page-id
```

**Data model additions:**
- `pages.forked_from` — nullable FK to source page id
- `pages.forkable` — boolean, default `true`
- `pages.fork_count` — integer counter (increment on fork)

**Storage:** S3 CopyObject is a server-side operation with no data transfer cost. Metadata (title, description) is duplicated; the HTML/assets blob is shallow-copied.

**Edge cases to handle:**
- Source page deleted after fork is initiated → return 404 with clear message
- Forking your own page → allowed (creates a duplicate for experimentation)
- Forked page inheriting password protection → forks are always public by default unless forker sets a password
