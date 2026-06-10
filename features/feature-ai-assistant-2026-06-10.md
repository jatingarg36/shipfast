# In-Page AI Assistant

## Overview

Logged-in users can enable an AI assistant on any published ShipFast page (`/p/:slug`). The user supplies their own LLM API key, which never leaves their browser — all model calls go directly browser → provider. The assistant renders as a right-side panel where the user can ask questions about the page, ask about selected text, resume past chats, or start fresh ones. Chat transcripts persist server-side per user per page; the key does not.

## Corrected / Clarified Requirements

| # | Original requirement | Resolution |
|---|---|---|
| 1 | Key stays on user system | ✅ Key stored in browser `sessionStorage` only; model calls go browser → provider directly. Server never receives the key. |
| 2 | Assistant on any page | ✅ Widget injected server-side into `/p/:slug` responses **for authenticated users only** (decided: logged-in users only). |
| 3 | EFS + SQL storage | ✅ **Revised (2026-06-10): S3 + RDS Postgres.** Chat transcripts as JSON snapshots in S3 (reusing `services/s3.js`); Postgres holds chat metadata + the snapshot's **S3 key** (not a presigned URL — those expire; the server signs/reads on demand). No EFS ⇒ no VPC runtime requirement ⇒ stays on Vercel. Local dev: Postgres container + existing S3/local fallback. |
| 4 | Revoke anytime, keep chats | ✅ Revoke = clear key from `sessionStorage` + disable widget flag. Server-side chats untouched. |
| 5 | Chats per page, per user | ✅ SQL rows scoped `(user_id, page_slug)`; every API route enforces ownership. |
| 6 | No cross-user visibility | ✅ All chat routes behind `requireAuth` + `user_id = current user` filter. EFS paths are namespaced by user id and never accepted from the client. |
| 7 | Any LLM provider | ✅ Provider adapter in the widget: Anthropic, OpenAI, Google Gemini, plus "OpenAI-compatible" custom base URL. Note: not every provider allows browser CORS; Anthropic, OpenAI, and Gemini do. |

## High-Level Architecture

```
Browser (page /p/:slug, logged-in user)
│
├─ Assistant widget (injected <script src="/assistant.js">)
│   ├─ Settings: enable toggle, provider select, API key → sessionStorage
│   ├─ Page context: extracted page text (capped ~8K chars) as system prompt
│   ├─ Text selection → "Ask AI" affordance → quoted into chat
│   ├─ Chat call: browser ──► LLM provider API (key never hits ShipFast)
│   └─ Persistence: POST messages ──► ShipFast chat API (no key in payload)
│
▼
ShipFast server (chat API, runs on Vercel as today)
├─ routes/assistant.js   (CRUD, requireAuth + ownership checks)
├─ services/chat-db.js   (chat metadata + snapshot S3 key)   ──► RDS Postgres
└─ services/chat-store.js (snapshot read/write via s3.js)    ──► S3
                                                                 chats/{userId}/{slug}/{chatId}.json
```

## Data Model (SQL)

```sql
CREATE TABLE assistant_chats (
  id              UUID PRIMARY KEY,
  user_id         TEXT NOT NULL,
  page_slug       TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT 'New chat',  -- first user message, truncated
  message_count   INT  NOT NULL DEFAULT 0,
  snapshot_s3_key TEXT NOT NULL,                      -- server-generated; signed on demand, never stored signed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chats_user_page ON assistant_chats (user_id, page_slug, updated_at DESC);
```

