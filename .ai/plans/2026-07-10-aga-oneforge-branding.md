# AGA OneForge branding — implementation plan

**Spec:** User request in the 2026-07-10 task (small, explicit name rebrand; no separate spec)
**Research:** Repository inventory performed with Graphify and targeted `rg` searches on 2026-07-10
**Branch:** `codex/aga-oneforge-branding`

## Scope assumptions

- Replace user-visible product naming from `Carbon` to `AGA OneForge` across the ERP, MES, Academy, Starter, documentation, onboarding, generated documents, and email templates.
- Keep internal compatibility identifiers unchanged: `@carbon/*` package names, `getCarbon*` functions, database/schema identifiers, event names, CLI command `crbn`, source-code comments, tests, migration history, and third-party integration keys.
- Keep existing `carbon.ms` URLs and email addresses unchanged because no AGA OneForge domains or mailboxes are present in the repository. Do not invent replacements.
- Keep the existing icon/favicon mark. Replace visible wordmarks with text until approved AGA OneForge artwork is supplied; do not redraw a corporate logo during implementation.

## Progress

- [ ] Task 1: Rebrand application chrome and browser metadata
- [ ] Task 2: Rebrand user-facing product copy and localization catalogs
- [ ] Task 3: Rebrand transactional emails, PDFs, and platform sender names
- [ ] Task 4: Rebrand the documentation site and documentation content
- [ ] Task 5: Run static verification and browser acceptance checks

## Dependencies

Tasks 1, 3, and 4 are independent. Task 2 follows Task 1 so Lingui extraction sees the final app strings. Task 5 depends on Tasks 1–4.

---

## Task 1: Rebrand application chrome and browser metadata

**Depends on:** none
**Files:**
- Modify: `apps/erp/app/root.tsx` — use `AGA OneForge` and `AGA OneForge | Error` browser titles.
- Modify: `apps/mes/app/root.tsx` — use `AGA OneForge | MES` browser title.
- Modify: `apps/academy/app/root.tsx` — use `AGA OneForge Academy` browser title and render a text wordmark instead of Carbon wordmark images.
- Modify: `apps/starter/app/root.tsx` — use `AGA OneForge | Starter` browser title.
- Modify: `apps/erp/app/routes/_public+/_layout.tsx` — render `AGA OneForge` text in both light and dark public layouts instead of Carbon wordmark images.
- Modify: `apps/mes/app/routes/_public+/_layout.tsx` — render `AGA OneForge` text in both light and dark public layouts instead of Carbon wordmark images.
- Modify: `apps/erp/app/routes/_public+/login.tsx` — change the login title to `AGA OneForge | Login`.
- Modify: `apps/erp/app/routes/_public+/verify.tsx` — change the verification title to `AGA OneForge | Verify Email`.
- Modify: `apps/erp/app/routes/_public+/invite.$code.tsx` — change the invite title to `Accept Invite | AGA OneForge`.
- Modify: `apps/mes/app/routes/_public+/login.tsx` — change the login title to `AGA OneForge | Login`.
- Modify: `apps/academy/app/routes/_auth+/login.tsx` — change the login title to `AGA OneForge | Login`.
- Modify: `apps/academy/app/routes/_auth+/request-access.tsx` — change the request-access title to `AGA OneForge Developers | Request Access`.
- Modify: `apps/starter/app/routes/_public+/login.tsx` — change the login title to `AGA OneForge | Login`.
- Modify: `apps/starter/app/routes/_public+/request-access.tsx` — change the request-access title to `AGA OneForge Developers | Request Access`.
- Modify: `apps/erp/public/site.webmanifest` — change `name` from `Carbon ERP` to `AGA OneForge ERP`.
- Modify: `apps/mes/public/site.webmanifest` — change `name` from `Carbon MES` to `AGA OneForge MES`.
- Modify: `apps/academy/public/site.webmanifest` — change the app name to `AGA OneForge Academy`.
- Modify: `apps/starter/public/site.webmanifest` — change the app name to `AGA OneForge Starter`.
- Copy from (precedent): `apps/erp/app/routes/_public+/_layout.tsx` — preserve its existing responsive layout and light/dark text colors; only replace the image nodes.

**Steps:**
1. Update the exact metadata strings listed above. Preserve each route's existing separator style and suffix.
2. Replace public-layout and Academy `<img>` wordmarks with a plain text element containing `AGA OneForge`; retain the existing link, dimensions/spacing, and theme-aware foreground classes. Add no new shared logo component.
3. Update only each manifest's `name`; preserve `short_name`, icons, colors, and display mode.
4. If implementation reveals an approved AGA OneForge asset already added after this plan was written, STOP and report it before choosing between the asset and text — do not improvise.

