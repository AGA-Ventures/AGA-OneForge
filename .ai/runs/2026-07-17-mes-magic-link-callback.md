# Bugfix run: MES magic-link callback stalls

- Date: 2026-07-17
- Mode: fully-autonomous
- Request: fix it
- Phase plan: root-cause [run] · instrument [skip — live logs prove callback POST is absent] · fix [run] · test [pass] · deploy [pass] · commit [skip — not requested]

## Decisions

- Root-cause: the callback receives a GET but never posts a Supabase refresh token, leaving its loading-only UI permanent.

## Phase log

- root-cause: MEDIUM — Railway logs show repeated `GET /callback` without a callback action POST.
- instrument: skipped — the live request evidence isolates the missing client submit, and the fix adds an explicit session read instead of relying solely on an auth-state event.
- fix: added an explicit `getSession()` fallback and only lock the callback after a complete refresh token and user ID are available.
- test: `pnpm --filter mes exec vitest run 'app/routes/_public+/callback-session.test.ts'` — 2 passed.
- test: `pnpm exec turbo run typecheck --filter=mes` — passed.
- test: `git diff --check` — passed.
- deploy: MES UAT deployment `9a36b575-742d-4f53-84e9-70f37186a4ad` — SUCCESS.

## Outcome

- The deployed callback now obtains the Supabase session explicitly and submits it to the existing session action. A fresh magic link is required for end-to-end confirmation because magic links are single-use.
