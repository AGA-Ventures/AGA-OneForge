# Supabase OAuth-Only Authentication

## What

Make Supabase Social Login through the already-configured Google and Microsoft Azure providers the default and only enabled interactive sign-in method for AGA OneForge deployments. Preserve the existing Carbon HTTP-only session cookie, refresh-token handling, company selection, Redis-cached permissions, and Postgres RLS authorization. Email magic-link/password and passkey implementations remain in the repository behind `AUTH_PROVIDERS` for rollback, but an OAuth-only deployment must neither render nor accept those entry paths.

## Context

AGA OneForge already uses Supabase Auth. The ERP, MES, Academy, and Starter login routes call `supabase.auth.signInWithOAuth()` for Google and Azure, then their callback routes convert the Supabase session into Carbon's `carbon` HTTP-only cookie through [`@carbon/auth`](../../packages/auth/src/services/session.server.ts). The requested change is therefore an OAuth-only cutover, not a replacement of the authorization system.

Graphify traversal and source inspection identified this flow:

1. Login routes initiate Google/Azure Supabase Social Login.
2. The `/callback` routes receive the browser session and post its refresh token to the server.
3. `@carbon/auth` refreshes and validates the Supabase session.
4. ERP resolves company memberships, sets the active-company cookie, and routes new eligible users to onboarding or multi-company users to company selection.
5. Authenticated layouts and `requirePermissions()` continue enforcing roles, permissions, and RLS.

This is distinct from AGA OneForge's OAuth 2.0 server under `apps/erp/app/routes/_oauth+/`, which authorizes third-party MCP clients and is not part of this change. It is also distinct from Jira, Xero, Slack, and Onshape integration OAuth routes.

Relevant current code:

- Provider gates: `packages/env/src/index.ts`
- Supabase clients: `packages/auth/src/lib/supabase/client.ts`
- Carbon sessions: `packages/auth/src/services/session.server.ts`
- Session creation/refresh: `packages/auth/src/services/auth.server.ts`
- ERP login/callback: `apps/erp/app/routes/_public+/login.tsx`, `callback.tsx`
- MES login/callback: `apps/mes/app/routes/_public+/login.tsx`, `callback.tsx`
- Academy login/callback: `apps/academy/app/routes/_auth+/login.tsx`, `callback.tsx`
- Starter login/callback: `apps/starter/app/routes/_public+/login.tsx`, `callback.tsx`
- Invite acceptance: `apps/erp/app/routes/_public+/invite.$code.tsx`
- Supabase provider configuration: `packages/database/supabase/config.toml`

## Requirements

1. The default deployment value of `AUTH_PROVIDERS` must be `google,azure`. Each deployment may enable only one of those providers by configuration.
2. A provider button must appear only when both its `AUTH_PROVIDERS` gate and provider credentials are configured.
3. When `email` is disabled, every login action must reject direct email submissions server-side; hiding the form is insufficient.
4. When `passkey` is disabled, existing passkey login/registration endpoints and profile UI must remain unavailable through the existing provider gate.
5. Every app callback must accept only a Supabase session whose verified JWT `amr` claim includes `oauth`. The callback must not trust a provider or method posted by the browser.
6. The callback must preserve the existing `redirectTo` behavior using a local-path-safe redirect. External redirect targets must never be accepted.
7. Existing users signing in with the same provider-verified email must retain their existing Supabase `auth.users.id`, public `user` row, company memberships, permissions, and history through Supabase automatic identity linking.
8. Enterprise edition must continue to reject self-service users. An OAuth user may enter only when the email belongs to an existing active user with a company membership or a pending, unrevoked invite.
9. Community and Cloud editions must retain their current self-service behavior: a new OAuth user may be created by Supabase and sent through onboarding.
10. An unauthenticated invite recipient must authenticate with OAuth before the invite is accepted. After OAuth, the invite email must exactly match the authenticated email before any membership, role, permission, or `acceptedAt` mutation occurs.
11. OAuth-only invite acceptance must not generate a magic link. The invite code must survive the login/callback round trip as a safe local `redirectTo` value.
12. Logout, session refresh, company switching, console mode, API-key authentication, MCP OAuth, and RLS behavior must remain unchanged.
13. Production Supabase Redirect URLs must include each exact application callback URL. Local and preview wildcard URLs may be configured separately, but production must not use a broad wildcard.
14. Cutover must be reversible by restoring `email` and/or `passkey` in `AUTH_PROVIDERS`; rollback must not require a database migration or redeploying old code.

## Design

### Authentication flow

1. `/login` loads enabled providers from `AUTH_PROVIDERS` and credential presence.
2. Selecting Google or Microsoft calls the existing `signInWithOAuth()` implementation with `/callback` plus an optional encoded local `redirectTo`.
3. Supabase handles the external provider exchange and returns the browser to the app callback.
4. The callback refreshes the Supabase session server-side as it does today, verifies the access token with `supabase.auth.getClaims(accessToken)`, and requires at least one `amr` entry whose method is `oauth`.
5. The existing Carbon session is created only after the OAuth-method, active-user, edition, membership/invite, and redirect checks pass.
6. The authenticated layouts continue to perform company selection, onboarding, permission lookup, and RLS-scoped client creation.

