# Opptium Intelligence V2

## Workflow Orchestration, Tasks, and Data Model

**Document:** 06  
**Status:** Implementation specification  
**Purpose:** Define how the intelligence contracts from Documents 01–05 are executed, persisted, versioned, retried, audited, and exposed as progress through Trigger.dev, Supabase, and typed application services.

---

## 1. Purpose

Documents 01–05 define what Opptium must understand and decide. This document defines how that intelligence becomes a reliable production system.

The orchestration and data layer must ensure that:

- long-running intelligence workflows survive process restarts;
- every task can be safely retried;
- model and provider failures do not destroy completed work;
- a campaign always uses explicit profile, strategy, evidence, and scoring versions;
- concurrent discovery does not create uncontrolled duplicates;
- user corrections invalidate only the work that truly depends on them;
- progress shown in the interface corresponds to persisted state rather than transient logs;
- every important conclusion can be reconstructed from its inputs;
- web search can be the first discovery provider without leaking provider assumptions into the intelligence core;
- future database providers can be added without redesigning profile, strategy, qualification, or result storage.

This document consolidates the preliminary task and table definitions from the previous documents into one coherent implementation model.

---

## 2. Scope

This document covers:

- runtime architecture and service boundaries;
- Trigger.dev workflow graphs and task contracts;
- Supabase/PostgreSQL persistence model;
- identifiers, versions, snapshots, and immutable records;
- task idempotency, retries, concurrency, cancellation, and resume behavior;
- model-role and prompt configuration;
- provider execution records and usage accounting;
- campaign run state and progress reporting;
- audit events and user corrections;
- selective invalidation and recomputation;
- multi-tenant isolation and access control;
- performance, retention, and operational requirements;
- implementation order and acceptance criteria.

This document does not define:

- visual layouts and exact interface copy, covered by Document 07;
- benchmark datasets, rollout gates, and legacy removal, covered by Document 08;
- provider-specific commercial contracts or API pricing;
- contact/person enrichment implementation, which follows company qualification and may be specified separately.

---

## 3. Locked Architectural Decisions

### 3.1 Supabase is the source of truth

Trigger.dev runs work, but durable business state belongs in Supabase/PostgreSQL.

A Trigger.dev run ID must never be the only reference to:

- profile state;
- campaign state;
- strategy versions;
- discovered candidates;
- task completion;
- model output;
- evaluation results;
- progress;
- errors;
- cost or usage.

Trigger.dev may retain execution logs, but Opptium must be able to reconstruct the user-visible state from its own database.

### 3.2 Trigger.dev is an orchestrator, not the commercial brain

Trigger.dev is responsible for:

- durable execution;
- retries;
- scheduled and parallel work;
- task dependencies;
- concurrency control;
- cancellation propagation;
- heartbeat and timeout handling.

It must not contain hidden campaign logic that is absent from versioned database records.

### 3.3 Application code owns deterministic decisions

Deterministic TypeScript services own:

- schema validation;
- applicability of scoped rules;
- score calculations;
- confidence calculations and caps;
- state transitions;
- stable sorting;
- coverage aggregation;
- budget checks;
- idempotency;
- invalidation;
- version creation;
- data access and tenant enforcement.

Models own bounded interpretation tasks, not workflow authority.

### 3.4 Workflows consume immutable versions

A running workflow references immutable inputs:

- company profile version;
- offering version;
- campaign strategy version;
- discovery plan version;
- candidate intelligence snapshot;
- qualification rubric version;
- prompt version;
- model configuration version;
- scoring version;
- provider capability snapshot.

User edits create new versions or correction events. They do not silently mutate historical inputs.

### 3.5 Persist outputs at every meaningful boundary

A workflow may have many tasks, but each expensive or consequential output must be persisted before the next stage begins.

Examples:

- extracted evidence is saved before synthesis;
- semantic discovery segments are saved before provider calls;
- provider records are saved before entity resolution;
- entity decisions are saved before candidate research;
- factor evaluations are saved before scoring;
- score calculations are saved before comparative ranking.

This permits partial recovery and selective recomputation.

### 3.6 Provider data is evidence, not canonical truth

Provider source records remain immutable and separate from canonical organizations.

Neither Tavily/web search nor a future PDL/Apollo record may directly become the final company record without normalization and entity resolution.

### 3.7 User actions are durable events

Important user actions must create explicit records, including:

- confirming a profile;
- editing an offering;
- confirming a campaign strategy;
- adding an exclusion;
- changing exclusion scope;
- approving or rejecting a candidate;
- correcting a relationship or factor;
- accepting or rejecting a memory-promotion proposal;
- requesting more research;
- cancelling or resuming a campaign.

### 3.8 Historical results remain reproducible

When newer evidence, prompts, models, or rules produce different conclusions, Opptium creates new versions. It does not overwrite the historical result that the user previously reviewed.

---

## 4. Runtime Topology

The recommended runtime consists of five layers.

```text
Next.js application
    │
    ├── Server actions / API routes
    ├── Read models for UI
    └── Command handlers for user actions
            │
            ▼
Supabase / PostgreSQL
    ├── canonical business state
    ├── immutable intelligence versions
    ├── evidence and provider records
    ├── task/run state
    ├── audit events
    └── usage ledger
            │
            ▼
Trigger.dev orchestration
    ├── parent workflows
    ├── child tasks
    ├── retries and concurrency
    └── cancellation and resume
            │
            ├── Model gateway
            ├── Web/provider gateway
            ├── Website ingestion services
            └── Deterministic domain services
```

### 4.1 Next.js application responsibilities

The application layer should:

- validate user commands;
- create drafts and run requests;
- select the active workspace/company;
- enforce authorization;
- write transactional command records;
- enqueue or trigger workflows;
- render progress from persisted state;
- expose review and correction actions;
- never wait synchronously for a full campaign run.

### 4.2 Supabase responsibilities

Supabase should store:

- tenant and workspace ownership;
- mutable drafts;
- immutable published versions;
- normalized intelligence records;
- workflow and task state;
- evidence and source provenance;
- provider and model usage;
- audit and user feedback;
- progress aggregates.

### 4.3 Trigger.dev responsibilities

Trigger.dev should execute named tasks with typed input and output references. Large payloads should be stored in Supabase or object storage and passed by ID rather than copied through every task.

### 4.4 Model gateway responsibilities

All model calls should pass through one internal model gateway that:

- resolves model roles to provider/model IDs;
- applies prompt and schema versions;
- sets timeouts and retry policy;
- records token usage and cost estimates;
- validates structured output;
- stores raw response references where policy permits;
- redacts secrets and unsupported content;
- allows models to be changed without editing every task.

### 4.5 Provider gateway responsibilities

All discovery and enrichment providers should pass through a provider gateway that:

- exposes provider capabilities;
- translates semantic requests;
- handles rate limits and pagination;
- records each execution and usage event;
- returns normalized provider candidates;
- preserves immutable raw provider records;
- does not perform campaign qualification.

---

## 5. Aggregate Intelligence Workflow

The top-level sequence is:

```text
Company Profile
    ↓
Published Company Intelligence Version
    ↓
Campaign Draft
    ↓
Confirmed Campaign Strategy Version
    ↓
Discovery Plan Version
    ↓
Coverage-Driven Discovery
    ↓
Provider Records and Normalized Candidates
    ↓
Entity Resolution and Canonical Organizations
    ↓
Candidate Research and Evidence
    ↓
Relationship, Exclusion, and Factor Evaluation
    ↓
Deterministic Scores and Review Lanes
    ↓
Comparative Ranking and Consistency Checks
    ↓
User Review and Corrections
    ↓
Scoped Campaign Memory and Promotion Proposals
```

No downstream stage should infer missing upstream policy from UI text or previous prompt output.

---

## 6. Workflow Families

Opptium should expose several parent workflows rather than one monolithic campaign task.

### 6.1 Profile intelligence workflow

Creates or refreshes Company Intelligence.

```text
profile.createIntelligence
    ├── profile.ingestSources
    ├── profile.selectPages
    ├── profile.extractContent
    ├── profile.extractFacts
    ├── profile.resolveIdentity
    ├── profile.buildBusinessModel
    ├── profile.buildOfferings
    ├── profile.buildBuyerLogic
    ├── profile.buildRelationshipHypotheses
    ├── profile.generateBuyerArchetypes
    ├── profile.detectConflicts
    ├── profile.generateClarificationQuestions
    └── profile.prepareReview
```

Publishing occurs only after user review:

```text
profile.publishIntelligence
    ├── profile.applyUserCorrections
    ├── profile.recomputeAffectedIntelligence
    ├── profile.validateDraft
    ├── profile.compileSnapshot
    └── profile.publishVersion
```

### 6.2 Campaign strategy workflow

Compiles a market-specific strategy from a published profile.

```text
campaign.compileStrategy
    ├── campaign.compileCommercialContext
    ├── campaign.retrieveApplicableMemory
    ├── campaign.generateInitialTargetHypothesis
    ├── campaign.researchMarket
    ├── campaign.buildArchetypes
    ├── campaign.compileQualificationPolicy
    ├── campaign.compileScopedRules
    ├── campaign.buildDiscoverySegments
    ├── campaign.selectSourcePlan
    ├── campaign.detectStrategyConflicts
    ├── campaign.generateClarificationQuestions
    └── campaign.prepareStrategyReview
```

After user edits:

