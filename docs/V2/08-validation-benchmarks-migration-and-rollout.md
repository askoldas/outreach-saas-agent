# Opptium Intelligence V2

## Validation, Benchmarks, Migration, and Rollout

**Document:** 08  
**Status:** Release and quality specification  
**Depends on:** `00-documentation-map-and-core-principles.md` through `07-product-flows-and-interface-requirements.md`  
**Purpose:** Define how Intelligence V2 is validated, benchmarked, migrated, released, monitored, compared with the legacy pipeline, and ultimately made the default intelligence system without losing data, trust, or operational control.

---

## 1. Purpose

Intelligence V2 changes the core behavior of Opptium. It introduces new commercial reasoning, structured Company Intelligence, versioned Campaign Strategy, scoped memory, provider-independent discovery, canonical entity resolution, evidence-based qualification, deterministic scoring, and comparative ranking.

Because these changes affect the product’s central promise, the refactor cannot be considered complete merely because:

- the new workflows execute successfully;
- the UI displays results;
- model responses validate against schemas;
- discovery returns companies;
- score calculations complete;
- isolated examples look convincing.

The system must demonstrate that it produces better commercial decisions than the legacy pipeline across materially different business models, objectives, geographies, market sizes, and evidence conditions.

This document defines:

- the Intelligence V2 benchmark suite;
- golden datasets and annotation standards;
- offline and online evaluation methods;
- metrics for every intelligence layer;
- release gates and acceptance thresholds;
- regression testing;
- cost, latency, and reliability validation;
- shadow-mode operation;
- feature flags and cohort rollout;
- migration of profiles, campaigns, candidates, and corrections;
- rollback and kill-switch behavior;
- observability and incident response;
- provider-adapter qualification;
- criteria for freezing and removing the legacy workflow.

The main rule is:

> Intelligence V2 must be proven through repeatable benchmark evidence and controlled production rollout, not through confidence in prompts or success on one demonstration campaign.

---

## 2. Scope

This document covers validation and rollout for:

- Company Intelligence generation;
- business-model interpretation;
- offering decomposition;
- buyer-hypothesis generation;
- clarification-question generation;
- campaign strategy compilation;
- scoped exclusions and memory;
- market interpretation;
- semantic discovery planning;
- WebSearchProvider execution;
- future provider adapters;
- discovery coverage and gap analysis;
- entity resolution;
- reusable Candidate Intelligence;
- campaign-specific relationship classification;
- hard exclusions and eligibility;
- evidence-factor extraction;
- deterministic scoring;
- confidence calculation;
- comparative ranking;
- user corrections and learning promotion;
- Trigger.dev workflow reliability;
- Supabase migration and data integrity;
- product flows and user understanding;
- performance, cost, security, and auditability.

This document does not redefine the intelligence logic, provider contracts, scoring rules, data model, or UI behavior. Those are defined in Documents 01–07. It defines how those specifications are tested and released.

---

## 3. Validation Principles

### 3.1 Validate decisions, not fluency

A well-written explanation does not prove that the system selected the correct buyer, excluded the correct competitor, or interpreted the workspace company accurately.

Evaluation must compare structured decisions against reviewed reference labels.

### 3.2 Test across business models

A system validated only on B2B SaaS is not validated for:

- wholesale;
- manufacturing;
- professional services;
- logistics;
- marketplaces;
- agencies;
- distributor recruitment;
- partner discovery;
- local-market businesses.

The benchmark must intentionally include different value-chain positions and buying motions.

### 3.3 Include deceptive false positives

Easy negative examples are insufficient. The benchmark must contain companies that:

- share the same industry but have the wrong business model;
- appear to be buyers but are competitors;
- operate locally but purchase centrally elsewhere;
- are country storefronts of one parent organization;
- are brand-owned outlets rather than independent buyers;
- are directories rather than operating companies;
- fit the profile descriptively but lack the required operational capability;
- could be partners for one objective and exclusions for another.

These examples expose whether the system understands commercial compatibility rather than category similarity.

### 3.4 Separate source recall from qualification quality

A candidate cannot be qualified if it was never discovered. A discovery provider can have good recall but poor precision. A qualification model can be excellent while the source plan misses important companies.

Metrics must therefore be reported separately for:

- discovery;
- entity resolution;
- evidence collection;
- qualification;
- ranking.

### 3.5 Preserve unknowns

Benchmark labels must distinguish:

- confirmed positive;
- confirmed negative;
- unknown;
- conflicting;
- not applicable.

The system must not be rewarded for confidently guessing when evidence is unavailable.

### 3.6 Evaluate full workflows and components

Both are required:

- component tests identify where errors originate;
- end-to-end tests measure the user-visible outcome.

### 3.7 Compare against a baseline

Every major Intelligence V2 release must be compared with:

- the current legacy pipeline;
- the last accepted Intelligence V2 release;
- deterministic or lightweight baselines where useful.

Absolute metrics alone are not enough. The release must not silently regress from the previous accepted version.

### 3.8 Protect benchmark integrity

Benchmark labels and expected companies must not be inserted into production prompts or retrieval context.

Prompt authors may know the benchmark categories, but the execution system must not receive hidden expected answers.

### 3.9 Human review remains the reference for ambiguous commercial judgement

Some relationships cannot be proven from public evidence. In those cases, benchmark labels should represent the best reasoned commercial judgement, include uncertainty, and preserve disagreement where reviewers cannot reach strong consensus.

### 3.10 Rollout must be reversible

No migration or release phase may remove the ability to:

- stop new Intelligence V2 runs;
- route users back to the legacy workflow where supported;
- preserve already-created V2 data;
- replay failed jobs;
- compare output versions;
- roll back prompt, model, scoring, or provider configurations.

---

## 4. Validation Layers

Intelligence V2 must be evaluated at six levels.

### 4.1 Contract validation

Verifies that:

- schemas are complete;
- enum values are valid;
- required evidence references exist;
- version references are consistent;
- deterministic score traces can be recomputed;
- state transitions are legal;
- tasks are idempotent;
- foreign-key and workspace boundaries are preserved.

### 4.2 Component intelligence validation

Tests individual intelligence functions such as:

- extracting facts;
- identifying business models;
- decomposing offerings;
- proposing buyer archetypes;
- classifying relationships;
- evaluating factors;
- generating clarification questions;
- detecting campaign memory conflicts.

### 4.3 Pipeline-stage validation

Tests complete stages:

- profile creation;
- campaign strategy compilation;
- discovery planning and execution;
- entity resolution;
- candidate research;
- qualification;
- comparative ranking.

### 4.4 End-to-end campaign validation

Measures the full result experienced by the user:

- quality of the final strategy;
- useful coverage of the target market;
- correctness of top-ranked candidates;
- exclusion of invalid relationships;
- evidence quality;
- time and cost;
- user effort required to correct the system.

### 4.5 Production behavior validation

Measures:

- workflow completion;
- retries;
- timeout behavior;
- partial results;
- cancellations;
- stale data;
- user corrections;
- approval rates;
- reclassification rates;
- provider yield;
- system cost.

### 4.6 User comprehension validation

Tests whether users understand:

- what the profile says;
- what is confirmed versus inferred;
- why the campaign targets certain archetypes;
- what an exclusion applies to;
- why a company was recommended;
- the difference between fit, potential, and confidence;
- how to correct and scope a rule.

A technically accurate system that users cannot understand is not ready.

---

## 5. Benchmark Suite Structure

The benchmark suite should contain four related datasets.

### 5.1 Company Profile Benchmark

Tests whether Opptium can understand the workspace company.

Each case includes:

- company website snapshot or approved source corpus;
- optional uploaded materials;
- expected company roles;
- expected value-chain position;
- expected business model;
- expected offering decomposition;
- expected commercial mechanics;
- expected buyer/user/payer distinctions;
- expected high-impact uncertainties;
- expected buyer hypotheses;
- expected exclusions or incompatibilities;
- claims with evidence labels.

### 5.2 Campaign Strategy Benchmark

Tests whether the system correctly compiles a campaign from:

- a reviewed Company Intelligence version;
- a selected offering;
- a campaign objective;
- target geography;
- campaign constraints;
- scoped memory and exclusions.

Expected outputs include:

- target hypothesis;
- priority archetypes;
- conditional archetypes;
- incompatible archetypes;
- exclusion rules;
- qualification factors;
- positive and negative signals;
- discovery segments;
- source plan;
- coverage and stopping policy.

### 5.3 Candidate Evaluation Benchmark

Contains individual candidate organizations with:

- canonical identity;
- source records;
- company evidence;
- expected parent/branch/storefront relationship;
- expected campaign relationship;
- expected eligibility;
- factor-level labels;
- expected fit range;
- expected potential range;
- expected confidence range;
- expected queue;
- explanatory reference notes.

### 5.4 End-to-End Campaign Benchmark

Contains complete campaigns with:

- known market candidates;
- known strong positives;
- known difficult negatives;
- known competitors or suppliers;
- known duplicates;
- hidden holdout candidates;
- market coverage expectations;
- final ranking expectations;
- cost and latency envelopes.

