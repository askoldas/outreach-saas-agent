# Architecture Decisions

Only decisions that govern the current implementation are retained here. Migration history and completed refactor passes are recorded in `OPPTIUM_REFACTOR_PLAN.md`.

## Product and safety

- Opptium is a horizontal B2B platform. Sector-specific assumptions belong in Company Profile or Campaign Strategy data, not shared code.
- The product ends at human-reviewed drafts and CSV export. It does not send email, create mailbox drafts, run follow-ups, or infer that exported outreach was sent.
- Prospect facts require evidence. Facts, inferences, unknowns, and conflicts remain distinct.

## Runtime and persistence

- Use one root Next.js application with Trigger.dev Cloud for durable execution.
- Supabase PostgreSQL and Auth are the system of record. Tenant-owned data is workspace-scoped and protected by RLS.
- Long-running discovery, analysis, enrichment, qualification, and batch draft generation run as retry-safe Trigger.dev tasks, never inside normal web request lifetimes.
- Campaign Agent progress is persisted as structured Campaign Run checkpoints. Model
  conversation history is not authoritative workflow state.
- Adaptive Campaign Agent iterations must use separate provider execution and usage
  records. Reusing a completed paid execution for another iteration is prohibited.
- Every successful Campaign Agent planning call is linked to its iteration execution
  through an `ai_requests` audit record before provider-backed discovery begins.
- Ordered migrations are append-only. Applied migrations are not rewritten.
- Intelligence V2 is introduced beside V1 through deployment flags, workspace rollout
  settings, and immutable campaign/run workflow versions. V2 flags default to disabled;
  historical V1 records are never silently reinterpreted through V2 logic.
- The new project starts from `supabase/baseline/`. Files under
  `supabase/migrations-legacy/` reconstruct only the locked legacy schema and must not
  be applied to the new project.

## Canonical product model

- The user-facing and persistence model is Company Profile → Campaign → immutable Campaign Strategy → Research → Leads → Approved Companies → Contacts → Drafts → Export.
- Campaign creation freezes an immutable Company Profile snapshot. Research runs freeze the exact Strategy version they use.
- The former Offer table and duplicated campaign strategy columns were retired by guarded migration `20260719000600`; application fallbacks to them are prohibited.
- Draft tasks freeze Company Profile and Strategy references and may use only saved lead evidence and the selected public recipient route.
- Campaign creation asks geography first, then uses `campaign_planning` to propose an
  Offering and target client. The original proposal and confirmed brief are persisted
  separately; campaign adjustments never mutate Company Profile.
- Preferred outreach language controls generated messages only. Discovery languages are
  derived independently from the target market and persisted on Campaign Strategy.
- Market adjustments are immutable Campaign Strategy revisions. Saving a revision
  atomically synchronizes the Campaign targeting fields and confirmed brief; active runs
  remain frozen and must be paused before a revision can be saved.
- Market analysis means understanding where and how to search. Discovery collects raw
  candidates. Classification cheaply removes obvious bad candidates. Evaluation deeply
  judges fit with evidence. Only promising and policy-selected possible candidates may
  be evaluated.
- The current V1 discovery workflow remains bounded to five iterations, ten queries per
  iteration, and fifty results per query. Intelligence V2 supersedes fixed iteration
  count as the intelligence policy with typed coverage and marginal-yield stopping, but
  retains deterministic hard execution ceilings. There is no unrestricted agent loop.

## Providers and AI

- Tavily is the current public-search and contact-enrichment provider; OpenRouter is the current model gateway. Both remain behind internal adapters.
- Paid task-specific model configuration replaces free models as the production
  direction. Phase 1 records the registry without changing current AI transport.
- AI work is narrow, prompt-versioned, schema-validated, and provenance-logged. Model output cannot authorize access, spending, deletion, or sending.
- Deterministic code owns authorization, validation, state transitions, deduplication, recipient recommendation, usage estimates, and CSV shaping.
- AI guidance is scoped to one active Company, Offering, or Campaign. Guided drafts and conversations are not sources of truth; validated proposals require deterministic, version-checked application to canonical objects.
- Provider calls are excluded from deterministic browser CI; adapter, schema, Trigger
  service, and saved-fixture boundaries provide coverage.

## Testing and delivery

- The default gates are formatting, lint, strict type checking, unit/contract tests, and production build.
- Disposable Supabase tests verify migrations, RLS, tenant isolation, and persisted workflow invariants.
- Playwright against disposable Supabase covers the locked journey through authenticated historical export download.
- `pnpm` is the package manager. The application remains deployable on Vercel and uses
  Trigger.dev Cloud for durable execution. Railway is not part of the approved MVP
  stack.

## Explicitly deferred

- Paid-operation budget reservations, configurable monetary campaign ceilings, and
  remaining-budget gates are deferred. Existing hard execution-volume ceilings remain
  mandatory.
- Paid enrichment vendors, deep crawling, document uploads, production billing, CRM integrations, and cross-tenant reuse of public research.
- Contact enrichment remains an optional/deferred stage until an external contact data
  provider is connected. Discovery and qualification must remain usable without it.
- Any sending or mailbox integration requires a new accepted decision plus compliance, suppression, consent, and audit design.

## Task-specific paid models

- OpenRouter remains the provider-neutral gateway.
- Business functions select a `ModelRole`, never a raw model ID.
- The initial high-impact default is `anthropic/claude-sonnet-4.6`.
- The initial economical and critical-fallback model is `openai/gpt-5-mini`.
- Free models and moving aliases are prohibited in production routing.
- Fallback is explicit and auditable; it is not used to override a valid business
  result.
- OpenRouter-reported USD cost is retained as provider cost. Product credits and any
  future customer billing remain separate.
- The current transport and schema parsers remain in place. Vercel AI SDK can later
  replace transport without changing the logical role registry.
