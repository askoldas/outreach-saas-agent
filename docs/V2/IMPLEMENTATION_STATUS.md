# Opptium Intelligence V2 Implementation Status

This is the living implementation record required by
`09-refactor-execution-plan.md`. A package is marked complete only after its required
behavior and deterministic tests are implemented.

## Inspected baseline

- Repository state: `trigger` at `7a0d2b1dd13545fd946fcb7aebb3ea823bb86c90`
- Inspection date: 2026-07-27
- Runtime: Next.js 16, React 19, Supabase, Trigger.dev Cloud, OpenRouter, Tavily
- Existing canonical workflow: Intelligence V1
- V2 rollout default: disabled

## Work packages

| Package                                                  | Status      | Changes, tests, deviations, and removal work                                                                                                                                              |
| -------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-00 — Freeze baseline and add documentation            | complete    | Documents 00–10 are tracked under `docs/V2/`; this living record and links from current project documentation were added.                                                                 |
| WP-01 — Workflow version and feature-flag foundation     | complete    | Append-only versioning/rollout migration, typed flags, workspace settings, immutable run versions, and version-aware dispatch added.                                                      |
| WP-02 — Intelligence contract primitives                 | complete    | Strict evidence, claim, rule, memory, envelope, schema/task registry contracts and append-only registry migration added.                                                                  |
| WP-03 — Evidence and claim persistence                   | complete    | Append-only evidence/claim persistence, atomic links, conflicts, source guards, tenant repositories, RLS, and tests added.                                                                |
| WP-04 — Company Intelligence V3 contracts and V1 adapter | complete    | V3 identity, business model, offerings, mechanics, buyer logic, rules, readiness, and reviewed V2 draft adapter added.                                                                    |
| WP-05 — Company Intelligence V3 workflow                 | complete    | V3 persistence, six narrow task contracts, guarded sequential Trigger orchestration, audited/resumable stages, atomic normalized draft compilation, and lifecycle fixtures added.         |
| WP-06 — Company Profile V3 UI                            | complete    | Rollout-routed V3 review, V1 compatibility fallback, clarification and explicit review decisions, atomic core editing, immutable publishing, and an authenticated browser flow added.     |
| WP-07 — Campaign Strategy V2 contracts                   | complete    | Strict objective, geography, frozen offering, variant, archetype, signal, rubric, rule, source-plan, coverage, stopping, semantic-segment, strategy, and V1 adapter contracts added.      |
| WP-08 — Campaign Strategy V2 persistence and compiler    | complete    | Deterministic context and strategy compilers, bounded market/strategy task contracts, normalized draft persistence, immutable confirmation, versioning, diffs, and audit added.           |
| WP-09 — Campaign creation and Strategy V2 UI             | complete    | Rollout-routed geography-first creation, explicit objectives and offerings, campaign-scoped targeting, deterministic draft compilation, review, confirmation, and discovery gating added. |
| WP-10 — Scoped memory V2                                 | not_started | Scope precedence, promotion, conflicts, and application events remain.                                                                                                                    |
| WP-11 — Discovery provider contracts                     | not_started | Provider capabilities, registry, router, normalized records, and tests remain.                                                                                                            |
| WP-12 — WebSearchProvider                                | not_started | V2 query compilation inside the provider remains.                                                                                                                                         |
| WP-13 — Semantic discovery plan and coverage             | not_started | Segment runs, coverage, gap analysis, and stopping policy remain.                                                                                                                         |
| WP-14 — Organization graph and entity resolution         | not_started | Graph, conservative matching, reversible merge/split, and fixtures remain.                                                                                                                |
| WP-15 — Candidate research and reusable intelligence     | not_started | Research plan, claims, freshness, and reusable versions remain.                                                                                                                           |
| WP-16 — Qualification V2 factor engine                   | not_started | Relationship-first evaluation, exclusions, deterministic scoring, confidence, traces, and lanes remain.                                                                                   |
| WP-17 — Comparative ranking and consistency checks       | not_started | Ranking persistence, inversion checks, and failure isolation remain.                                                                                                                      |
| WP-18 — V2 Campaign Trigger workflow                     | not_started | Versioned V2 parent/children and workflow tests remain.                                                                                                                                   |
| WP-19 — V2 campaign results UI                           | not_started | Coverage, lanes, factors, corrections, entity review, and accessibility remain.                                                                                                           |
| WP-20 — Shadow mode and benchmark runner                 | not_started | Synthetic portfolio, comparison runner, report, and no-write shadow mode remain.                                                                                                          |
| WP-21 — Controlled beta                                  | not_started | Selected-workspace rollout, telemetry, and rollback drill remain.                                                                                                                         |
| WP-22 — Default V2 and legacy freeze                     | not_started | Requires explicit product decision and all prior gates.                                                                                                                                   |
| WP-23 — Legacy removal                                   | blocked     | Requires explicit approval after V2 default and historical-read guarantees.                                                                                                               |

