# Issue #4 branding verification

Date: 2026-07-11
Branch: `codex/issue-4-branding-verification`

## Static audit

- Replaced remaining user-visible Carbon product naming in app copy, onboarding, glossary entries, integrations, notifications, email senders, PDF metadata, and accessibility labels.
- Carried existing translations forward with the new proper noun and audited active catalogs for stale localized Carbon names; zero mismatches remain.
- Retained internal `@carbon/*` imports, `getCarbon*`/`CarbonContext` identifiers, Carbon Cloud and upstream licensing references, auth relying-party identity, migration history, and existing `carbon.ms` destinations.
- The retained `carbon.ms` URL inventory has the same SHA-256 hash as `origin/main`: `f05667f62c739a5595d4bded81b0a9c02714d7fc4ad1a3eb1815cd67c1b2f57d`.
- Retained service origins responded successfully; `rest.carbon.ms` returned the expected unauthenticated `401`.

## Browser acceptance

Verified ERP login, MES login, Academy, and docs with agent-browser at 1440x900 and 375x812.

- Correct AGA OneForge title and visible branding on every surface.
- No broken images.
- No horizontal overflow.
- Remaining visible Carbon text on docs is intentional upstream context: the legal attribution in the footer and Carbon Cloud service/licensing labels.

## Commands

- `pnpm lingui:extract && pnpm lingui:clean && pnpm lingui:compile` — pass; zero missing ERP/MES messages in every locale
- `pnpm run lint` — pass (existing warnings only)
- `pnpm exec turbo run typecheck --filter=erp --filter=mes --filter=academy --filter=starter --filter=docs --filter=@carbon/locale --filter=@carbon/documents --filter=@carbon/database --filter=@carbon/onboarding --filter=@carbon/jobs --filter=@carbon/ee --filter=@carbon/glossary --filter=@carbon/auth` — pass
- `pnpm --filter docs build` — pass
- `graphify update .` — pass; 28,719 nodes, 97,959 edges, 1,065 communities
