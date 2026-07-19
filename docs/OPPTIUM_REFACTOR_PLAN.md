# Opptium Refactor Completion Record

The requested refactor is complete. The repository now implements the canonical Company Profile → Campaign → immutable Strategy → Research → Leads → Contacts → Drafts → Export workflow without application-level fallback to retired schemas or mock business data.

## Delivered passes

1. Replaced Offer-first and global Lead/Draft navigation with Company Profile and campaign-local workspaces.
2. Added immutable Company Profile versions, campaign snapshots, and Campaign Strategy versions.
3. Persisted enrichment state, recipient selection, immutable usage events, and frozen export history.
4. Added disposable-database RLS and tenant-workflow coverage in CI.
5. Audited and retired the former schema after production readiness returned `ready: true`.
6. Added grounded durable draft generation with frozen context and AI provenance.
7. Added schema-validated Company Profile website analysis and Strategy generation.
8. Added Tavily-backed contact enrichment with route-level verification provenance.
9. Added authorized historical CSV regeneration from immutable export payloads.
10. Added Playwright coverage through recipient acceptance, draft editing, export, and historical download.
11. Added authenticated durable-run progress surfaces.
12. Removed obsolete compatibility routes, fallback constructors, unused components, and superseded documentation.

## Current verification gates

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:db` against disposable Supabase
- `pnpm test:e2e` against disposable Supabase

## Current exclusions

Paid enrichment vendors, deep crawling, document uploads, production billing, CRM integrations, automatic sending, mailbox draft creation, follow-ups, and reply detection are not implemented. These are product expansions, not unfinished refactor work.