## Known compatibility boundaries

- Existing profiles, campaigns, runs, qualifications, and exports remain V1.
- V2 is introduced beside V1 through persisted campaign/run workflow versions.
- There are no V2 canonical writes yet.
- V1 records are not reinterpreted as V2 records.
- Compatibility paths may read V1 into user-reviewed V2 drafts only when their package
  is implemented.

## WP-01 delivery record

- Migration:
  `supabase/migrations/20260728000100_intelligence_v2_versioning_and_rollout.sql`
- Runtime: typed feature registry, workspace rollout resolution, V1/V2 workflow
  routing, persisted run-version dispatch, and fail-closed V2 routing.
- Compatibility: all existing and newly defaulted records remain V1; the existing
  `execute-campaign` task is still the only active campaign workflow.
- Database types were aligned with the migration locally. Regenerate them from the
  linked Supabase project after applying the migration.
- Deployment boundary: the migration and pgTAP additions are not applied to a remote
  database by this repository change.

## Checks actually run

- `corepack pnpm test` — 268 passed, 0 failed after WP-04.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm lint` — passed.
- `corepack pnpm format:check` — passed.
- `corepack pnpm build` — passed.
- `corepack pnpm db:baseline:build` — passed; the generated clean baseline remains
  reproducible.
- `git diff --check` — passed.

## WP-03 delivery record

- Migration:
  `supabase/migrations/20260728000300_intelligence_claims_and_evidence.sql`
- Evidence supports exactly one source link: existing company source, document chunk,
  provider execution, or explicit manual source.
- Claims and evidence links are persisted atomically. Claims, evidence, and links are
  append-only; supersession creates a new claim.
- Conflict records retain both claims, reject cross-workspace or mismatched subjects,
  support one explicit resolution, and preserve immutable conflict identity.
- No speculative legacy claim backfill is performed.
- Database pgTAP coverage was expanded but requires the migration in a local Supabase
  test database to execute.

## WP-04 delivery record

- Runtime contracts:
  `src/lib/intelligence/company-profile-v3/`
- Active offerings require coherent commercial mechanics and at least one relationship
  hypothesis. Priority buyer archetypes require an explicit compatibility rationale.
- Company Profile rules are restricted to workspace or offering scope, and all offering
  records are bound to the frozen profile version.
- Readiness uses the documented publish gate. Missing optional details produce warnings
  rather than artificial blockers.
- The V2 adapter produces only a review-required V3 draft. Legacy values remain
  provisional, have low confidence, carry no invented evidence, and cannot be
  published without user review.
- Supabase types were regenerated successfully after WP-03 was applied.

## WP-05 delivery record

- Persistence migration drafted:
  `supabase/migrations/20260728000400_company_intelligence_v3.sql`
- The migration adds mutable review drafts, normalized business models and roles,
  stable offerings and offering versions, buyer archetype hypotheses, scoped rules,
  clarification questions, task runs, and change events.
- Published normalized records are immutable. Draft/task links have tenant consistency
  guards, and task idempotency keys are unique.
- Six independent prompt/schema contracts now exist for fact extraction, commercial
  synthesis, offering decomposition, buyer logic, clarification, and consistency
  audit.
- Migration 4 was applied through the Supabase SQL Editor and database types were
  regenerated from project `aqhuzmqzeipubxrxadyj`.
- A guarded parent Trigger workflow now runs the six stages as durable sequential child
  tasks. Each stage freezes its contract, prompt, schema, context compiler, input hash,
  and evidence context; completed matching outputs are reused on retry.
- Provider calls and validated outputs are persisted to `ai_requests` and
  `profile_task_runs`, including provider metadata, token/cost telemetry, output hashes,
  and bounded failure diagnostics.
- Migration 5 and its deterministic compiler atomically replace mutable normalized draft
  business models, roles, offering versions, archetypes, rules, and clarification
  questions while preserving stable offering identity. Buyer archetypes now require an
  explicit offering key; unknown cross-references fail instead of being guessed.
- Migration 5 was applied, database types were regenerated, and Trigger tasks were
  deployed.
- Deterministic workflow fixtures cover ordered success, cached-stage resume, blocking
  clarification, and terminal child failure. Terminal parent failure marks a building
  draft failed and records a bounded change event instead of leaving it stuck.

## WP-06 delivery record

- The Company Profile route selects V3 only through resolved environment and workspace
  rollout settings; V1 retains its existing editor and guided-AI fallback.
- The first V3 review slice reads normalized business models, roles, offerings, buyer
  archetypes, commercial rules, and clarification questions with explicit workspace and
  current-draft scoping.
- V3 clarification answers and skips are workspace scoped; non-skippable questions
  cannot be skipped. Legacy guided mutations are hidden while reviewing a V3 draft.
- Reviewers can explicitly activate or deactivate offerings, confirm or reject buyer
  archetypes, and confirm or reject proposed rules; every decision emits an audit event.
- Migration 6 adds one guarded publish transaction that verifies review readiness,
  blocking questions, business-model presence, and active offerings; it then freezes
  normalized children against a new `intelligence_version = 'v2'` profile version and
  advances the canonical profile pointer.
- The legacy profile reader recognizes V2 versions through an explicit compatibility
  view instead of attempting to parse V3 snapshots as the V1 schema.
- Migration 6 was applied and types regenerated; immutable publishing now uses its
  generated RPC type directly.
- Migration 7 adds guarded atomic editing for the public identity, canonical domain,
  commercial summary, primary role, revenue model, transaction model, and customer-use
  mode. Normalized data, the compiled snapshot, its invalidated hash, and the change
  event remain synchronized.
- Migration 7 was applied and types regenerated; the core-edit action now uses its
  generated RPC type directly.
- The authenticated Playwright flow provisions a disposable workspace, seeds a
  normalized V3 review, edits the commercial core, confirms review decisions, publishes,
  and verifies both the approved draft and immutable V2 profile version. It self-skips
  when deployment-level V2 profile flags are intentionally disabled.

## WP-07 delivery record

- Campaign Strategy V2 now requires an explicit commercial objective and relationship
  taxonomy, confirmed structured geography, and offering versions belonging to one
  frozen Company Intelligence version.
- Archetypes combine organization roles, relationship, use mode, commercial rationale,
  conditions, signals, and evidence questions. Conditional archetypes require explicit
  conditions, and every strategy requires at least one priority archetype.
- Qualification policy stores factor definitions rather than holistic model scores.
  Factor weights must total 100, hard gates must be actual hard-exclusion rules, and
  unknown evidence has an explicit handling policy.
- Discovery segments are provider-neutral semantic requests. Strict schemas reject raw
  query fields, unknown archetype links, incompatible-archetype discovery, inverted size
  ranges, and cross-profile offering references.
- The V1 adapter produces only a low-confidence, review-required V2 draft. It does not
  copy legacy raw search terms, keeps inferred exclusions soft and campaign scoped, and
  cannot be confirmed until the user explicitly reviews the objective and geography.

## WP-08 delivery record

- The deterministic campaign context compiler freezes one published Company
  Intelligence version, selects only referenced offerings, filters confirmed rules by
  applicability, separates facts from hypotheses and unknowns, and produces a canonical
  input hash.
- Market interpretation and strategy compilation now have narrow, strict, versioned
  output contracts. Market facts require evidence, factor weights total 100, archetype
  keys are unique, and neither contract emits provider-specific queries or candidate
  scores.
- Migration 8 adds workspace-scoped Campaign inputs, strategy drafts, objectives,
  archetypes, rubrics and factors, campaign rules, source plans, market findings, diffs,
  and audit events. The complete strategy remains one JSON snapshot written atomically
  with its normalized records.
- Confirmation is an admin-only transaction. It requires reviewed objective and
  geography, rejects unreconciled legacy imports, creates a new immutable version,
  copies normalized child records, updates the active Campaign reference, and records
  the confirming user and audit event.

## WP-09 delivery record

- Campaign creation remains geography first and now captures an explicit commercial
  objective before the offering and target hypothesis are finalized.
- Persisted workspace rollout settings route V1 campaigns through the existing immediate
  start path and V2 campaigns through the new strategy-draft path. V2 creation does not
  enqueue discovery.
- The V2 path resolves the selected immutable published offering version, compiles a
  bounded commercial context, writes the draft and normalized records, and redirects to
  a dedicated strategy review.
- Strategy review exposes the frozen objective, geography, profile version, archetypes,
  qualification factors, provider-neutral source plan, and stopping policy. Confirmation
  is explicit and transactional.
- Discovery start is visibly gated until the V2 discovery-provider packages are
  implemented. This prevents a confirmed V2 strategy from entering the incompatible V1
  Trigger workflow.

## Next package entry point

Begin WP-10 with scoped memory V2. V1 remains the default path until its successor
packages are complete and the V2 rollout is explicitly enabled.