The end-to-end benchmark should use the same workflow as production, with only provider fixtures or controlled live-source modes changed as appropriate.

---

## 6. Representative Benchmark Portfolio

The initial benchmark should contain at least ten campaign families. More cases may be added, but the suite must not be dominated by one business model.

### 6.1 B2B SaaS direct buyers

Example characteristics:

- a software product sold to mid-market companies;
- users and economic buyers are different roles;
- technology or process maturity matters;
- agencies may be users, partners, or exclusions depending on objective.

Tests:

- technology compatibility;
- company-size constraints;
- likely internal function;
- distinction between direct buyer and service partner.

### 6.2 Enterprise software or integration service

Example characteristics:

- long sales cycle;
- minimum organizational complexity;
- internal implementation capacity required;
- centralized procurement likely.

Tests:

- purchasing capability;
- operational readiness;
- parent-company buying authority;
- exclusion of small superficially relevant companies.

### 6.3 Industrial manufacturer seeking distributors

Example characteristics:

- campaign objective is distributor recruitment rather than direct buyers;
- candidate must represent complementary manufacturers;
- local technical service may matter;
- manufacturers in the same category may be competitors.

Tests:

- relationship interpretation;
- distributor versus reseller distinction;
- service capability;
- regional coverage.

### 6.4 Wholesaler seeking retail buyers

Example characteristics:

- buyer resells inventory;
- procurement model is more important than visual category similarity;
- competing wholesalers must be excluded;
- independent outlets may outrank premium retailers.

Tests:

- resale compatibility;
- stock or inventory model;
- competitor classification;
- buying autonomy.

### 6.5 Professional-services agency

Example characteristics:

- multiple offerings with different buyers;
- project triggers matter;
- companies with internal teams may still buy overflow support;
- other agencies can be competitors, subcontractors, or partners.

Tests:

- offering decomposition;
- trigger logic;
- objective-sensitive relationship classification.

### 6.6 Logistics provider

Example characteristics:

- geographic and operational requirements;
- shipment type and volume matter;
- some companies are intermediaries rather than end customers;
- local office may not control contracts.

Tests:

- operational compatibility;
- regional serviceability;
- procurement authority.

### 6.7 Marketplace seeking supply-side partners

Example characteristics:

- campaign target is providers or sellers, not buyers;
- the platform’s “customer” terminology may be ambiguous;
- competitors can look almost identical to targets.

Tests:

- two-sided business models;
- objective interpretation;
- supplier versus competitor distinction.

### 6.8 Cybersecurity consultancy or managed service

Example characteristics:

- trust and compliance signals matter;
- regulated industries may be priority targets;
- companies with mature internal teams can still be buyers;
- other consultancies may be partners or competitors.

Tests:

- nuanced need signals;
- no simplistic technology-presence exclusions;
- evidence quality.

### 6.9 Local service business or multi-location operator

Example characteristics:

- web and maps coverage may be better than company databases;
- legal entities and brands may differ;
- small local businesses may have sparse websites.

Tests:

- WebSearchProvider behavior;
- low-evidence confidence;
- entity resolution across location pages.

### 6.10 Strategic partnerships or channel campaigns

Example characteristics:

- companies excluded from direct-buyer campaigns may be valuable partners;
- campaign objective overrides broad assumptions;
- relationship quality may not map to immediate revenue.

Tests:

- scoped exclusions;
- specific-context precedence;
- offering-level memory reuse without global contamination.

### 6.11 Optional expansion cases

The benchmark should later add:

- healthcare procurement;
- construction suppliers;
- recruitment services;
- financial technology;
- education providers;
- hospitality suppliers;
- climate or energy technology;
- highly specialized scientific equipment;
- public-sector-oriented campaigns where permitted.

---

## 7. Geography and Market Diversity

The benchmark must include:

- one-country campaigns;
- multi-country regional campaigns;
- small markets;
- large markets;
- markets with strong English-language web presence;
- markets requiring local-language queries;
- countries with strong national registries;
- countries with weak public data;
- candidates with cross-border operations;
- candidates whose local storefront is not the buying organization.

The initial suite should include substantial European coverage because that is relevant to the product’s near-term use. However, schemas and tests must not encode Europe-only assumptions.

For multilingual cases, benchmark fixtures should preserve:

- original-language evidence;
- normalized English interpretation where needed;
- local terminology used for buyer archetypes;
- translated search-query intent;
- source-language metadata.

---

## 8. Golden Dataset Creation

### 8.1 Case selection

Cases should be selected from:

- real user-like companies with publicly accessible materials;
- synthetic companies only when needed to isolate logic;
- historical production campaigns that can be lawfully reused;
- manually researched markets;
- deliberately constructed adversarial cases.

No benchmark should depend on private customer data without explicit authorization and suitable anonymization.

### 8.2 Evidence freezing

Web content changes over time. For reproducible benchmarks, store approved snapshots or extracted evidence packages containing:

- URL;
- retrieval timestamp;
- page title;
- relevant text excerpts;
- structured metadata;
- content hash;
- language;
- evidence type;
- screenshot or archived representation when necessary and legally appropriate.

The benchmark should support two modes:

1. **Frozen mode** — deterministic evaluation against stored evidence.
2. **Live mode** — controlled test of current provider and web behavior.

Frozen mode is the release gate for intelligence regressions. Live mode measures source drift and operational reality.

### 8.3 Annotation roles

Each benchmark case should be reviewed by at least two people for material commercial labels.

Suggested roles:

- primary analyst;
- independent reviewer;
- adjudicator for disagreements.

For difficult industry-specific cases, use an external domain expert when practical.

### 8.4 Annotation guide

Reviewers must use a written guide defining:

- company role categories;
- relationship labels;
- eligibility states;
- factor meanings;
- evidence status;
- confidence bands;
- exclusion scopes;
- entity-resolution rules;
- ranking expectations.

The guide should include positive and negative examples.

### 8.5 Uncertainty labels

Reference labels may include:

- `confirmed`;
- `strongly_supported`;
- `plausible`;
- `unknown`;
- `conflicting`;
- `unlikely`;
- `confirmed_negative`.

For scoring tests, expected values should often be ranges rather than exact numbers.

Example:

```ts
interface ExpectedScoreRange {
  min: number;
  max: number;
  rationale: string;
}
```

This avoids pretending that human commercial judgement has false numerical precision.

### 8.6 Inter-reviewer agreement

Track agreement for:

- relationship classification;
- eligibility;
- entity grouping;
- factor states;
- top-tier versus non-top-tier ranking.

Low agreement indicates either:

- ambiguous evidence;
- a weak annotation guide;
- a genuinely uncertain case.

Such cases should not be used as strict blocking gates unless adjudicated.

### 8.7 Holdout set

At least 20% of benchmark cases should remain holdout cases not used during prompt tuning.

Holdout cases should include:

- unseen industries;
- unseen company structures;
- difficult negatives;
- multilingual evidence;
- objective changes using familiar companies.

### 8.8 Benchmark versioning

Every benchmark release must have:

- benchmark version;
- case IDs;
- evidence snapshot version;
- annotation-guide version;
- reviewer metadata;
- change log;
- deprecated-case list;
- known limitations.

Production release reports must name the exact benchmark version used.

---

## 9. Benchmark Data Contracts

A benchmark campaign may use the following contract:

```ts
interface BenchmarkCampaignCase {
  id: string;
  version: number;
  title: string;

  workspaceCompanyFixtureId: string;
  companyProfileExpectationId: string;

  campaignInput: {
    offeringKey: string;
    objective: string;
    geographies: string[];
    userConstraints: Record<string, unknown>;
    scopedMemories: BenchmarkMemoryFixture[];
  };

  strategyExpectationId: string;
  candidateUniverseFixtureId: string;
  expectedCandidateLabels: BenchmarkCandidateLabel[];
  expectedRanking: BenchmarkRankingExpectation;

  executionPolicy: {
    frozenProviders: string[];
    liveProviders?: string[];
    maximumRuntimeSeconds?: number;
    maximumEstimatedCostEur?: number;
  };

  tags: string[];
  difficulty: "standard" | "difficult" | "adversarial";
  holdout: boolean;
}
```

Candidate labels may use:

```ts
interface BenchmarkCandidateLabel {
  canonicalCandidateKey: string;

  expectedEntityClusterKey: string;
  expectedBuyingOrganizationKey?: string;

  expectedRelationship: string[];
  expectedEligibility: string[];
  acceptedRelationshipAlternatives?: string[];

  expectedFactors: Array<{
    factorKey: string;
    acceptableStates: string[];
    minimumEvidenceQuality?: number;
  }>;

  fitRange?: ExpectedScoreRange;
  potentialRange?: ExpectedScoreRange;
  confidenceRange?: ExpectedScoreRange;

  expectedQueue?: string[];
  mustExclude?: boolean;
  mustNotExclude?: boolean;
  difficultNegative?: boolean;
  notes: string;
}
```

