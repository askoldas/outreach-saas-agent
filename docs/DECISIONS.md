# Architecture Decisions

Only decisions that govern the current implementation are retained here. Migration history and completed refactor passes are recorded in `OPPTIUM_REFACTOR_PLAN.md`.

## Product and safety

- Opptium is a horizontal B2B platform. Sector-specific assumptions belong in Company Profile or Campaign Strategy data, not shared code.
- The product ends at human-reviewed drafts and CSV export. It does not send email, create mailbox drafts, run follow-ups, or infer that exported outreach was sent.
- Prospect facts require evidence. Facts, inferences, unknowns, and conflicts remain distinct.

## Runtime and persistence

- Use one root Next.js application with a separately runnable worker in the same repository.
- Supabase PostgreSQL and Auth are the system of record. Tenant-owned data is workspace-scoped and protected by RLS.
- Long-running discovery, analysis, enrichment, qualification, and batch draft generation run as retry-safe database-backed tasks, never inside normal web request lifetimes.
- Ordered migrations are append-only. Applied migrations are not rewritten.

## Canonical product model

- The user-facing and persistence model is Company Profile → Campaign → immutable Campaign Strategy → Research → Leads → Approved Companies → Contacts → Drafts → Export.
- Campaign creation freezes an immutable Company Profile snapshot. Research runs freeze the exact Strategy version they use.
- The former Offer table and duplicated campaign strategy columns were retired by guarded migration `20260719000600`; application fallbacks to them are prohibited.
- Draft tasks freeze Company Profile and Strategy references and may use only saved lead evidence and the selected public recipient route.

## Providers and AI

- Tavily is the current public-search and contact-enrichment provider; OpenRouter is the current model gateway. Both remain behind internal adapters.
- AI work is narrow, prompt-versioned, schema-validated, and provenance-logged. Model output cannot authorize access, spending, deletion, or sending.
- Deterministic code owns authorization, validation, state transitions, deduplication, recipient recommendation, usage estimates, and CSV shaping.
- Provider calls are excluded from deterministic browser CI; adapter, schema, worker, and saved-fixture boundaries provide coverage.

## Testing and delivery

- The default gates are formatting, lint, strict type checking, unit/contract tests, and production build.
- Disposable Supabase tests verify migrations, RLS, tenant isolation, and persisted workflow invariants.
- Playwright against disposable Supabase covers the locked journey through authenticated historical export download.
- `pnpm` is the package manager. The application remains deployable on Vercel and the worker as a separate long-running service such as Railway.

## Explicitly deferred

- Paid enrichment vendors, deep crawling, document uploads, production billing, CRM integrations, and cross-tenant reuse of public research.
- Any sending or mailbox integration requires a new accepted decision plus compliance, suppression, consent, and audit design.
