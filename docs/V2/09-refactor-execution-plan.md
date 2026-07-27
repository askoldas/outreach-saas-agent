# Opptium Intelligence V2

## Repository-Specific Refactor Execution Plan

**Document:** 09 of the Intelligence V2 specification set  
**Repository:** `askoldas/outreach-saas-agent`  
**Inspected baseline:** `main` at merge commit `93939739c8ce60e699a17cb7ad62259b33acec6a`  
**Merged implementation branch:** `trigger` at `ce52fd0e0b01ef5b1fc0c7b831b3e856262a339b`  
**Runtime:** Next.js 16, React 19, Supabase, Trigger.dev Cloud, OpenRouter, Tavily  
**Status:** Implementation plan; no code change is implied by this document alone

---

## 1. Purpose

This document converts Documents 00–08 into an implementation sequence for the current Opptium repository.

It is not another conceptual architecture document. It specifies:

- which existing implementation surfaces remain valid;
- which current contracts are insufficient;
- which files should be created, modified, adapted, or retired;
- the ordered database migration path;
- the Trigger.dev workflow transition;
- how Intelligence V1 and Intelligence V2 coexist during rollout;
- the exact dependency order between implementation work packages;
- test and benchmark gates required before each stage can be enabled;
- rollback and cleanup boundaries;
- Codex-sized task boundaries and recommended commit structure.

The implementation must preserve the current working product while replacing the commercial-intelligence core.

---

## 2. Binding Inputs

This execution plan must be implemented together with:

1. `00-documentation-map-and-core-principles.md`
2. `01-company-intelligence-and-profile-creation.md`
3. `02-campaign-strategy-and-scoped-memory.md`
4. `03-discovery-architecture-and-provider-abstraction.md`
5. `04-entity-resolution-and-candidate-intelligence.md`
6. `05-qualification-scoring-and-comparative-ranking.md`
7. `06-workflow-orchestration-tasks-and-data-model.md`
8. `07-product-flows-and-interface-requirements.md`
9. `08-validation-benchmarks-migration-and-rollout.md`