```text
campaign.confirmStrategy
    ├── campaign.applyStrategyEdits
    ├── campaign.resolveRuleScopes
    ├── campaign.validateStrategy
    ├── campaign.compileStrategySnapshot
    ├── campaign.createMemorySnapshot
    ├── campaign.publishStrategyVersion
    └── discovery.createPlan
```

### 6.3 Campaign discovery workflow

The discovery parent workflow is coverage-driven.

```text
discovery.executePlan
    ├── discovery.initializeRun
    ├── discovery.dispatchEligibleSegments
    │       └── discovery.executeSegment [parallel, bounded]
    │               ├── discovery.compileProviderRequest
    │               ├── discovery.executeProvider
    │               ├── discovery.persistSourceRecords
    │               ├── discovery.normalizeProviderCandidates
    │               ├── discovery.suppressExactDuplicates
    │               └── discovery.updateSegmentMetrics
    ├── discovery.queueEntityResolution
    ├── discovery.aggregateCoverage
    ├── discovery.detectGaps
    ├── discovery.decideNextActions
    ├── discovery.dispatchTargetedGapPasses [optional]
    └── discovery.finalizeRun
```

Discovery should not block until every possible candidate has been fully evaluated. Candidate processing can be progressive.

### 6.4 Entity resolution workflow

```text
entityResolution.resolveCandidate
    ├── entityResolution.initializeCase
    ├── entityResolution.extractIdentitySignals
    ├── entityResolution.findExactMatch
    ├── entityResolution.findPossibleMatches
    ├── entityResolution.assessMatches
    ├── entityResolution.verifyAmbiguity [conditional]
    ├── entityResolution.applyDecision
    ├── entityResolution.linkSourceRecords
    ├── entityResolution.resolveOrganizationGraph
    ├── entityResolution.resolveBuyingOrganization
    ├── candidate.createCampaignCandidate
    └── entityResolution.finalizeCase
```

### 6.5 Candidate intelligence and qualification workflow

```text
candidate.evaluateForCampaign
    ├── candidate.compileResearchPlan
    ├── candidate.reuseExistingEvidence
    ├── candidate.fetchRequiredSources [parallel, bounded]
    ├── candidate.extractEvidence
    ├── candidate.updateReusableClaims
    ├── candidate.createIntelligenceSnapshot
    ├── candidate.classifyRelationship
    ├── candidate.compileApplicableExclusions
    ├── candidate.evaluateExclusions
    ├── candidate.determinePreliminaryEligibility
    ├── candidate.compileFactorQuestions
    ├── candidate.researchCriticalUnknowns [conditional]
    ├── candidate.evaluateFactors
    ├── candidate.calculateScores
    ├── candidate.calculateConfidence
    ├── candidate.assignReviewLane
    ├── candidate.runConsistencyChecks
    └── candidate.finalizeEvaluation
```

### 6.6 Comparative ranking workflow

```text
campaign.rankCandidates
    ├── campaign.selectComparableCandidates
    ├── campaign.prepareComparativeBatches
    ├── campaign.compareCandidateBatch [parallel, bounded]
    ├── campaign.detectCrossBatchAnomalies
    ├── candidate.reEvaluateFlaggedFactors [conditional]
    ├── campaign.calculateStableRanks
    ├── campaign.createRankSnapshot
    └── campaign.publishReviewQueue
```

### 6.7 Correction and learning workflow

```text
candidate.applyUserCorrection
    ├── correction.recordEvent
    ├── correction.resolveScope
    ├── correction.updateImmediateCandidateState
    ├── correction.calculateInvalidationSet
    ├── correction.recomputeAffectedOutputs
    ├── memory.createCampaignLesson
    ├── memory.detectPromotionCandidate
    └── correction.refreshReviewQueue
```

Promotion is separate:

```text
memory.resolvePromotionProposal
    ├── memory.recordUserDecision
    ├── memory.createPromotedRecord [when accepted]
    ├── memory.markSourceRelationship
    ├── memory.invalidateApplicableFutureDrafts [not historical versions]
    └── memory.closeProposal
```

---

## 7. Parent Workflows Versus Child Tasks

Parent workflows should coordinate state, but child tasks should perform bounded work.

A child task should generally satisfy all of the following:

- one clear responsibility;
- typed input;
- persisted output or output reference;
- bounded runtime;
- explicit idempotency key;
- known retry behavior;
- no hidden dependency on an in-memory parent object;
- no direct mutation of immutable versions;
- no silent creation of global memory.

Avoid child tasks that combine unrelated stages such as:

```text
searchEvaluateScoreAndSaveLead
```

Prefer:

```text
discovery.executeProvider
candidate.extractEvidence
candidate.evaluateFactors
candidate.calculateScores
```

This separation is required for auditability and selective recomputation, not merely code style.

---

## 8. Standard Task Contract

Every intelligence task should use a shared envelope.

```ts
type IntelligenceTaskInput<TPayload> = {
  taskRequestId: string;
  workspaceId: string;
  actorUserId?: string;

  workflow: {
    family: string;
    runId: string;
    parentRunId?: string;
  };

  versions: {
    contractVersion: string;
    profileVersionId?: string;
    campaignStrategyVersionId?: string;
    discoveryPlanVersionId?: string;
    candidateIntelligenceSnapshotId?: string;
    evaluationVersionId?: string;
    promptVersionId?: string;
    modelConfigVersionId?: string;
    providerCapabilitySnapshotId?: string;
  };

  idempotencyKey: string;
  requestedAt: string;
  payload: TPayload;
};
```

Task results should also use a standard envelope.

```ts
type IntelligenceTaskResult<TOutput> = {
  status: "completed" | "partial" | "skipped" | "blocked";

  output?: TOutput;
  outputReferenceIds?: string[];

  warnings: Array<{
    code: string;
    message: string;
    evidenceIds?: string[];
  }>;

  usage?: {
    modelCallIds?: string[];
    providerExecutionIds?: string[];
    usageEventIds?: string[];
  };

  completedAt: string;
};
```

### 8.1 Do not pass large raw payloads through workflows

Persist and pass references for:

- crawled page bodies;
- provider responses;
- raw model responses;
- candidate evidence collections;
- compiled snapshots;
- large candidate lists.

A task should load only the records it needs.

### 8.2 Task inputs must be sufficient to reproduce work

A task must not depend on whichever campaign version is currently marked active unless the task input explicitly resolves and stores that version first.

---

## 9. Idempotency

### 9.1 General rule

The same logical task with the same effective inputs must produce one durable result.

Recommended idempotency key pattern:

```text
{workspaceId}:{taskType}:{subjectId}:{inputFingerprint}:{contractVersion}
```

The input fingerprint should include all versions and fields that materially affect the output.

### 9.2 Example keys

Profile extraction:

```text
profile.extractFacts:{profileDraftId}:{sourceSetHash}:{promptVersion}:{schemaVersion}
```

Campaign strategy:

```text
campaign.compileStrategy:{campaignDraftId}:{profileVersionId}:{inputHash}:{strategyContractVersion}
```

Discovery provider execution:

```text
discovery.executeProvider:{segmentRunId}:{providerId}:{providerRequestHash}:{providerAdapterVersion}
```

Entity resolution:

```text
entityResolution.resolveCandidate:{normalizedProviderCandidateId}:{identitySignalHash}:{resolutionRulesVersion}
```

Candidate evaluation:

```text
candidate.evaluateFactors:{campaignCandidateId}:{strategyVersionId}:{evidenceSnapshotHash}:{rubricVersion}:{evaluatorVersion}
```

Comparative ranking:

```text
campaign.compareCandidateBatch:{campaignId}:{strategyVersionId}:{batchMembershipHash}:{comparisonVersion}
```

### 9.3 Database enforcement

`intelligence_task_runs.idempotency_key` must be unique.

A task should:

1. attempt to create or claim the task-run row;
2. return the existing completed output if the key already completed;
3. wait or exit safely if another execution owns an active claim;
4. reclaim only when the prior lease is expired;
5. never insert duplicate domain records after a retry.

### 9.4 Idempotency does not mean permanent caching

When source freshness, strategy, model, prompt, schema, or rules change, the effective input fingerprint changes and a new result may be created.

---

## 10. Task Leasing and Concurrency Safety

A persisted task-run record should support a lease:

```ts
type TaskLease = {
  ownerExecutionId: string;
  leasedAt: string;
  leaseExpiresAt: string;
  heartbeatAt: string;
};
```

Tasks that perform multiple writes should heartbeat periodically.

If the Trigger.dev process disappears:

- the lease eventually expires;
- a retry may reclaim the task;
- completed sub-results remain reusable;
- uniqueness constraints prevent duplicate output.

Use database transactions for short state transitions. Do not hold database transactions while waiting for model or provider calls.

---

## 11. Retry Policy

Retries must be error-class aware.

### 11.1 Retryable errors

Examples:

- temporary provider timeout;
- HTTP 429 or rate limiting;
- transient 5xx response;
- model gateway timeout;
- temporary database connection failure;
- task worker interruption;
- fetch failure for one page where alternate pages remain.

Use exponential backoff with jitter and provider-specific limits.

### 11.2 Non-retryable errors

Examples:

- invalid task schema;
- missing tenant access;
- nonexistent immutable version;
- unsupported provider capability;
- malformed user configuration that needs correction;
- deterministic rule conflict with no resolution path;
- campaign cancelled;
- record permanently blocked by policy.

### 11.3 Model-output repair

For invalid structured model output:

1. validate against the expected schema;
2. attempt one bounded repair call using the validation errors;
3. if still invalid, fail the task with `model_output_invalid`;
4. preserve the raw response reference and errors;
5. do not silently coerce material fields.

