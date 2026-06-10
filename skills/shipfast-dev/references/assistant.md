# AI Assistant — Threat Model and Invariants

The AI assistant is the floating chat pill that appears on published pages for authenticated users. It lets the viewer talk to an LLM with the page content as context. The defining design decision is that **the user's LLM API key never reaches the ShipFast server**. Every other architectural choice in this feature flows from that.

Read this file before touching `routes/assistant.js`, `services/chat-db.js`, `services/chat-store.js`, or `templates/assistant/`.

## Why the key never reaches the server

Three reasons:

1. **Less liability.** If the server doesn't store keys, it can't leak them. The ShipFast server is a serverless function on Vercel; we don't want to be a key vault.
2. **Per-user provider choice.** Users bring their own Anthropic/OpenAI/Gemini key. Storing keys server-side would force us to either pick one provider or build a provider registry.
3. **Smaller attack surface.** Compromising ShipFast yields no usable API keys.

The trade-off: the browser makes the LLM call directly. CORS works because the major providers allow direct browser calls when the API key is provided in the right header. Rate limiting and key rotation become the user's problem, which is a feature (it's their key, their bill).

## The flow

```
[Page in browser]
    └─ /assistant.js loader (public, no secrets)
         └─ creates floating pill + injects iframe pointing at /assistant/panel?slug=…
              │
              └─ [Iframe — same-origin, auth required]
                   ├─ panel/script.js: chat UI, reads API key from localStorage
                   ├─ Browser → LLM provider directly (key in headers, never to ShipFast)
                   └─ Browser → ShipFast /api/assistant/chats* to persist transcripts
```

The server is in the loop for persistence and auth, never for LLM calls.

## Server-side invariants (the rules that keep this safe)

These are not negotiable. If a change appears to require relaxing one of these, that's a sign the design needs adjustment, not the invariant.

### 1. No API key ever touches the server.

Search `routes/assistant.js`, `services/chat-db.js`, `services/chat-store.js`, and the assistant template files. There is no code that reads, accepts, or stores an API key. If you add a route or service that takes one, you've regressed the threat model.

The settings page (`routes/settings.js`) only renders a shell. The actual key input lives in the panel's client-side JS and persists to `localStorage`. The server is never told what the key is, never even told whether the user has one.

### 2. Every query is scoped by `user_id`.

Look at every function in `services/chat-db.js`. They all take a `userId` parameter and include `WHERE user_id = $1` in their SQL. This is how cross-user access is prevented by construction.

If you add a function, follow the pattern. Don't add "admin override" branches that let one user read another user's chats. Admins should not be able to do this either — chat content is more sensitive than page content.

### 3. S3 keys are server-built from authenticated identity.

In `routes/assistant.js`'s `POST /chats` handler:

```js
const user = authMiddleware.getCurrentUser(req);
const id = crypto.randomUUID();
const s3Key = chatStore.keyFor(user.id, slug, id);
```

The key is `chats/{user.id}/{slug}/{chatId}.json` — built from `req.user.id`, not from anything in the request body. The client never supplies a key, path, or URL. If a route ever accepts an `s3Key` or `path` from the body, that's the security regression to catch in code review.

`chatStore.sanitizeSegment` replaces `..` and other path characters defensively, but the real defense is "we never use client input for the key".

### 4. The loader script is public; everything else requires auth.

`/assistant.js` is publicly cacheable (`Cache-Control: private, max-age=300`). It contains no secrets — it's just JavaScript that boots the iframe.

`/assistant/panel` requires auth (uses `requireAuth`). The chat API uses an inline 401 middleware (see #5) because `requireAuth` doesn't work correctly inside a sub-router.

### 5. The sub-router 401 quirk.

`routes/assistant.js` mounts a sub-router at `/api/assistant`:

```js
router.use("/api/assistant", api);
```

Inside that sub-router, `req.path` is relative — a request to `/api/assistant/chats` has `req.path === "/chats"` from the sub-router's perspective. `requireAuth` checks `req.path.startsWith("/api/")` to decide between JSON 401 and redirect to `/login`. Inside the sub-router, that check fails, so unauthenticated API calls would get redirected to `/login` as if they were HTML requests.

The fix in `routes/assistant.js` is an inline middleware:

```js
api.use((req, res, next) => {
  if (!authMiddleware.getCurrentUser(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

If you add another sub-router under `/api/`, use this same pattern.

### 6. Transcripts are bounded.

`services/chat-store.js` enforces:

- `MAX_MESSAGES_PER_APPEND = 20` — a single POST can't append more than 20 messages.
- `MAX_APPEND_BYTES = 64 * 1024` — total bytes per append batch.
- `MAX_SNAPSHOT_MESSAGES = 500` — the snapshot is truncated to the last 500 messages on every append.

These exist to bound S3 object size and prevent abuse. If you raise them, raise them deliberately — runaway transcripts mean S3 storage cost grows linearly with chat depth.

### 7. Append is read-modify-write.

`appendMessages` reads the existing snapshot, concats new messages, writes back. There's no atomicity beyond "single writer per chat per user, last-write-wins is acceptable" — which is true *because* a single user can only have one tab actively writing to a chat at a time. If multi-device sync becomes a feature, this assumption breaks and you'll need version tokens or move to Postgres for the transcript itself.

## What the client actually does

The panel's client-side script (`templates/assistant/panel/script.js`) is the thing to read if you're wondering "where does the key live, when does it call the provider, when does it call us". The short story:

- API key in `localStorage`, never sent to ShipFast.
- New chat → POST `/api/assistant/chats { slug }` to get a `chatId`.
- User sends a message → POST `/api/assistant/chats/{id}/messages` to persist, *then* call the LLM provider directly from the browser, *then* POST the assistant's reply back to persist it.
- Listing past chats → GET `/api/assistant/chats?slug=...`.
- Loading a past chat → GET `/api/assistant/chats/{id}` (returns the full transcript from S3).
- Delete → DELETE `/api/assistant/chats/{id}` (deletes the row and the S3 snapshot).

## Common ways to break this

- Adding a server-side proxy for the LLM call (would need to handle the key → breaks invariant 1).
- Adding "admin can read all chats" (breaks invariant 2).
- Accepting an S3 key or path from a request body (breaks invariant 3).
- Storing the user's API key in a session, cookie, or database (breaks invariant 1).
- Caching responses from the LLM in Redis (would need server-side access to the conversation → still doable in principle, but think hard about what gets cached and who can read it).

If a feature request seems to require any of the above, push back and look for a client-side alternative first.
