# Intelligence Logic Repair Status

## Inspected baseline

- Inspection date: 2026-08-02.
- Branch: `inteligence`.
- Commit: `e94b6c6 running stage`.
- Initial working tree: clean. The sibling branch initially checked out was
  `inteligenceV2`; no edits were made before switching to the requested branch.
- Authoritative references read: `AGENTS.md`, `README.md`, the repository architecture,
  domain, AI, security, testing and decisions documents, `docs/V2/IMPLEMENTATION_STATUS.md`,
  and the Company Intelligence, Campaign Strategy, product-flow and AI-task V2 specs.

## Current end-to-end runtime trace

| Transition                                             | Input and transformation                                                                                                                                                                                                                                                               | Persisted output / owner                                                                                              | Context, loss, and stale-data risk                                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Website to Profile sources                             | Published URLs are collected and normalized by Company Profile V3 ingestion tasks. Narrow task outputs are schema validated.                                                                                                                                                           | Evidence, claims, task runs, draft graph; Profile V3 server and Trigger tasks.                                        | Evidence provenance is retained. Detailed Package 2 inspection remains pending.                                                                                                      |
| Profile tasks to published Profile                     | Fact extraction, commercial synthesis, offering decomposition, buyer logic, clarification and consistency stages compile a normalized review draft; publication creates an immutable Profile version.                                                                                  | Profile version plus normalized offering/offering-version, archetype, rule and evidence records.                      | Campaign planning reads only the published version.                                                                                                                                  |
| Geography to target proposal (defect baseline)         | `CampaignBriefForm` previously called `proposeCampaignBriefAction` with geography only. The model received every active offering and selected one itself. Objective was selected only after the proposal existed.                                                                      | Proposal was later stored in `campaign_briefs.proposal`; Campaign inputs and Strategy draft were created on submit.   | Objective was unavailable. Offering, objective, geography or Profile changes were not bound by a proposal input hash. Stale buyer-oriented segments could survive objective changes. |
| Proposal to confirmed Campaign Brief (defect baseline) | Client edits produced `confirmedBrief`; parsers checked geography, one known offering and discoverability.                                                                                                                                                                             | `campaign_briefs.confirmed_brief`; Campaign targeting fields.                                                         | No canonical objective/relationship compatibility check. Clarification was stored but not compiled into targeting or Strategy.                                                       |
| Confirmed brief to Strategy                            | `createInitialCampaignStrategyV2` resolves the selected stable key to its published offering version, compiles commercial context, builds a native Strategy draft, validates it and persists normalized draft records.                                                                 | Campaign Strategy V2 draft, context/input hashes, normalized objective/archetype/rule/source-plan records.            | Current builder forces the objective relationship onto supplied segments/archetypes; market-context task usage requires Package 3 inspection.                                        |
| Confirmed Strategy to discovery                        | Explicit Strategy confirmation freezes a version; run planning consumes frozen Strategy and memory snapshots, then compiles relationship-aware, localized provider queries with policy-versioned fingerprints.                                                                         | Strategy version, memory snapshot, discovery plan, queries and provider executions.                                   | Query purpose and expected information gain are frozen; every returned source now receives Package 5 preclassification.                                                              |
| Results to candidate preclassification                 | Every raw source is retained; deterministic checks assign a disposition, and only plausible organization pages receive bounded commercial-role model refinement.                                                                                                                       | Immutable source records and Strategy-bound commercial preclassifications; accepted/reviewable normalized candidates. | Directories, news and marketplaces remain source-only; rejected records do not enter Entity Resolution.                                                                              |
| Accepted candidates to research                        | Entity-resolved candidates compile frozen unresolved questions and preferred page kinds; same-domain discovery ranks and fetches bounded first-party pages until strong question-specific coverage or budget exhaustion.                                                               | Canonical page fetches, source artifacts, evidence items, bounded excerpts, claims and explicit unknown findings.     | Search snippet length no longer suppresses research. Off-domain redirects are rejected and inaccessible evidence remains unknown.                                                    |
| Research to qualification/UI                           | Applicable, verifiable claims feed relationship, exclusions and factors; deterministic evidence gates produce eligibility, separate fit/potential, confidence, lanes and ranking. Results join the frozen discovery query, source disposition, identity and applied Memory provenance. | Research snapshots, claims, evaluations and ranking snapshots; concise decision and provenance readers.               | Readers expose cited decisions and unresolved items without chain-of-thought. Review decisions and corrections remain audited proposals.                                             |

