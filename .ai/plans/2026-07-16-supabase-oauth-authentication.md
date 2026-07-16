# Supabase OAuth-only authentication — implementation plan

**Spec:** `docs/supabase-oauth-authentication/spec.md`
**Tracking issue:** [AGA-Ventures/AGA-OneForge#16](https://github.com/AGA-Ventures/AGA-OneForge/issues/16)
**Branch:** `codex/issue-16-supabase-oauth-auth`

## Progress

- [x] Task 1: Add one shared OAuth callback authorization gate with focused tests
- [x] Task 2: Convert ERP login, callback, email-only routes, and invite acceptance to OAuth-only behavior
- [x] Task 3: Apply the shared OAuth-only login/callback behavior to MES, Academy, and Starter
- [x] Task 4: Set OAuth-only defaults and document provider/callback configuration
- [x] Task 5: Refresh Graphify and attempt browser verification (provider/browser smoke skipped because the shared local Supabase port was already in use)

## Dependencies

- Task 1 must land before Tasks 2 and 3 because every callback calls the shared authorization gate.
- Tasks 2 and 3 are independent after Task 1.
- Task 4 is independent of Tasks 2 and 3 but must be included before the final verification.
- Task 5 requires Tasks 1–4.

---

## Task 1: Add a shared OAuth callback authorization gate with focused tests

**Depends on:** none
**Files:**
- Create: `packages/auth/src/services/auth.server.test.ts` — mocked unit coverage for OAuth JWT-method and edition/access decisions
- Modify: `packages/auth/src/services/auth.server.ts` — export the callback authorization gate
- Copy from (precedent): `packages/auth/src/services/auth-redis-resilience.test.ts` — Vitest setup and module mocking style

**Steps:**
1. Add and export `validateOAuthCallback(authSession: AuthSession)`. It must return a discriminated result with `allowed: true` or `allowed: false` plus one of these stable reasons: `invalid_claims`, `non_oauth`, `user_missing`, `user_inactive`, `enterprise_unprovisioned`, or `authorization_check_failed`.
2. Verify `authSession.accessToken` with `getCarbon().auth.getClaims(authSession.accessToken)`. Reject when Supabase reports an error, the claims are absent, `claims.sub !== authSession.userId`, or `claims.amr` has no entry whose `method` is `"oauth"`. Do not decode an unverified JWT or trust a browser-posted provider value.
3. Use `getCarbonServiceRole()` only on the server to load the public `user` row by `authSession.userId`, requiring the row to exist, its email to equal `authSession.email` case-insensitively, and `active === true`.
4. For `CarbonEdition === Edition.Enterprise`, query `userToCompany` for at least one membership and `invite` for an unaccepted, unrevoked invite matching `authSession.email`. Reject only when both are absent. For Community, Cloud, and Test editions, allow the active OAuth user without a membership so the existing onboarding flow remains available.
5. Fail closed on database query errors. Do not return raw Supabase errors, access tokens, refresh tokens, or user metadata to callers or logs.
6. In `auth.server.test.ts`, mock `getCarbon().auth.getClaims()` and the service-role query chains. Cover valid OAuth claims, password/OTP/magic-link claims, missing/invalid claims, mismatched subject, inactive user, Enterprise user with membership, Enterprise user with pending invite, Enterprise unprovisioned user, and Community new user.

**Verify:**
```bash
pnpm --filter @carbon/auth test -- auth.server.test.ts && pnpm --filter @carbon/auth typecheck
# Expected: the focused Vitest file passes and the @carbon/auth typecheck exits 0.
```

**Out of scope:** `@supabase/ssr`, PKCE-cookie migration, session-cookie attributes, permission cache behavior, API-key authorization, database migrations, and new identity providers.

## Task 2: Convert ERP login, callback, email-only routes, and invite acceptance to OAuth-only behavior

**Depends on:** Task 1
**Files:**
- Create: `apps/erp/app/routes/_public+/oauth-only-auth.test.ts` — route-level coverage for disabled email and invite handoff
- Modify: `apps/erp/app/routes/_public+/login.tsx` — gate email action/form through `isAuthProviderEnabled("email")`
- Modify: `apps/erp/app/routes/_public+/callback.tsx` — call `validateOAuthCallback()` before company lookup or `setAuthSession()`
- Modify: `apps/erp/app/routes/_public+/verify.tsx` — reject loader/action access while email is disabled
- Modify: `apps/erp/app/routes/_public+/magic-link.tsx` — add a loader that redirects to login while email is disabled
- Modify: `apps/erp/app/routes/_public+/invite.$code.tsx` — require OAuth-backed Carbon session before accepting an invite
- Copy from (precedent): `apps/erp/app/routes/_public+/login.tsx` — existing Google/Azure button and `AUTH_PROVIDERS` gate pattern

**Steps:**
1. In ERP login loader, add `hasEmailAuth = isAuthProviderEnabled("email")` beside the existing Google, Azure, and passkey flags. Return it in both normal and cookie-clearing responses.
2. In the ERP login action, after `assertIsPost(request)` and before rate limiting, return a generic unsupported-auth-method result when email is disabled. Do not call `getUserByEmail`, `sendMagicLink`, `sendVerificationCode`, Turnstile, or Redis for that rejected email submission.
3. Conditionally render the existing `ValidatedForm`, email input, Turnstile, separator, and email-status copy only when `hasEmailAuth` is true. Leave Google, Azure, and passkey controls on their existing gates and preserve the current visual components, translations, and redirect handling.
4. In ERP callback action, call `validateOAuthCallback(authSession)` immediately after `refreshAccessToken()`. On a rejected result, clear Carbon and company cookies with `destroyAuthSession(request)` before any `getCompanies`, `getEmployeeCompanies`, `getUserByEmail`, or `setAuthSession` call. Preserve `safeRedirect`, multi-company selection, and Community/Cloud onboarding behavior on success.
5. In ERP verify loader and action, check `isAuthProviderEnabled("email")` before authentication, rate limiting, code verification, account creation, or password sign-in. Redirect to the login route when disabled. In magic-link, add the same server loader gate so a disabled email route cannot render a Supabase verify URL.
6. In invite loader, verify the invite is valid first, then redirect unauthenticated visitors to `/login?redirectTo=/invite/<code>`. In invite action, require an auth session, pass `authSession.email` to the existing `acceptInvite()`, and delete the unauthenticated `generateLink({ type: "magiclink" })` fallback. Preserve the matching-email check, membership activation, permission-cache invalidation, company selection, and Cloud subscription update.
7. Add route tests with mocked auth/session/user services proving: disabled email login never calls `sendMagicLink` or verification-code creation; a non-OAuth callback cannot call `setAuthSession`; an unauthenticated invite redirects to login with the local invite path; and a mismatched authenticated email leaves the invite unaccepted.

**Verify:**
```bash
pnpm --filter erp test -- app/routes/_public+/oauth-only-auth.test.ts && pnpm exec turbo run typecheck --filter=erp
# Expected: the ERP OAuth-only route tests pass and the ERP typecheck exits 0.
```

**Out of scope:** changing `acceptInvite()` transaction semantics, deleting email/password data, changing `userToCompany` or invite schema, or changing ERP protected-layout authorization.

## Task 3: Apply OAuth-only login and callback behavior to MES, Academy, and Starter

**Depends on:** Task 1
**Files:**
- Modify: `apps/mes/app/routes/_public+/login.tsx` — add the email gate to loader/action/form
- Modify: `apps/mes/app/routes/_public+/callback.tsx` — call `validateOAuthCallback()` before membership/session work
- Modify: `apps/academy/app/routes/_auth+/login.tsx` — combine credential presence with `AUTH_PROVIDERS` gates and hide/reject email login when disabled
- Modify: `apps/academy/app/routes/_auth+/callback.tsx` — call `validateOAuthCallback()` before membership/session work
- Modify: `apps/starter/app/routes/_public+/login.tsx` — combine credential presence with `AUTH_PROVIDERS` gates and hide/reject email login when disabled
- Modify: `apps/starter/app/routes/_public+/callback.tsx` — call `validateOAuthCallback()` before membership/session work
- Copy from (precedent): `apps/erp/app/routes/_public+/login.tsx` — provider-gated loader/action/UI contract after Task 2

**Steps:**
1. Add `isAuthProviderEnabled("email")` to each app login loader and return `hasEmailAuth` alongside the existing social-provider flags.
2. In each login action, reject disabled email submissions before rate limiting, user lookup, and magic-link delivery. Render existing email form and success-copy only when `hasEmailAuth` is true.
3. In Academy and Starter, require both the existing OAuth client-ID check and `isAuthProviderEnabled("google")` or `isAuthProviderEnabled("azure")` before rendering the corresponding button.
4. In every callback action, invoke `validateOAuthCallback()` after `refreshAccessToken()` and before user/membership/company/session operations. On failure, clear the Carbon/company session through `destroyAuthSession(request)`.
5. Preserve every app's existing post-login destination, company choice, layout guard, and error UI. Do not introduce ERP invite behavior into MES, Academy, or Starter.

**Verify:**
```bash
pnpm exec turbo run typecheck --filter=mes --filter=academy --filter=starter
# Expected: all three scoped app typechecks complete successfully with exit code 0.
```

**Out of scope:** creating new authentication screens, changing passkey endpoint behavior, adding Academy or Starter invitations, or adding tests that need real third-party provider consent.

## Task 4: Set OAuth-only defaults and document provider/callback configuration

**Depends on:** none
**Files:**
- Create: `docs/supabase-oauth-authentication/spec.md` — approved design record from this task
- Create: `.ai/plans/2026-07-16-supabase-oauth-authentication.md` — this executable implementation plan
- Modify: `.env.example` — set documented default to `AUTH_PROVIDERS="google,azure"`
- Modify: `contrib/deploying/simple-docker-caddy/docker-compose.prod.yml` — default ERP and MES `AUTH_PROVIDERS` to `google,azure`
- Modify: `packages/database/supabase/config.toml` — include exact localhost callback paths for ERP (`3000`), MES (`3001`), Academy (`4111`), and Starter (`4000`) in `additional_redirect_urls`
- Modify: `docs/content/docs/platform/self-hosting/environment-variables.mdx` — document OAuth-only default, provider credentials, and rollback by restoring provider names in `AUTH_PROVIDERS`
- Modify: `docs/content/docs/platform/architecture.mdx` — replace magic-link sign-in description with Supabase Google/Azure OAuth-only sign-in while preserving session/RBAC language
- Modify: `docs/content/docs/building/local-development.mdx` — distinguish local `DEV_BYPASS_EMAIL` from production OAuth-only authentication and document real-provider callback prerequisites
- Copy from (precedent): `.env.example` — existing `AUTH_PROVIDERS` and provider-secret documentation style

**Steps:**
1. Change only default values and documentation; keep all existing provider enum values and secret-variable names unchanged so rollback is a configuration change.
2. Add exact local callback URLs ending in `/callback` to the Supabase CLI config. Do not add broad production wildcard URLs.
3. Document the two different redirects: Google/Azure registered callback goes to Supabase Auth `/auth/v1/callback`; the application callback goes to the allow-listed AGA OneForge `/callback` route.
4. Document that production deployments must configure exact ERP/MES callback URLs in their Supabase project, and that local OAuth requires real provider credentials plus a restart of the local Auth service.
5. Add the approved spec and plan to the branch so issue and PR reviewers have the design and mechanical execution record.

**Verify:**
```bash
rg -n 'AUTH_PROVIDERS="google,azure"|AUTH_PROVIDERS: \$\{AUTH_PROVIDERS:-google,azure\}|http://localhost:(3000|3001|4000|4111)/callback|Supabase.*OAuth' .env.example contrib/deploying/simple-docker-caddy/docker-compose.prod.yml packages/database/supabase/config.toml docs/supabase-oauth-authentication/spec.md docs/content/docs/platform
# Expected: OAuth-only defaults, all four localhost callback URLs, and the Supabase OAuth documentation are present.
```

**Out of scope:** adding required environment variables, changing Supabase provider secrets, enabling/disabling providers in a hosted production project, changing email templates, or changing deployment topology.

## Task 5: Browser-verify the OAuth-only login surface and refresh Graphify

**Depends on:** Tasks 1, 2, 3, 4
**Files:**
- Create: `.ai/playbooks/supabase-oauth-login.md` — only after a passing browser run
- Modify: `graphify-out/` — incremental graph output generated by Graphify
- Copy from (precedent): `.ai/skills/test/SKILL.md` — required browser-test flow and playbook format

**Steps:**
1. Follow `.ai/skills/test/SKILL.md`: check for a matching playbook, announce the test plan, then use the local ERP/MES URLs from `.env.local`.
2. With `AUTH_PROVIDERS=google,azure`, verify the ERP and MES login pages do not render email input, email submit, magic-link success copy, or passkey controls; verify only configured Google/Azure controls are available.
3. Submit a direct POST-form equivalent only through the route test from Task 2; do not attempt a real email login in the browser because it must be rejected.
4. When real Google/Azure credentials are available, complete one provider callback in a local or preview environment and verify Carbon cookie creation, safe return path, logout, and existing invited-user identity continuity. If credentials or provider consent are unavailable, mark this provider callback as `SKIP` with the exact missing prerequisite while still completing the unauthenticated login-surface checks.
5. Write `.ai/playbooks/supabase-oauth-login.md` only for browser checks that pass. Close the browser after recording results.
6. Run `graphify update .` and query the login-to-session and invite-to-callback paths to confirm the graph contains the shared authorization gate and invite handoff.

**Verify:**
```bash
graphify update . && graphify query "Trace Supabase OAuth login from each login route through callback authorization, Carbon session creation, and ERP invite acceptance" --budget 2500
# Expected: Graphify update completes and the query names the login routes, shared OAuth callback gate, callback routes, session creation, and invite route.
```

**Out of scope:** production OAuth-provider setup, automated third-party consent, user-data migration, or committing generated Graphify artifacts that are already ignored by repository policy.

## Plan self-check

- [x] Every task lists exact paths, commands, and expected output.
- [x] No migration or generated database type work is required.
- [x] Each UI task names an in-repo precedent.
- [x] All typechecks are scoped; no whole-repository typecheck is planned.
- [x] The requirements in the approved spec are covered, with the final task using the browser-test workflow.
