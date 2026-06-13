# Page Tags (max 3, PascalCase)

## Overview

Let publishers attach up to **3 tags** per page in **PascalCase** format (e.g. `Productivity`, `MachineLearning`, `LeetCode`). Tags are stored as page metadata, surfaced on the page, and exposed through the API so they can drive search, filtering on the dashboard, and (later) the vector index for semantic discovery.

This is a quick-win feature: small data shape change, lightweight UI, no new infrastructure.

## Key Requirements

- A page can have **0–3 tags**; the cap is enforced server-side, not just in the UI.
- Tag format must be **PascalCase**: starts with an uppercase letter, contains only letters and digits, no spaces, hyphens, or underscores. Regex: `^[A-Z][A-Za-z0-9]{0,29}$` (1–30 chars).
- Tags are **case-sensitive** for storage (`MachineLearning` ≠ `machinelearning`), but matched case-insensitively for filtering/search.
- Tags are **deduplicated** within a single page (no `["Productivity", "Productivity"]`).
- Tags can be **set at publish time** and **edited later** without re-uploading the page.
- Tags are **visible** on the rendered page (small chips, e.g. footer or header).
- Tags are **listed** on the dashboard next to each page; clicking a tag filters to pages with that tag.
- Tag list is **returned** by the page metadata API so future features (vector embed, recommendations) can consume it.
- Invalid input returns a clear `400` with the offending tag and the rule it broke.

## Non-Goals

- Tag autocomplete / suggestions (future).
- Tag rename or merge across pages (future, once we have a tag index).
- Public tag-browse pages (`/tags/MachineLearning`) — deferred until the slug-metadata DB migration lands.
- Locking format to a fixed taxonomy.

## User Stories

**As a publisher**, I want to add up to 3 tags when I publish a page so my work is organized by topic, not just by slug.

**As a publisher**, I want to edit tags on a page I already published without re-uploading the file, so I can fix typos or re-categorize.

**As a publisher**, I want the platform to reject `machine-learning` or `Machine Learning` and tell me to use `MachineLearning`, so my tags stay consistent.

**As a visitor / dashboard user**, I want to click a tag on a page card and see every other page with the same tag, so I can discover related content.

**As a future system (vector index, AI editor)**, I want tags exposed in the page metadata API so I can use them as retrieval signals.

## Data Model

Tags live in the existing page metadata in S3 (`pages/meta.json`), keyed by slug. A `tags` array is added per entry.

```json
{
  "sliding-window-master-guide": {
    "access": "public",
    "owner": "admin",
    "createdAt": "2026-05-13T20:31:38.852Z",
    "tags": ["LeetCode", "Algorithms", "Interview"]
  }
}
```

**Backward compatibility:** missing `tags` is treated as `[]`. Existing pages don't need migration.

**Forward compatibility:** when the slug-metadata DB migration lands (separate feature), `tags` becomes a `TEXT[]` column on `pages`, indexed with a GIN index for fast tag filtering. No data shape change.

## Validation Rules

Implemented in a single helper, `validateTags(input): { ok, tags?, error? }`, called by every write path.

1. `input` must be an array. (Strings, objects → `400`.)
2. `input.length <= 3`.
3. Each entry is a string matching `^[A-Z][A-Za-z0-9]{0,29}$`.
4. After trimming whitespace, deduplicate case-sensitively. If the input had duplicates after dedup, return them as a warning (still accept the deduped list) — or reject; **decision: reject** to keep behavior predictable.
5. Reject reserved tags: `Admin`, `System`, `Internal` (case-insensitive match) — prevents UI confusion with system labels.

Error payload shape:

```json
{
  "error": "INVALID_TAG",
  "tag": "machine-learning",
  "reason": "Tags must be PascalCase: start with an uppercase letter and contain only letters and digits."
}
```

## API Changes

All changes are additive — no breaking change to existing clients.

### `POST /api/pages/:slug` (publish)

Accepts an optional `tags` field in the JSON body alongside `title`, `description`, etc.

```http
POST /api/pages/sliding-window-master-guide
Content-Type: application/json

{
  "access": "public",
  "tags": ["LeetCode", "Algorithms", "Interview"]
}
```

### `PATCH /api/pages/:slug/tags` (new — edit tags only)