**Verify:**
```bash
pnpm exec turbo run typecheck --filter=erp --filter=mes --filter=academy --filter=starter
# Expected: all four scoped typecheck tasks complete successfully with zero errors.
```

**Out of scope:** Renaming `@carbon/*`, `getCarbon*`, public asset filenames, favicon/icon artwork, auth relying-party IDs, and deployment domains.

## Task 2: Rebrand user-facing product copy and localization catalogs

**Depends on:** Task 1
**Files:**
- Modify: `apps/academy/app/config.tsx` — replace Academy course descriptions that name Carbon.
- Modify: `apps/academy/app/routes/about.tsx` — rename Carbon Academy references to AGA OneForge Academy.
- Modify: `apps/academy/app/routes/course+/_layout.tsx` — replace the learner-facing Carbon reference.
- Modify: `apps/erp/app/routes/onboarding+/plan.tsx` — rename Carbon Academy references while retaining existing external URLs.
- Modify: `apps/erp/app/modules/settings/ui/Backups/BackupProgressModal.tsx` — name AGA OneForge in the support message.
- Modify: `apps/erp/app/modules/settings/ui/Integrations/IntegrationForm.tsx` — use `AGA OneForge` in the endorsement disclaimer.
- Modify: `apps/erp/app/routes/api+/mcp+/lib/server.ts` — expose `AGA OneForge ERP Manufacturing System` as the MCP server description.
- Modify: `packages/onboarding/src/ui/OnboardingHub.tsx` — replace the visible Carbon product reference.
- Modify: `packages/react/src/Acknowledge.tsx` — rename Carbon Academy to AGA OneForge Academy while retaining the current learning URL.
- Modify: `packages/locale/locales/*/erp.po` — regenerate ERP catalogs after source changes.
- Modify: `packages/locale/locales/*/mes.po` — regenerate MES catalogs after source changes.
- Copy from (precedent): `apps/erp/app/routes/onboarding+/plan.tsx` — retain the existing Lingui `t` macro around changed translatable strings.

**Steps:**
1. Replace only product-name uses in rendered strings. Do not replace the chemistry/material term `carbon`, data variables such as `carbonIssue`, or integration protocol identifiers.
2. Preserve `<Trans>`, `useLingui().t`, and `msg` wrappers exactly so the new source strings remain extractable.
3. Run `pnpm lingui:extract` to update all committed PO catalogs, then `pnpm lingui:clean` to remove volatile headers and source-line references.
4. Do not run the LLM translation command for a proper noun; set the translated message value to `AGA OneForge`/`AGA OneForge Academy` wherever the old translation was only the Carbon proper name.

**Verify:**
```bash
pnpm lingui:compile && pnpm exec turbo run typecheck --filter=erp --filter=mes --filter=academy --filter=@carbon/locale
# Expected: Lingui compiles every catalog and all scoped typechecks finish with zero errors.
```

**Out of scope:** Internal symbols, package scopes, integration entity names, migration SQL, tests/fixtures, and `carbon.ms` links.

## Task 3: Rebrand transactional emails, PDFs, and platform sender names

**Depends on:** none
**Files:**
- Modify: `packages/documents/src/email/components/Logo.tsx` — replace remote Carbon wordmark images with accessible `AGA OneForge` text that works on light and dark email backgrounds.
- Modify: `packages/documents/src/email/GetStartedEmail.tsx` — replace visible Carbon product copy with AGA OneForge.
- Modify: `packages/documents/src/email/WelcomeEmail.tsx` — replace visible Carbon product copy with AGA OneForge.
- Modify: `packages/documents/src/email/VerificationEmail.tsx` — retain `support@carbon.ms` but name AGA OneForge in surrounding copy if present.
- Modify: `apps/erp/public/templates/invite.html` — rename the invited product to AGA OneForge.
- Modify: `apps/erp/public/templates/magic-link.html` — rename visible Carbon references if present.
- Modify: `packages/database/supabase/templates/invite.html` — rename the invited product to AGA OneForge.
- Modify: `packages/database/supabase/templates/magic-link.html` — rename visible Carbon references if present.
- Modify: `packages/dev/docker/docker-compose.dev.yml` — change user-visible Supabase mail sender and default organization names from Carbon to AGA OneForge.
- Copy from (precedent): `packages/documents/src/email/components/Logo.tsx` — preserve its table-safe React Email structure and dark-mode behavior.

**Steps:**
1. Change visible sender/product copy only; keep URLs, mailbox addresses, environment variables, and template tokens unchanged.
2. In the email logo component, use inline email-safe typography rather than an external image or a new dependency; retain useful alt/accessibility semantics.
3. Do not rename the Docker project, container, volume, network, or environment identifiers.