### 11.4 Partial success

A task may return `partial` when:

- some source pages fail but sufficient evidence remains;
- one provider page is blocked but the candidate can continue;
- some qualification factors remain unknown;
- a discovery segment produces fewer candidates than targeted;
- a candidate requires manual research.

Partial success should preserve completed work and create explicit unresolved items.

---

## 12. Cancellation, Pause, and Resume

### 12.1 Campaign cancellation

When the user cancels a campaign run:

- mark the campaign run `cancelling`;
- stop dispatching new tasks;
- request cancellation of active Trigger.dev children;
- allow atomic writes already in progress to complete;
- mark unfinished segment and candidate tasks `cancelled` or `paused`;
- retain all completed evidence and candidates;
- record who cancelled and why when supplied.

### 12.2 Pause

Pause differs from cancellation:

- no new work is dispatched;
- active bounded tasks may finish;
- the run remains resumable with the same versions;
- budget and coverage state remain intact.

### 12.3 Resume

Resume must:

- validate that referenced immutable versions still exist;
- detect already-completed idempotent tasks;
- recalculate pending work;
- not rerun completed provider searches without a reason;
- continue from persisted coverage and candidate state.

### 12.4 Strategy edits during an active run

A confirmed strategy version is immutable. A material edit creates a new strategy version and one of three explicit actions:

- continue the old run unchanged;
- stop the old run and start a new run;
- create a controlled re-evaluation run that reuses compatible evidence and candidates.

Never silently apply a new strategy to old evaluations.

---

## 13. Concurrency and Backpressure

### 13.1 Concurrency dimensions

Concurrency should be controlled independently for:

- provider requests by provider and workspace;
- website fetches by domain;
- model calls by model role;
- candidate evaluations by campaign;
- entity resolution cases;
- comparative batches;
- global account budget.

### 13.2 Suggested initial limits

Exact limits are configurable, but the first implementation should favor correctness:

- one active profile build per workspace company;
- one strategy compilation per campaign draft;
- several discovery segments in parallel;
- no more than one active fetch per canonical domain at a time;
- bounded candidate evaluations per campaign;
- one comparative finalization per strategy version;
- one merge or split operation per canonical organization graph at a time.

### 13.3 Backpressure

Before dispatching more work, the parent workflow should inspect:

- remaining campaign budget;
- open candidate-evaluation queue;
- provider rate limits;
- model concurrency;
- duplicate rate;
- qualified yield;
- user stop or pause state.

Discovery should slow or stop when the downstream queue is saturated rather than producing thousands of unprocessed candidates.

### 13.4 Domain-level fetch locking

A shared fetch cache and domain lock should prevent multiple candidates or campaigns from simultaneously downloading the same public page.

The cache must retain:

- URL;
- normalized URL;
- fetch time;
- status code;
- content hash;
- content language;
- freshness policy;
- tenant visibility classification.

Public website content may be reused across workspaces, while private uploaded documents remain tenant-isolated.

---

## 14. Versioning Model

### 14.1 Version categories

Opptium uses several distinct version types:

- business-content versions;
- intelligence-contract versions;
- prompt versions;
- model configuration versions;
- scoring versions;
- provider adapter versions;
- provider capability snapshots;
- workflow versions.

They must not be collapsed into one generic version string.

### 14.2 Business-content versions

These include:

- company profile version;
- offering version;
- campaign strategy version;
- discovery plan version;
- candidate intelligence version;
- candidate evaluation version;
- rank snapshot.

### 14.3 Contract versions

Contracts define expected input/output schemas and semantics.

Examples:

```text
company-intelligence/v2.0
campaign-strategy/v2.0
discovery-segment/v1.0
candidate-evaluation/v2.0
```

A contract version changes when fields or semantics change, even if the prompt text does not.

### 14.4 Prompt versions

Prompts should be stored and referenced by immutable IDs.

A prompt version includes:

- task role;
- system instructions;
- user-template structure;
- expected output schema ID;
- allowed evidence context;
- change notes;
- activation status.

### 14.5 Model configuration versions

A model configuration maps semantic roles to provider/model settings.

```ts
type ModelRoleConfig = {
  role:
    | "fast_extraction"
    | "commercial_reasoning"
    | "verification"
    | "comparative_ranking"
    | "explanation";

  provider: string;
  modelId: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs: number;
  retryPolicyId: string;
  structuredOutputMode: string;
};
```

A campaign run stores the configuration version used. Changing the default model affects new tasks, not historical runs.

### 14.6 Scoring versions

Scoring is deterministic but versioned. A scoring version stores:

- factor state mapping;
- weighting method;
- denominator behavior for unknown factors;
- confidence formula;
- confidence caps;
- lane thresholds;
- stable sort policy.

### 14.7 Immutable snapshots

Published versions should retain both:

- normalized records that remain queryable;
- a compiled immutable JSON snapshot with a content hash.

The snapshot supports reproducibility, export, and fast context compilation. Normalized tables remain the canonical editable source before publication.

---

## 15. Database Design Principles

### 15.1 UUIDs and timestamps

Use UUID primary keys and timezone-aware timestamps.

Every mutable table should generally include:

- `id`;
- `workspace_id` where tenant-owned;
- `created_at`;
- `updated_at`;
- `created_by_user_id` where applicable;
- `deleted_at` only when soft deletion is required.

Immutable event and version tables should not use `updated_at` as a normal mutation mechanism.

### 15.2 Status columns

Use constrained enums or validated text values for state machines. Avoid free-form status strings.

### 15.3 JSONB use

Use JSONB for:

- flexible provider payloads;
- compiled immutable snapshots;
- model metadata;
- structured condition expressions;
- diffs;
- schema-valid outputs whose subfields are not frequently queried.

Use normalized columns or child tables for:

- ownership;
- version links;
- state;
- scope;
- relationship types;
- rule applicability;
- factor keys;
- scores;
- confidence;
- provider IDs;
- timestamps;
- fields used for filtering or uniqueness.

### 15.4 No opaque campaign blob

The complete campaign cannot live only in one JSON column. The system needs normalized access to:

- strategy versions;
- archetypes;
- exclusions;
- segments;
- candidates;
- evaluations;
- progress;
- corrections.

A compiled JSON snapshot is additional, not exclusive.

### 15.5 Append-only records

Prefer append-only history for:

- published versions;
- user corrections;
- model calls;
- provider executions;
- usage events;
- score calculations;
- rank snapshots;
- merge and split events;
- audit events.

### 15.6 Soft deletion

Do not physically delete records that historical versions reference. Use archive, superseded, rejected, merged, or deleted markers as appropriate.

---

## 16. Tenant and Workspace Core Tables

### 16.1 `workspaces`

Stores tenant identity and product-level settings.

Key fields:

```text
id
name
slug
status
created_by_user_id
created_at
updated_at
```

### 16.2 `workspace_members`

```text
workspace_id
user_id
role
status
joined_at
```

Unique constraint:

```text
(workspace_id, user_id)
```

### 16.3 `workspace_companies`

Represents the user’s own company within a workspace.

```text
id
workspace_id
display_name
canonical_domain
status
is_active
created_at
updated_at
```

The initial product may enforce one active company per workspace, while the schema should not prevent future multi-company support.

### 16.4 `workspace_settings`

Stores non-intelligence workspace settings such as locale, review defaults, and budget preferences. Commercial knowledge belongs in profile or memory records, not this settings table.

---

## 17. Configuration and Contract Registry

### 17.1 `intelligence_contracts`

Stores named schema contracts.

```text
id
contract_key
version
json_schema
status
content_hash
created_at
```

Unique:

```text
(contract_key, version)
```

### 17.2 `prompt_versions`

```text
id
prompt_key
version
role
contract_id
system_template
user_template
status
content_hash
change_notes
created_at
```

### 17.3 `model_config_versions`

```text
id
name
version
status
config_json
content_hash
created_at
```

### 17.4 `model_role_assignments`

Normalized optional child rows:

```text
model_config_version_id
role
provider
model_id
settings_json
```

### 17.5 `scoring_versions`

```text
id
version
status
formula_json
lane_policy_json
confidence_policy_json
content_hash
created_at
```

### 17.6 `workflow_versions`

Stores application workflow version metadata used by runs.

```text
id
workflow_family
version
status
change_notes
created_at
```

### 17.7 `provider_adapters`

```text
id
provider_key
adapter_version
status
configuration_schema
created_at
```

Secrets are never stored in these rows. They remain in environment or secret management.

---

## 18. Source Documents, Fetches, Evidence, and Claims

The evidence layer should be shared where practical but retain subject and visibility boundaries.

### 18.1 `source_documents`

Represents a logical source such as:

- workspace company website;
- uploaded PDF;
- public candidate website;
- registry record;
- market-analysis source;
- provider record.

Key fields:

```text
id
workspace_id nullable
subject_type
subject_id
source_type
canonical_url nullable
title nullable
language nullable
visibility: public | workspace_private
status
created_at
```

### 18.2 `source_fetches`

Immutable fetch instances.

```text
id
source_document_id
requested_url
resolved_url
http_status
fetched_at
content_hash
content_location
mime_type
language
fetch_metadata_json
error_code nullable
```

### 18.3 `evidence_items`

Shared evidence representation.

```text
id
workspace_id nullable
subject_type
subject_id
source_document_id
source_fetch_id nullable
evidence_type
structured_value_json nullable
excerpt nullable
location_json nullable
directness
source_reliability
freshness_state
observed_at nullable
retrieved_at
content_hash
visibility
```