## Confirmed defects

1. Campaign target generation accepted geography and the complete offering collection but
   not the user's commercial objective or selected offering.
2. The UI selected objective after a target proposal already existed; changing objective
   did not invalidate that proposal.
3. Selecting another offering replaced the proposal with generic Profile defaults rather
   than requiring objective-aware regeneration.
4. Campaign Brief parsing did not enforce compatibility between Campaign objective and
   confirmed segment relationship.
5. Proposal persistence had model/prompt metadata but no immutable objective, exact
   offering-version, Profile-version and semantic input-hash provenance.
6. A required clarification answer was persisted for audit but did not change targeting
   or Strategy input.
7. The Profile buyer-logic task returned one global `purchaseLogic` object. The compiler
   copied it into every offering while only archetypes were keyed per offering, allowing
   unrelated product, service and channel mechanics to leak across offerings.
8. Profile review exposed only `whyBuy` and archetype status controls; users could not
   correct the offering boundary, mechanics, conditions, triggers, roles or evidence
   signals consumed by Campaign planning.
9. `campaign.market_context` and `campaign.strategy_compiler` had strict versioned task
   contracts but no runtime caller. Initial creation and retry both compiled the Strategy
   directly from form values through `buildNativeCampaignStrategyV2`, bypassing bounded
   market interpretation and market-specific Strategy proposal entirely.
10. Web discovery appended supplier/manufacturer vocabulary regardless of the confirmed
    Campaign relationship. This biased direct-buyer and channel Campaigns toward the wrong
    company role. Retry planning also emitted `expand_from_seed` queries without receiving
    any real seed organization, and excluded canonical domains were not sent to Tavily.
11. Web normalization promoted every apparent homepage or branded commercial subpage to
    `normalized_provider_candidates`. Entity Resolution loaded that complete set without
    an objective-aware commercial disposition, so valid but irrelevant suppliers,
    competitors and wrong-market organizations could consume resolution and research.
12. Candidate Research froze useful `preferredPages` and `pageBudget` values but runtime
    forced `maximumFirstPartyFetches` to one. Source collection then treated 3,500
    characters of search snippets as sufficient and fetched only the canonical homepage,
    leaving product, location, partnership and procurement questions unresolved.
13. Campaign Memory snapshots stored only applied and overridden IDs. The runtime
    discarded structured values and evidence links, so confirmed corrections were
    auditable but could not change Strategy, discovery queries, research, Entity
    Resolution or qualification; replay also depended on mutable Memory rows.
14. Discovery coverage persisted commercial preclassification but reconstructed coverage
    from raw records and normalized identity hints only. Irrelevant organizations and
    source-only pages could therefore satisfy target volume or confidence and stop useful
    discovery early.
15. Qualification claims had IDs, keys and evidence but no structured Campaign/offering/
    archetype/factor/exclusion applicability. Relationship outputs could rely on cited
    hypotheses, and factor outputs could cite evidence unrelated to their supporting claim.
    A numerically high fit could also remain visible below the minimum evidence coverage.

## Package status

