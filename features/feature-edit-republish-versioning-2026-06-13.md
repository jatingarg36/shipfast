# Edit & Re-publish (Versioning)

## Overview

Allow page publishers to update an already-published page without changing its URL. The platform stores up to 5 previous versions in S3, enabling rollback if a bad publish happens.

## Key Requirements

- Publisher can upload a new version of an existing page from the dashboard
- Live URL continues to serve the latest version immediately after re-publish
- Up to 5 prior versions are retained per page (oldest dropped when limit exceeded)
- Publisher can roll back to any retained version with one click
- Version list shows timestamp and optional label (e.g. "v3 — added pricing table")
- Re-publish should complete in under 3 seconds for typical page sizes

## User Stories

**Updating content:**
As a publisher, I want to fix a typo or swap out images on a live page without creating a new URL, so my audience doesn't need to be re-sent the link.

**Rolling back:**
As a publisher, I made a bad update and the page looks broken — I want to instantly revert to the previous version so the live URL is healthy again while I fix the issue.

**Version history:**
As a publisher, I want to see a timestamped list of my past versions so I know what changed and when.

## High-Level Architecture

```
Publisher uploads new HTML/assets
        │
        ▼
POST /api/pages/:id/versions
  1. Validate ownership
  2. Write new content to S3 at pages/{id}/v{n}/
  3. Atomically update pages/{id}/latest pointer
  4. Prune oldest version if count > 5
  5. Return { versionId, publishedAt }
        │
        ▼
CDN / serve layer reads pages/{id}/latest
  → always serves current version
        │
        ▼
Rollback: PATCH /api/pages/:id/versions/:versionId/activate
  → updates latest pointer to selected version
```

**Storage layout (S3):**
```
pages/{pageId}/
  latest          ← pointer file containing active version key
  v1/index.html + assets
  v2/index.html + assets
  ...
  v5/index.html + assets
```

**Version metadata** stored in DB (Postgres/SQLite):
- `page_id`, `version_number`, `s3_key`, `created_at`, `label`

No new infrastructure needed — builds on existing S3 and DB.