The evidence item is a source-backed observation, not a conclusion.

### 18.4 `intelligence_claims`

Claims may refer to the workspace company, offering, campaign, external organization, or candidate.

```text
id
workspace_id nullable
subject_type
subject_id
claim_key
value_json
status
confidence
origin_type
origin_id nullable
valid_from nullable
valid_to nullable
supersedes_claim_id nullable
created_at
```

### 18.5 `claim_evidence_links`

```text
claim_id
evidence_id
stance: supports | contradicts | contextual
weight nullable
```

### 18.6 `claim_conflicts`

```text
id
workspace_id
subject_type
subject_id
claim_key
status
resolution
resolved_by_user_id nullable
resolved_at nullable
created_at
```

### 18.7 Specialized compatibility views

Documents 01 and 04 use names such as `company_evidence` and `candidate_evidence`. These may be implemented as:

- specialized tables when access patterns differ materially; or
- views over `evidence_items` filtered by subject type.

The important requirement is one consistent evidence contract, not a forced single-table design if performance or RLS becomes awkward.

---

## 19. Company Profile Persistence

### 19.1 `company_profiles`

One logical profile per workspace company.

```text
id
workspace_id
workspace_company_id
status
current_published_version_id nullable
current_draft_id nullable
created_at
updated_at
```

### 19.2 `company_profile_drafts`

Mutable user-review state.

```text
id
company_profile_id
base_version_id nullable
state
input_hash
created_by_user_id
created_at
updated_at
```

### 19.3 `company_profile_versions`

Immutable published versions.

```text
id
company_profile_id
version_number
status
compiled_snapshot_json
content_hash
published_by_user_id
published_at
```

Unique:

```text
(company_profile_id, version_number)
```

### 19.4 `company_business_models`

Stores versioned business-model synthesis.

```text
id
profile_draft_id nullable
profile_version_id nullable
primary_role
revenue_model
transaction_model
customer_usage_mode
sales_motion
structured_details_json
confidence
```

Exactly one of `profile_draft_id` or `profile_version_id` should be set.

### 19.5 `company_business_roles`

```text
id
business_model_id
role_type
priority
confidence
claim_id nullable
```

### 19.6 `company_offerings`

Stable offering identity across profile versions.

```text
id
workspace_company_id
stable_key
created_at
archived_at nullable
```

### 19.7 `company_offering_versions`

```text
id
company_offering_id
profile_version_id nullable
profile_draft_id nullable
name
description
category
status
compiled_snapshot_json
content_hash
```

Unique for published records:

```text
(company_offering_id, profile_version_id)
```

### 19.8 Offering intelligence children

Normalized child tables:

```text
offering_commercial_mechanics
offering_buyer_logic
offering_buyer_roles
offering_relationship_options
profile_buyer_archetypes
profile_buyer_archetype_conditions
profile_evidence_signals
```

Each row references an offering version or profile draft subject.

### 19.9 `commercial_rules`

Shared scoped rule table for workspace and offering rules.

Key fields:

```text
id
workspace_id
scope_type: workspace | offering | campaign | candidate
scope_id
rule_type
statement
condition_json
strength: hard | soft
status
origin_type
origin_id nullable
confidence
confirmed_by_user_id nullable
supersedes_rule_id nullable
created_at
```

Campaign rules may use the same table or a specialized child table. The applicability contract must remain uniform.

### 19.10 Clarification tables

```text
clarification_questions
clarification_answers
```

Questions should retain:

- subject;
- impact category;
- uncertainty being resolved;
- generated options;
- skip allowance;
- status;
- answer and actor.

---

## 20. Campaign and Strategy Persistence

### 20.1 `campaigns`

Stable campaign identity.

```text
id
workspace_id
workspace_company_id
name
status
current_strategy_version_id nullable
created_by_user_id
created_at
updated_at
```

### 20.2 `campaign_inputs`

Stores the mutable creation inputs before strategy publication.

```text
id
campaign_id
geography_json
objective_key
selected_offering_id
campaign_offer_variant_json nullable
constraints_json
created_at
updated_at
```

### 20.3 `campaign_strategy_drafts`

```text
id
campaign_id
base_strategy_version_id nullable
profile_version_id
offering_version_id
state
compiled_draft_json nullable
input_hash
created_at
updated_at
```

### 20.4 `campaign_strategy_versions`

Immutable confirmed strategy.

```text
id
campaign_id
version_number
profile_version_id
offering_version_id
objective_key
compiled_snapshot_json
memory_snapshot_id
qualification_rubric_id
content_hash
confirmed_by_user_id
confirmed_at
```

Unique:

```text
(campaign_id, version_number)
```

### 20.5 Strategy child records

```text
campaign_geographies
campaign_market_findings
campaign_target_hypotheses
campaign_archetypes
campaign_archetype_conditions
campaign_evidence_signals
campaign_rules
campaign_assumptions
campaign_clarification_questions
campaign_user_edits
```

Each confirmed child record references `campaign_strategy_version_id`. Draft equivalents may reference `campaign_strategy_draft_id`.

### 20.6 `qualification_rubrics`

```text
id
campaign_strategy_version_id
scoring_version_id
status
compiled_snapshot_json
content_hash
created_at
```

### 20.7 `qualification_factor_definitions`

```text
id
qualification_rubric_id
factor_key
purpose
weight
criticality
applicability_json
positive_definition
negative_definition
research_questions_json
sort_order
```

### 20.8 `campaign_strategy_diffs`

Stores normalized or JSON diffs between strategy versions, including whether existing candidates require re-evaluation.

---

## 21. Scoped Memory Persistence

### 21.1 `intelligence_memories`

Canonical memory table.

```text
id
workspace_id
user_id nullable
scope_type: user | workspace | offering | campaign | candidate
scope_id nullable
memory_type
statement
structured_value_json nullable
applicability_json
strength: hard | soft
status: proposed | provisional | confirmed | rejected | superseded | expired
origin_type
origin_id nullable
confidence
created_at
updated_at
last_applied_at nullable
supersedes_memory_id nullable
```

### 21.2 `memory_evidence_links`

Links memory to evidence or corrections where relevant.

### 21.3 `campaign_memory_snapshots`

An immutable snapshot of memories used to compile a strategy or execute a major evaluation phase.

```text
id
campaign_id
campaign_strategy_version_id nullable
snapshot_json
content_hash
created_at
```

### 21.4 `memory_application_events`

Records when a memory was retrieved and applied.

```text
id
memory_id
workspace_id
applied_to_type
applied_to_id
application_reason
result: applied | overridden | ignored | conflicted
created_at
```

### 21.5 `memory_promotion_proposals`

```text
id
workspace_id
source_memory_id
proposed_scope_type
proposed_scope_id
proposed_statement
proposed_applicability_json
reason
support_count
status
created_at
resolved_at nullable
resolved_by_user_id nullable
```

Promotion never mutates the source campaign memory. Acceptance creates a new broader memory linked to the original.

### 21.6 `intelligence_conflicts`

General conflict table for rule or memory applicability.

```text
id
workspace_id
subject_type
subject_id
conflict_type
record_ids_json
precedence_result_json
status
created_at
resolved_at nullable
```

---

## 22. Discovery Persistence

### 22.1 `discovery_plans`

Stable plan identity for one strategy version.

```text
id
campaign_id
campaign_strategy_version_id
version_number
status
coverage_policy_json
stopping_policy_json
budget_policy_json
compiled_snapshot_json
content_hash
created_at
```

### 22.2 `discovery_segments`

Semantic, provider-independent segments.

```text
id
discovery_plan_id
campaign_archetype_id
geography_json
business_characteristics_json
positive_signals_json
negative_signals_json
exclusion_rule_ids_json
target_candidate_count
priority
status
```

### 22.3 `discovery_source_plans`

```text
id
discovery_segment_id
provider_key
source_role: primary | supporting | verification
priority
activation_condition_json
provider_request_policy_json
```

### 22.4 `discovery_provider_capability_snapshots`

Stores the capabilities assumed during plan compilation.

```text
id
provider_key
adapter_version
capabilities_json
captured_at
content_hash
```

### 22.5 `discovery_runs`

One execution of a plan.

```text
id
discovery_plan_id
campaign_id
status
started_at
paused_at nullable
completed_at nullable
stopping_reason nullable
budget_limit_json
usage_summary_json
coverage_summary_json
```

### 22.6 `discovery_segment_runs`

```text
id
discovery_run_id
discovery_segment_id
pass_number
status
started_at
completed_at nullable
candidate_count
unique_candidate_count
qualified_yield_count
metrics_json
```

Unique:

```text
(discovery_run_id, discovery_segment_id, pass_number)
```

### 22.7 `discovery_provider_executions`

Represents one bounded provider request or paginated sequence.

```text
id
discovery_segment_run_id
provider_key
adapter_version
request_hash
request_json
status
started_at
completed_at nullable
result_count
next_cursor nullable
error_code nullable
usage_json
```

Unique idempotency constraint should cover segment run, provider, adapter version, and request hash.

### 22.8 `discovery_queries`

For web search and other query-based providers.

```text
id
provider_execution_id
query_text
language
country
query_type
sequence_number
result_count
```

Search strings live here, not in the semantic discovery plan.

### 22.9 `provider_source_records`

Immutable provider outputs.

```text
id
provider_execution_id
provider_key
provider_record_id nullable
record_type
raw_payload_json
raw_payload_hash
source_url nullable
retrieved_at
```

