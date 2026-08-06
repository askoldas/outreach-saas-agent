# Opptium

Opptium is an AI-assisted B2B prospecting and outbound-preparation platform. A company maintains reusable seller knowledge, describes the companies it wants to find, reviews a structured research strategy, evaluates evidence-backed leads, enriches approved companies with contacts, prepares drafts, and exports the result. The current product does not send email or create mailbox drafts.

## Current implementation

This repository contains one Next.js 16 App Router application with strict TypeScript,
CSS Modules, Supabase Auth/Postgres/RLS, workspace-scoped repositories, ordered
migrations, provider-neutral Tavily/OpenRouter adapters, and Trigger.dev Cloud for
durable execution. The retired polling worker is not part of the current runtime.

Persisted today: authentication, workspaces, versioned Company Profiles, immutable
campaign profile snapshots and Campaign Strategy versions, campaign runs, staged
discovery plans/queries/candidates, canonical companies and contacts,
campaign-company/contact associations, qualification evidence, provider executions,
drafts, exports, and internal usage telemetry.

Company setup and Campaign creation use compact AI-guided workspaces with recommended
structured selections, optional natural-language interpretation, explicit proposal
application, live summaries, persistent guided drafts, scoped assistant history, and
applied-change audit records. Direct editing remains available and conversations never
replace the canonical Company Profile, Campaign, or Strategy objects.

Company Profile analysis, Campaign Strategy refinement, company qualification, and
draft generation use schema-validated provider output with persisted provenance.
Trigger.dev orchestrates durable logical provider executions with retry-safe results,
stable idempotency keys, explicit dispatch recovery, and terminal failure handling.
Draft generation is grounded in frozen Company Profile and Campaign Strategy versions,
saved company evidence, and an accepted public recipient route. The preferred outreach
language controls generated communication only.
Discovery languages are independently derived from the selected market and retain
English as an international-source fallback. Tavily-backed contact enrichment retains
route-level verification provenance.

The application uses Company Profiles and immutable Campaign Strategy versions exclusively. Discovery and qualification consume immutable campaign profile snapshots and frozen strategy versions. Migration `20260719000600` completed the audited retirement of the former Offer schema and duplicated campaign strategy columns.

## Intelligence V2 rollout

The Intelligence V2 specification is maintained under `docs/V2/`. Its implementation
is incremental and disabled by default. Existing profiles, campaigns, and runs remain
Intelligence V1. Campaign and run workflow versions are persisted so later V2 stages
can be enabled for selected workspaces without reinterpreting historical V1 records.
The exact package status and verification record is maintained in
`docs/V2/IMPLEMENTATION_STATUS.md`.

## Routes

- Public: `/`, `/product`, `/use-cases`, `/features/*`, `/pricing`, `/security`, `/resources`, `/about`, `/contact`, `/privacy`, `/terms`
- Authentication: `/login`, `/signup`, `/logout`
- `/dashboard` (redirects to `/campaigns`)
- `/leads/contacts` and `/leads/companies`
- `/sequences`
- `/campaigns`, `/campaigns/new`
- `/campaigns/[id]`, `/market-analysis`, `/discovery`, `/strategy`, `/leads`, `/outreach`
- `/company-profile`
- `/usage`
- `/settings`
- `/help`

Public, authentication, and application pages use separate route-group layouts. Public navigation opens login and signup as intercepted modals; direct visits retain full-page fallbacks.

## Development

Requires Node.js 22.18+ and pnpm 10.13.1.

```bash
corepack pnpm install
corepack pnpm dev
```

Copy `.env.example` to `.env.local` and provide the public Supabase URL and publishable key. Provider keys are optional unless running provider-backed research.

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Database integration tests require Docker and the Supabase CLI. They reset and test the local disposable Supabase database configured in `supabase/config.toml`; they must not be pointed at a shared or production database.

```bash
supabase start
corepack pnpm test:db
supabase stop --no-backup
```

GitHub Actions runs application verification, disposable database tests, and the Playwright campaign workflow independently.

See [the refactor audit](docs/OPPTIUM_REFACTOR_PLAN.md), [product definition](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), and [decisions](docs/DECISIONS.md).
