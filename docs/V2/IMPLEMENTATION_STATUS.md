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

| Package                                                  | Status      | Changes, tests, deviations, and removal work                                                                                         |
| -------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| WP-00 — Freeze baseline and add documentation            | complete    | Documents 00–10 are tracked under `docs/V2/`; this living record and links from current project documentation were added.            |
| WP-01 — Workflow version and feature-flag foundation     | complete    | Append-only versioning/rollout migration, typed flags, workspace settings, immutable run versions, and version-aware dispatch added. |
| WP-02 — Intelligence contract primitives                 | complete    | Strict evidence, claim, rule, memory, envelope, schema/task registry contracts and append-only registry migration added.             |
| WP-03 — Evidence and claim persistence                   | complete    | Append-only evidence/claim persistence, atomic links, conflicts, source guards, tenant repositories, RLS, and tests added.           |
| WP-04 — Company Intelligence V3 contracts and V1 adapter | complete    | V3 identity, business model, offerings, mechanics, buyer logic, rules, readiness, and reviewed V2 draft adapter added.               |
| WP-05 — Company Intelligence V3 workflow                 | in_progress | V3 draft/task persistence and six versioned narrow task contracts added; Trigger orchestration and execution services remain.        |
| WP-06 — Company Profile V3 UI                            | not_started | V3 review and publish UI remain.                                                                                                     |
| WP-07 — Campaign Strategy V2 contracts                   | not_started | Objective, archetype, rubric, source-plan, and segment contracts remain.                                                             |
| WP-08 — Campaign Strategy V2 persistence and compiler    | not_started | Compiler, persistence, confirmation, and audit remain.                                                                               |
| WP-09 — Campaign creation and Strategy V2 UI             | not_started | V2 routing, wizard, review, and E2E coverage remain.                                                                                 |
| WP-10 — Scoped memory V2                                 | not_started | Scope precedence, promotion, conflicts, and application events remain.                                                               |
| WP-11 — Discovery provider contracts                     | not_started | Provider capabilities, registry, router, normalized records, and tests remain.                                                       |
| WP-12 — WebSearchProvider                                | not_started | V2 query compilation inside the provider remains.                                                                                    |
| WP-13 — Semantic discovery plan and coverage             | not_started | Segment runs, coverage, gap analysis, and stopping policy remain.                                                                    |
| WP-14 — Organization graph and entity resolution         | not_started | Graph, conservative matching, reversible merge/split, and fixtures remain.                                                           |
| WP-15 — Candidate research and reusable intelligence     | not_started | Research plan, claims, freshness, and reusable versions remain.                                                                      |
| WP-16 — Qualification V2 factor engine                   | not_started | Relationship-first evaluation, exclusions, deterministic scoring, confidence, traces, and lanes remain.                              |
| WP-17 — Comparative ranking and consistency checks       | not_started | Ranking persistence, inversion checks, and failure isolation remain.                                                                 |
| WP-18 — V2 Campaign Trigger workflow                     | not_started | Versioned V2 parent/children and workflow tests remain.                                                                              |
| WP-19 — V2 campaign results UI                           | not_started | Coverage, lanes, factors, corrections, entity review, and accessibility remain.                                                      |
| WP-20 — Shadow mode and benchmark runner                 | not_started | Synthetic portfolio, comparison runner, report, and no-write shadow mode remain.                                                     |
| WP-21 — Controlled beta                                  | not_started | Selected-workspace rollout, telemetry, and rollback drill remain.                                                                    |
| WP-22 — Default V2 and legacy freeze                     | not_started | Requires explicit product decision and all prior gates.                                                                              |
| WP-23 — Legacy removal                                   | blocked     | Requires explicit approval after V2 default and historical-read guarantees.                                                          |

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
- Remaining before WP-05 completion: apply and regenerate types, implement the guarded
  parent/child Trigger workflow, task execution and AI audit writes, persisted stage
  outputs, resumability, and end-to-end fixtures.

## Next package entry point

Apply Migration 4 and regenerate types, then continue WP-05 with the guarded staged
Trigger.dev profile workflow and execution services. V1 profile analysis remains the
canonical path until that workflow is complete and explicitly enabled.
