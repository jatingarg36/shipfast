# Password-Protected Pages

**Status:** Spec Ready  
**Effort:** Medium (1–2 weeks)  
**Date:** 2026-06-12

---

## Overview

Allow page publishers to put an optional password gate on any ShipFast page. Visitors who don't know the password are blocked at the server — they never receive the page content.

---

## Key Requirements

- Publisher can set or remove a password on any page they own via the dashboard.
- Password validation happens server-side. The raw page HTML/assets are never sent to an unauthenticated request — the server returns a 401 with a minimal gate UI.
- Wrong password → 401 response. Correct password → server issues a short-lived signed cookie (e.g. 24h) so the visitor isn't re-prompted on every load.
- Password is stored hashed (bcrypt) — never in plaintext.
- Publisher can change or remove the password at any time; existing tokens are invalidated.
- The public page URL does not change when a password is added or removed.

---

## User Stories

**As a publisher:**
- I want to add a password to a page so only people I've told the password can view it.
- I want to remove or change the password without the page URL changing.
- I want client deliverables, staging demos, or internal tools to be inaccessible to the public even if someone guesses the URL.

**As a viewer:**
- When I visit a password-protected page, I see a clean password prompt — not a blank page or 404.
- After entering the correct password, I'm not re-prompted on the same device for a reasonable session window (e.g. 24 hours).
- If I enter the wrong password, I get a clear error and can try again.

---

## High-Level Architecture

```
Visitor → GET /p/{slug}
          ↓
      Server middleware checks:
        1. Does this page have a password hash stored? (DB/metadata lookup)
        2. If yes → does the request carry a valid signed session cookie?
           - Yes → serve page normally
           - No  → return 401 + gate HTML (password form)
          ↓
      POST /p/{slug}/auth  (password submission)
        - Hash submitted password, compare to stored hash
        - Match → set HttpOnly signed cookie (24h TTL), redirect to GET
        - No match → return gate HTML with error message
```

**Storage:** Password hash stored alongside page metadata (e.g. a `password_hash` field in the pages table/record). Null = no gate.

**Session token:** HMAC-signed cookie containing `{ slug, exp }`. No server-side session store needed — stateless validation.

**Gate UI:** Minimal server-rendered HTML form (no JS required). Consistent with ShipFast branding — publisher's page title shown above the prompt if available.

---

## Open Questions

- Should the publisher be able to see a list of who has accessed the page (even with password)?
- Do we want per-page passwords only, or also per-account "team password" that covers all pages?
- Rate-limit brute-force attempts on `/p/{slug}/auth`?