### Provider and route gating

- Reuse `isAuthProviderEnabled()`; do not introduce another provider registry.
- Add the missing `email` gate to all four login loaders/actions and conditionally render the existing email form.
- Academy and Starter must use the same gate as ERP/MES rather than credential presence alone.
- ERP `/verify` and `/magic-link` must reject or redirect when `email` is disabled, preventing hidden email-auth entry points.
- Keep the current email and passkey code intact for configuration rollback. Do not delete validators, templates, Redis verification code logic, or passkey credentials.

### OAuth-method verification

Add one shared `@carbon/auth` helper that verifies a supplied access token with Supabase `getClaims()` and checks `claims.amr` for `method === "oauth"`. All application callbacks must call it before `setAuthSession()`.

The `AUTH_PROVIDERS` UI gate is not the security boundary. Supabase provider configuration determines which external providers can issue sessions, while the callback's verified `amr` check prevents a directly obtained email/password, OTP, magic-link, recovery, or invite token from creating a Carbon session during an OAuth-only deployment.

### Account continuity and invitations

No user-data migration is planned. Supabase automatically links an OAuth identity to an existing user when the provider supplies the same verified email. Before production cutover, audit active users for missing, changed, or unverified provider emails; those exceptions require administrator remediation because automatic linking must not be guessed.

Invites continue using the existing AGA OneForge invite record and email. The route changes as follows:

1. An unauthenticated request to `/invite/:code` redirects to `/login?redirectTo=/invite/:code` without accepting the invite.
2. OAuth returns through `/callback`, which creates the Carbon session and safely redirects back to the invite.
3. The invite POST calls the existing `acceptInvite()` with `authSession.email`.
4. A mismatch fails without mutation. A match activates the account, membership, role, permissions, cache invalidation, active company, and `acceptedAt` using the current flow.

Pre-provisioned invite users already have confirmed Supabase auth accounts with random passwords. Same-email OAuth linking must preserve their IDs rather than create replacement users.

### Edition behavior

- **Enterprise:** deny OAuth completion when the user is inactive or has neither a membership nor a pending valid invite. Clear partial Carbon/company cookies and show a generic access-denied message.
- **Community/Cloud:** preserve the existing new-user trigger and onboarding route.
- Do not use `user_metadata` for authorization. Edition, membership, invite, role, and permission decisions remain server-side database checks.

### Affected surfaces

| Surface | Planned effect |
| --- | --- |
| `packages/env/src/index.ts`, `.env.example`, production compose defaults | Default to `google,azure`; reuse the existing provider enum/gate. |
| Four app login routes | Gate email server-side and client-side; consistently gate Google/Azure by config plus credentials. |
| `packages/auth/src/services/auth.server.ts` | Add the shared verified `amr=oauth` check without changing session/RBAC APIs. |
| Four app callback routes | Require OAuth authentication method before creating the Carbon session; retain current company/session flow. |
| ERP `invite.$code.tsx` | Authenticate before accepting; preserve invite code across callback; remove magic-link fallback. |
| ERP `verify.tsx` and `magic-link.tsx` | Make unavailable while email auth is disabled. |
| Supabase local/deployment config | Keep Google/Azure external providers configured and callback/redirect allow-lists exact. |
| Architecture, self-hosting, and local-development docs | Describe OAuth-only defaults, credentials, callbacks, and rollback. |
| Session, company, permissions, RLS, API keys, MCP OAuth, integration OAuth | No contract or behavior change. |

No database schema or generated database type changes are required.

## Decisions

### Social Login, not Supabase OAuth Server

- **Choice:** Use Supabase Social Login with the existing Google and Azure providers.
- **Alternative:** Replace AGA OneForge's MCP OAuth 2.0 server or make Supabase an OAuth 2.1 server for third parties.
- **Why:** Those solve a different problem and Graphify shows they do not participate in user login.
- **Reversible:** Yes; provider choice remains configuration-driven.

### Preserve the Carbon session architecture

- **Choice:** Keep the `carbon` HTTP-only cookie, refresh flow, company cookie, Redis permission cache, and `requirePermissions()` unchanged.
- **Alternative:** Add `@supabase/ssr`, move session ownership to Supabase cookies, and rewrite every authenticated loader/action integration.
- **Why:** Supabase already authenticates the user; replacing the downstream session layer would expand the blast radius without improving the requested OAuth cutover.
- **Reversible:** Yes; no public session contract changes.

### Retain disabled auth implementations

- **Choice:** Disable email and passkey by configuration and server gates, but keep their code for rollback.
- **Alternative:** Delete magic-link, verification, password, and passkey code immediately.
- **Why:** Configuration rollback is safer for existing installations and requires fewer files; deletion can follow after an observed deprecation period.
- **Reversible:** Yes, by changing `AUTH_PROVIDERS`.

### Existing providers

- **Choice:** Default to Google and Microsoft Azure because both are already implemented and configured.
- **Alternative:** Add another provider or enterprise SAML/OIDC SSO.
- **Why:** Adding a provider introduces credentials, consent-screen, tenant, claims, and support decisions not requested here.
- **Reversible:** Yes.