### 22.10 `normalized_provider_candidates`

Provider-neutral preliminary candidate representation.

```text
id
provider_source_record_id
name
normalized_name
domain nullable
website_url nullable
country nullable
locality nullable
description nullable
industries_json
employee_count nullable
matched_archetype_id
matched_signals_json
normalization_version
```

### 22.11 `discovery_candidate_groups`

Temporary grouping before canonical entity resolution.

```text
id
discovery_run_id
group_key
status
representative_candidate_id
candidate_count
```

### 22.12 Coverage and gaps

```text
discovery_coverage_snapshots
discovery_gaps
discovery_gap_actions
```

A coverage snapshot should include:

- archetype;
- geography;
- source roles attempted;
- unique candidate count;
- evaluated count;
- qualified yield;
- duplicate rate;
- confidence in coverage;
- open gaps.

### 22.13 `discovery_usage_events`

May be implemented as a specialized view over the general usage ledger, but should support discovery-specific metrics.

---

## 23. External Organization and Entity Resolution Persistence

### 23.1 `external_organizations`

Canonical external organization node.

```text
id
display_name
normalized_name
organization_type
primary_domain nullable
primary_country nullable
operating_status
review_state
identity_confidence
merged_into_organization_id nullable
created_at
updated_at
```

Canonical public organization identity may be shared across tenants, but workspace-private candidate judgments must remain separate.

### 23.2 Organization identity tables

```text
organization_aliases
organization_domains
organization_identifiers
organization_locations
```

Important unique constraints:

- verified canonical domain should not normally belong to two active unrelated canonical organizations;
- provider identifiers are unique within provider namespace;
- legal identifiers are unique within country and registry namespace where reliable.

### 23.3 `organization_relationships`

Stores:

- parent;
- subsidiary;
- brand;
- branch;
- franchise;
- owner;
- operating entity;
- procurement relationship;
- historical relationship.

Relationships retain confidence, status, evidence, and validity dates.

### 23.4 `organization_buying_hypotheses`

Stores hypotheses about the actual buying organization and procurement scope, such as local, regional, parent-controlled, franchise-controlled, or unknown.

### 23.5 Entity resolution process tables

```text
entity_resolution_cases
entity_match_assessments
entity_resolution_decisions
organization_merge_events
organization_split_events
organization_source_links
```

Merge and split events must be reversible and must record reassignment of:

- source links;
- campaign candidates;
- evidence;
- relationships;
- candidate memories;
- evaluations that require invalidation.

### 23.6 Shared public versus tenant-private data

`external_organizations` and public identity evidence may be system-public. The following remain workspace-private:

- fit assessments;
- exclusions;
- do-not-contact state;
- user corrections;
- campaign candidate status;
- commercial potential;
- internal notes;
- candidate memory.

---

## 24. Candidate Intelligence Persistence

### 24.1 `candidate_research_plans`

```text
id
organization_id
campaign_candidate_id nullable
campaign_strategy_version_id nullable
research_type: reusable | campaign_specific
questions_json
source_plan_json
priority
status
created_at
```

### 24.2 `candidate_research_tasks`

```text
id
research_plan_id
question_key
task_type
source_document_id nullable
status
priority
result_reference_json nullable
error_code nullable
```

### 24.3 `candidate_claims`

Reusable public organization claims. This may be a specialized projection over `intelligence_claims`.

### 24.4 `candidate_intelligence_versions`

```text
id
organization_id
version_number
source_cutoff_at
compiled_snapshot_json
content_hash
created_at
```

### 24.5 `campaign_candidates`

One canonical candidate organization per campaign.

```text
id
workspace_id
campaign_id
organization_id
buying_organization_id nullable
campaign_strategy_version_id
state
matched_archetype_ids_json
discovered_country nullable
display_organization_id
current_evaluation_version_id nullable
user_review_status
created_at
updated_at
```

Unique:

```text
(campaign_id, organization_id, campaign_strategy_version_id)
```

When several branches map to one buying organization, the display and buying organization fields preserve both user-visible and commercial context.

### 24.6 `campaign_candidate_discovery_links`

Links one campaign candidate to every discovery segment and provider source that contributed to it.

### 24.7 `campaign_candidate_claims`

Stores campaign-specific conclusions and assumptions that must not contaminate reusable public Candidate Intelligence.

### 24.8 `candidate_memories`

May be a view or constrained subtype of `intelligence_memories` with candidate scope.

---

## 25. Qualification and Ranking Persistence

### 25.1 `candidate_evaluation_versions`

Immutable aggregate evaluation version.

```text
id
campaign_candidate_id
campaign_strategy_version_id
candidate_intelligence_version_id
qualification_rubric_id
scoring_version_id
model_config_version_id
version_number
status
compiled_snapshot_json
content_hash
created_at
finalized_at nullable
```

### 25.2 `candidate_relationship_assessments`

```text
id
candidate_evaluation_version_id
primary_relationship
secondary_relationships_json
confidence
evidence_summary_json
model_call_id nullable
```

### 25.3 `candidate_exclusion_assessments`

```text
id
candidate_evaluation_version_id
campaign_rule_id nullable
commercial_rule_id nullable
state
strength
applicability_result
confidence
reason
evidence_ids_json
```

### 25.4 `candidate_eligibility_decisions`

```text
id
candidate_evaluation_version_id
eligibility
reason_code
reason_text
decided_by
created_at
```

### 25.5 `candidate_factor_evaluations`

```text
id
candidate_evaluation_version_id
factor_definition_id
state
strength
confidence
evidence_quality
explanation
evidence_ids_json
counter_evidence_ids_json
model_call_id nullable
```

Unique:

```text
(candidate_evaluation_version_id, factor_definition_id)
```

### 25.6 Score and confidence tables

```text
candidate_score_calculations
candidate_confidence_calculations
```

They must preserve full traces:

- included factors;
- excluded unknown/not-applicable factors;
- signed values;
- weights;
- denominator;
- raw score;
- rounded score;
- confidence caps;
- policy version.

### 25.7 `candidate_review_lane_assignments`

Stores lane and reason before comparative ranking.

### 25.8 Comparative ranking tables

```text
comparative_batches
comparative_batch_members
comparative_anomalies
candidate_rank_snapshots
candidate_explanations
candidate_evaluation_events
```

A rank snapshot should be immutable and reference:

- campaign strategy version;
- included evaluation versions;
- comparative model calls;
- anomaly resolutions;
- stable ordering policy;
- creation time.

### 25.9 No destructive score updates

When evidence changes, create a new evaluation version and update `campaign_candidates.current_evaluation_version_id`. Historical score calculations remain intact.

---

## 26. Workflow and Run Persistence

### 26.1 `intelligence_workflow_runs`

One parent workflow execution.

```text
id
workspace_id
workflow_family
workflow_version_id
subject_type
subject_id
status
trigger_run_id nullable
requested_by_user_id nullable
started_at nullable
completed_at nullable
cancelled_at nullable
input_reference_json
output_reference_json nullable
progress_summary_json
error_summary_json nullable
```

### 26.2 `intelligence_task_runs`

```text
id
workflow_run_id
parent_task_run_id nullable
task_type
status
idempotency_key
input_fingerprint
input_reference_json
output_reference_json nullable
attempt_count
lease_owner nullable
lease_expires_at nullable
heartbeat_at nullable
started_at nullable
completed_at nullable
error_code nullable
error_details_json nullable
```

Unique:

```text
idempotency_key
```

### 26.3 `intelligence_task_attempts`

Append-only attempt records.

```text
id
task_run_id
attempt_number
trigger_execution_id nullable
started_at
completed_at nullable
status
error_code nullable
metrics_json
```

### 26.4 `workflow_dependencies`

Optional explicit dependency rows if useful for inspection and recovery.

```text
workflow_run_id
upstream_task_run_id
downstream_task_run_id
dependency_type
```

### 26.5 `workflow_checkpoints`

Stores named workflow checkpoints such as:

- profile facts complete;
- strategy ready for review;
- initial discovery pass complete;
- entity resolution complete for current batch;
- candidate evaluation threshold reached;
- final ranking published.

### 26.6 `workflow_commands`

Durable commands from UI actions:

```text
id
workspace_id
command_type
subject_type
subject_id
payload_json
status
requested_by_user_id
created_at
processed_at nullable
```

Commands support transactional creation of a request before Trigger.dev execution begins.

### 26.7 Transactional outbox

Use an outbox pattern for commands whose database write and workflow dispatch must be consistent.

`workflow_outbox` fields:

```text
id
command_id
event_type
payload_json
status
attempt_count
available_at
published_at nullable
```

A dispatcher publishes pending outbox entries to Trigger.dev. This prevents a campaign draft from being saved while the corresponding workflow trigger is lost.

---

## 27. State Machines

### 27.1 Profile states

```text
draft
→ ingesting
→ synthesizing
→ awaiting_user_review
→ validating
→ published
```

Alternative terminal states:

```text
failed
cancelled
archived
```

### 27.2 Campaign strategy states

```text
draft
→ compiling
→ market_analysis
→ awaiting_strategy_review
→ validating
→ confirmed
```

### 27.3 Campaign run states

```text
queued
→ initializing
→ discovering
→ resolving_entities
→ evaluating_candidates
→ ranking
→ ready_for_review
→ completed
```

Non-terminal controls:

```text
pausing
paused
cancelling
```

Terminal alternatives:

```text
cancelled
failed
completed_partial
```

