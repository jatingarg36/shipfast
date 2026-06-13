# Contributing to ShipFast

Thanks for taking the time to contribute. ShipFast is a small, layered Express
app — keeping it small and layered is the main thing we're optimizing for. This
guide is short on ceremony and long on rules-that-actually-matter.

## Table of contents

- [Before you start](#before-you-start)
- [Local setup](#local-setup)
- [Project layout](#project-layout)
- [Branching and commits](#branching-and-commits)
- [Pull request process](#pull-request-process)
- [Code style](#code-style)
- [Testing](#testing)
- [**Mandatory updates** — CHANGELOG and SKILL](#mandatory-updates)
- [Security](#security)
- [Reporting bugs](#reporting-bugs)

---

## Before you start

- For non-trivial work, open an issue first describing the change and the
  motivation. Small fixes (typos, one-line bugs) can skip straight to a PR.
- For new features, drop a short spec in `features/` before writing code.
  That folder is the canonical home for in-flight feature design.
- Be kind in reviews and issues. Critique the code, not the contributor.

## Local setup

Requirements: Node 18+ and Docker (for Redis / Postgres / S3-compatible
storage).

```bash
git clone <your-fork>
cd ShipFast
npm install
cp .env.example .env.local        # fill in secrets
npm run services:up               # starts Redis + Postgres in Docker
npm run dev                       # server on :3000
```

`config.js` is the single source of truth for environment variables. If you
add a new env var, declare it there with a sensible default and document it
in `.env.example`.

## Project layout

ShipFast follows a strict layering:

```
config → services → middleware → routes → templates
```

Read `skills/shipfast-dev/SKILL.md` before touching anything substantial — it
explains the layering, the storage split (S3 / Redis / Postgres), the auth
matrix, and the content pipeline. Treat it as the architectural source of
truth.

The big rules:

- **Routes are thin glue.** Business logic lives in `services/`. If a route
  handler is doing more than parameter parsing, calling a service, and
  shaping a response, push the logic down a layer.
- **Services don't touch Express.** No `req`, no `res`, no middleware
  imports. They take plain arguments and return plain values or throw.
- **Templates are pure functions.** Take user/data, return an HTML string.
  No I/O, no DB calls.
- **Storage drivers are isolated.** Only `services/s3.js` imports the AWS
  SDK; only `services/chat-db.js` imports `pg`. Don't sprinkle SDK calls
  across the codebase.

If you find yourself fighting these rules, that's a signal the design is
off — talk to a reviewer before working around them.

## Branching and commits

- Branch off `main` using a descriptive prefix:
  `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`,
  `refactor/<slug>`.
- Keep branches focused. One PR, one concern.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for
  commit messages. Examples:
  - `feat(changelog): wire renderer to CHANGELOG.md`
  - `fix(pages): treat /raw of missing slug as 404, not 500`
  - `refactor(services): extract view-counter into its own module`
  - `docs(contributing): document the SKILL.md update rule`
  - `chore(deps): bump express to 4.19.2`
- Rebase rather than merge when syncing with `main`; we keep history linear.

## Pull request process

1. Fork the repo and push your branch.
2. Open a PR against `main` with a clear title and a description that covers
   **what changed**, **why**, and **how to test it**. Link the issue or
   feature spec when one exists.
3. Make sure CI is green and `npm test` passes locally.
4. **Update `CHANGELOG.md` and (when required) `skills/shipfast-dev/SKILL.md`** —
   see [Mandatory updates](#mandatory-updates) below. PRs that don't update
   these when they should will be sent back.
5. Request review from a maintainer. Address feedback in additional commits;
   we squash on merge so the PR title becomes the final commit message.
6. A maintainer merges once the PR has at least one approval, green CI, and
   the mandatory-update checklist is satisfied.

## Code style

- Two-space indentation. No tabs.
- Semicolons on. Double quotes for strings (match what's already in the file).
- Prefer small functions with clear names over clever one-liners.
- Keep templates' inline CSS/JS readable — this is a small project and the
  inline-everything trade-off is intentional. Add comments where the
  reasoning isn't obvious.
- No new top-level dependencies without discussion; we prefer fewer, well-
  understood packages over many small ones.
- ESLint/Prettier configs are intentionally minimal — when in doubt, match
  the surrounding file.

## Testing

- Test runner: built-in `node --test`. Run `npm test`.
- New services should ship with unit tests. Use `tests/views.test.js` as the
  shape to follow — pure-function services are trivial to test; if your
  service is hard to test, that's a design smell.
- Route handlers don't need their own tests if the service underneath is
  well-covered, but at minimum smoke-test new endpoints by hand and document
  the steps in the PR description.
- Don't mock S3, Redis, or Postgres in integration tests — use the local
  Docker services from `npm run services:up`. Mocks here have historically
  hidden real bugs.

## Mandatory updates

Two files **must** be updated alongside your code for any PR that touches
user-facing behaviour, architecture, or the data model. PRs missing these
updates will be sent back for revision.

### 1. `CHANGELOG.md` — every change

Every PR that ships a user-visible change adds an entry to the top of
`CHANGELOG.md`. The file is parsed by `services/changelog.js` and rendered
live at `/changelog`, so the format matters.

Format (em-dash or ` - ` works as a separator):

```markdown
## vMAJOR.MINOR.PATCH — YYYY-MM-DD — Short, human-readable title

Tag: feature | improvement | fix | security

- One bullet per user-visible change.
- Write for the reader of the changelog, not the reviewer of the PR.
```

Rules:

- **Bump the version** following [Semantic Versioning](https://semver.org/):
  - `MAJOR` for breaking API or storage-format changes.
  - `MINOR` for new features or notable improvements (backward compatible).
  - `PATCH` for bug fixes and small improvements.
- **One entry per release**, not per PR. If a release is still unreleased,
  add your bullets under that entry instead of creating a new one. Cut a
  new entry only when shipping.
- **Pick the right tag.** `feature` is new capability; `improvement` is
  better UX or perf on existing capability; `fix` is a bug; `security` is
  anything with a security impact (CVEs, auth changes, key handling).
- **No internal jargon.** "Refactored content service" is not a changelog
  entry. "Faster page publish on cold cache" is.
- Skip the changelog entry only for pure internals: refactors with no
  behaviour change, test additions, doc edits, CI tweaks, dependency
  bumps without user-visible effect. Note this in the PR description.

### 2. `skills/shipfast-dev/SKILL.md` — features, critical changes, business changes

The `SKILL.md` file is the architectural map of the codebase. It is the
first thing a new contributor (or an AI assistant) reads to orient
themselves. **You must update it whenever your change would invalidate or
extend what it currently says.** Specifically:

- **Introducing a new feature.** Anything that adds a capability — new
  endpoint, new content type, new auth provider, new background job, new
  page in the dashboard. Add or update the relevant section so the map
  reflects the new reality.
- **Critical changes.** Anything that changes how an existing piece works
  in a load-bearing way — auth/access rules, the content-detection
  pipeline, the storage split between S3/Redis/Postgres, the layering
  rules, error handling conventions. If a reader of the old SKILL.md
  would now be misled, update it.
- **Business changes.** Anything that changes the product's behaviour for
  users — billing, quotas, sharing semantics, default page access,
  visibility of view counts, etc. The SKILL.md captures product-level
  invariants (e.g. "the API key never reaches the server"); keep those
  invariants accurate.

When in doubt: update it. A small, accurate paragraph beats no update
and a stale map.

If a change has deep architectural implications, also add or update the
relevant deep-dive file under `skills/shipfast-dev/references/` and link
to it from `SKILL.md`.

### PR checklist

Copy this into your PR description and tick off the relevant boxes:

```markdown
- [ ] CHANGELOG.md updated (or N/A — internal-only change, explained above)
- [ ] skills/shipfast-dev/SKILL.md updated (or N/A — no architectural,
      product, or business impact)
- [ ] Tests added or updated
- [ ] Manual test steps documented above
- [ ] No new top-level dependency, or discussed in issue: #___
```

## Security

- Never commit secrets. `.env*` files (except `.env.example`) are in
  `.gitignore`; keep it that way.
- The AI assistant API key is **client-side only**. Don't add any code path
  that sends it to the server, even as a "convenience". This is a
  load-bearing invariant of the product.
- Auth changes (touching `middleware/auth.js`, `routes/auth.js`, or session
  configuration in `server.js`) require an additional reviewer and a
  `security` tag in the changelog.
- For vulnerability reports, **do not open a public issue**. Email the
  maintainer or use GitHub's private security advisory feature.

## Reporting bugs

Good bug reports include:

- What you were doing (steps to reproduce).
- What you expected to happen.
- What actually happened (error messages, stack traces, screenshots).
- Environment: Node version, browser, OS, whether you're running locally
  or hitting a deployed instance.

A minimal reproducible example is worth a thousand "doesn't work for me"s.

---

Thanks again for contributing. The whole point of keeping the codebase small
and the layering strict is that contributions like yours stay easy to ship.