**Verify:**
```bash
pnpm exec turbo run typecheck --filter=@carbon/documents --filter=@carbon/database
# Expected: both scoped typecheck tasks finish successfully with zero errors.
```

**Out of scope:** PDF customer/company logos, email/domain migration, Resend configuration, SMTP credentials, and Docker resource identifiers.

## Task 4: Rebrand the documentation site and documentation content

**Depends on:** none
**Files:**
- Modify: `docs/lib/seo.ts` — set the site title to `AGA OneForge Docs`.
- Modify: `docs/app/not-found.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/app/api-reference/page.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/app/api-reference/authentication/page.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/app/api-reference/[module]/[resource]/page.tsx` — use `AGA OneForge API` in page metadata.
- Modify: `docs/app/mcp/page.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/app/mcp/authentication/page.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/app/mcp/tools/page.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/app/mcp/tools/[tool]/page.tsx` — use `AGA OneForge MCP` in page metadata.
- Modify: `docs/app/docs/[[...slug]]/page.tsx` — use AGA OneForge in page metadata.
- Modify: `docs/components/site-logo.tsx` — render the AGA OneForge text wordmark.
- Modify: `docs/components/editorial/site-header.tsx` — render AGA OneForge in the header.
- Modify: `docs/components/site-footer.tsx` — render AGA OneForge and change the copyright owner to `AGA OneForge`; preserve existing destination URLs.
- Modify: `docs/app/manifest.ts` — use AGA OneForge for installable-site metadata.
- Modify: `docs/public/site.webmanifest` — use AGA OneForge for installable-site metadata.
- Modify: `docs/content/docs/**/*.mdx` — replace prose references to the Carbon product with AGA OneForge while preserving code identifiers, package names, license attribution, repository links, and `carbon.ms` URLs.
- Modify: `docs/content/guides/**/*.mdx` — replace prose references to the Carbon product with AGA OneForge.
- Copy from (precedent): `docs/components/site-logo.tsx` — preserve the existing link, dimensions, and header alignment when replacing the wordmark image.

**Steps:**
1. Update metadata and visible header/footer branding in the exact files above.
2. Replace product-name prose in MDX, but leave factual upstream/legal references intact: `@carbon/*`, `crbn`, `Carbon Cloud` licensing history, the upstream GitHub repository, and all live `carbon.ms` URLs. Where a paragraph describes the running product rather than upstream licensing, use `AGA OneForge`.
3. Keep the existing favicon/icon artwork and filenames.
4. If a sentence becomes factually ambiguous after separating AGA OneForge from upstream Carbon licensing, STOP and report that sentence — do not rewrite legal meaning.

**Verify:**
```bash
pnpm exec turbo run typecheck --filter=docs && pnpm --filter docs build
# Expected: docs typecheck and production build complete successfully with zero broken MDX imports or metadata errors.
```

**Out of scope:** Rewriting upstream license terms, changing external URLs, altering API examples' hosts, and creating new logo artwork.

## Task 5: Run static verification and browser acceptance checks

**Depends on:** Tasks 1, 2, 3, 4
**Files:**
- Modify: none.
- Copy from (precedent): `apps/erp/app/routes/_public+/login.tsx` — use the existing login page as the primary visual acceptance surface.

**Steps:**
1. Search for remaining user-visible Carbon branding while excluding known internal compatibility surfaces. Review every match; do not blindly replace it.
2. Run the repository lint command and the scoped builds/typechecks from earlier tasks.
3. Use `/test` to open the ERP login page, MES login page, Academy page, and docs home page. Confirm AGA OneForge is visible, no Carbon wordmark is rendered, browser titles are correct, and layouts have no overflow or missing-image placeholders at desktop and mobile widths.
4. Confirm existing `carbon.ms` links still resolve to their unchanged destinations and no internal `@carbon/*` import was renamed.
5. Run `graphify update .` after the implementation so the repository graph reflects changed source files.

**Verify:**
```bash
rg -n --glob '!graphify-out/**' --glob '!node_modules/**' --glob '!pnpm-lock.yaml' --glob '!packages/database/supabase/migrations/**' --glob '!packages/locale/locales/**' 'Carbon (ERP|MES|Academy|Manufacturing)|Carbon \||on Carbon\b|in Carbon\b' apps packages docs
# Expected: no unexplained user-visible matches; remaining matches are documented upstream/legal, internal identifiers, tests, comments, or unchanged domains.
pnpm run lint
# Expected: Biome exits 0 with no new diagnostics.
```

**Out of scope:** Renaming the monorepo/package namespace, changing schema or auth, domain cutover, mailbox provisioning, and visual identity design.