The stages may overlap internally. For example, entity resolution and candidate evaluation may begin while other discovery segments are still running. The campaign’s displayed primary stage should be derived from aggregate state, not used as the only workflow truth.

### 27.4 Campaign candidate states

```text
discovered
→ resolving_entity
→ queued_for_research
→ researching
→ evaluating
→ evaluated
→ ranked
→ ready_for_review
```

Alternative states:

```text
requires_research
excluded
rejected
invalid
duplicate_merged
approved
```

### 27.5 Task states

```text
pending
claimed
running
completed
partial
blocked
retry_wait
failed
cancelled
skipped
```

All transitions should be validated by application code or database functions.

---

## 28. Event and Audit Model

### 28.1 `intelligence_events`

Append-only domain event table.

```text
id
workspace_id
event_type
subject_type
subject_id
actor_type: user | system | model | provider
actor_id nullable
workflow_run_id nullable
task_run_id nullable
payload_json
created_at
```

Examples:

```text
profile.version_published
campaign.strategy_confirmed
discovery.segment_completed
entity.organization_merged
candidate.relationship_corrected
candidate.approved
memory.promotion_proposed
memory.promotion_accepted
workflow.cancelled
```

### 28.2 Audit requirements

For every important output, the system must answer:

- which user or system action initiated it;
- which input versions were used;
- which task produced it;
- which model and prompt were used;
- which provider records and evidence supported it;
- what deterministic rules were applied;
- what later event superseded it.

### 28.3 User corrections

Use a dedicated `user_corrections` table or typed event records with normalized fields:

```text
id
workspace_id
campaign_id nullable
campaign_candidate_id nullable
subject_type
subject_id
correction_type
old_value_json
new_value_json
scope_choice
reason nullable
created_by_user_id
created_at
```

A correction is never represented only by editing the current row in place.

---

## 29. Model Call Persistence

### 29.1 `model_calls`

```text
id
workspace_id
workflow_run_id nullable
task_run_id nullable
model_config_version_id
model_role
provider
model_id
prompt_version_id
contract_id
request_hash
status
started_at
completed_at nullable
input_token_count nullable
output_token_count nullable
cached_token_count nullable
cost_estimate_minor nullable
currency nullable
raw_response_location nullable
error_code nullable
```

Use minor currency units when storing monetary estimates.

### 29.2 `model_call_inputs`

Store input references and hashes rather than always duplicating complete source text.

### 29.3 `model_call_outputs`

```text
model_call_id
validated_output_json
validation_status
schema_errors_json nullable
repair_model_call_id nullable
content_hash
```

### 29.4 Sensitive content

Private documents and workspace-specific context must not be exposed to another tenant. Raw model inputs should follow retention policy and may be stored by reference or not retained depending on product policy.

### 29.5 Cache policy

Model outputs may be reused only when all relevant components match:

- prompt version;
- model config version;
- contract version;
- normalized input hash;
- evidence/source freshness policy;
- tenant visibility rules.

---

## 30. Provider Execution Persistence

`discovery_provider_executions` covers discovery calls. A general `provider_calls` view or table may support other provider types.

Required fields include:

- provider key;
- adapter version;
- capability snapshot;
- request hash;
- request payload or reference;
- pagination cursor;
- response count;
- raw record references;
- rate-limit metadata;
- latency;
- status;
- cost or credit usage estimate;
- error details.

Provider calls must not expose API keys in logs or payloads.

---

## 31. Usage and Cost Ledger

### 31.1 `usage_events`

Append-only usage ledger.

```text
id
workspace_id
campaign_id nullable
workflow_run_id nullable
task_run_id nullable
usage_type
provider_or_model
quantity
unit
estimated_cost_minor nullable
currency nullable
credit_cost nullable
metadata_json
occurred_at
```

Usage types may include:

- model input tokens;
- model output tokens;
- provider searches;
- provider records;
- website fetches;
- candidate deep research;
- candidate evaluation;
- contact enrichment later;
- outbound draft generation later.

### 31.2 Internal cost versus customer credits

Keep two separate concepts:

- estimated infrastructure/provider cost;
- customer-facing Opptium credit consumption.

The mapping from internal usage to customer credits is versioned business logic and should not be embedded in provider adapters.

### 31.3 Budget checks

The run controller should check budgets before dispatching a new expensive batch.

Budget dimensions may include:

- maximum internal estimated cost;
- maximum customer credits;
- maximum candidates discovered;
- maximum candidates deeply researched;
- maximum runtime;
- target qualified-company count.

### 31.4 Reconciliation

Provider or model final billing may differ from estimates. Support reconciliation records without rewriting the original usage event.

---

## 32. Progress Reporting

### 32.1 Persisted progress, not log parsing

The interface should read progress from normalized state and aggregate views. It should not parse Trigger.dev logs.

### 32.2 Progress dimensions

A campaign may show:

- strategy status;
- active discovery segments;
- candidate counts;
- unique entity counts;
- candidates queued for evaluation;
- evaluated candidates;
- candidates in review lanes;
- open coverage gaps;
- usage and budget;
- warnings;
- elapsed time.

### 32.3 Avoid misleading single percentages

The workflow is adaptive, so a precise overall percentage may be false. Prefer stage progress and factual counters.

A coarse overall percentage may be calculated from configured phase weights, but it must not imply that the total candidate universe is known in advance.

### 32.4 Progress snapshots

`workflow_progress_snapshots` may store periodic aggregates:

```text
id
workflow_run_id
stage
progress_json
created_at
```

Snapshots support real-time UI updates and historical analysis.

### 32.5 Event delivery

Use Supabase Realtime, polling, or server-sent updates over persisted records. The client should recover after refresh without losing context.

### 32.6 Counter consistency

Counters such as discovered, unique, evaluated, qualified, and ready for review must have explicit definitions.

For example:

- `discovered source records` is not the same as `normalized candidates`;
- `canonical organizations` is not the same as `campaign candidates`;
- `evaluated` is not the same as `eligible`;
- `qualified` must map to a defined lane or threshold;
- `ready for review` is the sum of specified review lanes, not a hidden separate count.

This avoids confusing outputs like inconsistent qualified and ready-for-review totals.

---

## 33. Compiled Context Services

Models should not query the database directly and should not receive every record.

Application services compile task-specific context.

### 33.1 `compileCompanyContext`

Returns:

- profile version;
- business model;
- relevant offering versions;
- buyer hypotheses;
- confirmed rules;
- critical unknowns;
- evidence summary.

### 33.2 `compileCampaignStrategyContext`

Returns:

- selected profile and offering versions;
- objective;
- geography;
- market findings;
- relevant memory;
- user adjustments;
- unresolved conflicts.

### 33.3 `compileDiscoverySegmentContext`

Returns:

- one semantic segment;
- provider capability snapshot;
- previous queries and filters;
- known candidates;
- coverage gap;
- active campaign corrections;
- remaining budget.

### 33.4 `compileCandidateResearchContext`

Returns:

- canonical identity;
- organization graph;
- existing evidence;
- unresolved research questions;
- campaign-specific factor requirements;
- source freshness state.

### 33.5 `compileCandidateEvaluationContext`

Returns:

- strategy and rubric references;
- relationship objective;
- applicable scoped rules;
- factor definitions;
- candidate evidence IDs and bounded excerpts;
- relevant candidate and campaign memory;
- contradictions and unknowns.

### 33.6 Context snapshots

For consequential tasks, store the compiled context hash and optionally a snapshot reference so the output can be reproduced.

---

## 34. Invalidation and Selective Recomputation

### 34.1 Dependency graph

Outputs depend on upstream versions and records.

Examples:

```text
Profile offering changed
    → campaign drafts using latest profile may become stale
    → confirmed historical strategies remain valid snapshots
```

```text
Campaign exclusion changed
    → exclusion assessment
    → eligibility
    → score denominator where applicable
    → review lane
    → comparative rank
```

```text
Candidate parent company corrected
    → buying organization
    → relationship
    → procurement factor
    → exclusions
    → evaluation
    → ranking
```

```text
Scoring formula changed
    → score and confidence calculations
    → lane and rank
    → no new web research required
```

### 34.2 `invalidation_events`

```text
id
workspace_id
trigger_type
trigger_record_id
reason
affected_subjects_json
created_at
```

### 34.3 `recomputation_jobs`

```text
id
invalidation_event_id
subject_type
subject_id
required_tasks_json
status
created_at
completed_at nullable
```

### 34.4 Invalidation planner

A deterministic service should map changes to affected task classes.

Do not ask an LLM to decide the technical dependency graph.

### 34.5 Staleness states

Records may be:

- current;
- stale;
- superseded;
- invalidated;
- pending recomputation.

The UI should not silently present stale results as current.

### 34.6 Evidence freshness

Expired evidence does not necessarily delete a claim. It may:

- reduce confidence;
- mark a factor for verification;
- trigger selective refresh for top candidates;
- remain sufficient for stable identity facts.

---

## 35. Entity Merge and Split Effects

### 35.1 Merge

When organizations are merged:

- source links move to the surviving organization;
- aliases and identifiers are reconciled;
- relationship graph is rebuilt;
- duplicate campaign candidates are consolidated;
- campaign discovery links are preserved;
- private memories remain workspace-scoped;
- evaluations are marked stale if buying or display organization changes;
- rank snapshots remain historical.

### 35.2 Split

A split requires an explicit reassignment plan for:

- domains;
- identifiers;
- source records;
- locations;
- evidence;
- relationships;
- campaign candidates.

Affected evaluations must be invalidated.