Snapshot JSON in S3: `{ chatId, messages: [{role, content, ts, selection?}] }`. Append = read snapshot, merge, put (single-writer per chat per user, so last-write-wins is fine). No API key, ever, in either store.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/assistant/chats?slug=` | List my chats for a page (id, title, updated_at) |
| POST | `/api/assistant/chats` | Create chat `{slug}` → `{chatId}` |
| GET | `/api/assistant/chats/:id` | Full transcript (ownership-checked) |
| POST | `/api/assistant/chats/:id/messages` | Append `[{role, content, selection?}]` |
| DELETE | `/api/assistant/chats/:id` | Delete a chat (optional, v1 nice-to-have) |

All behind `authMiddleware.requireAuth`; `:id` lookups always include `AND user_id = $me`. Payload limits (~64KB/message batch) and basic rate limiting.

## Client Widget Behavior

- **Disabled state:** small "AI" pill bottom-right (next to the existing badge). Click → prompt to enable via the Settings page (or inline quick-enable sheet as a shortcut to the same storage).
- **Enabled state:** right-side slide-in panel (~380px, collapsible). Header: chat title dropdown (history list), "New chat" button, settings/revoke.
- **General Q&A:** page text content sent as system context with each call.
- **Selection Q&A:** `selectionchange` listener shows a floating "Ask AI" button; selected text quoted at the top of the message.
- **Streaming:** provider responses streamed into the panel; on completion, the user+assistant message pair is POSTed to the persistence API.
- **Revoke:** clears `sessionStorage` key + enabled flag; panel returns to disabled state; history remains and reappears on re-enable.
- **Key scope:** `sessionStorage` = per-tab, gone on tab close (matches "stays within the session"). Re-entering the key in a new session is expected behavior.

## Context Management (LLM requests)

LLM APIs are stateless and the browser calls the provider directly, so all context assembly happens in the widget. Each request is built as:

1. **System prompt** — extracted page text: `document.body.innerText` with scripts/styles/nav stripped, capped at ~8K chars (truncate with a `[page content truncated]` marker). Computed once per page load, sent with every call. Prefixed with brief instructions ("You are an assistant helping the user understand this page…").
2. **Message history** — prior turns replayed from the chat snapshot. Resuming an old chat = load snapshot via the chat API, replay those messages to the provider. This is what gives the assistant memory across a conversation and across sessions.
3. **Current turn** — the user's question; if text was selected, the selection is prepended as a quoted block (`Regarding this excerpt: "…"`), and also stored in the message's `selection` field in the snapshot.

**Window management (v1 — sliding window with token budget):**

- Budget ≈ 20K chars of history (~5K tokens) on top of the page context. Estimate tokens as `chars / 4`; no tokenizer dependency.
- If history exceeds budget: keep the **first user/assistant exchange** (anchors the topic) + the **most recent turns** that fit; drop the middle and insert one marker message ("[earlier conversation omitted]").
- Trimming affects only what is sent to the provider — the snapshot in S3 always holds the full conversation.

**Explicitly out of scope for v1:** client-side summarization of dropped turns (revisit if long chats become common), RAG/chunked retrieval over page content (pages are small; the 8K cap suffices), and a per-chat "include page context" toggle (cheap later add for token-cost-sensitive users).

## Settings Page & Profile Menu

**Profile menu (dashboard header):** replace the inline avatar + Logout button with a profile button (avatar/initial). Clicking it opens a dropdown with: user name/email (read-only), **Settings**, **Logout** (moved here from the header).

**Settings page (`GET /settings`, `requireAuth`):** server-rendered shell (new `templates/settings.js`); the AI Assistant section is client-side since the key never reaches the server:

- Enable/disable AI assistant toggle
- Provider select (Anthropic / OpenAI / Gemini / OpenAI-compatible + base URL)
- API key input (masked) with "Test key" button (browser → provider ping)
- **Revoke access** button — clears key + disables assistant; note shown that chats are kept
- All values stored in browser storage only; the page makes no server calls for key data

Storage note: the key is saved in `sessionStorage` under a namespaced key, so enabling from Settings carries into `/p/:slug` visits in the same tab session. New tab/session ⇒ re-enter key (consistent with "key stays within the session").

## Files to Add / Change

| File | Change |
|---|---|
| `migrations/001-assistant-chats.sql` | New — schema above |
| `services/chat-db.js` | New — Postgres pool + chat metadata queries (`pg` dependency) |
| `services/chat-store.js` | New — snapshot read/append in S3 via existing `services/s3.js` |
| `routes/assistant.js` | New — API routes above |
| `public/assistant.js` (or template) | New — the widget (vanilla JS, self-contained, no build step) |
| `routes/pages.js` | Inject `<script src="/assistant.js" data-slug=...>` for authenticated viewers, alongside the badge |
| `templates/settings.js` | New — Settings page (AI assistant section: enable, provider, key, revoke) |
| `routes/auth.js` or new route | `GET /settings` (requireAuth) serving the settings page |
| `templates/dashboard.js` | Replace inline Logout with profile dropdown (name/email, Settings, Logout) |
| `server.js` | Mount assistant routes; serve widget script |
| `config.js` | `DATABASE_URL` (+ validation, feature-flag off if unset) |
| `docker-compose.yml` | Add Postgres service for local dev |
| `tests/assistant.test.js` | Route auth/ownership tests, chat-store round-trip |

## Security Notes

- API key: never transmitted to or stored on ShipFast; widget strips it from any persisted payload by construction.
- Published pages are arbitrary user HTML → widget runs in the page's JS context. Page scripts could theoretically read `sessionStorage`. **Mitigation:** render the chat panel inside a sandboxed iframe served from ShipFast; key and chat live only in the iframe, page communicates context via `postMessage`. (Recommended for v1 — cheap and closes the main hole.)
- S3 keys server-generated from `(userId, slug, chatId)`; slug sanitized; no client-supplied keys or URLs; presigning (if used) happens per-request, never persisted.
- Cross-user: enforced in SQL on every query; no listing endpoints without user scope.

## Deployment

No change to hosting — everything stays on Vercel. New requirements: `DATABASE_URL` env var (RDS Postgres, publicly reachable or via RDS Proxy/connection pooler — serverless functions need pooling, plan for `pg` + RDS Proxy or PgBouncer) and the existing S3 bucket. Local dev: dockerized Postgres + existing S3 config.

## Out of Scope (v1)

Anonymous-visitor chats, cross-page chat search, server-side LLM proxying, chat sharing/export, encrypted-at-rest key storage (no key storage at all).

## Decisions (resolved 2026-06-10)

1. **Sandboxed-iframe panel** — chat UI runs in a sandboxed iframe; key handed in via `postMessage`, never exposed to page-authored scripts directly. Residual risk: same-origin `sessionStorage` is technically readable by page scripts; long-term fix is serving `/p/*` from a separate user-content subdomain (out of scope for v1, noted as follow-up).
2. **RDS Postgres** — auth/connection string to be provided as `DATABASE_URL`.
   **Storage revised:** EFS dropped in favor of S3 snapshots + Postgres metadata. Postgres stores the snapshot's S3 key only; URLs are signed on demand (stored signed URLs would expire). Keeps the app fully on Vercel.
3. **No dashboard chat view** — chats surface only on the page itself.
4. **Settings page added** — reached via new profile dropdown in the dashboard header; Logout moves into that dropdown.