| Package                                                       | Status   | Current session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — objective-first targeting and stale proposal invalidation | complete | Canonical objective compatibility, objective/exact-offering proposal inputs, proposal provenance, server stale-input rejection, objective-aware Profile defaults, UI ordering/invalidation, and clarification application implemented. Focused and full deterministic verification passed.                                                                                                                                                                                                                                                                         |
| 2 — offering-specific buyer logic                             | complete | Buyer logic is returned, validated, compiled, persisted and read per exact offering key/version. Missing, unknown and duplicate keys fail. Multi-offering fixtures prevent product/distributor logic leaking into consulting/direct-buyer logic. Profile review exposes and edits offering mechanics and buyer assumptions.                                                                                                                                                                                                                                        |
| 3 — market-specific Campaign Strategy                         | complete | The live initial and retry paths execute the existing bounded market-context and Strategy proposal contracts, audit model provenance, reject objective contradictions and invalid evidence, preserve frozen Profile/offering references, then deterministically compile a review-only Strategy. The UI exposes assumptions, unresolved questions and localized discovery vocabulary before confirmation.                                                                                                                                                           |
| 4 — objective-aware discovery queries                         | complete | Web queries now derive role, directory and localized vocabulary from the frozen Strategy relationship; direct-buyer searches reject supplier/channel bias while supplier Campaigns retain appropriate terms. Query plans declare expected information gain, seed expansion is suppressed without real seeds, retry exclusions reach Tavily, and policy-aware fingerprints prevent collisions with the prior semantics.                                                                                                                                             |
| 5 — commercial candidate preclassification                    | complete | Every source receives a frozen disposition before Entity Resolution. Deterministic checks run first; only plausible organization pages reach a small evidence-bounded model task. Strategy/archetype provenance, reason codes, signals, geography/objective state, confidence and classifier versions persist immutably.                                                                                                                                                                                                                                           |
| 6 — multi-page first-party research                           | complete | Research now discovers same-domain pages, ranks them by frozen question purpose, executes the page budget, persists each bounded first-party artifact with existing URL/kind/reliability/directness/freshness/hash provenance, rejects off-domain redirects, and stops on question-specific strong coverage or budget exhaustion. Snippet length cannot suppress first-party fetching.                                                                                                                                                                             |
| 7 — executable frozen Memory effects                          | complete | Validated typed effects now compile into Strategy, discovery/query exclusions, research, Entity Resolution and qualification. Snapshot schema v3 freezes full applied/overridden records, evidence, origin/version fields, compiler version and per-memory layer trace. Deterministic precedence and applicability prevent cross-offering/campaign leakage; replay uses only frozen values.                                                                                                                                                                        |
| 8 — useful-candidate coverage and continuation                | complete | Coverage carries separate raw-source, valid-organization, source-only, plausible, unique-plausible, geography-supported and relationship-compatible counters. Native V2 no longer stops at a requested company count; continuation is governed by bounded budget, coverage, saturation, marginal yield and actionable gaps. Omitted segments remain not-started.                                                                                                                                        |
| 9 — evidence-bound qualification and interpretation           | complete | Qualification claims receive deterministic organization/Campaign/offering/archetype/question/factor/exclusion applicability. Relationships, factors and hard exclusions require applicable verifiable claims with linked current evidence. Unknown/conflict gates remain unresolved, confidence caps critical conflicts, insufficient evidence suppresses fit, potential stays separate, and claim-content changes invalidate evaluation inputs.                                                                                                                   |
| 10                                                            | complete | Company Profile retains per-offering mechanics, evidence, confidence, unresolved questions and meaningful correction controls. Strategy exposes objective, geography, selected offering, relationships, archetype conditions, exclusions, terminology, source plan, assumptions, unresolved questions and Memory reference. Results expose discovery/query/source provenance, preclassification, resolved identity, first-party source status, eligibility, factors, independent scores, confidence, unresolved questions, and audited review/correction controls. |

## Files changed

- Campaign creation/Strategy: `src/features/campaigns/CampaignBriefForm.tsx`,
  `src/server/campaigns/actions.ts`, `src/lib/ai/campaign-brief-proposal.ts`,
  `src/lib/campaign-workflow/contracts.ts`,
  `src/lib/campaign-workflow/objective-compatibility.ts`.