The benchmark runner should validate outputs by stable semantic keys rather than production database IDs.

---

## 10. Company Intelligence Metrics

### 10.1 Company-role accuracy

Measure whether the profile correctly identifies relevant roles such as:

- manufacturer;
- wholesaler;
- distributor;
- retailer;
- marketplace;
- SaaS provider;
- agency;
- consultancy;
- integrator;
- logistics provider.

Report:

- exact-match accuracy for primary role;
- macro F1 across all roles;
- multi-label precision and recall for secondary roles.

### 10.2 Value-chain interpretation accuracy

Review whether the profile correctly explains:

- what enters the company;
- what value it adds;
- what it sells;
- who receives the output;
- whether the customer uses, consumes, resells, distributes, or integrates it.

Use a human rubric from 1 to 5:

1. materially wrong;
2. major omissions;
3. partially correct;
4. commercially useful;
5. complete and precise.

### 10.3 Offering decomposition quality

Measure:

- missed materially distinct offerings;
- incorrectly split offerings;
- incorrectly merged offerings;
- duplicated offerings;
- offering descriptions that are too generic to support targeting.

Report:

- offering precision;
- offering recall;
- reviewer utility score.

### 10.4 Commercial-mechanics accuracy

Evaluate whether the system identifies:

- transaction type;
- recurring versus one-off relationship;
- direct versus channel sale;
- buyer/user/payer differences;
- order or contract constraints;
- minimum viable customer conditions;
- delivery or implementation dependencies.

### 10.5 Buyer-hypothesis quality

For each offering, measure:

- priority archetype precision;
- priority archetype recall;
- incompatible-archetype recall;
- whether proposed archetypes describe business models rather than only industries;
- whether positive signals are commercially meaningful;
- whether exclusions are overbroad.

### 10.6 Clarification-question efficiency

Questions should be evaluated by:

- percentage that would materially change targeting;
- redundancy rate;
- answerability by the user;
- number of questions per profile;
- number of repeated questions already answered by evidence;
- percentage skipped by users;
- percentage resulting in a strategy change.

A high question count is not a sign of intelligence.

### 10.7 Claim evidence coverage

For material claims, report:

- percentage with evidence references;
- percentage correctly labeled as inference rather than fact;
- unsupported-claim rate;
- stale-evidence rate;
- contradiction-detection rate.

### 10.8 Profile acceptance target

Initial release target:

- at least 85% of benchmark profiles rated commercially useful or better;
- less than 5% materially wrong primary business-model classifications;
- at least 90% evidence coverage for material factual claims;
- fewer than 15% low-value clarification questions;
- no critical buyer hypothesis created solely from unsupported category similarity.

These targets should tighten as the benchmark grows.

---

## 11. Campaign Strategy Metrics

### 11.1 Objective alignment

The strategy must reflect the selected relationship objective.

Measure whether:

- buyer campaigns target buyers;
- distributor campaigns target distributors;
- partner campaigns do not inherit buyer-only exclusions;
- supplier-side marketplace campaigns target providers rather than purchasers.

Critical objective mismatches are blocking failures.

### 11.2 Offering specificity

The strategy must use the selected offering’s mechanics rather than a generic company-wide ICP.

Measure:

- reuse of correct offering conditions;
- absence of conditions belonging only to another offering;
- correct buying roles;
- correct operational requirements.

### 11.3 Archetype quality

Report:

- reference-archetype recall;
- irrelevant-archetype rate;
- overbroad-archetype rate;
- duplicate-archetype rate;
- business-model specificity score.

### 11.4 Exclusion correctness

For proposed exclusions, measure:

- valid exclusion precision;
- missing critical exclusions;
- scope accuracy;
- objective applicability;
- rate of harmful overexclusion.

### 11.5 Qualification-rubric quality

Evaluate whether:

- factors correspond to actual buying compatibility;
- hard gates are justified;
- unknown evidence reduces confidence rather than fit;
- generic industry similarity does not dominate;
- weights align with the offering’s commercial mechanics.

### 11.6 Source-plan appropriateness

For web-only V2, evaluate whether the plan selects suitable web tactics:

- local language;
- directories;
- associations;
- category searches;
- signals;
- location-specific queries;
- parent-company verification.

When database providers are added, evaluate whether the plan selects providers according to their capabilities rather than always using every provider.

### 11.7 Strategy confirmation burden

Production metric:

- percentage of strategies accepted unchanged;
- number of material edits;
- time to confirmation;
- most frequently corrected fields;
- repeated correction patterns.

High unchanged acceptance is useful only if downstream precision is also high.

### 11.8 Strategy acceptance target

Initial release target:

- no critical objective mismatch in the blocking benchmark;
- at least 85% priority-archetype precision;
- at least 80% priority-archetype recall;
- at least 95% recall of critical exclusion categories;
- fewer than 5% harmful scope errors;
- at least 80% reviewer rating of commercially useful or better.

---

## 12. Discovery Metrics

### 12.1 Candidate recall

For campaigns with a known-good company set:

```text
Candidate recall = known relevant candidates discovered / known relevant candidates available
```

Report recall at:

- first pass;
- final discovery;
- top 50 normalized candidates;
- evaluated candidate set.

### 12.2 Precision of discovered universe

Measure the percentage of discovered source records that represent plausible operating organizations within the campaign’s broad segment.

This is intentionally broader than final qualification precision.

### 12.3 Segment coverage

For each archetype and geography combination, report:

- query count;
- provider count;
- unique candidates;
- evaluated candidates;
- eligible candidates;
- qualified yield;
- coverage status;
- stop reason.

### 12.4 Qualified yield

```text
Qualified yield = recommended or conditional candidates / evaluated unique candidates
```

Low yield may indicate:

- poor source plan;
- overbroad archetype;
- weak provider coverage;
- incorrect qualification policy;
- genuinely small market.

The system must preserve enough data to distinguish these causes.

### 12.5 Marginal iteration yield

For every targeted discovery pass:

```text
Marginal qualified yield = newly qualified canonical companies / newly evaluated canonical companies
```

The system should stop when marginal value falls below policy thresholds and no high-priority coverage gap remains.

### 12.6 Duplicate burden

Report:

- source-record duplicate rate;
- pre-normalization duplicate rate;
- post-resolution duplicate rate;
- duplicate candidates entering final review;
- duplicate companies charged more than once.

### 12.7 Source diversity

Measure whether the result pool is dominated by one query pattern or source type.

A campaign may legitimately rely on one source, but the system should detect when that source creates systematic blind spots.

### 12.8 Query redundancy

Measure similarity and overlap among executed searches.

Report:

- exact duplicate queries;
- near-duplicate queries;
- repeated domains;
- repeated result-set overlap;
- queries run despite sufficient segment coverage.

### 12.9 WebSearchProvider target

Initial target for benchmark campaigns:

- no exact repeated query within one strategy version unless explicitly retried after a failure;
- less than 15% near-duplicate query rate;
- at least 70% recall of the manually identified strong candidate set in web-suitable markets;
- less than 10% invalid-page records after preliminary normalization;
- each additional pass must have an explicit gap reason;
- no fixed blind five-iteration behavior.

Candidate recall expectations may vary by market and source accessibility; thresholds should be tagged by campaign type.

---

## 13. Entity Resolution Metrics

### 13.1 Pairwise precision and recall

For candidate pairs:

- precision measures how often merged records truly belong together;
- recall measures how often records that belong together were successfully merged.

False merges are usually more damaging than missed merges because they can combine unrelated evidence and corrupt evaluation.

Therefore release thresholds should prioritize precision.

### 13.2 Cluster quality

Use cluster-level metrics such as:

- cluster purity;
- B-cubed precision;
- B-cubed recall;
- exact-cluster match rate.

### 13.3 Parent and buying-organization accuracy

Separate tests should evaluate:

- parent-company detection;
- legal-entity grouping;
- brand ownership;
- branch detection;
- localized storefront grouping;
- procurement-owner inference.

### 13.4 Duplicate leakage

Measure the percentage of final review rows representing the same buying organization.

Initial target:

- below 2% duplicate buying organizations in the final recommended and conditional queues;
- zero known exact-domain duplicates;
- zero duplicate credit charges after confirmed merge.

### 13.5 Merge safety

All automatic merges must preserve:

- source records;
- evidence provenance;
- previous evaluations;
- reversible merge history.

Automated merge precision should exceed 98% on high-confidence rules. Lower-confidence cases must remain proposed or unresolved rather than forced.

---

## 14. Candidate Intelligence and Evidence Metrics

### 14.1 Business-model classification accuracy

Measure candidate business-model interpretation independently from campaign fit.

### 14.2 Relationship classification

Report per-class precision, recall, and F1 for:

- probable buyer;
- possible buyer;
- partner;
- reseller;
- distributor;
- supplier;
- competitor;
- irrelevant adjacent;
- unknown.

Because some classes overlap, the benchmark may accept multiple valid labels where commercial relationships are genuinely conditional.

### 14.3 Critical relationship exclusions

