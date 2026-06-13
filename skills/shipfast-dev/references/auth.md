# Auth and Access — Full Reference

ShipFast has two auth surfaces (password and Google OAuth) and two page access levels (public and publisher). The combinations form a small matrix you should keep in your head while touching any code that touches `req.user` or page metadata.

## Identities

A "user" in this system is whatever ends up on `req.user` after `passport.deserializeUser`. There are exactly two shapes:

**Admin** — created by password login at `POST /api/login`. Hardcoded:

```js
{ id: "admin", displayName: "Admin", role: "admin" }
```

There is no admin database; the admin object is reconstructed from the session every request. Changing the admin password means changing `PUBLISHER_PASSWORD` in env. Don't `upsertUser()` the admin into the `users` table — it's not meant to be a normal user record.

**Publisher** — created on Google OAuth callback. Persisted in the Postgres `users` table (see `migrations/003-users.sql`) via `userService.upsertUser`:

```js
{
  id: "google-" + profile.id,
  displayName: profile.displayName,
  email: ...,
  avatar: ...,
  role: "publisher",
  createdAt: ...,
  lastLogin: ...,
}
```

The `google-` prefix on the id is load-bearing — `meta.json` stores it as the page owner, and that prefix is how the system knows "this owner is a Google user, look them up in the `users` table for the display name".

> Historical note: prior to migration 003 these rows lived in a single `users.json` blob in S3. `scripts/backfill-users-from-s3.js` copies that blob into Postgres for any deployment that pre-dates the cutover.

If you ever add a third provider (GitHub, etc.), use a similar prefix scheme (`github-{id}`) and route through `upsertUser`. Default `role: "publisher"` — only the password flow creates admins.

## Access levels

Each page in `meta.json` has an `access` field:

- `"public"` — anyone can `GET /p/:slug` without logging in.
- `"publisher"` — must be authenticated (any role). Unauthenticated viewers get redirected to `/login?next=…`.

Pages default to `"publisher"` if `meta.json` doesn't say otherwise. There's also a legacy shape where `meta[slug]` is a bare string (the access level); `pageService.getPageMeta` normalizes that to `{ access, owner: "admin" }`.

Two things to note:

1. There's no third level (no "unlisted" or "password-protected per page"). The fork/expiry/shared-publish feature specs in `features/` may add these — read those specs before adding new levels.
2. "Publisher" means "any logged-in user can read", not "the page owner". Ownership is separate (see below).

## The matrix

| Viewer        | `public` page          | `publisher` page                    | Manage (`PATCH`/`DELETE`)        |
| ------------- | ---------------------- | ----------------------------------- | -------------------------------- |
| Anonymous     | Can view               | Redirected to `/login`              | 401                              |
| Publisher (not owner) | Can view       | Can view                            | 403 ("only your own pages")      |
| Publisher (owner) | Can view           | Can view                            | Allowed                          |
| Admin         | Can view               | Can view                            | Allowed (any page)               |

`GET /api/pages` (the dashboard listing) filters by these same rules:

- Anonymous → only `public` pages.
- Publisher → own pages (any access) + all `public` pages.
- Admin → all pages.

## The helpers — semantics in detail

All five live in `middleware/auth.js`. Use them; don't reimplement.

### `getCurrentUser(req)` → `User | null`

Returns `req.user` if `req.isAuthenticated()`, else `null`. Cheap, sync, safe to call multiple times in a handler. Use it whenever you need to *read* the current user without enforcing anything.

### `isAdmin(req)` → `boolean`

Sugar for `getCurrentUser(req)?.role === "admin"`. Use sparingly — most "is admin?" branches are better expressed as `canManagePage` (which already short-circuits true for admins) or a `requirePageOwner` middleware.

### `canManagePage(req, slug)` → `Promise<boolean>`

Returns true if the current user is admin OR owns the page. Reads `meta.json` via `pageService.getPageMeta`, so it does I/O — don't call it in tight loops, and don't call it inside another `canManagePage` call. If you find yourself wanting to check ownership for multiple pages, load `meta.json` once via `pageService.readMeta()` and check `owner` directly.

### `requireAuth(req, res, next)` — Express middleware

If logged in → `next()`. If not:
- Request path starts with `/api/` → `401 { error: "Unauthorized" }`.
- Otherwise → `redirect("/login?next=" + encodeURIComponent(req.originalUrl))`.

**The sub-router gotcha**: this branch uses `req.path`, which inside a sub-router (`router.use("/api/assistant", api)`) is the *relative* path, not the full one. So a request to `/api/assistant/chats` has `req.path === "/chats"` inside the sub-router, which doesn't start with `/api/`, which means `requireAuth` would redirect instead of returning JSON. That's why `routes/assistant.js` has an inline 401 middleware instead of using `requireAuth`. If you add a sub-router under `/api/`, copy that pattern.

### `requirePageOwner(req, res, next)` — Express middleware

Combines auth + ownership. Expects `req.params.slug`. Unauthenticated → 401 (API) or redirect (HTML). Authenticated but not owner/admin → `403 { error: "You can only manage your own pages" }`. Otherwise → `next()`. Use this for `PATCH /api/pages/:slug/access`, `DELETE /api/pages/:slug`, and any future ownership-gated endpoint.

## Session storage

Sessions live in Redis via `connect-redis`. Cookie config (in `server.js`):

- `httpOnly: true` (no JS access)
- `secure: config.IS_PRODUCTION` (HTTPS-only in prod)
- `sameSite: "lax"` (CSRF protection but allows OAuth redirects)
- `maxAge: 7 days`

`SESSION_SECRET` must be stable across deployments or sessions invalidate on every push. The README calls this out — believe it.

The `next` URL pattern: when an unauthenticated user hits a protected route, we redirect to `/login?next=<original>`. Login handlers must read `req.body.next` (password flow) or `req.session.returnTo` (OAuth flow, which sets it on `/auth/google`) and redirect there on success. If you add a new auth flow, plumb the `next` parameter through or you'll break deep linking.
