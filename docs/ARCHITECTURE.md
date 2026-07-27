# Architecture

## Runtime

The approved target is Next.js on Vercel, Supabase as the product system of record and
Trigger.dev Cloud for durable execution. The new empty Supabase project is defined by
`docs/database/clean-baseline-design.md` and `supabase/baseline/`.

Opptium is one Next.js 16 application with Trigger.dev Cloud for durable execution.
Supabase provides authentication, Postgres persistence, and RLS. The browser never
receives service-role or provider credentials.

The web layer handles authenticated composition and bounded mutations.
Workspace-scoped repositories own database access. Thin Trigger tasks invoke typed
server services using stored execution identifiers. Provider SDK behavior stays behind
Tavily/OpenRouter adapters. Deterministic code owns authorization, transitions,
validation, deduplication, cost estimates, cancellation, and user actions; AI is
reserved for narrow schema-validated interpretation and generation.

Campaign creation is geography-first. A bounded `campaign_planning` call proposes an
Offering and structured target client from the frozen Company Profile; user edits remain
campaign-local. One Start action persists the proposal and confirmed brief, freezes
profile/strategy context, creates a Campaign Run, and dispatches Trigger.dev.
The campaign's preferred outreach language is a communication-generation setting.
Discovery languages are a separate Strategy concern derived from target country codes,
local official languages, and an English international-source fallback.
Market adjustments create a new immutable Campaign Strategy only while no run is
active. The strategy-save transaction synchronizes the Campaign read model and
user-confirmed Campaign Brief so the next run receives one consistent target.

The Campaign Run pipeline is staged:

```text
brief -> market analysis -> discovery planning -> raw discovery
      -> candidate classification -> selective deep evaluation -> ready for review
      -> optional enrichment -> outreach preparation
```

Every raw candidate retains query/path/source provenance. Deterministic URL/domain and
source rules remove obvious exclusions and duplicates before expensive inspection.
The Discovery workspace exposes this stored provenance and the concise classification
decision for recent raw candidates; it never exposes model chain-of-thought.

Long-term bounded modules are Company Profile Intelligence, Campaign Strategist, Discovery Engine, Company Research, Identity Resolution, Qualification, Contact Discovery/Enrichment, Outreach Composer, and a deterministic orchestrator. These remain feature/service boundaries inside the current repository rather than speculative microservices.

The initial deterministic `execute-campaign` Trigger workflow owns one Campaign Run.
It resolves the stored discovery execution, durably waits for the discovery and
qualification child task, and then records an explicit optional-enrichment gate.
Campaign workspaces retain a recent run ledger so repeated executions remain distinct
and inspectable by status, phase, result counts, timestamps, and recorded cost. Run
selection remains campaign- and workspace-scoped, and historical Market Analysis and
Discovery artifacts can be opened without changing the current campaign state.
User-visible Campaign Run events are rendered as a concise timeline of persisted stage
changes, gates, pauses, refinements, and failures; internal-only events and raw details
remain hidden.
Contact enrichment and draft generation remain user-triggered until approval-driven
continuations are implemented.

The Campaign execution policy is deterministic application code shared by discovery
and future adaptive planning. Initial ceilings are five discovery iterations, ten
queries per iteration, fifty results per query, and five hundred inspected companies.
The deterministic discovery parent may run up to five sequential iterations with a
conservative eight results per query. Each later iteration has its own stable child
execution and changes source family across local directories, associations, event
exhibitors, and partner directories. Persisted domains prevent duplicate candidates
from receiving another deep evaluation. Tavily requests have a fixed worker-safe timeout.

The provider-neutral Campaign Agent core is implemented as one injected typed loop in
`src/lib/campaign-agent/loop.ts`. It owns plan, act, evaluate, refine, gate, and
completion transitions while deterministic code clamps every plan and observation.
The OpenRouter planner adapter returns a strictly validated plan through the logical
`campaign_planning` role. Stable loop states can be resumed and are stored as
workspace-scoped Campaign Run checkpoints. These pieces remain behind
`CAMPAIGN_AGENT_ENABLED=false`; current production execution remains the deterministic
parent workflow. When enabled, the first integration performs one planned,
provider-backed discovery/qualification iteration, evaluates its persisted result
deterministically, and writes loop checkpoints. Every adaptive iteration owns a child
provider execution linked to the orchestration execution, its own Trigger idempotency
key, and its own usage settlement. The loop may refine up to the deterministic
five-iteration ceiling and completes the orchestration-only parent separately.
Planner calls are written to `ai_requests` against the corresponding iteration
execution with logical role, prompt/schema version, actual model, fallback state,
tokens, provider cost, latency timestamps, and request hash. A planner or orchestration
failure fails the parent, closes pending iteration executions, fails the Campaign Run,
and appends one user-visible failure event.

Company Profile is persisted as one stable workspace record with immutable numbered
versions. Campaign creation selects the current version and atomically stores an
immutable JSON snapshot through database triggers. Application routes, repositories,
and Trigger services use only Company Profiles, snapshots, and immutable Strategy
versions.

Website analysis freezes the current profile-version identifier into a durable task.
The Trigger service discovers public website evidence through Tavily, sends only the
frozen profile plus retrieved sources to a schema-validated OpenRouter extractor, and
saves a new immutable `website_analysis` version through a service-role-only database
function.

Authenticated progress endpoints expose only the latest workspace-scoped durable run and task aggregates. A shared polling surface renders pending/running state, current step, percentage, task completion, failures, and the last persisted error for Company Profile analysis and campaign operations. Polling stops at a terminal state and refreshes the server-rendered result. Synchronous Strategy generation exposes its pending and error state directly in the Strategy workspace.