### Current callback transport

- **Choice:** Keep the current browser OAuth callback to Carbon-session handoff for this cutover; add verified JWT-method enforcement.
- **Alternative:** Migrate the callback and all apps to `@supabase/ssr` PKCE cookies now.
- **Why:** It is an independent session-architecture migration and would add a production dependency plus duplicate/replace existing cookie behavior.
- **Reversible:** Yes. A PKCE/SSR migration can be specified separately.

**Assumption:** “Use Supabase OAuth” means OAuth-only end-user sign-in with the existing Google and Microsoft providers, not a rewrite of authorization, MCP OAuth, or third-party integration OAuth.

## Versions

- Keep the repository-pinned `@supabase/supabase-js` `2.80.0`; its installed `getClaims()` verifies JWT claims and exposes `amr`. No new runtime dependency is required.
- Supabase references checked for this spec:
  - [Social Login](https://supabase.com/docs/guides/auth/social-login)
  - [`signInWithOAuth`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)
  - [JWT claims and `amr`](https://supabase.com/docs/guides/auth/jwt-fields)
  - [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
  - [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
  - [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)
- The current Supabase OAuth Server token-endpoint `201` to `200` breaking change does not apply because this feature does not call Supabase's OAuth 2.1 server token endpoint.

## Invariants

- A valid OAuth login never changes the existing Supabase user ID for a same-verified-email account.
- No Carbon session is created from a non-OAuth Supabase token while OAuth-only mode is active.
- No invite is accepted before an authenticated email match.
- `redirectTo` never leaves the application origin.
- Company selection remains explicit for multi-company users.
- Every authenticated database request remains scoped by the existing access token, company ID, permissions, and RLS.
- Service-role clients never reach the browser.
- Logout clears both Carbon and company cookies as today.
- No schema migration, generated type update, or permission-scope change is introduced.

## Error Behavior

- Provider missing/disabled: hide the button; a direct disabled login action returns a generic unsupported-auth-method response without revealing account existence.
- User cancels or provider rejects OAuth: show a normalized callback error and a link to restart login; do not create a Carbon session.
- Invalid, expired, or missing Supabase token: clear partial cookies and return to login.
- Verified JWT lacks `amr=oauth`: clear partial cookies, log the method mismatch without tokens or personal metadata, and show a generic unsupported-auth-method error.
- Existing user is inactive: deny and clear cookies.
- Enterprise user has no membership or pending invite: deny without onboarding.
- Invite email mismatch: do not mutate account, membership, permission, cache, or invite state; instruct the user to sign out and use the invited account.
- Unsafe `redirectTo`: fall back to the authenticated root.

## Testing Strategy

### Automated

1. Add a focused `@carbon/auth` test proving the OAuth-method helper accepts a verified JWT claim set containing `oauth` and rejects `password`, `otp`, `magiclink`, missing `amr`, invalid, and expired tokens.
2. Add route-level tests proving disabled email submissions cannot call `sendMagicLink()` or verification-code creation.
3. Test callback success, provider error, non-OAuth token rejection, inactive user, Enterprise no-membership denial, Community/Cloud onboarding, safe redirect, and multi-company selection preservation.
4. Test invite login round trip, matching email acceptance, mismatched email rejection, and no mutation before authentication.
5. Test same-email identity continuity against a seeded existing/invited user ID.

### Real-provider smoke test

Run once with Google and once with Microsoft in local or preview environments using real provider credentials. Verify provider callback URL, app redirect allow-list, Carbon cookie creation, refresh, logout, company selection, invite acceptance, and existing-user ID continuity. Provider consent and callback configuration cannot be fully proven by mocks.

### Validation commands

```bash
pnpm --filter @carbon/auth typecheck
pnpm --filter @carbon/auth test
pnpm exec turbo run typecheck --filter=erp --filter=mes --filter=academy --filter=starter
pnpm run lint
```

After code changes, run `graphify update .` and re-query the login-to-session and invite-to-callback paths.

## Rollout

1. Configure and verify Google/Azure provider credentials and exact callback URLs in a non-production environment.
2. Audit active and invited users for provider-email compatibility.
3. Deploy the provider gates and callback enforcement while retaining the current deployment's `AUTH_PROVIDERS` value.
4. Smoke-test both providers and invite/account continuity.
5. Change production `AUTH_PROVIDERS` to `google,azure`.
6. Monitor callback errors, rejected auth methods, invite mismatches, and support requests.
7. Roll back by restoring `email` and/or `passkey` in `AUTH_PROVIDERS` if required.

## Out of Scope

- Replacing Carbon sessions with `@supabase/ssr` cookies or a full PKCE/SSR migration.
- Adding new social providers, custom OIDC, SAML SSO, or MFA.
- Changing the MCP OAuth 2.0 server, API keys, or integration OAuth flows.
- Deleting email, password, verification, magic-link, or passkey code/data during this cutover.
- Changing session duration, cookie attributes, refresh-token policy, RBAC, RLS, multi-tenancy, or database schema.
