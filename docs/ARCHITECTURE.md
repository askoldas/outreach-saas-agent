# Architecture

## Runtime

Opptium is a Next.js 16 application backed by Supabase and Trigger.dev Cloud.
Supabase is authoritative for authentication, tenant isolation, immutable intelligence
versions, workflow state, audit records, results, and usage. Trigger.dev owns durable
execution, retry, concurrency, and waitpoints. Provider and service-role secrets never
reach the browser.

The web application performs authenticated composition and bounded user mutations.
Workspace-scoped repositories own database access. Trigger tasks are thin wrappers
around typed services and receive persisted identifiers rather than trusting
client-provided tenant context.

## Canonical intelligence entry points

Company Intelligence V3 starts from the workspace identity and saved official website.
It collects bounded first-party evidence, executes six schema-validated stages, and
publishes an immutable normalized commercial graph only after review. It does not seed
or adapt a legacy structured profile.

Campaign creation reads the published V3 graph, lets the user select an offering and
confirm geography, objective, target client, and target segments, then creates a native
Campaign Strategy V2 review draft. The compiler produces relationship archetypes,
semantic discovery segments, scoped rules, evidence questions, qualification factors,
coverage targets, and stopping policy without a V1 strategy.

## Company Research workflow

All new Campaign Runs use `execute-campaign-v2` as a durable Company Research runner:

```text
initialize
  -> semantic discovery
  -> entity resolution
  -> candidate research
  -> relationship-first qualification
  -> comparative ranking
  -> ready for review
```

Initialization freezes the run identity and then waits for the idempotent market
opportunity bootstrap before semantic discovery. The bootstrap compiles commercial
intelligence, initial opportunity hypotheses, a run-scoped Market Opportunity Map,
provider capability snapshot, and Market Research Plan. The map can retain, downgrade,
or reject initial hypotheses and add market-research lanes without changing the frozen
commercial objective. Discovery therefore consumes the run-tied plan and
cannot race ahead with a Strategy-only fallback. This execution guidance is not a
second user approval gate.

Before the map is synthesized, bounded external market reconnaissance retrieves a
run-scoped evidence corpus through the metered Tavily boundary. This corpus is persisted
separately from candidate-discovery provider records, cached by frozen Target Model
content, and passed to the model as untrusted evidence with explicit evidence IDs.

Concrete operations are checkpointed and idempotent. The runner checks durable pause,
resume, cancellation, saturation, campaign authorization, and workspace balance around
paid work. Candidate research and qualification use budget-safe bounded fan-out;
ranking and persistence are deterministic. Supabase remains the source of truth.

Multi-country discovery creates an explicit query context for every target country and
derives the relevant local discovery languages from the frozen country codes, with
English retained as a working fallback. The Tavily country parameter is a search
priority signal, not proof of market presence. Candidate research must therefore record
reliable evidence that an organization is legally based in or demonstrably operates in
the target market; qualification treats unresolved target-market presence as an
eligibility gate.

The Company Research page combines the evolving Market Overview, explored directions,
source provenance, progressive company states, and usage. Historical Market Analysis
and Discovery URLs redirect there.

## Credits and provider usage

`usage_ledger` is the provider-neutral audit boundary. It records raw provider usage,
actual USD cost, independently billable USD cost, and fractional Opptium credits.
`workspace_credit_accounts`, Campaign Run authorization, and `budget_reservations` are
enforced atomically by database functions. Authorization is a ceiling, not an upfront
deduction; settlement returns unused reservations. Conversion lives in
`OPPTIUM_COST_PER_CREDIT_USD`.

Provider/model kill switches remain available. They stop external calls without
changing workflow versions.

## Historical compatibility

V1 tables, immutable rows, reports, strategy reads, results, and exports remain
available for audit history. Historical V1 Campaign Runs are read-only and cannot be
dispatched or resumed. V1 constructors, mutation actions, compatibility adapters,
deprecated prompts, rollout switching actions, and the old Trigger parent/child tasks
have been removed.

Migration `20260729000400_remove_legacy_write_and_execution_surfaces.sql` drops the
retired constructor RPCs and rejects new legacy `company_profile_analysis` and
`campaign_discovery` provider executions. It does not delete historical data.

## Downstream operations

Approved-company contact enrichment and grounded outreach draft generation remain
explicit user-triggered operations. Contact enrichment is provider-backed and deferred
when an external contact database is unavailable. Draft generation freezes the exact
profile snapshot, Strategy version, company evidence, and selected recipient context.

Historical export downloads are generated from immutable stored payloads after
re-authorizing the current workspace. No public object URL or mutable campaign row is
used.

## Model routing

AI services request logical roles declared in `src/lib/ai/model-roles.ts`.
`model-registry.ts` owns paid defaults, `model-router.ts` resolves optional environment
overrides, and the OpenRouter adapter owns one transport attempt plus usage metadata.
Trigger.dev owns durable retries.

Deterministic code owns authorization, transitions, validation, deduplication,
eligibility, scoring, ranking, cancellation, and user decisions. AI is limited to
narrow schema-validated extraction, synthesis, research, qualification support, and
grounded generation.

## Tenant and data boundaries

Every canonical read and mutation is workspace-scoped. RLS protects authenticated
access; service-role operations re-resolve workspace ownership from persisted records.
Campaign Runs freeze the exact profile and Strategy references they use. V1 records are
never reinterpreted as V2 records.