Competitor, supplier, and invalid-entity errors are especially damaging.

Initial target:

- at least 95% precision and recall for confirmed competitor and supplier exclusions in the blocking benchmark;
- at least 98% precision for invalid-entity exclusion;
- zero directories or pure map pages in the recommended queue.

### 14.4 Factor-state accuracy

For each evaluation factor, measure whether the system correctly returns:

- positive;
- negative;
- unknown;
- conflicting;
- not applicable.

Unknown-to-negative conversion must be tracked as a dedicated error category.

### 14.5 Evidence support

Report:

- percentage of material factor evaluations with evidence;
- evidence-source relevance;
- evidence freshness;
- contradiction preservation;
- unsupported strong-positive rate;
- unsupported hard-exclusion rate.

Initial target:

- at least 90% of material factor evaluations supported by evidence;
- 100% of hard exclusions supported by a user rule, deterministic invalidity, or explicit evidence;
- fewer than 3% unsupported strong-positive factors.

### 14.6 Research efficiency

Measure:

- pages inspected per candidate;
- repeated page retrieval rate;
- evidence reuse rate;
- cost per evaluated candidate;
- cost per qualified candidate;
- research tasks stopped because evidence was sufficient;
- research tasks continued despite confirmed exclusion.

---

## 15. Qualification and Scoring Metrics

### 15.1 Eligibility accuracy

Measure accuracy for:

- eligible;
- requires research;
- excluded;
- rejected;
- invalid entity;
- duplicate or merged.

### 15.2 Top-k precision

Primary user-facing metric:

```text
Precision@10 = relevant recommended companies in top 10 / 10
```

Also report:

- Precision@5;
- Precision@20;
- conditional precision;
- review-needed rate.

Initial blocking target:

- average Precision@10 above 80% across the benchmark;
- no campaign below 60% Precision@10 unless tagged as sparse-evidence or source-limited;
- at least 85% Precision@10 for standard-difficulty cases.

### 15.3 Relevant-candidate recall

Report recall of all known strong and plausible candidates after final qualification.

A high-precision system that returns only two obvious companies in a large market is incomplete.

### 15.4 Ranking quality

Use:

- normalized discounted cumulative gain at 10 and 20;
- pairwise ranking accuracy;
- top-tier recall;
- mean reciprocal rank for known strongest candidates.

### 15.5 Scoring inversion rate

A scoring inversion occurs when a candidate with direct positive buying evidence ranks below a candidate supported mainly by category similarity or unknowns.

Track:

- critical inversions;
- inversions fixed by comparative ranking;
- inversions introduced by comparative ranking.

Initial target:

- comparative ranking must reduce critical inversions by at least 50% over isolated deterministic score ordering;
- comparative ranking must not increase hard-exclusion errors.

### 15.6 Score trace reproducibility

Every deterministic score must be recomputable from:

- strategy version;
- factor records;
- weights;
- gates;
- scoring-function version.

Recomputed scores must match persisted scores exactly.

### 15.7 Fit versus potential separation

Validate that:

- small but highly compatible companies may have high fit and lower potential;
- large but uncertain companies may have high potential and moderate fit;
- confidence remains independent;
- UI queues do not silently collapse all three dimensions into one opaque ranking.

### 15.8 Queue correctness

Measure whether candidates enter the correct queue:

- recommended;
- conditional;
- research required;
- rejected;
- excluded;
- invalid;
- duplicate.

The recommended queue should prioritize precision. The conditional queue may preserve high-value uncertainty.

---

## 16. Confidence Calibration

Confidence must predict correctness rather than model certainty language.

### 16.1 Calibration datasets

For benchmark decisions, record whether each high-level conclusion was correct according to the reference label.

Group predictions into confidence bands:

- 0–20;
- 21–40;
- 41–60;
- 61–80;
- 81–100.

Compare predicted confidence with observed correctness.

### 16.2 Metrics

Use:

- expected calibration error;
- Brier score;
- reliability diagrams;
- overconfidence rate;
- high-confidence error rate.

### 16.3 Critical confidence errors

Track separately:

- high-confidence false buyer;
- high-confidence missed competitor;
- high-confidence incorrect merge;
- high-confidence hard exclusion based on insufficient evidence.

Initial target:

- fewer than 5% high-confidence material errors;
- expected calibration error below 0.10 for benchmarked high-level decisions;
- unknown-heavy candidates must not receive high confidence without strong alternative evidence.

---

## 17. Scoped Memory and Exclusion Validation

### 17.1 Required scenarios

The benchmark must include:

- a campaign-only exclusion;
- an offering-level exclusion;
- a workspace-level exclusion;
- a candidate-specific do-not-contact instruction;
- a provisional rule created during campaign review;
- a campaign objective that intentionally overrides a broader rule;
- repeated campaign corrections that should trigger a promotion suggestion;
- a rejected promotion suggestion;
- a superseded rule.

### 17.2 Scope accuracy

Measure whether a memory item is applied only when:

- scope matches;
- applicability conditions match;
- status is active;
- a more specific exception does not override it.

### 17.3 Cross-campaign contamination

A campaign correction must not silently affect unrelated campaigns.

Blocking target:

- zero benchmark cases where a campaign-only exclusion is automatically enforced in another campaign;
- zero cases where a rejected memory promotion remains active;
- zero cases where one offering’s exclusion contaminates another offering without explicit applicability.

### 17.4 Useful memory retrieval

Measure:

- relevant memory retrieval precision;
- missed relevant memory;
- irrelevant memory included in prompts;
- context-token overhead;
- contradictions detected before strategy compilation.

### 17.5 Promotion behavior

The system may propose broader scope when:

- the user explicitly requests it;
- the same correction is repeated;
- the system detects a stable pattern.

It must not automatically promote provisional memory into a hard workspace rule.

---

## 18. Workflow Reliability Metrics

### 18.1 Completion rate

Report by workflow and task:

- started;
- completed;
- failed;
- cancelled;
- timed out;
- paused;
- resumed;
- partially completed.

Initial production target:

- at least 98% successful completion for non-cancelled profile and strategy workflows;
- at least 95% successful completion for full discovery campaigns, excluding external-provider outages;
- no silent terminal states.

### 18.2 Retry safety

Test that retries do not create:

- duplicate source records;
- duplicate candidates;
- duplicate evaluations;
- duplicate credit charges;
- duplicate memory promotions;
- conflicting workflow states.

### 18.3 Idempotency

For every idempotent task, rerunning with the same input version and idempotency key must produce either:

- the same persisted output;
- a reference to the existing output;
- a safely superseding version where explicitly defined.

### 18.4 Cancellation and pause

Test cancellation at every major stage:

- strategy compilation;
- search execution;
- candidate research;
- evaluation;
- ranking.

Verify:

- no new expensive work is scheduled after cancellation;
- completed artifacts remain inspectable;
- partial usage is accounted for;
- campaign state is understandable;
- resume behavior starts from a safe checkpoint.

### 18.5 Concurrency

Test:

- multiple campaigns in one workspace;
- multiple workspaces;
- repeated corrections while evaluation is running;
- entity merges while ranking is pending;
- strategy revision while an old run exists;
- provider rate-limit contention.

### 18.6 Outbox and event delivery

Verify:

- commands are not lost;
- events are not processed twice without idempotent handling;
- progress counters converge to persisted truth;
- UI can recover after missed live updates.

---

## 19. Performance and Cost Validation

### 19.1 Required measurements

Track per workflow:

- wall-clock duration;
- queue time;
- provider latency;
- model latency;
- retries;
- tokens;
- search requests;
- pages fetched;
- candidates processed;
- cost per stage;
- cost per discovered unique company;
- cost per evaluated company;
- cost per recommended company.

### 19.2 Stage-level latency budgets

Initial internal targets, subject to benchmark adjustment:

- profile factual extraction: under 2 minutes for normal websites;
- profile commercial synthesis: under 2 minutes after extraction;
- campaign strategy compilation: under 90 seconds;
- first useful discovery results: under 3 minutes;
- normal small-market campaign completion: under 10 minutes;
- larger or evidence-heavy campaign completion: under 20 minutes unless the user explicitly chooses deeper research.

The product should display partial safe results rather than hiding all progress until completion.

### 19.3 Cost envelopes

Each benchmark case should define a maximum expected cost range. The range must include:

- search calls;
- model calls;
- scraping or extraction;
- future database-provider usage;
- retries.

Cost gates should be expressed relative to qualified output, not only total campaign cost.

Example:

```text
Cost per recommended company = campaign intelligence usage / recommended companies
```

### 19.4 Efficiency regression gate

A release should be blocked or explicitly approved when it:

- increases average benchmark cost by more than 20% without a material quality gain;
- increases p95 runtime by more than 25% without a material quality gain;
- substantially increases pages researched per rejected company;
- decreases qualified yield while increasing search volume.

### 19.5 Cost-quality frontier

Maintain at least two execution presets for testing:

- standard;
- deep research.

The standard preset should optimize practical precision and cost. Deep research may improve confidence or recall for strategic campaigns.