- Company Profile: `src/lib/intelligence/company-profile-v3/task-contracts.ts`,
  `src/lib/intelligence/company-profile-v3/draft-compiler.ts`,
  `src/server/company-profile-v3/actions.ts`, and
  `src/features/company-profile/CompanyProfileV3Workspace.tsx`.
- Campaign planning reader: `src/lib/intelligence/campaign-strategy-v2/planning-profile.ts`
  and `src/server/campaign-strategy-v2/repository.ts`.
- Market-specific Strategy: `src/lib/intelligence/campaign-strategy-v2/market-strategy.ts`,
  `src/lib/intelligence/campaign-strategy-v2/task-contracts.ts`,
  `src/server/campaign-strategy-v2/service.ts`,
  `src/server/campaign-strategy-v2/repository.ts`, and
  `src/features/campaigns/CampaignStrategyV2Workspace.tsx`.
- Objective-aware discovery: `src/lib/discovery-v2/providers/relationship-vocabulary.ts`,
  `src/lib/discovery-v2/providers/web-query-generator.ts`,
  `src/lib/discovery-v2/providers/web-search-provider.ts`, and
  `src/lib/providers/tavily.ts`.
- Candidate preclassification: `src/lib/discovery-v2/candidate-preclassification.ts`,
  `src/lib/discovery-v2/candidate-preclassification-model.ts`,
  `src/lib/discovery-v2/contracts.ts`,
  `src/lib/discovery-v2/providers/web-normalization.ts`,
  `src/server/discovery-v2/provider-service.ts`, and
  `src/server/discovery-v2/provider-repository.ts`.
- Multi-page research: `src/lib/candidate-intelligence-v2/research-plan.ts`,
  `src/lib/candidate-intelligence-v2/research-runtime.ts`,
  `src/server/candidate-research-v2/source-service.ts`, and
  `src/server/candidate-research-v2/candidate-worker.ts`.
- Executable Memory: `src/lib/intelligence/contracts/memory.ts`,
  `src/lib/memory-v2/effects.ts`, `src/lib/memory-v2/precedence.ts`,
  `src/server/discovery-v2/semantic-context.ts`, the research and qualification stage
  services, Entity Resolution repository, and the web-query generator.
- Useful-candidate coverage: `src/lib/discovery-v2/coverage.ts`, `gaps.ts`,
  `stopping.ts`, and the discovery provider coverage, history, initial-pass and
  targeted-pass server modules.
- Evidence-bound qualification: `src/lib/qualification-v2/runtime.ts`, `scoring.ts`,
  and the qualification repository and candidate worker.
- Decision readers: `src/features/campaigns/CampaignV2Results.tsx`,
  `src/features/campaigns/CampaignStrategyV2Workspace.tsx`, and
  `src/server/campaign-results-v2/repository.ts`.
- Tests: `src/lib/campaign-workflow/objective-compatibility.test.ts`,
  `src/lib/campaign-workflow/contracts.test.ts`,
  `src/features/campaigns/campaign-strategy-v2-ui-contract.test.ts`.
- Documentation: this file.
- Database/migrations:
  `supabase/migrations/20260802000100_commercial_candidate_preclassification.sql`
  adds immutable, tenant-scoped, Strategy-bound source dispositions. Historical rows are
  not rewritten.

## Versions changed

- Campaign Brief prompt: `campaign-brief-proposal-v4-objective-first`.
- Compatibility policy: initial canonical objective/legacy-segment relationship mapping.
- Profile buyer-logic prompt: `profile-buyer-logic-v5`.
- Profile buyer-logic schema: `profile-buyer-logic-schema-v4`.
- Market-context prompt/schema: `campaign-market-context/v3.0`.
- Strategy-proposal prompt/schema: `campaign-strategy-compiler/v3.0`.
- Campaign context compiler: `campaign-context/v2.2-market-specific`.
- Web query policy: `web-query/v3-objective-aware`.
- Web search provider: `2.5`.
- Web normalization: `web-search-normalization-v3.1-source-expansion`.
- Web discovery sources now expand into durable organization references with stable
  reference keys, source/query/extraction provenance, resumable offsets, and cautious
  name-only identity handling before the existing Entity Resolution stage.