### 35.3 Concurrency lock

Merge and split operations should acquire organization-graph locks to prevent simultaneous conflicting edits.

---

## 36. Model Role Configuration

### 36.1 Model roles

Use semantic roles rather than model names in workflow code.

Recommended roles:

- `fast_extraction` — page facts, basic classification, formatting;
- `commercial_reasoning` — business model, offerings, archetypes, strategy, difficult relationship reasoning;
- `verification` — conflicting evidence and high-value uncertainties;
- `comparative_ranking` — batch comparison and anomaly detection;
- `explanation` — evidence-bounded user-facing summaries.

### 36.2 Strong-model allocation

Use the stronger reasoning role for:

- profile commercial synthesis;
- campaign target and qualification strategy;
- ambiguous relationship classification;
- critical exclusions;
- comparative ranking;
- difficult conflict resolution.

Do not spend the strongest model on:

- deterministic score calculations;
- simple field normalization;
- known-domain extraction;
- progress aggregation;
- formatting existing structured data.

### 36.3 Fallbacks

A role may define ordered fallbacks. Fallback use must be recorded.

A fallback should not silently change structured-output semantics. It must support the same contract.

### 36.4 Model failure isolation

If comparative ranking fails, individual evaluations remain available. If one candidate evaluation fails, discovery continues. Parent workflows should degrade gracefully rather than fail the whole campaign whenever possible.

### 36.5 Model changes and reproducibility

Store actual provider and model IDs for each call even when workflow code references a semantic role.

---

## 37. Prompt and Schema Registry

### 37.1 Prompts are code-adjacent assets

Prompt templates should be version-controlled in the repository and registered in the database during deployment or migration.

### 37.2 Prompt inputs

Every prompt should receive:

- task purpose;
- output contract;
- bounded evidence context;
- applicable rules;
- definitions for `unknown`, inference, and contradiction;
- explicit prohibited behavior;
- stable identifiers for evidence references.

### 37.3 Prompt outputs

Model tasks return JSON validated against a registered schema.

Do not depend on parsing prose sections from a model response.

### 37.4 Prompt audit

A model call references the exact prompt version and content hash. Updating a prompt creates a new version.

### 37.5 Reasoning storage

Store concise reasoning summaries and evidence mappings. Do not require or persist private chain-of-thought.

---

## 38. Provider Abstraction in Orchestration

### 38.1 Provider interface

```ts
interface CompanyDiscoveryProvider {
  id: string;
  adapterVersion: string;

  getCapabilities(): Promise<DiscoveryProviderCapabilities>;

  compileRequest(
    segment: DiscoverySegmentRequest,
    context: DiscoveryProviderContext,
  ): Promise<CompiledProviderRequest[]>;

  execute(request: CompiledProviderRequest): Promise<ProviderExecutionResult>;

  normalize(sourceRecord: ProviderSourceRecord): Promise<NormalizedProviderCandidate[]>;
}
```

### 38.2 Current implementation

The first active provider is `WebSearchProvider`.

It compiles semantic segments into:

- local-language searches;
- buyer-archetype searches;
- business-model signal searches;
- specialist directory searches;
- known-company verification searches;
- gap-targeted searches.

### 38.3 Future providers

PDL, Apollo, Coresignal, registries, maps, or directories implement the same provider boundary.

Adding one should require:

- adapter implementation;
- capability definition;
- mapping to normalized candidates;
- source routing rules;
- provider-specific tests;
- usage accounting.

It must not require changes to:

- profile intelligence;
- campaign strategy contracts;
- entity resolution contracts;
- qualification logic;
- scoring;
- result UI contracts.

### 38.4 Provider capability snapshots

A discovery plan references the capability snapshot used when routing was decided. If a provider changes later, historical plans remain explainable.

---

## 39. Security and Multi-Tenant Isolation

### 39.1 Row-level security

All workspace-private tables must enforce workspace membership through RLS or server-side trusted access patterns.

Workspace-private records include:

- company profiles;
- campaign strategies;
- memories;
- campaign candidates;
- evaluations;
- corrections;
- internal notes;
- uploaded sources;
- usage and billing records.

### 39.2 Public canonical data

Shared public organization records require careful access rules. Public identity may be reused, but one tenant must never see another tenant’s:

- relationship judgment;
- exclusion;
- review decision;
- outreach status;
- memory;
- uploaded evidence;
- private notes.

### 39.3 Service role usage

Trigger.dev workers may use a privileged service role only in trusted server environments. Every task must still include and validate `workspaceId` to prevent cross-tenant writes caused by programming mistakes.

### 39.4 Secrets

Provider and model secrets must remain outside database payloads and logs.

### 39.5 User-supplied URLs and content

Fetching services must protect against SSRF and unsafe schemes. Normalize and validate URLs, block private network ranges, and restrict file handling.

### 39.6 Audit visibility

Administrators may need operational logs, but raw private customer content should be minimized and access-controlled.

---

## 40. Data Retention and Lifecycle

### 40.1 Keep durable commercial records

Retain:

- published profile and strategy versions;
- user corrections;
- evidence references used for conclusions;
- evaluation versions;
- rank snapshots;
- merge/split history;
- usage ledger;
- audit events.

### 40.2 Potentially expire heavy raw data

Subject to product policy, expire or archive:

- repeated raw HTML bodies;
- raw provider payloads after normalized retention requirements are met;
- low-value model raw responses;
- temporary workflow payloads;
- obsolete draft snapshots.

Before deletion, ensure historical conclusions retain sufficient evidence references and legal/commercial requirements are satisfied.

### 40.3 Draft cleanup

Abandoned drafts and failed transient runs may be archived after a configured period, but only when they are not referenced by active workflows or audit requirements.

### 40.4 User deletion

Workspace deletion must remove or anonymize tenant-private data while preserving only system-public organization data that was independently obtained from public sources and is lawful to retain.

---

## 41. Observability

### 41.1 Operational metrics

Track:

- workflow duration by family;
- task duration and failure rate;
- retry count;
- provider latency and error rate;
- model latency and invalid-output rate;
- website fetch success rate;
- duplicate rate;
- entity-resolution ambiguity rate;
- candidate research cost;
- candidate evaluation cost;
- qualified yield by segment and provider;
- time to first reviewable candidate;
- time to campaign completion.

### 41.2 Intelligence metrics

Track:

- relationship correction rate;
- exclusion correction rate;
- factor correction rate;
- score inversion anomalies;
- user approval rate by review lane;
- percentage of material factors with evidence;
- unknown critical-factor rate;
- confidence calibration;
- repeated discovery of already-known candidates.

### 41.3 Structured logs

Every log entry should include where applicable:

- workspace ID;
- workflow run ID;
- task run ID;
- campaign ID;
- candidate ID;
- provider/model role;
- version IDs;
- error code.

Do not log secrets or complete private source content.

### 41.4 Alerts

Alert on:

- sustained provider failures;
- model invalid-output spikes;
- duplicate task executions despite idempotency;
- stuck task leases;
- runaway campaign spend;
- campaign runs with no progress;
- high mismatch between discovered and unique candidates;
- impossible counter combinations;
- repeated entity merge reversals.

---

## 42. Performance Strategy

### 42.1 Cheap work first

Order the pipeline so inexpensive deterministic checks occur before expensive research:

```text
normalize
→ exact deduplicate
→ basic exclusion checks
→ entity resolution
→ bounded research
→ factor evaluation
→ comparative ranking
```

### 42.2 Progressive results

The user should receive qualified candidates progressively. Do not wait for market-wide discovery to finish before evaluating the first strong segment.

### 42.3 Cache stable public evidence

Reuse public website fetches and stable identity evidence based on freshness rules. Do not repeatedly fetch the same page for every campaign.

### 42.4 Batch model calls carefully

Batch compatible tasks when it improves cost and comparison quality, while keeping outputs attributable to individual candidates.

Good batching candidates:

- page fact extraction from short related pages;
- factor evaluation with consistent rubric;
- comparative ranking.

Avoid huge batches that make one invalid item fail the entire request or exceed context limits.

### 42.5 Context budgeting

Context compilers should rank evidence by:

- relevance to current question;
- directness;
- reliability;
- freshness;
- contradiction value.

Do not send complete websites or all campaign memories to every call.

### 42.6 Database indexes

Important indexes include:

- workspace and state indexes on all tenant tables;
- canonical/normalized domain;
- normalized organization name plus country;
- provider namespace and provider record ID;
- campaign ID plus organization ID;
- strategy version plus evaluation state;
- active task lease and status;
- memory scope and status;
- evidence subject and claim key;
- usage event time and workspace;
- unique idempotency key.

---

## 43. Error Taxonomy

Use stable error codes grouped by domain.

### 43.1 Validation

```text
input_schema_invalid
output_schema_invalid
version_missing
version_mismatch
state_transition_invalid
```

### 43.2 Provider

```text
provider_rate_limited
provider_timeout
provider_auth_failed
provider_capability_unsupported
provider_response_invalid
```

### 43.3 Website ingestion

```text
fetch_blocked
fetch_timeout
unsupported_content
content_empty
robots_or_policy_block
```

### 43.4 Model

```text
model_timeout
model_rate_limited
model_output_invalid
model_content_refused
model_context_too_large
```

### 43.5 Entity resolution

```text
identity_ambiguous
merge_conflict
graph_cycle_detected
canonical_domain_conflict
```

### 43.6 Campaign logic

```text
strategy_not_confirmed
rubric_missing
rule_scope_invalid
no_provider_route
budget_exhausted
coverage_stalled
```

