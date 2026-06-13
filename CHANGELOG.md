# Changelog

All notable changes to Shipfast are documented in this file. Newest at the top.

**Format**: each release is an `##` heading shaped as `vVERSION — DATE — TITLE`.
A `Tag:` line (`feature`, `improvement`, `fix`, or `security`) classifies the
release, and `-` bullets list the user-facing changes. This file is parsed and
rendered at `/changelog` by `services/changelog.js`.

## v1.6.0 — 2026-06-13 — Page tags

Tag: feature

- Attach up to 3 PascalCase tags per page (e.g. `MachineLearning`, `LeetCode`).
- Tags can be set at publish time and edited later from the publish/edit dialog.
- Tags group pages: they appear in the rail next to "All pages", ordered by how many pages use them, with a count on each.
- Dashboard: tag chips on each card; click a tag (card or rail) to filter the page list (shareable `?tag=` URL).
- Published pages show crawlable tag chips linking back to the filtered dashboard.
- API: `tags` accepted on `POST /api/pages`, returned by `GET /api/pages`, filterable via `?tag=` (AND-ed); new `PATCH /api/pages/:slug/tags` and `GET /api/tags` (counts).
- Tag document counts are maintained in Postgres (new `tags` + `page_tags` tables, kept in sync by a trigger), split by access level so publisher-gated pages never count toward the public view; falls back to deriving counts when no database is configured.
- Invalid tags return a clear `400` naming the offending tag and the rule it broke.

## v1.5.0 — 2026-06-13 — Adding support for version history

Tag: feature

- Edit and re-publish any page; the live URL stays the same.
- Up to 5 prior versions kept per page; restore in one click (reversible).
- Optional labels on each re-publish.
- Version metadata in Postgres (new `page_versions` table); snapshots in S3.
- Dashboard: new History modal with Preview + Restore; in-UI restore confirmation.
- Icon refresh: dashboard wired to the `public/icons` sprite; action buttons are icon-only.
- Fix: access-only updates no longer create duplicate snapshots.


## v1.4.0 — 2026-06-10 — Mobile-friendly AI assistant

Tag: improvement

- Fixed the in-page AI assistant panel on small viewports.
- Improved drag handle behaviour on touch devices.

## v1.3.0 — 2026-06-04 — File uploads + dashboard redesign

Tag: feature

- Upload files directly when publishing a page — no more copy-paste only.
- Dashboard redesign: no more scrolling to find your pages, cleaner cards.

## v1.2.0 — 2026-05-20 — Bring your own LLM

Tag: feature

- In-page AI assistant powered by your own API key (Anthropic, OpenAI, Gemini).
- Added LiteLLM gateway support for self-hosted proxies.
- Keys are stored only in your browser — never sent to Shipfast servers.

## v1.1.0 — 2026-05-02 — Page view counter

Tag: feature

- Every published page now tracks views, shown on the dashboard.
- Iframe previews are excluded so dashboard thumbnails don't inflate numbers.

## v1.0.0 — 2026-04-15 — Initial release

Tag: feature

- Publish self-contained HTML pages to clean `/p/slug` URLs.
- Google sign-in, per-user page library, and instant sharing.