- Deterministic candidate classifier: `commercial-candidate-preclassification/v1.1`.
- Model candidate classifier prompt: `candidate-commercial-plausibility/v1.1`.
- Commercial-role hints are non-exclusive: an inferred manufacturer, supplier,
  distributor, or reseller role routes uncertain objective compatibility to review rather
  than rejecting a plausible organization. A ccTLD is a positive geography hint when it
  matches, but a mismatching ccTLD is not sufficient negative evidence for rejection.
- Candidate classifier schema: `candidate-preclassification-schema/v1.0`.
- Candidate Research runtime: `candidate-research-v2.3-multipage`.
- Candidate evidence extraction prompt: `candidate-evidence-extraction-v2.3-multipage`.
- Campaign Memory snapshot schema: `3`.
- Memory effect compiler: `memory-effect-compiler/v1.0`.
- Discovery coverage policy: `discovery-coverage/v3-commercial-plausibility`.
- Persisted discovery coverage summary schema: `3`.
- Qualification runtime: `candidate-qualification-v2.3`.
- Relationship/factor prompts: `v2.2-applicable-evidence`.
- Scoring, confidence and hard-exclusion policies: `v2.2`.

## Commands actually run

- Required baseline Git commands on the workspace parent: failed because it was not the
  repository root.
- Required baseline Git commands from the repository: passed; found the initial branch
  mismatch and clean tree.
- `git switch inteligence`: passed.
- Documentation and targeted source inspection using `Get-Content` and `rg`: passed.
- `corepack pnpm typecheck`: initially failed on an unchecked mapping lookup; corrected;
  rerun passed.
- Focused Node tests for Campaign Brief parsing, objective compatibility and Campaign UI
  contracts: 16 passed, 0 failed.
- `corepack pnpm format:check`: failed because 30 pre-existing files outside Package 1
  are not Prettier-clean. A targeted Prettier check over every changed Package 1 file
  passed.
- `corepack pnpm lint`: passed.
- `corepack pnpm test`: 500 passed, 0 failed.
- `corepack pnpm build`: passed. Its generated `next-env.d.ts` change was reverted to the
  inspected baseline.
- `git diff --check`: passed.
- Package 2 focused compiler, task-contract, Strategy and Profile UI tests: 20 passed,
  0 failed.
- Package 2 `corepack pnpm typecheck`: passed after updating richer Campaign planning
  fixtures.
- Package 2 `corepack pnpm lint`: passed.
- Package 2 first full `corepack pnpm test`: 501 passed and 2 failed because legacy
  rule-scope fixtures still used the removed global contract. After correcting those
  fixtures, the full suite passed: 503 passed, 0 failed.
- Package 2 `corepack pnpm build`: passed.
- Package 2 changed-file Prettier check and `git diff --check`: passed.
- Package 3 focused Strategy/compiler/UI tests and typecheck: passed after correcting one
  test-only path-alias import; 22 focused tests passed, 0 failed.
- Package 3 `corepack pnpm lint`: passed.
- Package 3 `corepack pnpm test`: 508 passed, 0 failed.
- Package 3 `corepack pnpm build`: passed; its generated `next-env.d.ts` change was
  reverted to the inspected baseline.
- Package 3 `git diff --check`: passed.
- Package 4 focused objective-aware query/provider tests: 21 passed, 0 failed.
- Package 4 `corepack pnpm typecheck`: passed.
- Package 5 focused preclassification, provider-contract, normalization and migration
  tests: 34 passed, 0 failed.
- Package 5 `corepack pnpm typecheck` and `git diff --check`: passed.
- Package 5 `corepack pnpm lint`: passed.
- Package 5 full `corepack pnpm test`: 522 passed, 0 failed.
- Package 5 `corepack pnpm build`: passed; its generated `next-env.d.ts` change was
  reverted to the inspected baseline.