### 43.7 System

```text
task_lease_conflict
transaction_failed
outbox_publish_failed
workflow_cancelled
unexpected_internal_error
```

User-visible messages should be friendlier and should explain whether action is needed.

---

## 44. Recovery Procedures

### 44.1 Stuck workflow

A recovery service should detect workflows with no heartbeat or state change beyond configured limits.

Recovery may:

- reclaim expired task leases;
- retry pending outbox events;
- mark orphan Trigger.dev executions;
- resume from last checkpoint;
- move irrecoverable work to failed with a clear error.

### 44.2 Lost provider response after successful billing

Where possible, use provider request IDs and idempotency. If the result cannot be recovered, record the usage event and retry only according to provider semantics.

### 44.3 Candidate merged while evaluating

The evaluation task must check canonical redirects before finalizing. If the candidate was merged:

- cancel or redirect finalization;
- link reusable evidence to the survivor where valid;
- invalidate duplicate campaign candidate state;
- queue the surviving candidate for evaluation if necessary.

### 44.4 Strategy superseded during queued work

Tasks tied to the old immutable strategy may complete for historical consistency, but their results must not become current for the new strategy. The run controller decides whether to cancel low-value queued work.

### 44.5 Model configuration disabled

Queued tasks should resolve configuration at dispatch time only when the workflow explicitly permits latest-active config. Prefer pinning the version when the workflow begins. If the pinned model becomes unavailable, use an approved fallback and record it.

---

## 45. Testing Requirements

### 45.1 Unit tests

Cover:

- state transitions;
- scoped rule applicability;
- memory precedence;
- idempotency keys;
- score calculations;
- confidence caps;
- coverage calculations;
- invalidation planning;
- canonical domain normalization;
- merge/split reassignment;
- budget checks.

### 45.2 Contract tests

Every model and provider adapter needs fixture-based contract tests.

Test:

- valid outputs;
- missing optional fields;
- malformed outputs;
- unknown values;
- contradictions;
- pagination;
- rate-limit handling;
- duplicate records;
- multilingual strings.

### 45.3 Workflow integration tests

Simulate:

- complete successful workflow;
- provider timeout and retry;
- model invalid JSON and repair;
- campaign cancellation;
- pause and resume;
- strategy change;
- duplicate candidate convergence;
- organization merge during evaluation;
- user correction and selective recomputation;
- partial completion with reviewable results.

### 45.4 Database tests

Verify:

- RLS isolation;
- unique constraints;
- immutable version enforcement;
- transactional outbox behavior;
- task lease reclamation;
- foreign-key integrity;
- historical references after archive/merge.

### 45.5 Load tests

Test several campaigns concurrently with:

- many provider source records;
- high duplicate rates;
- slow websites;
- model rate limits;
- long-running candidate queues.

The system must respect workspace and global backpressure.

---

## 46. Migration and Compatibility Notes

Detailed rollout belongs to Document 08, but this data model must support side-by-side legacy and V2 operation.

### 46.1 Feature flag

Add an intelligence engine field on campaigns or runs:

```text
legacy | v2
```

### 46.2 Preserve current infrastructure

Reuse where suitable:

- authentication;
- workspace ownership;
- Trigger.dev project;
- existing web search integration;
- website fetchers;
- progress UI shell;
- campaign and lead navigation;
- table components.

### 46.3 Do not force legacy records into false V2 precision

Legacy candidates may be imported with:

- source provenance;
- canonical organization link where resolvable;
- legacy score and explanation;
- `legacy_unverified` status.

They should not be presented as evidence-based V2 evaluations until reprocessed.

### 46.4 Dual writes should be temporary

Where migration requires dual writes, define an end date and ownership. Avoid indefinitely maintaining two sources of truth.

---

## 47. Recommended Repository Structure

One possible structure:

```text
src/
  intelligence/
    contracts/
    profile/
    campaign/
    discovery/
      providers/
        web-search/
        pdl/            # later
        apollo/         # later
    entities/
    candidates/
    qualification/
    ranking/
    memory/
    orchestration/
    contexts/
    invalidation/
    usage/

  db/
    repositories/
    transactions/
    views/
    generated-types/

  models/
    gateway/
    roles/
    prompts/
    schemas/

  trigger/
    workflows/
    tasks/
    shared/
```

### 47.1 Domain services

Keep business logic in testable services rather than embedding it directly in Trigger.dev task files.

A Trigger task should mainly:

1. validate input;
2. load required records;
3. call domain/provider/model services;
4. persist output transactionally;
5. return references.

### 47.2 Repository boundaries

Use repositories or typed data-access modules for:

- profiles;
- strategies;
- discovery;
- organizations;
- evidence;
- evaluations;
- memories;
- workflow state;
- usage.

This makes RLS and tenant filtering consistent.

---

## 48. Implementation Phases for Document 06

### Phase 1 — Shared contracts and registries

Implement:

- core IDs and enums;
- contract registry;
- prompt version registry;
- model configuration versions;
- scoring versions;
- shared task envelope;
- model and provider gateways.

### Phase 2 — Workflow persistence

Implement:

- workflow runs;
- task runs and attempts;
- leases;
- commands;
- transactional outbox;
- checkpoints;
- events;
- usage ledger.

### Phase 3 — Company and campaign versions

Implement:

- profile drafts and versions;
- offering identities and versions;
- strategy drafts and versions;
- rules;
- memories and snapshots;
- qualification rubrics.

### Phase 4 — Discovery persistence and provider boundary

Implement:

- semantic plans and segments;
- source plans;
- WebSearchProvider adapter;
- provider executions;
- raw and normalized records;
- coverage and gap tables.

### Phase 5 — Entity and Candidate Intelligence

Implement:

- canonical organizations;
- source links;
- entity-resolution cases;
- organization graph;
- campaign candidates;
- candidate research and evidence versions.

### Phase 6 — Qualification and ranking

Implement:

- relationship, exclusion, and eligibility records;
- factor evaluations;
- deterministic score traces;
- confidence calculations;
- review lanes;
- comparative batches and rank snapshots.

### Phase 7 — Invalidation and correction flows

Implement:

- user corrections;
- dependency/invalidation planner;
- selective recomputation;
- memory promotion proposals;
- merge/split effects.

### Phase 8 — Operational hardening

Implement:

- concurrency limits;
- budget enforcement;
- progress aggregates;
- alerts;
- retention jobs;
- recovery procedures;
- load testing.

---

## 49. Acceptance Criteria

### 49.1 Workflow reliability

- Every long-running workflow can resume from persisted state.
- Retrying any task does not create duplicate logical output.
- A campaign can be paused, resumed, or cancelled without losing completed work.
- One candidate failure does not normally fail the whole campaign.
- Expired task leases can be safely reclaimed.

### 49.2 Version integrity

- Every published profile and strategy is immutable.
- Every evaluation references exact strategy, evidence, rubric, model, prompt, and scoring versions.
- Historical results remain queryable after newer versions are created.
- Model and prompt changes do not silently alter old results.

### 49.3 Provider independence

- Web search is implemented behind the provider interface.
- Semantic discovery plans contain no provider-only query strings.
- Provider records remain separate from canonical organizations.
- A mock database provider can be added without changing qualification code.

### 49.4 Data integrity

- A campaign cannot have duplicate active candidates for the same canonical organization and strategy version.
- Entity merges and splits preserve audit history.
- Scope and applicability are mandatory for exclusions and memories.
- User corrections are append-only events.
- Counters shown to the user have explicit, consistent definitions.

### 49.5 Deterministic qualification

- Models do not write final fit scores directly.
- Score and confidence traces can be recalculated from factor records.
- Hard exclusions occur before normal scoring.
- Unknown evidence is represented separately from negative evidence.

### 49.6 Auditability

For a reviewed candidate, the system can show:

- how it was discovered;
- which provider/query or source found it;
- how it was resolved to a canonical organization;
- which pages and evidence were used;
- how relationship and factors were classified;
- how the score and confidence were calculated;
- how comparative ranking affected position;
- which user corrections changed the result.

### 49.7 Security

- Workspace-private data is isolated by tenant.
- Public canonical organizations do not expose another tenant’s evaluations or memories.
- Provider/model secrets never appear in task payloads or logs.
- User-supplied URLs are safely validated and fetched.

### 49.8 Performance

- Discovery and evaluation can run progressively and in parallel within configured limits.
- Reusable public evidence is cached with freshness controls.
- Downstream backpressure prevents unbounded candidate accumulation.
- Cost and customer-credit usage are recorded before another expensive batch is dispatched.

---

## 50. Final Implementation Rule

The workflow architecture must preserve this dependency:

> **Versioned Company Intelligence → Versioned Campaign Strategy → Provider-independent Discovery Plan → Persisted Source Records → Canonical Entities → Evidence-backed Candidate Intelligence → Deterministic Qualification → Comparative Ranking → Scoped Learning**

No task should bypass that chain by generating a lead and an arbitrary score in one model call.

The technical system is successful when Opptium can change search providers, models, scoring formulas, or campaign strategy versions without losing auditability and without requiring another redesign of the commercial intelligence core.

---

## 51. Next Document

Document 07 defines the product flows and interface requirements that expose this architecture without overwhelming the user, including:

- Company Profile review;
- campaign strategy confirmation;
- discovery progress;
- compact result lanes and tables;
- expanded evidence and score explanations;
- scoped exclusion controls;
- correction and memory-promotion interactions;
- user-facing terminology and progressive disclosure.