Repository-local rules remain binding:

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT.md`
- `docs/TESTING.md`

When a repository document still describes Intelligence V1 behavior that this specification explicitly replaces, update that repository document in the same pull request that changes the behavior.

Do not leave two contradictory descriptions marked as current.

---

## 3. Refactor Classification

This is a serious refactor of the intelligence core, but not a product rewrite.

### 3.1 Retained foundations

The following foundations are valid and should remain:

- one Next.js App Router application;
- Supabase Auth and PostgreSQL as system of record;
- workspace-scoped ownership and RLS;
- Trigger.dev Cloud for durable work;
- immutable Company Profile versions;
- immutable Campaign Strategy versions;
- frozen Campaign Profile snapshots;
- Campaign Runs and persisted run events;
- generic `provider_executions` and `ai_requests` audit concepts;
- provider result idempotency;
- model-role routing through OpenRouter;
- Tavily transport adapter;
- explicit pause, continue, cancellation, and failure handling;
- progressive campaign UI and historical run views;
- approval-driven contact enrichment and outreach preparation;
- CSV export boundaries;
- existing authentication, workspace, settings, usage, and navigation shells;
- existing compact table and expandable-row UI patterns;
- deterministic server authorization and state transitions;
- current testing stack: Node tests, pgTAP/Supabase, Playwright, build and lint gates.

### 3.2 Refactored foundations

The following areas must be substantially extended or replaced:

- Company Profile commercial-intelligence schema;
- offering commercial mechanics and buyer logic;
- profile facts, claims, hypotheses, and uncertainty representation;
- campaign objective and relationship model;
- campaign strategy contract;
- exclusion scope and applicability;
- campaign working memory and durable campaign knowledge;
- discovery plan contract;
- discovery provider abstraction;
- WebSearchProvider implementation boundary;
- coverage-driven discovery control;
- candidate identity and organization graph;
- reusable Candidate Intelligence;
- campaign-specific relationship assessment;
- eligibility and exclusion evaluation;
- evidence-factor extraction;
- deterministic fit, potential, and confidence computation;
- comparative ranking;
- correction propagation and controlled memory promotion;
- result lanes and result explanation UI;
- benchmark suite and shadow-mode comparison.

### 3.3 Explicitly retired behavior

The following behavior must not survive as the authoritative V2 path:

- a campaign strategy represented mainly by flat string arrays;
- discovery planning represented mainly by raw search-query strings;
- fixed generic discovery iterations that only append a new source-family phrase;
- a universal five-iteration loop as the definition of intelligence;
- query construction outside the active discovery provider;
- Tavily result shapes leaking into normalized candidate or campaign contracts;
- isolated holistic `relevanceScore` generation by the model;
- treating an LLM-created 0–100 score as authoritative;
- collapsing relationship, eligibility, fit, potential, and confidence into one score;
- treating unknown evidence as a confirmed negative;
- applying a campaign exclusion globally without explicit promotion;
- treating every country storefront as a separate buying organization;
- deep evaluation of every superficially plausible raw search result;
- storing only concise campaign learnings without applicability and scope metadata;
- allowing the generic Campaign Agent loop to decide commercial meaning without typed V2 policies.

---

## 4. Current Repository Assessment

### 4.1 Company Profile

Current important files:

- `src/lib/company-profile/structured-profile.ts`
- `src/lib/ai/company-profile-analysis.ts`
- `src/server/company-profile/analysis-service.ts`
- `src/server/company-profile/repository.ts`
- `src/server/company-profile/actions.ts`
- `src/trigger/analyze-company-profile.ts`
- `src/features/company-profile/CompanyProfileWorkspace.tsx`
- `src/features/company-profile/CompanyGuidedSetup.tsx`
- `src/features/company-profile/CompanyWebsiteSettings.tsx`
- `supabase/baseline/003_company_profiles.sql`

Current strengths:

- schema-versioned structured profile JSON;
- offering grouping;
- business-model labels;
- evidence references;
- review questions;
- immutable profile versions;
- durable website analysis;
- user-preference preservation;
- profile snapshots frozen into campaigns.

Current gaps:

- business model is mostly a categorical label, not a commercial-mechanics model;
- value-chain role is not represented robustly;
- offering buyer logic is incomplete;
- user, buyer, payer, procurement, reseller, integrator, and channel roles are not separated;
- buyer archetypes are not first-class reusable objects;
- facts, evidence-backed inferences, hypotheses, unknowns, and rejected assumptions are not represented consistently as claims;
- commercial rules and exclusions are arrays rather than scoped rule objects;
- profile-level global exclusions cannot express objective-dependent applicability;
- source references are embedded repeatedly rather than linked through a reusable evidence model;
- `schemaVersion: 2` is insufficient for Intelligence V2.

### 4.2 Campaign creation and strategy

Current important files:

- `src/lib/campaign-workflow/contracts.ts`
- `src/lib/ai/campaign-brief-proposal.ts`
- `src/lib/ai/strategy-generation.ts`
- `src/lib/campaign-workflow/market-planning.ts`
- `src/server/campaigns/actions.ts`
- `src/server/campaigns/repository.ts`
- `src/server/campaign-strategy/actions.ts`
- `src/server/campaign-strategy/repository.ts`
- `src/features/campaigns/CampaignWizard.tsx`
- `src/features/campaigns/CampaignBriefForm.tsx`
- `src/features/campaigns/StrategyWorkspace.tsx`
- `supabase/baseline/004_campaigns.sql`

Current strengths:

- geography-first campaign creation;
- selected profile offering;
- AI-proposed target client;
- user-confirmed brief;
- immutable strategy versions;
- frozen strategy per Campaign Run;
- separate discovery and outreach languages;
- campaign-local overrides.

Current gaps:

- objective is an unrestricted text field rather than a typed relationship objective;
- target client is a flat set of company types, industries, characteristics, and exclusions;
- buyer archetypes are absent;
- relationship intent is implicit;
- market analysis and final strategy are compiled too late inside discovery execution;
- qualification rubric is not explicit or versioned;
- required evidence questions are not explicit;
- hard and soft exclusions are not separated;
- exclusion scope, applicability, origin, and promotion state are absent;
- campaign memory is not compiled into strategy context;
- source planning is query-oriented rather than provider-oriented;
- the user does not approve the full commercial strategy before discovery begins.

### 4.3 Discovery

Current important files:

- `src/lib/discovery/query-builder.ts`
- `src/lib/discovery/iteration-refinement.ts`
- `src/lib/discovery/result-classifier.ts`
- `src/lib/discovery/directory-entity-extractor.ts`
- `src/lib/campaign-workflow/market-planning.ts`
- `src/server/campaign-discovery/service.ts`
- `src/trigger/discover-campaign-companies.ts`
- `src/trigger/execute-campaign.ts`
- `src/lib/providers/tavily.ts`
- `src/lib/campaign-agent/*`

Current strengths:

- Tavily remains behind an adapter;
- raw result provenance is stored;
- first-party pages are inspected selectively;
- candidates are classified before deep evaluation;
- provider results are cached by stable input hash;
- discovery tasks are retry-safe;
- candidate domains are deduplicated before repeated evaluation;
- local languages and directory extraction are already considered;
- run counters and iteration records exist.

Current gaps:

- `DiscoveryPlan` contains paths with provider-specific search queries;
- `buildCampaignSearchQueries` sits in shared discovery logic and knows search syntax;
- semantic target segments do not exist;
- provider capabilities and routing do not exist;
- source plans do not distinguish primary, supporting, and verification providers;
- the discovery controller evaluates yield globally rather than by archetype and geography;
- refinement appends generic directory/association/event phrases to previous queries;
- repeated iterations do not reliably close identified coverage gaps;
- raw results, normalized provider candidates, entity groups, and canonical organizations are insufficiently separated;
- database integration later would require reverse-engineering filters from query strings unless this layer is refactored now.

### 4.4 Entity resolution

Current important files and tables:

- `companies`
- `company_domains`
- `company_sources`
- `campaign_companies`
- canonical company resolution RPCs in migrations;
- normalization code inside `src/server/campaign-discovery/service.ts`;
- deterministic domain-based deduplication tests.

Current strengths:

- normalized domain support;
- normalized names;
- campaign-company association separation;
- domain collision state;
- one company can have multiple source records.

Current gaps:

- parent companies, subsidiaries, brands, branches, franchises, country storefronts, and legal entities are not modeled;
- buying organization is not represented;
- procurement autonomy is not represented;
- legal identifiers are not represented;
- entity matches are not versioned or reversible enough;
- merge/split decisions and evidence are not first-class;
- country storefront duplicates can survive into review.

### 4.5 Qualification

Current important files and tables:

- `src/lib/ai/lead-evaluation.ts`
- `src/lib/providers/lead-evaluator.ts`
- qualification helpers in `src/server/campaign-discovery/service.ts`
- `qualification_results`
- `qualification_dimensions`
- `qualification_evidence`
- `src/lib/opptium/domain.ts`
- `src/features/leads/CampaignLeadReview.tsx`

Current strengths:

- qualification is schema-validated;
- sources and evidence are stored;
- facts, inferences, unknowns, and conflicts have some representation;
- confidence is distinct from score;
- qualification failures are persisted;
- campaign-company review decisions are separate from model output.

Current gaps:

- the model directly creates `relevanceScore`;
- dimensions are model-created conclusions rather than deterministic factor outputs;
- relationship classification is not a required first step;
- competitors, suppliers, distributors, buyers, and partners can be mixed in one score space;
- hard exclusions are not enforced before score calculation;
- commercial potential is not separate from fit;
- confidence is a coarse enum rather than evidence-derived calibration;
- critical unknowns and evidence gaps are not handled systematically;
- no comparative reranking detects scoring inversions;
- no explicit review lane assignment based on eligibility, fit, potential, and confidence.

### 4.6 Memory

Current important files and tables:

- `campaign_memories`
- `workspace_memories`
- `src/server/campaign-memories/repository.ts`
- `src/server/campaign-memories/actions.ts`
- Campaign Agent checkpoints;
- guided conversation and applied-change audit records.

Current strengths:

- campaign learnings are persisted;
- proposed memories can be approved or rejected;
- workspace memories are separated from campaign memories;
- conversation history is not canonical workflow state;
- checkpoints support execution continuation.

Current gaps:

- offering scope is absent;
- candidate scope is absent;
- user preference scope is absent;
- applicability conditions are absent;
- hard versus soft behavior is absent;
- provisional rules and promotion proposals are incomplete;
- precedence and conflict resolution are absent;
- application events are not persisted;
- campaign working memory is not clearly separated from durable learning;
- memory retrieval is not task-specific;
- repeated corrections cannot safely propose promotion to broader scope.

### 4.7 Workflow and execution

Current important files:

- `src/trigger/execute-campaign.ts`
- `src/trigger/discover-campaign-companies.ts`
- `src/server/campaign-execution/service.ts`
- `src/server/execution/*`
- `src/server/trigger/*`
- `provider_executions`
- `ai_requests`
- `campaign_runs`
- `campaign_run_events`

Current strengths:

- durable parent/child execution;
- idempotency keys;
- provider-result reuse;
- retry boundaries;
- explicit terminal failure handling;
- campaign pause and cancellation;
- usage settlement;
- model request auditing;
- immutable frozen run context.

Current gaps:

- the deterministic parent still owns a fixed five-iteration model;
- the optional Campaign Agent loop is generic and does not yet operate on V2 discovery segments or coverage gaps;
- planning, searching, normalization, inspection, entity resolution, evaluation, and persistence are concentrated in one large service;
- task-level context compilers are not explicit;
- candidate research and evaluation cannot be independently invalidated and recomputed cleanly;
- comparative ranking is absent;
- V1 and V2 workflow versions are not first-class persisted values.

---

## 5. Refactor Strategy

### 5.1 Build V2 beside V1

Do not modify the live V1 campaign path into a half-V2 state.

Implement V2 behind persisted workflow selection and feature flags.

The initial topology is:

```text
Existing application and infrastructure
├── Intelligence V1
│   ├── current profile schema v2
│   ├── current flat strategy
│   ├── current query/path discovery
│   ├── current holistic qualification
│   └── current result UI
└── Intelligence V2
    ├── Company Intelligence v3
    ├── Campaign Strategy v2
    ├── semantic discovery segments
    ├── provider registry + WebSearchProvider
    ├── coverage-driven discovery
    ├── organization graph resolution
    ├── evidence-factor evaluation
    ├── deterministic scoring
    ├── comparative ranking
    └── scoped memory
```

V1 remains available until V2 passes the gates in Document 08.

### 5.2 Persist workflow versions

Every new durable artifact must identify its workflow/contract version.

At minimum persist:

- profile intelligence contract version;
- campaign strategy contract version;
- discovery workflow version;
- provider adapter version;
- entity-resolution version;
- candidate-intelligence version;
- qualification rubric version;
- scoring version;
- prompt version;
- model configuration;
- comparative-ranking version.

### 5.3 Use adapters between V1 and V2 only at boundaries

Temporary compatibility adapters are allowed for:

- reading an existing V1 profile into a V2 migration draft;
- compiling a V1 campaign into a V2 draft for user review;
- presenting legacy campaign results in the existing UI;
- exporting legacy results.

Do not create indefinite bidirectional synchronization between V1 and V2 objects.

V2 writes V2 records. V1 records remain historical.

---

## 6. Feature Flags and Rollout Controls

### 6.1 Environment-level flags

Add to `.env.example` and validated configuration:

```text
INTELLIGENCE_V2_ENABLED=false
INTELLIGENCE_V2_PROFILE_ENABLED=false
INTELLIGENCE_V2_STRATEGY_ENABLED=false
INTELLIGENCE_V2_DISCOVERY_ENABLED=false
INTELLIGENCE_V2_EVALUATION_ENABLED=false
INTELLIGENCE_V2_RANKING_ENABLED=false
INTELLIGENCE_V2_SHADOW_MODE=false
INTELLIGENCE_V2_WRITE_RESULTS=false
DISCOVERY_PROVIDER_WEB_ENABLED=true
DISCOVERY_PROVIDER_PDL_ENABLED=false
DISCOVERY_PROVIDER_APOLLO_ENABLED=false
DISCOVERY_PROVIDER_CORESIGNAL_ENABLED=false
```

Environment flags are emergency and deployment-level controls.

### 6.2 Workspace rollout settings

Add workspace-level rollout configuration so internal and selected test workspaces can use V2 without enabling it globally.

Suggested setting shape:

```ts
type WorkspaceIntelligenceSettings = {
  profileVersion: "v1" | "v2";
  campaignWorkflow: "v1" | "v2";
  shadowMode: boolean;
  enabledProviders: string[];
  resultWriteMode: "none" | "shadow" | "canonical";
};
```

### 6.3 Campaign-level workflow freeze

When a campaign is created, persist:

- `intelligence_version`;
- `workflow_version`;
- selected profile contract version;
- selected strategy contract version.

A campaign must never switch workflow versions during an active run.

A V1 campaign can be cloned into a V2 campaign draft, but not mutated into V2 in place after research has started.

### 6.4 Run-level workflow freeze

Every Campaign Run must persist its workflow version.

Dispatch must select the Trigger task based on the stored run value, not only an environment variable.

This ensures historical replay and safe rollback.

---

## 7. Target Module Structure

Create coherent V2 modules rather than extending large V1 files indefinitely.

Recommended target structure:

```text
src/lib/intelligence/
├── contracts/
│   ├── claims.ts
│   ├── evidence.ts
│   ├── rules.ts
│   ├── memory.ts
│   ├── versions.ts
│   └── validation.ts
├── context/
│   ├── compile-company-context.ts
│   ├── compile-campaign-context.ts
│   ├── compile-discovery-context.ts
│   ├── compile-candidate-research-context.ts
│   └── compile-candidate-evaluation-context.ts
└── errors.ts

src/lib/company-intelligence/
├── contracts.ts
├── profile-v2-adapter.ts
├── profile-v3-parser.ts
├── business-model.ts
├── offering-decomposition.ts
├── buyer-hypotheses.ts
├── clarification-questions.ts
├── readiness.ts
└── prompts.ts

src/lib/campaign-strategy-v2/
├── contracts.ts
├── objective-model.ts
├── archetypes.ts
├── qualification-policy.ts
├── exclusion-policy.ts
├── source-plan.ts
├── compiler.ts
├── context.ts
└── prompts.ts

src/lib/discovery-v2/
├── contracts.ts
├── provider.ts
├── provider-registry.ts
├── provider-router.ts
├── coverage.ts
├── gap-analysis.ts
├── stopping-policy.ts
├── normalization.ts
├── deduplication.ts
└── providers/
    ├── web-search-provider.ts
    ├── web-query-generator.ts
    ├── pdl-provider.ts
    ├── apollo-provider.ts
    └── coresignal-provider.ts

src/lib/entity-resolution/
├── contracts.ts
├── normalization.ts
├── deterministic-matching.ts
├── probabilistic-matching.ts
├── organization-graph.ts
├── buying-organization.ts
├── merge-policy.ts
└── split-policy.ts

src/lib/candidate-intelligence/
├── contracts.ts
├── research-plan.ts
├── evidence-extraction.ts
├── claim-resolution.ts
├── relationship-assessment.ts
└── prompts.ts

src/lib/qualification-v2/
├── contracts.ts
├── factor-library.ts
├── rubric-compiler.ts
├── exclusion-evaluator.ts
├── eligibility.ts
├── scoring.ts
├── confidence.ts
├── potential.ts
├── lane-assignment.ts
├── consistency-checks.ts
├── comparative-ranking.ts
└── prompts.ts

src/lib/memory-v2/
├── contracts.ts
├── precedence.ts
├── applicability.ts
├── retrieval.ts
├── promotion.ts
├── conflicts.ts
└── context-compiler.ts
```

Server-side services:

```text
src/server/company-intelligence/
src/server/campaign-strategy-v2/
src/server/discovery-v2/
src/server/entity-resolution/
src/server/candidate-intelligence/
src/server/qualification-v2/
src/server/comparative-ranking/
src/server/intelligence-memory/
src/server/intelligence-workflows/
```

Trigger tasks:

```text
src/trigger/v2/
├── analyze-company-intelligence.ts
├── compile-campaign-strategy.ts
├── execute-campaign.ts
├── execute-discovery-segment.ts
├── resolve-candidate-entities.ts
├── research-candidate.ts
├── evaluate-candidate.ts
├── compare-candidates.ts
└── apply-intelligence-correction.ts
```

Do not delete V1 files until V2 is default and legacy removal is approved.

---

## 8. Database Migration Plan

Migration timestamps below are proposed ordering identifiers. At implementation time, use the first unused ordered timestamps while preserving this order.

### Migration 1 — V2 version and rollout foundation

Proposed name:

```text
20260728000100_intelligence_v2_versioning_and_rollout.sql
```

Changes:

- add `intelligence_version` to `company_profile_versions`;
- add `intelligence_version` and `workflow_version` to `campaigns`;
- add `workflow_version` to `campaign_runs`;
- add `contract_versions jsonb` to `campaign_runs`;
- add workspace intelligence settings storage;
- add indexes for workflow-version filtering;
- add constraints that active run versions are immutable;
- add feature-rollout audit events if not already represented adequately.

Backfill:

- existing profile versions → `v1`;
- existing campaigns → `v1`;
- existing runs → `v1`.

No existing behavior changes after this migration.

### Migration 2 — Contract and scoring registries

Proposed name:

```text
20260728000200_intelligence_contract_and_scoring_registry.sql
```

Create:

- `intelligence_contracts`;
- `prompt_versions` or extend existing AI audit registry if already sufficient;
- `workflow_versions`;
- `scoring_versions`;
- `provider_adapters`;
- optional `model_role_assignments` only if existing `ai_model_configs` cannot represent versioned role history.

Do not duplicate `ai_model_configs` unnecessarily.

Use immutable or append-only registry records.

### Migration 3 — Evidence and claims foundation

Proposed name:

```text
20260728000300_intelligence_claims_and_evidence.sql
```

Create:

- `evidence_items`;
- `intelligence_claims`;
- `claim_evidence_links`;
- `claim_conflicts`.

Retain `company_sources` as source/fetch provenance.

`evidence_items` should reference `company_sources`, uploaded-document chunks, provider records, or manually entered evidence.

Backfill only high-confidence existing evidence that can be mapped without inventing semantics.

Do not convert every legacy text field into a confirmed fact.

### Migration 4 — Company Intelligence V3

Proposed name:

```text
20260728000400_company_intelligence_v3.sql
```

Create or extend:

- `company_business_models`;
- `company_business_roles`;
- `company_offerings`;
- `company_offering_versions`;
- `buyer_archetype_hypotheses`;
- `commercial_rules`;
- `profile_clarification_questions` if current `review_questions` JSON is insufficient for workflow state;
- `company_profile_drafts` if draft-versus-published lifecycle cannot be represented safely by current versions.

Keep `company_profile_versions.structured_profile` as the immutable complete snapshot.

Normalized tables support querying, editing, and references. They must be derived from or written atomically with the profile snapshot.

Do not create two independent sources of truth.

### Migration 5 — Campaign Strategy V2

Proposed name:

```text
20260728000500_campaign_strategy_v2.sql
```

Create:

- `campaign_inputs`;
- `campaign_strategy_drafts`;
- `campaign_objectives` or constrained objective fields;
- `campaign_buyer_archetypes`;
- `campaign_qualification_rubrics`;
- `campaign_qualification_factor_definitions`;
- `campaign_rules` or references to unified `commercial_rules`;
- `campaign_strategy_diffs`;
- `campaign_source_plans`.

Extend `campaign_strategy_versions` with:

- `contract_version`;
- `scoring_version_id`;
- `profile_intelligence_version_id`;
- `compiled_context_hash`;
- `confirmation_status`;
- `confirmed_by`;
- `confirmed_at`.

The full immutable strategy remains stored in `strategy jsonb`.

### Migration 6 — Scoped memory V2

Proposed name:

```text
20260728000600_scoped_intelligence_memory.sql
```

Create unified:

- `intelligence_memories`;
- `memory_evidence_links`;
- `memory_application_events`;
- `memory_promotion_proposals`;
- `intelligence_conflicts`;
- `campaign_memory_snapshots`.

Required fields include:

- scope;
- scope record ID;
- kind;
- statement;
- applicability;
- strength;
- status;
- origin;
- confidence;
- source campaign/run/correction;
- superseded memory ID;
- expiry where appropriate.

Backfill:

- `campaign_memories` → campaign-scoped memories;
- `workspace_memories` → workspace-scoped memories;
- preserve approval state and origin;
- default applicability to unknown rather than global unconditional behavior.

Keep legacy memory tables read-only until V2 cutover is complete.

### Migration 7 — Discovery segments and provider records

Proposed name:

```text
20260728000700_discovery_segments_and_provider_records.sql
```

Create:

- `discovery_segments`;
- `discovery_source_plans`;
- `discovery_provider_capability_snapshots`;
- `discovery_segment_runs`;
- `provider_source_records`;
- `normalized_provider_candidates`;
- `campaign_candidate_discovery_links`;
- `discovery_coverage_snapshots`;
- `discovery_gap_decisions`.

Extend existing:

- `discovery_plans` with contract/workflow version;
- `discovery_iterations` with pass type and gap target;
- `provider_executions` with optional segment-run association;
- `discovery_queries` or existing query records with provider adapter version.

Do not store provider-specific filters in semantic segment fields.

Provider-specific request payload belongs to provider execution or provider source records.

### Migration 8 — Organization graph and entity decisions

Proposed name:

```text
20260728000800_organization_graph_and_entity_resolution.sql
```

Reuse `companies` as the canonical workspace organization table unless a later migration proves a rename is worth the risk.

Extend `companies` with:

- organization kind;
- canonical legal name;
- legal identifiers;
- active/inactive state;
- headquarters location;
- entity-resolution version;
- primary buying organization ID where known;
- procurement autonomy status and confidence.

Create:

- `organization_names`;
- `organization_identifiers`;
- `organization_locations`;
- `organization_relationships`;
- `organization_match_candidates`;
- `organization_merge_events`;
- `organization_split_events`;
- `organization_buying_hypotheses`.

Existing `company_domains` remains and is extended rather than replaced.

All automatic merges must be reversible.

### Migration 9 — Candidate Intelligence versions

Proposed name:

```text
20260728000900_candidate_intelligence_versions.sql
```

Create:

- `candidate_research_plans`;
- `candidate_research_tasks`;
- `candidate_intelligence_versions`;
- `candidate_claims` or links to unified `intelligence_claims`;
- `campaign_candidate_claims`;
- `candidate_memories` only if unified `intelligence_memories` cannot represent candidate scope cleanly.

Extend `campaign_companies` with:

- relationship status;
- eligibility status;
- review lane;
- current candidate intelligence version ID;
- current evaluation version ID;
- matched archetype ID;
- buying organization ID;
- duplicate/merged target ID;
- V2 status constraints.

### Migration 10 — Evaluation, scoring, and ranking V2

Proposed name:

```text
20260728001000_candidate_evaluation_and_ranking_v2.sql
```

Create:

- `candidate_evaluation_versions`;
- `candidate_relationship_assessments`;
- `candidate_exclusion_assessments`;
- `candidate_eligibility_decisions`;
- `candidate_factor_evaluations`;
- `candidate_score_traces`;
- `candidate_review_lane_assignments`;
- `comparative_ranking_runs`;
- `comparative_ranking_items`;
- `consistency_findings`.

Legacy `qualification_results`, `qualification_dimensions`, and `qualification_evidence` remain readable for V1 campaigns.

Do not write V2 evaluations into the legacy holistic schema.

### Migration 11 — V2 workflow, commands, and invalidation

Proposed name:

```text
20260728001100_intelligence_v2_workflow_and_invalidation.sql
```

Create or extend:

- `intelligence_workflow_runs` only if `campaign_runs` cannot represent all V2 subworkflow needs;
- `intelligence_task_runs`;
- `workflow_checkpoints`;
- `workflow_commands`;
- `invalidation_events`;
- `recomputation_jobs`.

Prefer extending existing generic execution tables where semantics match.

Do not duplicate `provider_executions`, `ai_requests`, or usage ledgers without a clear need.

### Migration 12 — V2 RLS, indexes, RPCs, and backfill functions

Proposed name:

```text
20260728001200_intelligence_v2_rls_indexes_and_rpcs.sql
```

Add:

- RLS policies for all tenant-owned tables;
- service-role restrictions for operational writes;
- composite tenant foreign-key checks;
- idempotency constraints;
- partial indexes for active tasks and current versions;
- atomic publish/confirm RPCs;
- profile snapshot creation RPC updates;
- strategy confirmation RPC;
- candidate merge/split RPCs;
- evaluation current-version switch RPC;
- memory promotion RPC;
- safe V1-to-V2 draft backfill functions.

Add pgTAP tests before enabling any V2 writes.

---

## 9. Company Intelligence Refactor

### 9.1 Contract version

Introduce `StructuredCompanyProfileV3` rather than mutating the V2 parser in place.

Create:

- `src/lib/company-intelligence/contracts.ts`
- `src/lib/company-intelligence/profile-v3-parser.ts`
- `src/lib/company-intelligence/profile-v2-adapter.ts`

The profile snapshot must include:

- identity;
- value-chain position;
- business model;
- business roles;
- commercial mechanics;
- offerings;
- offering buyer logic;
- relationship hypotheses;
- reusable buyer archetype hypotheses;
- commercial rules;
- claims and evidence references;
- important uncertainties;
- source coverage;
- readiness.

### 9.2 Existing file treatment

`src/lib/company-profile/structured-profile.ts`

- retain for V1 parsing and compatibility;
- extract shared primitives only where safe;
- do not add all V3 behavior to this already-large file;
- mark V2 types as legacy after V3 is stable.

`src/lib/ai/company-profile-analysis.ts`

- retain V1 implementation;
- move V2 prompt work into `src/lib/company-intelligence/prompts.ts`;
- split extraction, synthesis, and clarification into separate tasks;
- stop generating one monolithic profile directly from raw sources.

`src/server/company-profile/analysis-service.ts`

- add workflow-version dispatch;
- V1 calls existing analysis;
- V2 dispatches Company Intelligence parent workflow.

`src/trigger/analyze-company-profile.ts`

- retain task ID for V1;
- add `src/trigger/v2/analyze-company-intelligence.ts`;
- route new V2 profile analyses by profile workflow version.

### 9.3 V2 profile workflow

```text
profile ingest
→ fetch/select evidence
→ extract factual claims
→ resolve identity and value-chain position
→ synthesize business model and commercial mechanics
→ decompose offerings
→ generate buyer logic and archetype hypotheses
→ detect conflicts and high-impact unknowns
→ generate clarification questions
→ save draft intelligence version
→ user review
→ publish immutable version
```

Each task persists its output before the next task runs.

### 9.4 Profile UI transition

Modify:

- `CompanyProfileWorkspace.tsx`
- `CompanyGuidedSetup.tsx`
- profile page composition.

Add V2 sections from Document 07.

Keep a temporary legacy viewer for V1 profiles.

Profile analysis completion must not block on campaign-specific market, buyer-persona, or qualification questions.

### 9.5 Profile acceptance gate

Do not enable V2 campaign creation until:

- at least one active offering exists;
- business model and commercial mechanics are usable;
- buyer logic is present for the selected offering;
- all blocking identity conflicts are resolved;
- claims used as facts have evidence or user confirmation;
- benchmark profile acceptance targets pass.

---

## 10. Campaign Strategy Refactor

### 10.1 Replace the flat strategy contract

Create `CampaignStrategyV2` in:

- `src/lib/campaign-strategy-v2/contracts.ts`.

It must include:

- structured objective;
- structured geography;
- selected offering reference;
- campaign offer variant;
- compiled commercial context;
- market interpretation;
- priority, conditional, and incompatible archetypes;
- required evidence questions;
- relationship policy;
- scoped exclusion rules;
- qualification rubric;
- source plan;
- discovery segments;
- assumptions and uncertainties;
- memory snapshot reference;
- stop policy;
- contract/scoring/workflow versions.

### 10.2 Existing file treatment

`src/lib/campaign-workflow/contracts.ts`

- retain V1 contracts;
- add a V1-to-V2 campaign draft adapter;
- do not extend `CampaignTargetClient` into an unstructured catch-all.

`src/lib/ai/strategy-generation.ts`

- retain for V1;
- V2 uses a strategy compiler with narrower staged tasks;
- do not ask one model call to populate every V2 field without validation stages.

`src/lib/campaign-workflow/market-planning.ts`

- retain V1 market-planning parser;
- move V2 market interpretation into campaign-strategy compilation before discovery;
- V2 discovery plan contains semantic segments, not final Tavily query strings.

### 10.3 Campaign creation workflow

Implement:

```text
geography
→ objective
→ offering
→ AI target hypothesis
→ user adjustments
→ campaign constraints and exclusions
→ compile market strategy
→ show archetypes, rules, rubric, source plan, and assumptions
→ user confirms strategy
→ create Campaign Run
→ start discovery
```

The Start action must not create a run until the strategy is confirmed.

### 10.4 Strategy revisions

A confirmed Strategy version is immutable.

Changing:

- objective;
- geography;
- offering;
- archetypes;
- exclusion policy;
- rubric;
- source plan;

creates a new version.

Active runs remain frozen.

### 10.5 Strategy UI

Refactor `StrategyWorkspace.tsx` into a V2 review experience while preserving a V1 viewer.

Do not expose raw JSON or prompt details as the primary interface.

Show:

- target logic;
- why each archetype is relevant;
- required buying compatibility;
- exclusions and their scope;
- evidence requirements;
- source plan;
- uncertainties;
- confirmation state.

---

## 11. Scoped Memory Refactor

### 11.1 Unified memory service

Create:

- `src/lib/memory-v2/contracts.ts`
- `src/lib/memory-v2/precedence.ts`
- `src/lib/memory-v2/applicability.ts`
- `src/lib/memory-v2/retrieval.ts`
- `src/lib/memory-v2/promotion.ts`
- `src/server/intelligence-memory/repository.ts`
- `src/server/intelligence-memory/service.ts`
- `src/server/intelligence-memory/actions.ts`

### 11.2 Memory scopes

Support:

- user;
- workspace/company;
- offering;
- campaign;
- candidate.

### 11.3 Campaign working memory

Persist current-run working state separately from durable commercial knowledge:

- executed segments;
- attempted queries;
- coverage state;
- failed sources;
- candidate research gaps;
- active strategy adjustments;
- user corrections;
- stopping decisions.

This can be represented through workflow, discovery, and correction tables rather than duplicating all state as generic memory statements.

### 11.4 Promotion flow

A campaign correction defaults to campaign scope.

The system may create a promotion proposal to:

- offering scope;
- workspace scope;
- candidate scope.

Promotion requires:

- explicit user confirmation; or
- a clearly defined repeated-correction threshold followed by user confirmation.

Never silently promote a campaign exclusion globally.

### 11.5 Precedence

Implement deterministic precedence:

1. explicit current campaign instruction;
2. confirmed candidate-specific rule;
3. confirmed offering rule;
4. confirmed workspace rule;
5. provisional relevant memories;
6. AI hypotheses.

Specific applicability overrides broader applicability without deleting the broader rule.

---

## 12. Provider Abstraction and WebSearchProvider

### 12.1 Preserve Tavily transport

`src/lib/providers/tavily.ts` remains a transport adapter.

It should not know:

- campaign archetype semantics;
- scoring policy;
- memory;
- entity resolution;
- qualification.

### 12.2 Introduce provider contract

Create:

- `src/lib/discovery-v2/provider.ts`
- `src/lib/discovery-v2/provider-registry.ts`
- `src/lib/discovery-v2/provider-router.ts`

Initial interface:

```ts
interface CompanyDiscoveryProvider {
  id: string;
  version: string;
  getCapabilities(): DiscoveryProviderCapabilities;
  estimate(request: DiscoveryProviderRequest): Promise<DiscoveryEstimate>;
  search(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult>;
}
```

### 12.3 WebSearchProvider

Create:

- `src/lib/discovery-v2/providers/web-search-provider.ts`
- `src/lib/discovery-v2/providers/web-query-generator.ts`

Move query construction into this provider.

The provider receives semantic segments and produces:

- query families;
- localized terms;
- source-specific query forms;
- provider requests;
- normalized provider candidates;
- immutable provider source records.

### 12.4 Existing file treatment

`src/lib/discovery/query-builder.ts`

- retain for V1;
- do not call it from V2;
- later mark deprecated.

`src/lib/discovery/iteration-refinement.ts`

- retain for V1 only;
- V2 uses gap analysis and segment-level next-action decisions;
- delete only after V1 removal.

### 12.5 Future database provider integration

Later PDL, Apollo, or Coresignal integration must require only:

- provider adapter;
- capability mapping;
- semantic segment-to-filter translation;
- response normalization;
- provider benchmark and commercial-use approval;
- source-routing configuration.

No change to:

- Company Intelligence;
- Campaign Strategy;
- canonical candidate schema;
- entity resolution;
- qualification;
- result UI.

This boundary is mandatory now even though only WebSearchProvider is enabled.

---

## 13. Coverage-Driven Discovery Refactor

### 13.1 Replace fixed generic iteration logic

V2 discovery is controlled by coverage state.

The controller evaluates coverage for each combination of:

- archetype;
- geography;
- provider/source type;
- optional size or market subsegment.

### 13.2 Discovery pass lifecycle

```text
load confirmed strategy
→ load campaign memory snapshot
→ create semantic segments
→ route segments to providers
→ execute breadth discovery
→ persist provider source records
→ normalize provider candidates
→ perform preliminary duplicate suppression
→ resolve canonical organizations
→ prefilter obvious ineligible candidates
→ research plausible candidates
→ evaluate candidates
→ update coverage and yield
→ identify specific gaps
→ run targeted segment passes when justified
→ stop
```

### 13.3 Stopping policy

Stop when any required condition is met:

- requested qualified volume reached;
- archetype/geography coverage sufficient;
- marginal qualified yield below threshold;
- market appears exhausted;
- run ceiling reached;
- user pauses or cancels;
- provider failure makes further work unproductive;
- budget/credit policy later requires stopping.

Do not stop solely because an arbitrary iteration number was reached, though a maximum pass ceiling remains a safety guard.

### 13.4 Service decomposition

The current `src/server/campaign-discovery/service.ts` is too broad.

Create V2 services:

- `plan-discovery.ts`
- `route-segments.ts`
- `execute-segment.ts`
- `persist-provider-records.ts`
- `normalize-candidates.ts`
- `update-coverage.ts`
- `analyze-gaps.ts`
- `decide-next-pass.ts`

Do not rewrite the V1 service until V2 is ready.

### 13.5 Progress counters

Define counters once and use identical meanings in DB, API, and UI:

- provider records retrieved;
- normalized provider candidates;
- unique candidate groups;
- canonical organizations;
- candidates prefiltered;
- candidates researched;
- candidates evaluated;
- eligible candidates;
- recommended candidates;
- conditional candidates;
- research-needed candidates;
- rejected candidates;
- excluded candidates;
- invalid entities;
- duplicates/merged entities.

Do not label all of these as “leads.”

---

## 14. Entity Resolution Refactor

### 14.1 Canonical organization model

Keep the existing `companies` table as the current canonical organization root to minimize migration risk.

Add organization graph tables around it.

### 14.2 Matching stages

Implement in this order:

1. normalized domain exact match;
2. legal identifier exact match;
3. canonical URL and redirect match;
4. exact normalized name plus country;
5. name, address, phone, and source correlation;
6. parent/subsidiary/brand/storefront inference;
7. manual review for ambiguous cases.

### 14.3 Merge policy

Automatic merge is allowed only for high-confidence deterministic matches.

Possible but uncertain matches remain separate with an ambiguity record.

### 14.4 Buying organization

For every plausible campaign candidate, determine where possible:

- legal entity;
- operating brand;
- local branch/storefront;
- parent group;
- probable buying organization;
- procurement autonomy.

Unknown procurement autonomy reduces confidence. It does not automatically exclude the candidate.

### 14.5 Merge/split UI

Add internal or user-facing review actions for:

- merge duplicate entities;
- split incorrectly merged entities;
- choose parent buying organization;
- retain country storefronts as child entities without treating them as independent leads.

All decisions must be auditable and reversible.

---

## 15. Candidate Intelligence Refactor

### 15.1 Reusable versus campaign-specific data

Reusable Candidate Intelligence stores:

- identity;
- organization graph;
- business model;
- offerings;
- customers;
- markets;
- size and footprint;
- public evidence;
- freshness;
- ownership and parent relationships.

Campaign-specific evaluation stores:

- relationship to selected offering/objective;
- eligibility;
- exclusion assessment;
- fit factors;
- commercial potential;
- confidence;
- review lane;
- missing evidence.

### 15.2 Research plans

Candidate research must be question-driven.

The campaign rubric compiles research questions such as:

- Does this organization consume, resell, distribute, integrate, or compete with the offering?
- Is its business model compatible with the transaction model?
- Does it have purchasing authority?
- Is procurement local or centralized?
- Does it show the required operational capability?
- Is the candidate a valid operating company rather than a directory or marketplace page?

### 15.3 Research depth

Use progressive research:

1. provider snippet and metadata;
2. first-party homepage;
3. relevant first-party product/service/about/contact pages;
4. parent or group pages;
5. trusted directories or registries;
6. targeted verification only for unresolved critical factors.

Do not deeply research candidates already excluded deterministically.

### 15.4 Evidence extraction

Model tasks extract typed evidence states.

They do not assign final holistic scores.

Every material factor result must link to evidence or be marked unknown.

---

## 16. Qualification and Scoring Refactor

### 16.1 Required order

Qualification must run in this order:

1. validate entity;
2. classify relationship;
3. evaluate hard exclusions;
4. decide eligibility;
5. evaluate factor evidence;
6. calculate fit deterministically;
7. calculate commercial potential separately;
8. calculate confidence from evidence coverage and quality;
9. assign review lane;
10. run consistency checks;
11. run comparative ranking for plausible candidates.

### 16.2 Replace direct LLM score generation

`src/lib/ai/lead-evaluation.ts` remains V1 only.

Create V2 modules:

- factor extractor prompt;
- relationship assessment prompt;
- evidence resolver;
- deterministic scoring engine;
- confidence engine;
- potential engine;
- lane assignment;
- consistency checks.

### 16.3 Deterministic score trace

Every score must be reproducible from persisted inputs:

```text
factor definition
+ factor weight
+ observed state
+ evidence strength
+ factor confidence
+ criticality policy
+ scoring version
= factor contribution
```

Store the trace.

### 16.4 Unknown handling

Unknown factors:

- reduce confidence;
- may block recommendation when critical;
- do not automatically contribute a negative value equivalent to confirmed incompatibility.

### 16.5 Hard exclusions

Hard exclusion produces:

- relationship;
- exclusion match;
- evidence;
- eligibility `excluded`;
- no meaningful fit score.

Do not present excluded companies as weak-fit buyers.

### 16.6 Review lanes

V2 lanes:

- recommended;
- conditional;
- research needed;
- rejected;
- excluded;
- invalid entity;
- duplicate/merged.

User approval/rejection remains a separate human decision.

### 16.7 Comparative ranking

After individual evaluation:

- group plausible candidates by campaign and batch;
- provide only persisted evidence and factor outputs to the comparison model;
- detect scoring inversions;
- identify inconsistent assessments;
- propose ranking changes;
- persist comparative results;
- never let ranking invent new facts.

---

## 17. Trigger.dev V2 Workflow

### 17.1 New V2 parent task

Create:

```text
src/trigger/v2/execute-campaign.ts
```

Task ID:

```text
execute-campaign-v2
```

Do not replace `execute-campaign` until rollout completion.

### 17.2 V2 parent stages

```text
validate frozen context
→ load confirmed strategy and memory snapshot
→ initialize discovery coverage
→ execute initial segment batch
→ normalize and resolve entities
→ prefilter
→ research and evaluate plausible candidates
→ update coverage and gap state
→ execute targeted gap batches as required
→ run deterministic consistency checks
→ run comparative ranking
→ finalize review lanes
→ persist optional-enrichment gate
```

### 17.3 Child task boundaries

Create child tasks for independently retryable paid or failure-prone operations:

- execute discovery segment;
- fetch/inspect company evidence;
- resolve entity batch;
- research candidate;
- evaluate candidate factor batch;
- comparative ranking batch.

### 17.4 Idempotency keys

Examples:

```text
profile-v3-analysis:{profileVersionId}:{contractVersion}
strategy-v2-compile:{strategyDraftId}:{inputHash}
discovery-segment:{segmentRunId}:{providerId}:{adapterVersion}
entity-resolution:{candidateGroupId}:{resolverVersion}
candidate-research:{candidateId}:{researchPlanVersion}:{evidenceFreshnessHash}
candidate-evaluation:{campaignCandidateId}:{rubricVersion}:{evidenceHash}
comparative-ranking:{campaignRunId}:{rankingVersion}:{candidateSetHash}
```

### 17.5 Pause and resume

Pause is observed at safe boundaries:

- before new provider execution;
- before deep research batches;
- before evaluation batches;
- before comparative ranking.

Completed paid work is never repeated on resume when the input hash is unchanged.

### 17.6 Strategy changes

A running V2 campaign cannot silently consume a revised Strategy version.

The user must:

- pause/cancel the current run;
- create a new Strategy version;
- start a new run.

### 17.7 Campaign Agent treatment

The existing optional Campaign Agent loop remains disabled for V2 initially.

Do not make V2 depend on it.

After deterministic V2 is stable, the loop may be adapted to propose typed segment/gap actions. It must not bypass:

- confirmed strategy;
- provider capabilities;
- execution ceilings;
- deterministic scoring;
- user gates.

---

## 18. Server Actions and Repository Boundaries

### 18.1 Actions

Server actions must:

- derive workspace context server-side;
- validate contract versions;
- validate expected current version IDs;
- call domain services;
- never call providers directly;
- never calculate scores in route components;
- never trust client-supplied scope or workspace ownership.

### 18.2 Repositories

Repositories own persistence only.

Do not embed prompts, scoring logic, provider routing, or UI shaping in repository modules.

### 18.3 Read models

Create V2 read-model functions for:

- profile review;
- strategy review;
- campaign run overview;
- coverage matrix;
- discovery audit;
- candidate list lanes;
- candidate detail/evidence;
- memory/rule review;
- entity relationships;
- ranking explanations.

Do not force UI components to assemble raw normalized tables directly.

---

## 19. UI Implementation Order

### Stage 1 — Invisible foundations

No major visible change.

Implement:

- version fields;
- registries;
- V2 contracts;
- feature flags;
- V2 read/write repositories;
- tests.

### Stage 2 — Company Profile V3

Implement V2 profile analysis and review behind a workspace flag.

Existing V1 campaigns remain usable.

### Stage 3 — Campaign Strategy V2

Implement new campaign creation and strategy review for V2 workspaces.

Do not start V2 discovery yet unless the strategy compiler and persistence gates pass.

### Stage 4 — Discovery V2 internal/shadow

Run V2 discovery without making V2 results canonical.

Display internal comparison only.

### Stage 5 — Candidate evaluation V2

Enable V2 result lanes for internal campaigns.

Keep contact enrichment disabled until a candidate is explicitly approved.

### Stage 6 — Comparative ranking and memory

Add ranking explanations, campaign corrections, and promotion proposals.

### Stage 7 — Default V2

Enable for new campaigns after benchmark and production gates pass.

Legacy campaigns remain readable.

---

## 20. API and Route Changes

### 20.1 Existing routes retained

Retain:

- `/company-profile`
- `/campaigns`
- `/campaigns/new`
- `/campaigns/[id]`
- `/campaigns/[id]/market-analysis`
- `/campaigns/[id]/strategy`
- `/campaigns/[id]/discovery`
- `/campaigns/[id]/leads`
- `/campaigns/[id]/outreach`
- `/leads/companies`
- `/leads/contacts`
- `/usage`
- `/settings`

### 20.2 Route behavior additions

Add V2-aware behavior based on persisted campaign/profile workflow version.

Do not choose UI mode only from current environment flags.

### 20.3 Progress APIs

Existing progress APIs may remain but must use V2 counter definitions when the active run is V2.

Prefer a versioned response:

```ts
type CampaignProgressResponse =
  | { workflowVersion: "v1"; progress: V1Progress }
  | { workflowVersion: "v2"; progress: V2Progress };
```

### 20.4 Candidate correction APIs

Add explicit actions for:

- relationship correction;
- exclusion correction;
- entity merge/split;
- buying-organization correction;
- factor evidence correction;
- review lane override;
- memory scope selection;
- promotion proposal acceptance/rejection.

Every correction creates an audit event and appropriate invalidation event.

---

## 21. Existing File Action Matrix

### 21.1 Keep unchanged initially

- authentication and workspace modules;
- Supabase clients and service-role boundaries;
- marketing pages;
- public routes;
- CSV export shaping;
- outreach draft generation;
- contact-enrichment flow;
- general UI primitives;
- Trigger dispatch recovery;
- provider result cache;
- model router and OpenRouter transport;
- Tavily transport.

### 21.2 Modify

- `.env.example`
- `README.md`
- `AGENTS.md` only where terminology changes are required;
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/AI_PIPELINE.md`
- `docs/DOMAIN_MODEL.md`
- `src/lib/ai/model-roles.ts`
- `src/lib/ai/model-registry.ts`
- `src/server/company-profile/analysis-service.ts`
- `src/server/campaigns/actions.ts`
- `src/server/campaigns/repository.ts`
- `src/server/campaign-strategy/actions.ts`
- `src/server/campaign-strategy/repository.ts`
- `src/server/trigger/dispatch.ts`
- progress route/read models;
- profile, campaign, strategy, discovery, and leads UI components;
- database types generation output.

### 21.3 Retain as V1 compatibility

- `src/lib/company-profile/structured-profile.ts`
- `src/lib/ai/company-profile-analysis.ts`
- `src/lib/campaign-workflow/contracts.ts`
- `src/lib/ai/strategy-generation.ts`
- `src/lib/campaign-workflow/market-planning.ts`
- `src/lib/discovery/query-builder.ts`
- `src/lib/discovery/iteration-refinement.ts`
- `src/lib/ai/candidate-classification.ts`
- `src/lib/ai/lead-evaluation.ts`
- `src/server/campaign-discovery/service.ts`
- `src/trigger/execute-campaign.ts`
- `src/trigger/discover-campaign-companies.ts`

### 21.4 Deprecate after V2 default

- V1 profile analysis path;
- V1 campaign brief proposal;
- V1 flat strategy editor;
- V1 discovery query builder;
- V1 fixed refinement loop;
- V1 holistic qualification writes;
- V1 memory write actions;
- V1 Campaign Agent integration if not adapted to V2 contracts.

### 21.5 Delete only after legacy freeze and migration proof

Deletion requires:

- no new V1 campaigns;
- historical V1 campaigns readable through stable legacy read models;
- exports still reproducible;
- V2 default stable for the agreed observation period;
- explicit accepted removal decision;
- final migration and rollback plan.

---

## 22. Model Roles Required by V2

Extend `ModelRole` with narrowly scoped roles where needed:

```text
company_fact_extraction
company_business_model_synthesis
company_offering_synthesis
buyer_hypothesis_generation
clarification_question_generation
market_interpretation
campaign_strategy_compilation
search_query_generation
candidate_snippet_classification
candidate_evidence_extraction
candidate_relationship_assessment
candidate_factor_assessment
candidate_verification
comparative_ranking
memory_rule_proposal
```

Do not necessarily assign a unique model to every role initially.

Logical roles provide independent prompt, timeout, audit, fallback, and future routing control.

The existing broad roles remain for V1.

---

## 23. Prompt and Schema Treatment

The exact V2 task prompts and schemas belong in Document 10.

Implementation rules now:

- no new V2 prompt should be embedded in route or repository code;
- each prompt has a version constant;
- each structured response has a parser/schema;
- prompts receive compiled task-specific context;
- prompts do not receive full campaign history by default;
- models return evidence-linked conclusions;
- models return unknown when evidence is insufficient;
- models do not assign final fit score;
- models do not promote memory scope;
- model repair is bounded;
- all model calls are logged through existing audit infrastructure.

---

## 24. Backfill and Existing Data

### 24.1 Existing Company Profiles

Do not automatically mark V1 profile content as confirmed V2 knowledge.

Create a V2 migration draft that:

- maps known identity and offering fields;
- preserves source references;
- labels unsupported buyer logic as hypothesis or unknown;
- generates missing commercial mechanics;
- asks only high-impact clarification questions;
- requires user publication before V2 campaign use.

### 24.2 Existing campaigns

Existing V1 campaigns remain V1.

Offer:

- “Create V2 campaign from this campaign”;
- prefill geography, objective text, selected offering, and known constraints;
- compile a new V2 Strategy draft;
- require user confirmation.

### 24.3 Existing companies and sources

Existing `companies`, `company_domains`, and `company_sources` may seed organization records.

Do not infer parent/buying relationships without evidence.

### 24.4 Existing qualifications

Legacy qualifications remain historical V1 results.

They may be used as benchmark examples or user feedback, but not converted directly into V2 factor evaluations.

### 24.5 Existing memory

Backfill approved memories with their original scope only.

Campaign memories remain campaign-scoped.

Workspace memories become workspace-scoped but should receive conservative applicability metadata.

---

## 25. Invalidation and Recomputation

### 25.1 Changes that invalidate candidate evaluation

Invalidate when:

- Strategy version changes;
- qualification rubric changes;
- exclusion rule changes;
- candidate entity is merged or split;
- buying organization changes;
- material evidence changes;
- relationship correction occurs;
- scoring version changes.

### 25.2 Changes that do not require new web research

Recompute from saved evidence when:

- weights change;
- lane thresholds change;
- a soft rule changes;
- comparative ranking version changes;
- user corrects a relationship using existing evidence.

### 25.3 Changes that require targeted research

Research again when:

- critical evidence is missing;
- evidence is stale beyond policy;
- parent/procurement structure is unresolved;
- a merge exposes a new canonical domain;
- user disputes a material fact;
- verification model flags source conflict.

### 25.4 Never rerun the entire campaign by default

Use selective recomputation and targeted gap discovery.

---

## 26. Testing Plan by Layer

### 26.1 Contract tests

Add tests for:

- every V2 parser;
- schema rejection;
- unknown handling;
- rule scope and applicability;
- memory precedence;
- objective-relative relationships;
- deterministic scoring;
- confidence calculation;
- provider normalization;
- version compatibility.

### 26.2 Migration tests

Add contract tests for every migration and pgTAP coverage for:

- RLS;
- cross-workspace isolation;
- composite tenant foreign keys;
- current-version integrity;
- immutable confirmed versions;
- idempotency;
- merge/split safety;
- memory promotion;
- run workflow freeze.

### 26.3 Provider contract tests

WebSearchProvider tests must cover:

- semantic segment translation;
- local-language query generation;
- no seller-company leakage;
- provider timeout behavior;
- normalization;
- duplicate provider records;
- directory result handling;
- unsupported capability behavior.

### 26.4 Workflow tests

Test:

- pause and resume;
- cancellation;
- retry after provider failure;
- idempotent child execution;
- partial success;
- gap-driven continuation;
- no repeated paid work;
- strategy freeze;
- selective invalidation;
- comparative ranking failure without losing individual evaluations.

### 26.5 Benchmark tests

Implement the benchmark portfolio from Document 08.

Do not rely only on the existing pharmaceutical fixture.

At minimum include:

- SaaS direct buyer;
- industrial distributor search;
- wholesaler-to-retailer campaign;
- agency service campaign;
- marketplace partner campaign;
- logistics campaign;
- cybersecurity campaign;
- local business case;
- deceptive competitor/supplier/brand-owned false positives;
- parent/storefront duplicates.

### 26.6 End-to-end tests

Extend `tests/e2e/campaign-workflow.spec.ts` with V2 paths behind test configuration.

Keep V1 E2E coverage until legacy removal.

---

## 27. Required Verification Commands

Every work package must run the narrowest relevant checks.

Before merge of a V2 phase:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

When database behavior changes:

```bash
supabase start
corepack pnpm test:db
supabase stop --no-backup
```

When user journey changes:

```bash
corepack pnpm test:e2e
```

When discovery or evaluation changes:

```bash
corepack pnpm test:discovery-quality
```

Add a dedicated V2 benchmark command, for example:

```bash
corepack pnpm test:intelligence-v2
```

Never claim a command passed unless it was run.

---

## 28. Codex Work Packages

Each package should be implemented as one focused branch or a small sequence of reviewable commits.

### WP-00 — Freeze baseline and add documentation

Scope:

- add Documents 00–10 to `docs/intelligence-v2/`;
- update documentation map;
- record baseline commit;
- add no runtime behavior.

Gate:

- documentation links valid;
- no contradictory current docs left unmarked.

### WP-01 — Workflow version and feature-flag foundation

Scope:

- Migration 1;
- environment flags;
- workspace rollout settings;
- run workflow-version freeze;
- version-aware dispatch skeleton;
- tests.

No V2 business behavior yet.

### WP-02 — Intelligence contract primitives

Scope:

- claims;
- evidence;
- rules;
- memory;
- version contracts;
- parser helpers;
- contract registry migration;
- tests.

### WP-03 — Evidence and claim persistence

Scope:

- Migration 3;
- evidence repository;
- claim repository;
- conflict handling;
- source linkage;
- RLS and tests.

### WP-04 — Company Intelligence V3 contracts and V1 adapter

Scope:

- V3 profile schema;
- V2-to-V3 adapter;
- readiness logic;
- commercial mechanics;
- buyer logic;
- rules;
- tests.

No provider calls yet.

### WP-05 — Company Intelligence V3 workflow

Scope:

- staged profile tasks;
- prompt contracts from Document 10;
- Trigger parent/children;
- draft persistence;
- idempotency;
- AI audit;
- fixture tests.

### WP-06 — Company Profile V3 UI

Scope:

- V2 profile review;
- facts/assumptions/unknowns;
- offerings and buyer logic;
- rules;
- clarification questions;
- publish flow;
- V1 viewer fallback;
- E2E test.

### WP-07 — Campaign Strategy V2 contracts

Scope:

- objective model;
- geography;
- offer variant;
- archetypes;
- rules;
- rubric;
- source plan;
- semantic segments;
- V1 campaign adapter;
- tests.

### WP-08 — Campaign Strategy V2 persistence and compiler

Scope:

- Migration 5;
- context compiler;
- market interpretation;
- strategy compilation;
- confirmation transaction;
- versioning;
- audit;
- tests.

### WP-09 — Campaign creation and Strategy V2 UI

Scope:

- geography-first wizard;
- objective and offering;
- AI hypothesis;
- constraints and scoped exclusions;
- strategy compile progress;
- strategy review;
- explicit confirm/start;
- V1/V2 routing;
- E2E test.

### WP-10 — Scoped memory V2

Scope:

- Migration 6;
- precedence;
- retrieval;
- campaign snapshots;
- application events;
- promotion proposals;
- correction actions;
- tests.

### WP-11 — Discovery provider contracts

Scope:

- provider interface;
- capability model;
- provider registry;
- provider router;
- normalized result contract;
- immutable provider source record persistence;
- tests.

### WP-12 — WebSearchProvider

Scope:

- move V2 query generation inside provider;
- local-language and source-family generation;
- Tavily transport use;
- normalization;
- provider estimates;
- provider-specific audit;
- tests.

### WP-13 — Semantic discovery plan and coverage

Scope:

- Migration 7;
- segment generation;
- source plan routing;
- segment runs;
- coverage matrix;
- gap analysis;
- stopping policy;
- tests.

### WP-14 — Organization graph and entity resolution

Scope:

- Migration 8;
- organization graph;
- matching pipeline;
- merge/split;
- buying organization;
- procurement autonomy;
- tests and fixtures.

### WP-15 — Candidate research and reusable intelligence

Scope:

- Migration 9;
- research-plan compiler;
- first-party evidence fetch;
- claim extraction;
- freshness;
- reusable Candidate Intelligence version;
- tests.

### WP-16 — Qualification V2 factor engine

Scope:

- relationship classification;
- exclusion evaluation;
- eligibility;
- factor library;
- factor extraction;
- deterministic fit;
- potential;
- confidence;
- score trace;
- lane assignment;
- tests.

### WP-17 — Comparative ranking and consistency checks

Scope:

- Migration 10 ranking records;
- deterministic inversion checks;
- comparative model task;
- ranking persistence;
- failure isolation;
- tests.

### WP-18 — V2 Campaign Trigger workflow

Scope:

- Migration 11 where required;
- `execute-campaign-v2`;
- child tasks;
- checkpointing;
- pause/resume/cancel;
- usage settlement;
- progress aggregation;
- workflow tests.

### WP-19 — V2 campaign results UI

Scope:

- coverage view;
- discovery audit;
- result lanes;
- fit/potential/confidence columns;
- expanded evidence/factors;
- relationship and eligibility;
- entity relationships;
- correction actions;
- memory scope actions;
- responsive and accessibility tests.

### WP-20 — Shadow mode and benchmark runner

Scope:

- benchmark dataset;
- V1/V2 side-by-side execution;
- metric aggregation;
- cost/runtime reporting;
- no canonical V2 writes when in shadow mode;
- internal comparison UI/report.

### WP-21 — Controlled beta

Scope:

- selected workspace enablement;
- production telemetry;
- issue triage;
- rollback drill;
- threshold validation;
- documentation updates.

### WP-22 — Default V2 and legacy freeze

Scope:

- new campaigns default to V2;
- no new V1 campaign creation;
- historical V1 read models retained;
- legacy write paths disabled;
- cleanup plan prepared.

### WP-23 — Legacy removal

Only after explicit approval.

Scope:

- remove V1 write workflows;
- remove deprecated prompts and query logic;
- retain stable historical read/export support;
- remove flags no longer required;
- final migrations and documentation cleanup.

---

## 29. Recommended Commit Boundaries

Each work package should generally use this commit order:

1. contract/types and tests;
2. migration and database tests;
3. repository/service implementation;
4. Trigger task or route integration;
5. UI/read-model integration;
6. documentation and final verification.

Avoid combining:

- schema foundation;
- provider integration;
- workflow rewrite;
- large UI redesign;

in one unreviewable commit.

---

## 30. Rollback Boundaries

### 30.1 Before canonical V2 writes

Rollback is environment/workspace flag only.

### 30.2 During shadow mode

Disable V2 execution. V1 remains canonical.

Shadow records may be retained for analysis or deleted by a controlled internal cleanup.

### 30.3 During selected beta

Existing V2 campaigns remain readable.

Disable new V2 campaign creation and route new campaigns to V1 only if V1 creation is still supported.

Do not reinterpret V2 campaigns through V1 logic.

### 30.4 After default V2

Rollback requires:

- disabling new V2 creation;
- preserving V2 read paths;
- choosing whether V1 new-campaign creation remains temporarily available;
- no destructive schema rollback;
- forward-fix migrations rather than editing applied migrations.

---

## 31. Observability Requirements

Track per workflow and stage:

- duration;
- provider calls;
- model calls;
- tokens;
- provider cost;
- company records retrieved;
- normalization yield;
- duplicate rate;
- entity-resolution ambiguity;
- research success;
- factor evidence coverage;
- eligible yield;
- recommended yield;
- user approval rate;
- user correction rate;
- ranking inversion findings;
- memory promotion acceptance;
- failure and retry rate.

Every metric must include:

- workflow version;
- prompt version;
- model route;
- provider adapter version;
- campaign/business-model benchmark category where allowed.

---

## 32. Security and Privacy Requirements

- all new tenant records include `workspace_id`;
- RLS is mandatory;
- service-role writes are restricted to trusted server/Trigger code;
- raw provider payload retention is minimized and documented;
- public business evidence is distinguished from user-private notes;
- candidate memory remains workspace-private;
- no cross-tenant reuse of candidate intelligence in the current scope;
- no provider key reaches the browser;
- no model output authorizes spending or irreversible actions;
- no hidden global memory contains tenant business data;
- corrections and memory promotions are audited;
- contact enrichment remains post-approval;
- sending remains outside scope.

---

## 33. Performance Requirements

Initial V2 performance targets:

- strategy compilation should complete within a user-tolerable asynchronous flow;
- segment searches execute in bounded parallel batches;
- duplicate suppression happens before deep research;
- deep research is limited to plausible candidates;
- candidate evaluation runs with controlled concurrency;
- comparative ranking operates in bounded batches;
- provider and model results reuse stable hashes;
- repeated campaign corrections trigger selective recomputation;
- campaign progress remains visible throughout.

Do not optimize for maximum raw candidate count.

Optimize for cost and time per genuinely reviewable company.

---

## 34. Acceptance Gates by Rollout Stage

### Gate A — Contracts and data foundation

Required:

- migrations pass;
- RLS passes;
- V1 behavior unchanged;
- contract parsers pass;
- version dispatch works.

### Gate B — Company Intelligence V3

Required:

- benchmark role and offering accuracy passes;
- no repetitive low-impact questions;
- facts and hypotheses are distinguishable;
- V3 profile publishes successfully;
- V1 campaigns remain operational.

### Gate C — Strategy V2

Required:

- user can review commercial logic before discovery;
- archetypes, exclusions, rubric, and source plan persist immutably;
- campaign-local exclusions stay campaign-local;
- strategy confirmation is required before run creation.

### Gate D — Discovery V2 shadow

Required:

- provider abstraction works with WebSearchProvider;
- no Tavily types leak downstream;
- segment coverage and query provenance persist;
- fixed generic refinement is not used;
- V2 results do not affect canonical user results in shadow mode.

### Gate E — Evaluation V2

Required:

- relationship precedes scoring;
- hard exclusions precede score;
- unknown is not negative;
- scores reproduce from traces;
- fit, potential, and confidence remain separate;
- scoring inversion benchmark improves materially over V1.

### Gate F — Internal complete workflow

Required:

- end-to-end V2 campaign completes;
- pause/resume/cancel works;
- retries are idempotent;
- result lanes are understandable;
- user corrections cause selective recomputation;
- comparative ranking is auditable.

### Gate G — Selected beta

Required:

- Document 08 release thresholds pass;
- no severe tenant or workflow failures;
- rollback tested;
- cost and runtime acceptable;
- user review precision materially exceeds V1.

### Gate H — Default V2

Required:

- observation period complete;
- benchmark regression suite stable;
- production correction rate acceptable;
- no unresolved critical migration risk;
- explicit product decision recorded.

---

## 35. Primary Risks and Mitigations

### Risk: Building every theoretical table before useful behavior

Mitigation:

- reuse current compatible tables;
- add only tables required by each work package;
- keep complete immutable JSON snapshots;
- normalize fields that require references, querying, or independent lifecycle.

### Risk: Half-migrated campaigns

Mitigation:

- freeze workflow version per campaign and run;
- no in-place V1-to-V2 conversion after execution starts.

### Risk: V2 prompts become another monolith

Mitigation:

- staged typed tasks;
- Document 10 prompt catalogue;
- bounded context compilers;
- separate extraction from synthesis and scoring.

### Risk: Database provider integration later causes another refactor

Mitigation:

- semantic discovery segments now;
- provider interface now;
- query generation inside WebSearchProvider;
- normalized provider records now.

### Risk: Memory contaminates unrelated campaigns

Mitigation:

- explicit scope and applicability;
- campaign default;
- deterministic precedence;
- promotion proposals;
- application audit.

### Risk: Entity resolution creates destructive merges

Mitigation:

- conservative thresholds;
- ambiguity state;
- reversible merge/split events;
- no automatic merge from name similarity alone.

### Risk: Better reasoning dramatically increases cost

Mitigation:

- cheap breadth classification;
- early deterministic exclusions;
- selective research;
- typed economical models for extraction;
- strong models only for strategy and comparison;
- reuse evidence and selective recomputation.

### Risk: UI becomes too complex

Mitigation:

- progressive disclosure;
- compact lanes and tables;
- evidence detail in expandable views;
- strategy logic summarized before advanced controls;
- no exposure of internal chain-of-thought.

---

## 36. Implementation Definition of Done

The refactor is complete only when:

1. Company Profile represents commercial mechanics and offering-specific buyer logic.
2. Campaign creation compiles and confirms a market-specific commercial strategy before discovery.
3. Exclusions and memory are scoped and applicability-aware.
4. Discovery consumes semantic segments.
5. Web search is implemented as one provider, not the architecture.
6. Future database providers can be added without changing campaign or qualification contracts.
7. Discovery continues based on coverage gaps and yield, not generic fixed iterations.
8. Provider records, normalized candidates, canonical organizations, and buying organizations are distinct.
9. Relationship and eligibility are decided before fit scoring.
10. Evidence factors are persisted before deterministic scoring.
11. Fit, commercial potential, and confidence are separate.
12. Unknown evidence is not treated as a confirmed negative.
13. Hard exclusions do not receive misleading fit scores.
14. Comparative ranking detects major inconsistencies and scoring inversions.
15. Campaign corrections update the current result immediately and produce controlled learning proposals.
16. Contact enrichment remains after company approval.
17. V2 campaigns are reproducible from immutable versions and persisted evidence.
18. V1 historical campaigns remain readable and exportable.
19. Benchmarks and production gates in Document 08 pass.
20. V1 write paths are removed only after an explicit legacy-removal decision.

---

## 37. Immediate Next Step

Create Document 10 — AI Task, Prompt, and Schema Catalogue.

After Document 10 is complete, implementation starts with:

```text
WP-00 Documentation import
→ WP-01 Workflow/version foundation
→ WP-02 Contract primitives
→ WP-03 Evidence and claims
→ WP-04 Company Intelligence V3 contracts
```

Do not begin by tuning the existing lead evaluator, fixed iteration count, or Tavily query strings.

The first code change must establish V2 boundaries so every later implementation step lands in the final architecture.
