# Research Improvement Follow-up Report

## Outcome

The follow-up keeps the existing V2 architecture and closes the reviewed gaps in
adaptive Market Research, named-source discovery, typed signals, relationship
suppression, durable triage, provenance, fail-closed execution, observation dates, and
benchmark observability.

## Runtime pipeline

The active Trigger.dev path is now:

1. Company Profile snapshot and confirmed Campaign Strategy.
2. Commercial Intelligence and evidence-bearing initial target hypotheses.
3. Bounded external Market Research waves.
4. Market Opportunity Map and frozen Market Research Plan.
5. Source-, language-, lane-, geography-, and signal-aware Discovery.
6. Entity Resolution.
7. Exact evidence-backed relationship/exclusion matching.
8. Durable triage for every resolved candidate.
9. Bounded deep Candidate Research for the selected subset only.
10. Deterministic Qualification and lane-first Ranking with opportunity timing.

The parent `execute-campaign-v2` task invokes the market bootstrap before its research
cycle, then dispatches the active Discovery, Entity Resolution, Candidate Research,
Qualification, and Ranking stages through durable Trigger tasks and checkpoints.

## Market Research bounds

Normal execution uses two waves. A third wave is permitted only for explicit priority
coverage gaps. Policy bounds include waves, queries per wave, total provider calls,
retained evidence, and elapsed runtime. Follow-up questions carry their wave, direction,
parent evidence, and gap keys and are generated from discovered lanes, terminology,
sources, and missing priority evidence.

## Named sources and typed signals

Evidence-backed named market sources retain source family, URL, intended use, applicable
lane IDs, confidence, and evidence IDs. Candidate-discovery sources become frozen
Discovery routes and domain-constrained searches; validation-only sources are not
misused as directories.

Scale drivers, buying triggers, and need signals remain typed from Market Analysis
through the Research Plan, Discovery query intent, triage, Candidate Research, and
Qualification. Query text is only a provider translation of the retained semantic
signal.

## Suppression and durable triage

Before deep research, candidates are matched by exact organization ID, canonical domain,
or exact high-confidence evidenced alias. Confirmed customers, competitors, and explicit
exclusions are suppressed. Ambiguous relationships, partners, and former customers are
held. Fuzzy names never suppress.

`candidate_triage_decisions_v2` stores one immutable row per resolved candidate and
research cycle. It includes decision, commercial score, component explanations,
suppression reasons, relationship status, research difficulty, evidence IDs, policy
version, and input hash. Complete pool coverage is validated before research selection.

## Provenance and legacy gating

Native Strategy archetypes preserve evidence from the matched Company Profile buyer
hypothesis. Target and Market artifacts retain that upstream chain and add only evidence
that supports their own conclusions. Unsupported signal evidence is not invented.

Normal V2 Discovery throws `MissingMarketOpportunityPlanError` when its Market Research
Plan is absent. Strategy-only Discovery is available only through the explicit
`allowLegacyStrategyDiscovery` option, which the production workflow never enables.

## Database migrations

- `20260904000200_candidate_supporting_research_sources.sql`: third-party Candidate
  Research sources and publication dates.
- `20260904000300_candidate_claim_observation_dates.sql`: now an explicit full function
  definition; preserves cited observation time and leaves undated volatile claims
  unknown.
- `20260904000400_pre_research_relationship_suppression.sql`: service-role relationship
  memory loader.
- `20260904000500_candidate_triage_decisions.sql`: durable cycle-aware triage ledger and
  persistence RPC.

All four intended database changes have been reported as applied. The explicit rewrite
of `20260904000300` does not require reapplication because its deployed behavior did not
change.

## Main files changed

- Market contracts/compilers: `src/lib/intelligence/core/market-*`, `shared.ts`.
- Strategy provenance: `src/lib/intelligence/campaign-strategy-v2/*`,
  `campaign-target-model-compiler.ts`.
- Discovery consumption and fail-closed runtime: `src/lib/discovery-v2/*`,
  `src/server/discovery-v2/initial-discovery-stage.ts`.
- Adaptive reconnaissance: `src/server/market-analysis-v2/market-reconnaissance.ts` and
  `stage-service.ts`.
- Suppression and triage: `src/lib/candidate-intelligence-v2/*`,
  `src/server/candidate-research-v2/*`.
- Ranking/Trigger observability: `src/server/ranking-v2/stage-service.ts`,
  `src/trigger/research-campaign-candidates-v2.ts`.
- Architecture documentation and migration/behavior contract tests under `docs/V2`,
  `src/**/*.test.ts`, and `supabase/migrations`.

## Benchmark observability

Durable stage outputs now expose compact initial hypotheses, opportunity lanes,
weak/rejected lanes, named sources, wave/query IDs, lane-level discovery counts, triage
counts, Qualification lane counts, Ranking lane counts, reason codes, evidence IDs,
policy versions, and hashes. Whole LLM payloads are not logged.

## Verification and limitations

The active workflow and its individual decision logic are covered by unit, migration
contract, and runtime-path contract tests. Static checks include TypeScript, ESLint, and
`git diff --check`.

Known limitations:

- The final real Gemoss campaign remains an environment-level benchmark requiring live
  provider credentials, representative workspace data, and the final Trigger.dev deploy.
- Relationship memory can only use sources already normalized in the product; no CRM
  connector was introduced because none exists in the current V2 provider set.
- Name-only suppression deliberately requires exact, very high-confidence evidenced
  aliases, trading recall for false-positive safety.
