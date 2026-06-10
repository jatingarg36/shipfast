# Shared Publish Access

## Overview

Allow page owners to invite collaborators by email, giving them edit and republish rights on specific pages without granting full account access. This enables team workflows where one person builds a page and another manages or updates it over time.

## Key Requirements

- Page owner can invite one or more collaborators via email address
- Invitees receive an email with an accept link (token-based, expiring)
- Collaborator roles: **Editor** (can edit and republish) — no billing or account-level access
- Owner can revoke access at any time
- Collaborators see shared pages in their own dashboard under a "Shared with me" section
- Audit trail: record who last published a page and when

## User Stories

**As a page owner,** I want to invite a teammate by email so they can update the page without me having to share my credentials.

**As a collaborator,** I want to see the pages shared with me in my dashboard so I can edit and republish them without owning the account.

**As a page owner,** I want to revoke a collaborator's access so I stay in control of who can modify my pages.

**As a viewer,** I should not see any difference — the page URL and content remain the same regardless of who last published it.

## High-Level Architecture

```
Invite flow:
  Owner → POST /pages/:id/collaborators { email } 
        → Create invite record (token, page_id, invitee_email, expires_at)
        → Send email with accept link

Accept flow:
  Invitee → GET /invites/:token/accept
          → Validate token (not expired, not already used)
          → Create page_collaborators row { page_id, user_id, role: "editor" }
          → Redirect to page dashboard

Edit/Republish:
  Collaborator request → Auth middleware checks page_collaborators table
                       → If editor row exists → allow edit/publish
                       → Publish writes S3 under owner's namespace (URL unchanged)

Revoke:
  Owner → DELETE /pages/:id/collaborators/:user_id
        → Remove page_collaborators row
        → Next request by that user → 403

Data model additions:
  page_invites   { id, page_id, invitee_email, token, expires_at, accepted_at }
  page_collaborators { page_id, user_id, role, invited_by, created_at }
```

Pages remain owned by the original owner — collaborators publish on their behalf but the S3 path and public URL never change.