---

## 20. Product Usability Validation

### 20.1 Profile comprehension test

Ask users to identify:

- what the system believes the company sells;
- which information is inferred;
- where to correct an offering;
- where a profile-level exclusion applies.

### 20.2 Campaign strategy comprehension test

Ask users to identify:

- campaign objective;
- primary buyer archetypes;
- conditional targets;
- exclusions;
- why a target type is relevant;
- what will happen after starting discovery.

### 20.3 Candidate decision comprehension test

Ask users to explain:

- why a candidate was recommended;
- what evidence is strongest;
- what is unknown;
- whether the company is a buyer, partner, or competitor;
- the difference between fit, potential, and confidence.

### 20.4 Correction and scope test

Users must be able to:

- reject a candidate;
- reclassify its relationship;
- add a campaign-only exclusion;
- save a rule for one offering;
- avoid unintentionally making it global;
- understand a promotion suggestion.

### 20.5 Usability acceptance targets

Initial moderated-test target:

- at least 80% task completion without assistance;
- fewer than 10% of participants misinterpret confidence as fit;
- fewer than 10% accidentally apply an exclusion to a broader scope than intended;
- median campaign-strategy review under 5 minutes for a correctly generated strategy;
- users can locate supporting evidence within 30 seconds from a result row.

---

## 21. Regression Test Architecture

### 21.1 Test categories

The repository should include:

- unit tests;
- schema tests;
- deterministic scoring tests;
- task idempotency tests;
- database integration tests;
- workflow tests;
- frozen-model fixture tests;
- benchmark runner;
- browser-level product-flow tests;
- load and concurrency tests.

### 21.2 Fixture levels

Use three fixture levels:

1. **Pure fixtures** — no external calls.
2. **Recorded provider/model fixtures** — replay sanitized responses.
3. **Live canary fixtures** — controlled current external calls.

### 21.3 Prompt regression

Every prompt or schema change must run the relevant frozen benchmark subset.

Prompt changes must record:

- prompt version;
- model version;
- schema version;
- benchmark delta;
- cost delta;
- known trade-offs.

### 21.4 Scoring regression

Changes to weights, gates, or formulas must run:

- all factor fixtures;
- all hard-exclusion fixtures;
- score reproducibility checks;
- ranking inversion checks;
- top-k benchmark comparison.

### 21.5 Entity-resolution regression

Every entity-resolution change must test:

- exact-domain duplicates;
- localized storefronts;
- parent and subsidiary cases;
- franchises;
- unrelated similar names;
- shared addresses;
- brand versus legal entity;
- reversible merges.

### 21.6 Memory regression

Every memory change must test:

- scope precedence;
- campaign exceptions;
- provisional status;
- promotion confirmation;
- rejection;
- supersession;
- cross-campaign isolation.

### 21.7 Pull-request gates

Pull requests affecting Intelligence V2 should show:

- affected benchmark subsets;
- pass/fail result;
- quality deltas;
- cost and latency deltas where measurable;
- migration impact;
- rollback path.

Not every small refactor requires the full live suite, but all schema, prompt, model, scoring, provider, and orchestration changes require the relevant frozen suite.

---

## 22. Evaluation Runner

The benchmark runner should support:

```ts
interface BenchmarkRunRequest {
  benchmarkVersion: string;
  caseIds?: string[];
  tags?: string[];

  executionMode:
    | "pure_fixture"
    | "recorded"
    | "frozen_evidence_live_models"
    | "live_canary";

  configuration: {
    modelConfigurationVersion: string;
    promptConfigurationVersion: string;
    scoringVersion: string;
    workflowVersion: string;
    providerConfigurationVersion: string;
  };

  compareAgainstRunId?: string;
}
```

The runner must persist:

- every output artifact;
- task logs;
- versions;
- metrics;
- case-level failures;
- cost;
- latency;
- comparison deltas;
- reviewer notes;
- release decision.

Suggested tables:

```text
benchmark_suites
benchmark_cases
benchmark_case_versions
benchmark_evidence_fixtures
benchmark_expected_labels
benchmark_runs
benchmark_run_cases
benchmark_metrics
benchmark_artifacts
benchmark_reviews
benchmark_release_decisions
```

Benchmark data should be stored separately from customer production data.

---

## 23. Release Gates

A release may be categorized as:

- development-only;
- internal alpha;
- shadow-ready;
- user alpha;
- opt-in beta;
- default-ready;
- legacy-removal-ready.

### 23.1 Development-only gate

Requirements:

- schemas compile;
- migrations apply in a clean database;
- core unit tests pass;
- workflows can execute on fixtures;
- no benchmark quality requirement yet.

### 23.2 Internal alpha gate

Requirements:

- complete frozen benchmark execution;
- no critical contract failures;
- no workspace-isolation failures;
- deterministic score reproduction;
- basic quality above legacy baseline on at least 70% of cases;
- manual inspection of every benchmark campaign.

### 23.3 Shadow-ready gate

Requirements:

- blocking benchmark thresholds met;
- workflow completion target met in staging;
- cost envelope understood;
- production feature flag implemented;
- no write-side impact on legacy results unless isolated;
- shadow outputs hidden from normal users;
- rollback tested.

### 23.4 User-alpha gate

Requirements:

- small invited cohort;
- explicit “V2 experimental” state;
- correction tools functional;
- support and audit access available;
- production monitoring active;
- no unresolved data-loss bugs;
- user feedback process defined.

### 23.5 Opt-in beta gate

Requirements:

- V2 outperforms legacy on production-reviewed campaigns;
- top-10 precision and exclusion accuracy meet target;
- median runtime and cost remain within envelope;
- correction rate is decreasing across releases;
- no severe cross-scope memory incidents;
- migration path for existing profiles available.

### 23.6 Default-ready gate

Requirements:

- new campaigns default to V2 for supported workspace types;
- legacy remains available through controlled fallback;
- at least four weeks of stable beta operation or an equivalent campaign volume;
- no unresolved severity-one incidents;
- benchmark and production metrics remain stable;
- support documentation and admin tooling are complete.

### 23.7 Legacy-removal-ready gate

Requirements:

- at least 95% of active supported campaigns use V2;
- no critical dependency on legacy data structures;
- legacy-only campaigns are completed, archived, or migrated;
- rollback no longer requires legacy execution, only previous V2 configuration;
- removal approved after data-retention review;
- legacy exports remain readable.

---

## 24. Feature-Flag Architecture

Use feature flags at multiple levels.

### 24.1 Workspace flag

Controls whether a workspace may create Intelligence V2 profiles and campaigns.

### 24.2 Campaign flag

Records the intelligence engine used:

```text
legacy
intelligence_v2
```

This value must be immutable after discovery starts. A campaign cannot silently switch engines mid-run.

### 24.3 Stage flags

Allow controlled rollout of:

- profile V2;
- strategy compiler;
- provider abstraction;
- entity resolution V2;
- evidence evaluation V2;
- comparative ranking;
- memory promotion;
- contact-enrichment handoff.

Stage flags are useful during development but should not create unsupported hybrid states in production.

### 24.4 Provider flags

Control:

- WebSearchProvider;
- future PDL provider;
- Apollo provider;
- Coresignal provider;
- registry adapters;
- maps adapters;
- directory adapters.

### 24.5 Model and prompt configuration flags

Model, prompt, schema, and scoring versions should be configuration records rather than ad hoc environment changes.

### 24.6 Kill switches

Required kill switches:

- stop all new V2 campaign starts;
- stop all provider calls;
- stop all model calls;
- disable memory promotion;
- disable automatic entity merges;
- disable comparative ranking;
- force manual review for hard exclusions;
- pause contact enrichment;
- pause usage charging for affected stages.

Kill switches must not delete or corrupt existing run data.

---

## 25. Shadow Mode

Shadow mode allows Intelligence V2 to execute alongside the legacy pipeline without changing the user-visible result.

### 25.1 Shadow execution

For selected campaigns:

1. the legacy workflow runs normally;
2. a snapshot of campaign inputs is sent to V2;
3. V2 uses its own tables and run IDs;
4. V2 does not change legacy candidate states;
5. users do not see V2 unless they are internal reviewers;
6. usage charging for V2 is disabled or separately accounted;
7. outputs are compared after completion.

### 25.2 Shadow comparison

Compare:

- strategy quality;
- companies discovered;
- unique canonical companies;
- top candidates;
- excluded competitors and suppliers;
- duplicates;
- evidence coverage;
- runtime;
- cost;
- user corrections made to the legacy output.

### 25.3 Human review

Internal reviewers should label disagreements:

- V2 better;
- legacy better;
- both acceptable;
- both wrong;
- insufficient evidence.

### 25.4 Shadow-mode limits

Do not run V2 shadow mode automatically for every production campaign if it doubles cost materially. Use sampled cohorts by:

- business model;
- campaign size;
- geography;
- objective;
- complexity;
- prior failure pattern.

### 25.5 Promotion criteria from shadow to alpha

V2 should demonstrate:

- better or equal human preference on at least 70% of reviewed campaigns;
- materially better competitor/supplier exclusion;
- lower duplicate leakage;
- no unacceptable runtime or cost increase;
- no systematic failure in a major business-model category.

---

## 26. Rollout Phases

### Phase 0 — Specification and contracts

Deliver:

- final schemas;
- migrations;
- provider abstraction;
- benchmark contracts;
- feature-flag plan;
- workflow boundaries;
- scoring functions;
- audit requirements.

No production user exposure.

### Phase 1 — Component implementation

Implement:

- Company Intelligence V2;
- profile confirmation;
- Campaign Strategy compiler;
- scoped memory foundation;
- WebSearchProvider adapter;
- canonical source records;
- entity resolution;
- evidence extraction;
- deterministic qualification;
- comparative ranking.

Use fixtures and local benchmark cases.

### Phase 2 — Internal benchmark alpha

Run the complete frozen suite.

Fix:

- business-model errors;
- offering decomposition failures;
- scope leakage;
- wrong hard exclusions;
- ranking inversions;
- duplicate leakage;
- excessive cost and latency.

### Phase 3 — Internal product alpha

Internal users create real campaigns through the V2 UI.

Require:

- visible strategy confirmation;
- full evidence access;
- admin run inspector;
- manual correction tracking;
- no automated permanent memory promotion.

### Phase 4 — Production shadow mode

Run sampled V2 campaigns alongside legacy.

Do not expose output to normal users.

Collect production source, latency, and coverage data.

### Phase 5 — Invited user alpha

Enable V2 for selected workspaces.

Recommended cohort:

- users willing to review assumptions;
- moderate campaign sizes;
- supported geographies;
- business models represented in the benchmark;
- no mission-critical reliance on immediate perfect output.

### Phase 6 — Opt-in beta

Allow eligible users to select Intelligence V2 for new campaigns.

Display:

- strategy version;
- beta state;
- feedback mechanism;
- fallback support where possible.

### Phase 7 — Default for new supported campaigns

Make V2 the default for new campaigns in supported segments.

Legacy remains available only through an explicit fallback or admin control.

### Phase 8 — Legacy freeze

Stop new feature work on the legacy workflow.

Permit only:

- security fixes;
- data integrity fixes;
- migration support;
- critical outage recovery.

### Phase 9 — Legacy removal

Remove legacy execution only after all criteria in Section 23.7 are satisfied.

Preserve read-only historical campaign records and exports.

---

## 27. Data Migration Principles

### 27.1 Do not rewrite history

Existing legacy campaigns should remain identified as legacy campaigns.

Do not pretend that old scores were produced by V2.

### 27.2 Version all migrated intelligence

Migrated data must record:

- source type;
- migration job version;
- migration timestamp;
- confidence;
- whether the value was user-entered, legacy-generated, or newly inferred;
- original legacy record references.

### 27.3 Preserve raw legacy data

Do not delete or overwrite:

- old company profiles;
- old campaign inputs;
- raw discovered records;
- old scores;
- old user decisions;
- old exclusions;
- old contact associations.

### 27.4 Avoid false promotion

A legacy free-text exclusion must not automatically become a global V2 hard rule unless its scope is known.

Ambiguous migrated rules should become:

```text
scope: campaign or unknown
status: provisional
source: legacy_migration
```

### 27.5 Re-evaluation is explicit

Migrated candidates may retain legacy display values, but V2 evaluation must create new versioned records rather than overwriting legacy classification.

---

## 28. Company Profile Migration

### 28.1 Legacy profile states

Each workspace may be classified as:

- no profile;
- legacy profile only;
- V2 draft profile;
- V2 published profile;
- legacy plus V2 profile.

### 28.2 Migration workflow

For a legacy profile:

1. copy legacy source inputs into a migration bundle;
2. preserve the original profile unchanged;
3. run V2 factual extraction from current approved sources;
4. import useful legacy user-entered facts as claims;
5. label legacy AI-generated text as low-trust migration input;
6. build draft Company Intelligence;
7. identify contradictions;
8. generate only high-impact clarification questions;
9. require user review before publishing V2.

### 28.3 Offering migration

Legacy products or services may be:

- separate offerings;
- variants of one offering;
- marketing categories without commercial distinction.

The migration must not blindly map every legacy product card to a V2 offering.

### 28.4 Profile activation

A workspace should not start a new V2 campaign until it has a published V2 profile version.

The user may continue legacy campaigns while reviewing the V2 profile.

### 28.5 Profile migration acceptance

Require:

- no loss of user-entered facts;
- visible conflicts;
- provenance for migrated claims;
- explicit user confirmation of material commercial logic;
- ability to return to the legacy profile view for historical reference.

---

## 29. Campaign Migration

### 29.1 Existing active campaigns

Default rule:

- continue active legacy campaigns using the legacy engine;
- do not switch them mid-run;
- optionally allow creating a cloned V2 campaign from the same intent.

### 29.2 Draft legacy campaigns

A draft campaign may be converted into a V2 campaign only before discovery begins.

Conversion must:

- map geography;
- map objective where possible;
- map offering;
- transform free-text target criteria into strategy inputs;
- create provisional campaign memory from ambiguous exclusions;
- require strategy confirmation.

### 29.3 Completed campaigns

Completed campaigns remain read-only under their original engine.

A user may request:

- re-evaluation of selected candidates under a new V2 campaign;
- cloning the campaign into V2;
- importing approved companies into a new campaign seed list.

### 29.4 Campaign comparison

When cloning a legacy campaign to V2, preserve a lineage link:

```text
source_campaign_id
cloned_campaign_id
conversion_version
```

This supports product comparison without merging histories.

---

## 30. Candidate and Entity Migration

### 30.1 Legacy candidates as source records

Legacy candidate rows should initially be imported as source records, not automatically treated as canonical V2 companies.

### 30.2 Canonicalization

Migration may:

- normalize domain;
- identify obvious exact duplicates;
- link branches and storefronts conservatively;
- preserve uncertain cases separately;
- create merge proposals instead of forced merges.

### 30.3 Legacy scores

Legacy scores must be retained as:

```text
score_type: legacy_holistic_fit
engine_version: legacy
```

They must never appear as V2 deterministic fit scores.

### 30.4 User decisions

Import user actions such as:

- approved;
- rejected;
- excluded;
- contacted;
- do not contact.

Scope rules:

- candidate-specific do-not-contact may become durable candidate memory;
- campaign rejection remains campaign-scoped;
- broad legacy exclusions remain provisional unless scope is explicit.

### 30.5 Contact lineage

Existing leads and contacts must remain linked to their original company records. When a canonical V2 organization is created, link rather than rewrite historical ownership without an auditable migration record.

---

## 31. Database Migration Requirements

### 31.1 Expand before contract

Use an expand-and-contract migration strategy:

1. add new V2 tables and nullable references;
2. write V2 data without changing legacy reads;
3. validate data consistency;
4. introduce dual-read or engine-specific views;
5. migrate selected records;
6. change defaults;
7. stop legacy writes;
8. remove unused legacy structures only after retention approval.

### 31.2 Migration idempotency

Every migration job must be restartable and safe to rerun.

Use:

- migration batch ID;
- source record ID;
- target record ID;
- migration version;
- status;
- error details;
- checksum.

### 31.3 Row-level security

All new tables must be tested for workspace isolation before production rollout.

Benchmark and migration jobs must not bypass workspace boundaries except through controlled service-role tasks with explicit workspace predicates.

### 31.4 Backfill limits

Do not launch an unbounded backfill of all legacy web evidence.

Backfill in cohorts with:

- rate limits;
- cost ceilings;
- resumable batches;
- dry-run mode;
- error reporting;
- cancellation.

### 31.5 Data-integrity checks

After each migration batch, verify:

- source and target counts;
- orphaned references;
- duplicate canonical IDs;
- invalid version links;
- missing evidence references;
- workspace ownership;
- usage-accounting consistency.

---

## 32. Dual-Run and Dual-Read Rules

### 32.1 No hybrid scoring

A candidate cannot combine:

- legacy holistic score;
- V2 factors;
- V2 confidence;

into one mixed evaluation.

### 32.2 Engine-specific views

UI and APIs must know the campaign engine and render the appropriate contracts.

### 32.3 Historical display

Legacy campaigns may display a notice such as:

> This campaign used the previous intelligence engine. Its scores and classifications are preserved as originally generated.

### 32.4 Comparison tools

Internal admin tools may compare engines side by side, but normal user views should not merge candidate queues unless the user explicitly runs a V2 re-evaluation.

---

## 33. Provider Adapter Qualification

Every new discovery provider must pass a provider-admission process before production use.

### 33.1 Contract tests

Verify:

- capability reporting;
- request translation;
- pagination;
- rate limits;
- retries;
- authentication errors;
- malformed responses;
- source provenance;
- normalized candidate mapping;
- raw-record preservation.

### 33.2 Coverage benchmark

Run representative discovery segments and measure:

- recall of known companies;
- precision;
- geography coverage;
- small-company coverage;
- industry-field quality;
- domain accuracy;
- parent-company quality;
- duplicate rate;
- cost per useful company;
- latency.

### 33.3 Source-role decision

A provider may be approved as:

- primary discovery source;
- supporting discovery source;
- verification source;
- contact-enrichment source;
- specific-market source.

Approval is not universal. A provider may be primary for enterprise SaaS and irrelevant for local retail.

### 33.4 WebSearchProvider remains valid

Adding a database provider must not remove web-based qualification or niche discovery.

The benchmark should verify that provider routing improves breadth without lowering commercial precision.

### 33.5 Legal and commercial review

Before production use, confirm:

- API terms;
- redistribution rights;
- customer-facing use rights;
- data-retention limits;
- personal-data restrictions;
- geographic restrictions;
- rate and cost commitments.

These checks are required even when technical benchmarks pass.

---

## 34. Security, Privacy, and Audit Validation

### 34.1 Workspace isolation

Test every V2 table, API route, task, and admin path for cross-workspace data access.

### 34.2 Sensitive configuration

Verify that:

- provider keys are server-side;
- model keys are server-side;
- raw provider responses are not exposed unintentionally;
- service-role credentials are not sent to the browser;
- logs do not contain secrets.

### 34.3 Evidence retention

Define retention policies for:

- public web evidence;
- uploaded materials;
- provider raw records;
- model inputs and outputs;
- candidate contact data;
- benchmark fixtures.

### 34.4 User corrections

Corrections and memory records must preserve:

- actor;
- timestamp;
- previous value;
- new value;
- scope;
- reason where provided;
- affected evaluations;
- rollback information.

### 34.5 Contact-data boundary

Company discovery and qualification should remain separate from personal contact enrichment.

Do not process or store unnecessary personal data before company qualification.

### 34.6 Prompt-injection resilience

Web content may contain instructions intended for models.

Validation must include pages containing malicious or misleading instructions. Extraction prompts must treat website content as untrusted evidence, never as system instructions.

### 34.7 Audit reconstruction

For any final recommendation, an authorized reviewer must be able to reconstruct:

- Company Intelligence version;
- Campaign Strategy version;
- memory context used;
- discovery segment;
- source records;
- entity-resolution decision;
- evidence;
- factor states;
- score trace;
- comparative rank;
- user corrections;
- model and prompt versions.

---

## 35. Observability

### 35.1 Required dashboards

Create dashboards for:

- profile workflow health;
- campaign strategy health;
- discovery provider health;
- candidate funnel;
- entity-resolution quality;
- evaluation and ranking;
- user corrections;
- scoped memory;
- usage and cost;
- latency;
- failures and retries;
- benchmark status.

### 35.2 Candidate funnel dashboard

Show:

```text
provider source records
→ normalized source records
→ canonical organizations
→ prefiltered candidates
→ researched candidates
→ evaluated candidates
→ eligible candidates
→ recommended / conditional / research
→ approved companies
```

Each number must have a precise definition and must reconcile.

### 35.3 Quality proxy metrics

Production lacks immediate golden labels. Use proxies such as:

- approval rate by queue;
- rejection rate among recommended companies;
- competitor corrections;
- duplicate merges after review;
- strategy edit rate;
- exclusion-scope changes;
- “missing obvious company” reports;
- re-evaluation frequency;
- contact-enrichment abandonment.

These proxies do not replace benchmark metrics but reveal drift.

### 35.4 Alert conditions

Examples:

- sudden provider yield drop;
- duplicate rate above threshold;
- hard-exclusion rate spike;
- recommended approval rate collapse;
- cost per qualified company doubles;
- p95 campaign runtime exceeds threshold;
- workflow failure rate exceeds threshold;
- cross-scope memory application detected;
- score-trace mismatch;
- missing evidence for hard exclusions;
- provider authentication failures.

### 35.5 Run inspector

Internal tooling must allow inspection by:

- workspace;
- campaign;
- run;
- task;
- candidate;
- source record;
- entity cluster;
- evaluation version;
- benchmark case.

---

## 36. Production Experiment Design

### 36.1 A/B testing limitations

Do not optimize only for click-through or approval volume. Users may approve weak companies if evidence is unclear.

### 36.2 Suitable experiment outcomes

Measure:

- strategy-confirmation edits;
- recommended-company approval;
- rejection reasons;
- duplicate corrections;
- user-rated relevance;
- time to first approved company;
- contact-enrichment conversion;
- downstream sequence creation;
- user return rate;
- campaign abandonment;
- cost.

### 36.3 Cohort stratification

Segment results by:

- workspace business model;
- campaign objective;
- geography;
- market size;
- source plan;
- evidence availability;
- user experience level.

A strong average can hide severe failure in one category.

### 36.4 Human-labeled production sample

Regularly sample completed campaigns for internal review.

Reviewers should evaluate:

- top 10 companies;
- excluded high-potential companies;
- competitor and supplier handling;
- duplicates;
- evidence and confidence;
- missing obvious partners.

### 36.5 Minimum experiment duration

Use both time and volume criteria. For example:

- at least two weeks;
- at least 30 completed campaigns;
- at least 300 reviewed candidate decisions;
- representation from multiple business models.

Exact thresholds may change, but do not promote based on a handful of successful campaigns.

---

## 37. Incident Severity and Response

### Severity 1

Examples:

- cross-workspace data exposure;
- widespread data corruption;
- systematic incorrect charging;
- campaign-only exclusions applied globally;
- automatic merging of unrelated organizations at scale;
- inability to stop expensive runaway workflows.

Action:

- activate kill switch;
- stop new runs;
- preserve logs;
- notify affected users where required;
- roll back configuration;
- conduct data-integrity review.

### Severity 2

Examples:

- major provider outage;
- high campaign failure rate;
- substantial ranking regression;
- hard exclusions without evidence;
- serious duplicate leakage;
- incorrect progress or queue states.

Action:

- disable affected stage or provider;
- route to fallback where possible;
- communicate degraded behavior;
- prioritize fix.

### Severity 3

Examples:

- isolated candidate misclassification;
- stale evidence;
- incorrect low-impact memory suggestion;
- UI explanation defect.

Action:

- log;
- correct;
- add regression fixture where useful.

---

## 38. Rollback Strategy

### 38.1 Configuration rollback

Prompt, model, scoring, provider, and workflow configurations must support selecting the previous accepted version.

### 38.2 Workflow rollback

Do not attempt to mutate completed artifacts in place.

Instead:

- stop new runs on the faulty version;
- preserve completed outputs;
- mark affected runs;
- optionally re-run using the previous version;
- create new evaluation or ranking versions.

### 38.3 Database rollback

Prefer forward fixes over destructive down migrations after production data exists.

Schema changes should be backward-compatible during rollout.

### 38.4 User-facing rollback

For supported cohorts, the workspace may temporarily return to legacy campaign creation. Existing V2 campaigns remain readable.

### 38.5 Usage correction

If a system defect causes duplicate or invalid paid work, usage records must support:

- adjustment;
- credit restoration;
- reason;
- audit trail.

---

## 39. Legacy Freeze and Removal

### 39.1 Freeze criteria

Freeze legacy feature development when:

- V2 is default for supported campaigns;
- V2 quality exceeds legacy on benchmark and production review;
- provider abstraction is stable;
- core user workflows are complete;
- no major unsupported business-model category depends on legacy.

### 39.2 Removal inventory

Before removal, identify:

- legacy routes;
- legacy Trigger.dev tasks;
- legacy database tables;
- old scoring code;
- old prompt templates;
- old provider calls;
- analytics events;
- background jobs;
- admin tools;
- tests;
- documentation.

### 39.3 Historical access

Legacy campaigns should remain readable after execution code is removed.

Maintain:

- original candidate rows;
- original scores;
- user actions;
- exports;
- campaign metadata.

### 39.4 Removal sequence

1. disable new legacy campaigns;
2. wait for active legacy runs to finish or cancel;
3. archive legacy task definitions;
4. remove legacy writes;
5. preserve read models;
6. migrate required shared data;
7. remove obsolete code;
8. run historical-access tests;
9. document final removal version.

---

## 40. Release Checklist

### Architecture

- [ ] Company Intelligence contracts implemented.
- [ ] Campaign Strategy is required before discovery.
- [ ] Discovery uses semantic segments.
- [ ] WebSearchProvider is behind the provider interface.
- [ ] Provider records are separate from canonical organizations.
- [ ] Entity resolution is reversible.
- [ ] Qualification uses evidence factors.
- [ ] Scoring is deterministic.
- [ ] Fit, potential, and confidence are separate.
- [ ] Comparative ranking uses only recorded evidence.
- [ ] Memory and exclusions are scoped.

### Data

- [ ] All V2 tables have workspace isolation.
- [ ] Version references are immutable.
- [ ] Score traces recompute exactly.
- [ ] Evidence provenance is preserved.
- [ ] Migration jobs are idempotent.
- [ ] Legacy records remain intact.

### Workflow

