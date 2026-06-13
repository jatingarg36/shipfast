<!--
Thanks for the PR! Please fill out each section below.
Read CONTRIBUTING.md if you haven't yet — especially the "Mandatory updates"
section covering CHANGELOG.md and skills/shipfast-dev/SKILL.md.
-->

## Summary

<!-- One or two sentences: what does this PR change? -->

## Motivation

<!-- Why is this change needed? Link the issue or feature spec.
     - Closes #
     - Spec: features/<file>.md
-->

## Type of change

<!-- Tick the one that applies. -->

- [ ] `feature` — new user-facing capability
- [ ] `improvement` — better UX or perf on existing capability
- [ ] `fix` — bug fix
- [ ] `security` — auth, key handling, or other security impact
- [ ] `refactor` — internal-only, no user-visible behaviour change
- [ ] `docs` — documentation only
- [ ] `chore` — deps, CI, tooling

## What changed

<!-- Bulleted list of the concrete changes in this PR.
     - Added X
     - Refactored Y to use Z
     - Fixed off-by-one in views.js
-->

## How to test

<!-- Step-by-step manual test instructions a reviewer can follow.
     1. `npm run services:up && npm run dev`
     2. Sign in as a publisher
     3. ...
-->

## Screenshots / recordings

<!-- Required for any UI change. Drag images/videos in below.
     Delete this section if there's no UI impact. -->

## Mandatory updates checklist

<!-- See CONTRIBUTING.md → "Mandatory updates" for the rules.
     If a box is N/A, tick it and add a one-line note explaining why. -->

- [ ] **`CHANGELOG.md`** — entry added under the current release with the
      right version bump (semver), date, title, tag, and user-facing bullets
      _— or_ N/A because: <!-- e.g. internal refactor with no behaviour change -->
- [ ] **`skills/shipfast-dev/SKILL.md`** — updated to reflect new feature,
      critical change, or business change introduced by this PR
      _— or_ N/A because: <!-- e.g. no architectural / product impact -->
- [ ] Deep-dive doc under `skills/shipfast-dev/references/` added or
      updated if the change has significant architectural impact
      _— or_ N/A

## Standard checklist

- [ ] Branch name follows convention (`feature/…`, `fix/…`, `chore/…`,
      `docs/…`, `refactor/…`)
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Tests added or updated (`tests/**/*.test.js`), or N/A and explained above
- [ ] `npm test` passes locally
- [ ] No new top-level dependency, or discussed in issue: #___
- [ ] No secrets or `.env*` files committed
- [ ] Layering respected: routes call services, services don't touch
      `req`/`res`, only `services/s3.js` imports the AWS SDK, only
      `services/chat-db.js` imports `pg`

## Security considerations

<!-- Required if this PR touches middleware/auth.js, routes/auth.js,
     session config in server.js, the assistant key flow, or anything
     with a security impact. Otherwise write "N/A".
     - Does this change the auth/access matrix?
     - Could it leak secrets, session data, or PII?
     - Are inputs validated and escaped at the right layer?
-->

## Reviewer notes

<!-- Anything the reviewer should know: tricky bits, follow-ups deferred
     to a later PR, areas you'd like a second opinion on. Optional. -->