Strategy generation and refinement are server-authorized OpenRouter operations grounded in the immutable campaign profile snapshot, canonical campaign brief, and current Strategy version. The complete structured response is schema validated before the existing version RPC creates a new immutable Strategy. AI generation logs retain the prompt version, instruction, frozen inputs, raw response, structured output, and saved Strategy version identifier. Strategy-generation usage is recorded as its own operation.

Campaign Strategy follows the same immutable-version principle. Each campaign owns
numbered structured versions; saving creates a new version and supersedes only editable
predecessors. Campaign Run creation freezes the selected version and marks it used.
Discovery and qualification load that frozen version.

Campaign-local Leads and Outreach pages use workspace-and-campaign-scoped clean
repository queries. Campaign companies join immutable qualification dimensions,
evidence, and reusable public contact methods. Recipient recommendations are
deterministic projections over approved companies; user selection is persisted in
`campaign_contacts`.

Historical export downloads are generated on demand from the immutable JSON payload rather than mutable campaign rows. The download route re-establishes the authenticated current workspace, queries the export by both workspace and record identifier, emits CSV locally, and disables shared caching. No provider or public object URL is involved.

Approved-company contact enrichment is a durable Trigger operation. Tavily receives a
company-domain-scoped contact query; returned public evidence is parsed deterministically
and combined with saved evidence and shallow first-party page checks.

Draft generation is queued only for approved companies with selected recipients. Each
durable task captures the exact profile snapshot and Strategy version identifiers. The
Trigger service loads those frozen inputs with evidence and the selected public route,
validates structured OpenRouter output, logs generation provenance, and upserts one
reviewable primary draft per Campaign company.

Deterministic domain modules own validation, recipient recommendation, export shaping,
estimates, and state boundaries. Authentication, tenant isolation, persisted
repositories, ordered migrations, provider adapters, and Trigger.dev are the retained
foundations.

Tenant isolation is verified at the database boundary with pgTAP against a disposable local Supabase stack. The suite impersonates separate authenticated owners, exercises campaign profile/strategy creation and the persisted outreach workflow, and asserts that cross-workspace reads and writes are blocked by RLS. CI starts a fresh database, applies ordered migrations, runs these tests, and discards it.

AI-guided interaction is an orchestration layer above canonical objects. Validated
`AiGuidedResponse` values may contain one focused question and allowlisted proposed
changes. Server actions re-authorize the workspace, validate the proposal again, verify
the base Company Profile or Strategy version, and create a new persistent version before
recording an applied-change audit. Guided drafts and scoped conversations are separately
discardable; replaying messages is never required to reconstruct business state.

The reusable guided workspace owns selection/custom-input rendering and a live object
summary. Company and Campaign contextual drawers receive only their active structured
context. The initial campaign wizard persists a workspace-scoped draft and freezes the
selected Offering plus campaign-only overrides at creation.

Schema retirement was guarded by a service-role-only readiness audit and completed by migration `20260719000600`. Discovery, qualification, Strategy pages, and draft generation fail closed when canonical frozen context is missing.

## Model routing boundary

AI business services depend on logical roles declared in
`src/lib/ai/model-roles.ts`. `model-registry.ts` owns initial paid defaults,
`model-router.ts` resolves environment overrides/fallback/timeout policy, and the
OpenRouter adapter owns one transport attempt, failure classification, and usage
metadata. Trigger.dev owns durable retry/backoff. Attempt failures remain diagnostic;
only task-level final-failure hooks persist terminal execution and Campaign Run state.

Provider-backed services persist JSON-safe results into the logical
`provider_executions` metadata before downstream domain writes. A retry with the same
stable input hash reuses that result instead of calling OpenRouter, Tavily, or contact
providers again. Completed executions also retain a compact result reference for
idempotent task replay. Profile analysis versions are unique per logical execution,
and completed AI audit rows are unique per execution, role, request hash, and status.

Raw discovery candidates have a deterministic per-iteration identity. Overlapping
queries upsert one candidate and append separate `discovery_candidate_evidence`
records, preserving every source path and query. Canonical company resolution is a
service-role database function that prefers normalized domains, falls back to exact
name/country only when no domain exists, and removes race-created orphan rows.

This boundary is provider-independent above the transport layer and is intentionally
not coupled to an agent framework. Prompts, prompt versions, schema parsers, and
business decisions remain in their existing AI service modules.

Campaign pause and continue controls operate on durable orchestration. Pause is observed
at iteration boundaries and preserves completed artifacts. Continue resumes the same
Campaign Run through a stable Trigger idempotency key; it does not create a replacement
run or repeat completed paid child tasks.

The Campaign workspace follows the persisted workflow rather than a generic three-tab
shell: Overview shows stage, counters, blockers, and controls; Market Analysis shows the
versioned operational analysis; Discovery shows paths, iterations, classifications, and
filtered-candidate reasons; Companies presents progressive qualification review;
Contacts and Outreach retain the explicit post-approval workflows.

# AI-guided structured mutation boundary

Company Profile and Campaign setup use validated structured JSON contracts. AI
operations may generate profile business context, high-impact clarification questions,
Offering proposals, Target Segment proposals, or structured change sets.

Free text cannot mutate confirmed state. It is interpreted into explicit add, update,
remove, restore, or keep operations. The UI previews those operations and the user
selects which changes to apply. Application checks the base version for staleness and
creates a new immutable Company Profile or Campaign Strategy version.

The clean `company_profile_versions`, `campaign_strategy_versions`,
`ai_guided_drafts`, and `ai_applied_changes` entities provide the required versioning,
draft, provenance, stale-write, and audit boundaries. No polling-worker or retired
profile model is introduced.

Discovery remains organization-focused. Validation rejects consumer-only targets,
targets without a B2B relationship type, and low-discoverability confirmed segments
before a Campaign is created.