Replaces the page's tag list. Idempotent. Requires the publisher to own the page (uses existing ownership middleware).

```http
PATCH /api/pages/sliding-window-master-guide/tags
Content-Type: application/json

{ "tags": ["LeetCode", "Interview"] }
```

Returns `200 { slug, tags }`.

### `GET /api/pages` (list)

Each entry in the response gains a `tags: string[]` field.

### `GET /api/pages?tag=LeetCode` (filter)

New optional query param. Returns only pages whose tag list contains the value (case-insensitive match). Multiple `tag` params are AND-ed: `?tag=LeetCode&tag=Algorithms`.

## Service Layer Changes

`services/page.js`:

- `listPages()` — include `tags: pm.tags || []` in each returned record.
- `setPageMeta(slug, updates)` — already does shallow merge; passing `{ tags: [...] }` works as-is.
- New `setPageTags(slug, tags)` — thin wrapper that runs `validateTags` first, then calls `setPageMeta`.
- New `filterPagesByTags(pages, tags)` — case-insensitive AND filter, called from the route layer.

A new `services/tags.js` module holds `validateTags` and the reserved-tag list so both publish and patch paths share it. Keeping it separate from `page.js` makes it easy to swap in a richer policy later (e.g. per-tenant tag rules).

## UI Changes

**Publish dialog (existing publish flow):**

- New "Tags" field: a chip-input that accepts up to 3 entries.
- Live PascalCase validation as the user types; invalid entries get a red outline + tooltip with the rule.
- "Add tag" button disabled once 3 chips are present.

**Dashboard page list:**

- Each row gets a small row of tag chips after the title.
- Chips are clickable → adds `?tag=<value>` to the dashboard URL and re-filters.
- A "Clear tag filter" pill appears when a tag filter is active.

**Rendered page (template):**

- Tags rendered as small chips in the page footer, below the view counter (when present).
- Plain `<a>` links to `/?tag=<value>` so they're crawlable.

## High-Level Architecture

```
Publisher (dashboard)
        │
        ▼
PATCH /api/pages/:slug/tags  { tags: ["LeetCode", "Algorithms"] }
        │
        ▼
routes/pages.js
  1. Auth + ownership check (existing middleware)
  2. validateTags(req.body.tags)   ─── reject on bad format / >3 / reserved
  3. pageService.setPageTags(slug, tags)
        │
        ▼
services/page.js → setPageMeta(slug, { tags })
        │
        ▼
S3: pages/meta.json   (single source of truth today;
                       moves to DB in slug-metadata-db feature)
        │
        ▼
GET /api/pages[?tag=…]  serves the updated list
        │
        ▼
Dashboard renders chips · Page template renders chips
```

## Edge Cases

- **Empty array** clears tags — valid.
- **Whitespace-only tag** → trim, then validate; a trim that yields empty string is rejected.
- **Unicode letters** (e.g. `Café`) — explicitly rejected; rule allows ASCII `[A-Za-z0-9]` only. This keeps tag URLs and DB indexes simple. Revisit when we have non-English users.
- **Tag-only PATCH on a non-existent slug** → `404`, not silent create.
- **Concurrent edits** to the same page's tags — last-writer-wins is acceptable; the slug-metadata-db migration will add proper transactional writes.
- **Reserved tag** attempted (`Admin`) → `400` with `reason: "Tag is reserved."`.

## Rollout

1. Ship `validateTags` + service changes behind no flag (pure additive).
2. Ship API changes (`PATCH /api/pages/:slug/tags`, `?tag=` filter).
3. Ship dashboard chip-input + rendered-page chips together.
4. Backfill: none required. Existing pages start with `tags: []` implicitly.
5. Announce in the next changelog entry.

## Estimated Effort

**Quick win — ~2 days.** Validation helper + service tweaks: half a day. Routes + tests: half a day. Dashboard and template UI: one day.

## Open Questions

- Should we **normalize** common mistakes (e.g. accept `machine-learning` and silently convert to `MachineLearning`)? Default is **no** — strict rejection keeps the format honest. Revisit if rejection rate is high.
- Do tags participate in the **view counter** (e.g. aggregate views per tag)? Out of scope for this feature; comes for free once tags + views both live in the DB.