- Package 6 focused research planning, source collection, evidence and runtime tests:
  29 passed, 0 failed.
- Package 6 `corepack pnpm typecheck`: passed.
- Package 6 `corepack pnpm lint`: passed.
- Package 6 full `corepack pnpm test`: 525 passed, 0 failed.
- Package 6 `corepack pnpm build`: passed; its generated `next-env.d.ts` change was
  reverted to the inspected baseline.
- Package 7 focused Memory compiler, query, scope, replay, Entity Resolution and frozen
  Strategy tests: 39 passed, 0 failed across the focused runs.
- Package 7 `npm.cmd run typecheck` and `npm.cmd run lint`: passed.
- Package 7 full `npm.cmd run test`: 530 passed, 0 failed.
- Package 7 `npm.cmd run build`: passed; its generated `next-env.d.ts` change was reverted
  to the inspected baseline.
- Package 7 changed-file Prettier formatting and `git diff --check`: passed.
- Package 8 focused coverage, stopping, provider replay and initial-stage contract tests:
  29 passed, 0 failed.
- Package 8 `npm.cmd run typecheck` and `npm.cmd run lint`: passed.
- Package 8 full `npm.cmd run test`: 534 passed, 0 failed.
- Package 8 `npm.cmd run build`: passed; its generated `next-env.d.ts` change was reverted
  to the inspected baseline.
- Package 9 focused qualification, evidence, exclusion, taxonomy and recomputation tests:
  26 passed, 0 failed.
- Package 9 `npm.cmd run typecheck` and `npm.cmd run lint`: passed.
- Package 9 full `npm.cmd run test`: 541 passed, 0 failed.
- Package 9 `npm.cmd run build`: passed; its generated `next-env.d.ts` change was reverted
  to the inspected baseline.
- Package 10 focused Strategy and Results reader contracts: 16 passed, 0 failed.
- Package 10 `npm.cmd run typecheck` and `npm.cmd run lint`: passed.
- Package 10 full `npm.cmd run test`: 543 passed, 0 failed.
- Package 10 `npm.cmd run build`: passed; its generated `next-env.d.ts` change was reverted
  to the inspected baseline. Changed-file Prettier formatting and `git diff --check` passed.
- Final audit `npm.cmd run db:types`: first attempt was blocked by sandboxed registry
  access; approved rerun passed and regenerated `src/types/database.types.ts` from the
  migrated hosted Supabase project. Typecheck and targeted formatting passed afterward.
- Final audit `npm.cmd run format:check`: failed on 20 files; 18 are pre-existing files
  outside the repair diff. The two repair-owned/generated files reported by it were
  formatted and passed a targeted check.
- Final audit `npm.cmd run trigger:deploy:check`: the initial local attempt could not
  authenticate. After explicit user approval for worker-bundle upload, the authenticated
  rerun passed: Trigger account validation and worker-code build both succeeded.
- Local Supabase DB and E2E verification were unavailable: Docker is not installed and
  `npx supabase status` could not establish a local stack. No DB stack was started.

## Remaining risks and handoff

- The legacy `TargetSegment` relationship taxonomy is narrower than Strategy V2. Package 1
  maps that boundary explicitly; Package 9 must later verify all downstream mappings.
- Profile-default proposals use a temporary client provenance marker that is accepted only
  when every semantic provenance field matches and is replaced with the server-computed
  SHA-256 hash before persistence.
- All ten requested repair packages are complete. The applied preclassification migration
  must be paired with deployment of both the application and Trigger workers before new
  runs execute the repaired runtime end to end.
- Repository-wide `format:check` remains red on 18 pre-existing, untouched files; all
  repair-owned files are formatted. The Trigger CLI reported that 4.5.9 is available while
  the project intentionally remains pinned to 4.5.7; the dry-run build still passed.