- [ ] Tasks are idempotent.
- [ ] Retries do not double-charge.
- [ ] Pause and cancellation are tested.
- [ ] Partial results are safe.
- [ ] Concurrency limits are configured.
- [ ] Provider and model kill switches work.

### Quality

- [ ] Frozen benchmark passes release thresholds.
- [ ] Holdout benchmark passes.
- [ ] No critical objective mismatches.
- [ ] Competitor and supplier exclusion meets target.
- [ ] Duplicate leakage meets target.
- [ ] Top-10 precision meets target.
- [ ] Confidence is calibrated.
- [ ] Scope contamination tests pass.

### Performance

- [ ] Runtime is within envelope.
- [ ] Cost per qualified company is within envelope.
- [ ] Provider retries are bounded.
- [ ] No unbounded discovery iteration exists.
- [ ] Progress counters reconcile.

### Product

- [ ] Users can confirm the profile.
- [ ] Users can confirm the campaign strategy.
- [ ] Evidence is visible.
- [ ] Unknowns are visible.
- [ ] Exclusion scope is controllable.
- [ ] Candidate correction is auditable.
- [ ] Legacy campaigns remain readable.

### Operations

- [ ] Dashboards are live.
- [ ] Alerts are configured.
- [ ] Run inspector is available.
- [ ] Rollback is tested.
- [ ] Incident ownership is assigned.
- [ ] Support documentation is ready.

---

## 41. Acceptance Criteria by Layer

### Company Intelligence

- Profile explains business model and commercial mechanics, not only marketing description.
- Material offerings are correctly separated.
- Buyer hypotheses reflect how the offering is bought, used, resold, distributed, or integrated.
- Material claims preserve evidence and uncertainty.
- Questions are limited to high-impact unknowns.

### Campaign Strategy

- Strategy is specific to offering, objective, and geography.
- Priority archetypes are commercially meaningful.
- Exclusions have explicit scope and applicability.
- Qualification factors evaluate buyer compatibility.
- Discovery plan is provider-independent.

### Discovery

- Every pass has an explicit segment or gap purpose.
- Queries are generated inside the provider adapter.
- Coverage is tracked by archetype and geography.
- Duplicates are suppressed before expensive evaluation.
- Stop conditions prevent blind repeated iterations.

### Entity Resolution

- Source records remain preserved.
- Canonical organizations are not provider-owned.
- Parent, branch, brand, storefront, and buying organization are represented.
- Automatic merges are high precision and reversible.

### Qualification

- Relationship is classified before score.
- Hard exclusions are resolved before fit.
- Unknown is not treated as negative.
- Every material factor has evidence or explicit unknown status.
- Fit, potential, and confidence remain separate.
- Final ranking catches obvious scoring inversions.

### Memory

- Campaign memory improves later steps in the same campaign.
- Campaign-only learning does not become global silently.
- Repeated corrections may generate promotion proposals.
- User confirmation is required for durable broad rules.
- Specific applicable context overrides broad rules without deleting them.

### Product

- Users can understand and correct the system.
- Progress and counters are internally consistent.
- Results remain compact and inspectable.
- Evidence, uncertainty, and exclusions are explainable.
- Approved companies hand off cleanly to contact discovery.

---

## 42. Initial Blocking Threshold Summary

The following are initial targets for moving from internal alpha toward user beta. They should be refined as the benchmark grows.

| Metric                                             |         Initial blocking target |
| -------------------------------------------------- | ------------------------------: |
| Average Precision@10                               |                           > 80% |
| Standard-case Precision@10                         |                           > 85% |
| Lowest untagged campaign Precision@10              |                           ≥ 60% |
| Competitor/supplier exclusion precision and recall |                           ≥ 95% |
| Invalid-entity exclusion precision                 |                           ≥ 98% |
| Duplicate buying organizations in final review     |                            < 2% |
| Material factor evidence coverage                  |                           ≥ 90% |
| Hard-exclusion evidence or rule coverage           |                            100% |
| High-confidence material error rate                |                            < 5% |
| Confidence expected calibration error              |                          < 0.10 |
| Campaign-only exclusion cross-campaign leakage     |                               0 |
| Exact repeated query rate                          |        0% except explicit retry |
| Near-duplicate query rate                          |                           < 15% |
| Profile/strategy workflow completion               |                           ≥ 98% |
| Full campaign workflow completion                  | ≥ 95% excluding provider outage |
| Score-trace reproducibility                        |                            100% |

A release may not pass by averaging away a severe failure in one major category. Critical errors remain blocking even when aggregate metrics are high.

---

## 43. Quality Review Cadence

### Per pull request

Run relevant unit, schema, fixture, and benchmark subsets.

### Daily or scheduled staging run

Run:

- core frozen benchmark;
- workflow reliability suite;
- score reproducibility;
- memory scope tests;
- entity-resolution regression.

### Before every production intelligence release

Run:

- full frozen benchmark;
- holdout benchmark;
- migration dry run;
- load test;
- rollback rehearsal;
- security checks;
- manual review of metric regressions.

### Weekly during alpha and beta

Review:

- production campaign samples;
- user corrections;
- provider yield;
- duplicate leakage;
- cost and latency;
- failed workflows;
- memory promotion proposals.

### Monthly after stable release

Review:

- benchmark expansion;
- stale evidence fixtures;
- new provider performance;
- calibration drift;
- unsupported business-model categories;
- legacy removal readiness.

---

## 44. Ownership

The system should have explicit ownership for:

- Company Intelligence quality;
- Campaign Strategy quality;
- provider adapters;
- entity resolution;
- qualification and scoring;
- prompts and models;
- workflow reliability;
- Supabase migrations;
- benchmark governance;
- product UX;
- security and privacy;
- production incidents.

One person may own multiple areas during the early stage, but responsibilities must still be named.

No prompt, scoring, or provider change should reach production without an identified owner and rollback plan.

---

## 45. Known Risks

### 45.1 Benchmark overfitting

Mitigation:

- holdout cases;
- production samples;
- new industries;
- blind reviews;
- changing evidence fixtures.

### 45.2 Public web drift

Mitigation:

- frozen evidence suite;
- live canary suite;
- evidence freshness tracking;
- provider health monitoring.

### 45.3 Excessive model confidence

Mitigation:

- factor-level evidence;
- unknown status;
- confidence caps;
- calibration metrics;
- comparative consistency checks.

### 45.4 Scope contamination

Mitigation:

- explicit memory scopes;
- applicability conditions;
- precedence tests;
- no automatic permanent promotion.

### 45.5 Cost inflation

Mitigation:

- staged filtering;
- evidence reuse;
- gap-driven discovery;
- stopping conditions;
- task budgets;
- provider benchmarking.

### 45.6 False entity merges

Mitigation:

- precision-first automatic rules;
- merge proposals for uncertain cases;
- reversible history;
- buying-organization distinction.

### 45.7 Legacy migration ambiguity

Mitigation:

- preserve original data;
- mark migrated rules provisional;
- require profile confirmation;
- avoid overwriting old scores.

### 45.8 Strong benchmark but weak user trust

Mitigation:

- evidence UI;
- clear uncertainty;
- correction controls;
- usability testing;
- compact explanations.

---

## 46. Locked Rollout Decisions

The following decisions are considered locked unless later explicitly revised:

1. Intelligence V2 is introduced behind feature flags.
2. Existing active legacy campaigns do not switch engines mid-run.
3. Existing legacy scores remain labeled as legacy and are not converted into V2 scores.
4. Company profiles are migrated into V2 drafts and require review before publication.
5. Web search is the first discovery provider, but the architecture remains provider-independent.
6. New database providers must pass adapter, coverage, legal, and cost validation.
7. Campaign-level exclusions remain campaign-scoped by default and may become provisional promotion candidates.
8. No permanent broad memory is created from one AI inference without user confirmation.
9. Hard exclusions require explicit rules or evidence.
10. Benchmark results, production quality, runtime, and cost all influence release decisions.
11. The legacy pipeline remains readable after execution code is removed.
12. A severe scope, privacy, charging, or entity-corruption error blocks rollout regardless of aggregate quality metrics.

---

## 47. Final Release Principle

The Intelligence V2 refactor is successful only when Opptium can repeatedly demonstrate that it:

- understands the workspace company’s business model;
- separates materially different offerings;
- compiles objective- and market-specific targeting logic;
- discovers candidates through replaceable providers;
- resolves organizations and buying structures correctly;
- qualifies candidates according to commercial compatibility;
- preserves evidence and uncertainty;
- ranks strong candidates above superficial category matches;
- learns within a campaign without contaminating unrelated campaigns;
- remains auditable, affordable, reliable, and understandable.

The rollout must therefore optimize for controlled learning rather than speed of replacement.

The correct progression is:

> specification → fixtures → benchmarks → internal alpha → shadow mode → invited users → opt-in beta → default V2 → legacy freeze → legacy removal

Skipping these steps would risk replacing a visible intelligence problem with a less visible one. The benchmark and rollout system is part of the product architecture, not an optional final testing phase.
