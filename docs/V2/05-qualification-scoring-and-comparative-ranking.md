# Opptium Intelligence V2

## Qualification, Scoring, and Comparative Ranking

**Document:** 05  
**Status:** Detailed implementation specification  
**Purpose:** Define how Opptium converts resolved candidate organizations and campaign evidence into relationship classifications, eligibility decisions, factor-level evaluations, deterministic fit and commercial-potential scores, confidence measures, comparative rankings, and explainable review queues.

---

## 1. Purpose

Discovery only creates a candidate universe. Entity resolution only establishes what each candidate actually is. Neither step determines whether an organization is commercially relevant to the current campaign.

Qualification must answer a narrower and more important question:

> Given this workspace company, selected offering, campaign objective, target geography, and confirmed campaign strategy, what relationship can this external organization plausibly have with the offering, is it eligible for this campaign, and what evidence supports that conclusion?

The qualification system must avoid the failure mode where visually or categorically similar companies receive high scores despite having incompatible business models, while less obvious organizations with direct buying compatibility are ranked lower.

The required sequence is:

> resolved identity → commercial relationship → exclusions and eligibility → factor evidence → deterministic scoring → confidence assessment → comparative consistency check → review queue

The system must never begin with a holistic score and attempt to justify it afterward.

---

## 2. Scope

This document defines:

- relationship classification relative to the campaign objective;
- relationship confidence and evidence requirements;
- exclusion evaluation and scope resolution;
- eligibility states and transitions;
- campaign-specific qualification rubrics;
- standard and custom evaluation factors;
- positive, negative, unknown, conflicting, and not-applicable evidence states;
- factor evidence extraction;
- evidence strength, reliability, freshness, and directness;
- deterministic fit scoring;
- deterministic commercial-potential scoring;
- confidence calculation and confidence caps;
- critical-gate handling;
- review lanes and queue assignment;
- comparative reranking and cross-candidate consistency checks;
- explanation and audit requirements;
- user corrections and evaluation invalidation;
- model-task boundaries;
- preliminary data contracts;
- orchestration requirements;
- implementation phases and acceptance criteria.

This document does not fully define:

- profile creation, which is defined in Document 01;
- campaign strategy compilation, which is defined in Document 02;
- discovery providers, which are defined in Document 03;
- entity resolution and reusable Candidate Intelligence, which are defined in Document 04;
- the complete Supabase schema and Trigger.dev graph, which are consolidated in Document 06;
- final product UI layouts, which are defined in Document 07;
- benchmark rollout and legacy removal, which are defined in Document 08.

---

## 3. Required Inputs

Qualification may begin only when the following inputs exist.

### 3.1 Campaign Strategy version

The evaluation must reference one immutable `campaignStrategyVersionId` containing at least:

- campaign objective;
- selected offering version;
- target geography;
- buyer archetypes;
- relationship expectations;
- exclusion rules;
- qualification factor definitions;
- factor weights;
- critical gates;
- evidence expectations;
- confidence requirements;
- review thresholds;
- ranking policy.

A candidate cannot be evaluated against a mutable campaign object without a strategy version.

### 3.2 Canonical candidate organization

The candidate must reference a canonical external organization produced by Document 04.

The evaluation input must identify:

- canonical organization;
- discovered organization;
- display organization;
- target organization;
- probable buying organization;
- parent and subsidiary relationships;
- identity confidence;
- procurement-autonomy confidence;
- duplicate or invalid-entity state.

If the candidate is unresolved, invalid, or merged into another candidate, normal qualification must not proceed.

### 3.3 Candidate evidence

The evaluation may consume:

- reusable public organization claims;
- campaign-specific research claims;
- provider source records;
- company website evidence;
- registry evidence;
- directory evidence;
- user-provided evidence;
- prior campaign observations where scope allows reuse;
- current campaign corrections and memory.

Every material candidate claim must retain provenance.

### 3.4 Active scoped rules

Before evaluation, Opptium must compile applicable rules from:

- workspace/company memory;
- selected offering memory;
- campaign strategy;
- campaign memory;
- candidate-specific memory;
- explicit user overrides.

Rules must be filtered by applicability to the current:

- campaign objective;
- offering;
- geography;
- buyer archetype;
- relationship type;
- organization.

### 3.5 Evaluation contract version

Every evaluation must record:

- factor-library version;
- scoring-policy version;
- relationship-classifier version;
- exclusion-policy version;
- prompt version;
- model configuration;
- evidence snapshot or evidence cutoff timestamp.

This makes later recalculation and benchmark comparison possible.

---

## 4. Qualification Outputs

A complete evaluation produces several distinct outputs. They must not be collapsed into one score.

### 4.1 Relationship classification

The candidate’s probable commercial role relative to the offering and campaign objective.

### 4.2 Eligibility

Whether the candidate may proceed in the current campaign.

### 4.3 Factor evaluations

Structured positive, negative, unknown, conflicting, or not-applicable findings for every applicable qualification factor.

### 4.4 Fit

The degree of compatibility between the candidate and the selected offering, target archetype, and campaign objective.

### 4.5 Commercial potential

The likely account value or strategic importance if the proposed relationship is valid.

### 4.6 Confidence

The strength and completeness of evidence supporting the relationship, fit, potential, and eligibility conclusions.

### 4.7 Review lane

The candidate’s operational placement, such as:

- recommended;
- conditional;
- requires research;
- excluded;
- rejected;
- invalid;
- duplicate or merged.

### 4.8 Comparative rank

The candidate’s position relative to other candidates in the same campaign and review lane.

### 4.9 Explanation

A concise, evidence-backed summary describing:

- why the candidate is relevant or irrelevant;
- the strongest supporting evidence;
- the strongest concern;
- critical unknowns;
- why it ranks where it does.

---

## 5. End-to-End Evaluation Pipeline

The qualification pipeline consists of explicit stages.

```text
1. Validate candidate identity and strategy version
2. Compile applicable memory and exclusion rules
3. Classify commercial relationship
4. Evaluate hard exclusions
5. Determine preliminary eligibility
6. Compile candidate-specific research questions
7. Reuse existing evidence and research unresolved critical questions
8. Extract factor-level evidence
9. Resolve factor conflicts and applicability
10. Calculate fit deterministically
11. Calculate commercial potential deterministically
12. Calculate confidence and apply confidence caps
13. Assign review lane
14. Run candidate-level consistency checks
15. Compare plausible candidates in batches
16. Resolve flagged inconsistencies through structured re-evaluation
17. Generate final explanations and review order
18. Persist audit record and emit progress events
```

Each stage must be independently observable and retryable.

---

## 6. Commercial Relationship Classification

### 6.1 Why relationship precedes scoring

A company can be highly similar to the user’s target market while still being the wrong relationship type.

Examples include:

- a competing wholesaler when the campaign seeks buyers;
- a software implementation agency when the campaign seeks end users;
- a brand owner when the campaign seeks independent distributors;
- a supplier when the campaign seeks customers;
- a parent company when procurement occurs at a subsidiary;
- a local branch when purchasing is centralized elsewhere.

A candidate with the wrong relationship must not simply receive a lower score. It must be classified correctly first.

### 6.2 Relationship taxonomy

The standard relationship taxonomy is:

```ts
type CandidateRelationship =
  | "probable_buyer"
  | "possible_buyer"
  | "end_user"
  | "reseller"
  | "distributor"
  | "channel_partner"
  | "integration_partner"
  | "referral_partner"
  | "supplier"
  | "competitor"
  | "strategic_partner"
  | "investor_or_acquirer"
  | "existing_customer"
  | "former_customer"
  | "irrelevant_adjacent"
  | "unknown";
```

The exact enabled values may depend on the campaign objective. Additional relationship types may be added through versioned configuration, but provider-specific or industry-specific labels must map into the canonical taxonomy.

### 6.3 Primary and secondary relationships

A candidate may plausibly have more than one relationship.

For example:

- an agency may be both a potential end user and a channel partner;
- a distributor may also be a competitor in some regions;
- an existing customer may also be an expansion account;
- a manufacturer may be both a buyer of one offering and a supplier of another.

The evaluation must store:

- one primary relationship for the current objective;
- zero or more secondary relationships;
- evidence for each relationship;
- relationship confidence;
- objective-specific relevance.

### 6.4 Objective-relative interpretation

Relationship labels are interpreted relative to the campaign objective.

For a `direct_buyer` campaign:

- `probable_buyer` is usually eligible;
- `possible_buyer` may require research;
- `channel_partner` may be excluded from the buyer queue but retained as a partner lead;
- `competitor` is normally excluded;
- `supplier` is normally excluded.

For a `channel_partner` campaign:

- a distributor or reseller may be the desired relationship;
- a direct end user may be irrelevant;
- a competitor may still be excluded or may be considered a strategic partner depending on the strategy.

The relationship engine must not contain universal assumptions such as “distributors are always excluded.”

### 6.5 Relationship evidence questions

The relationship classifier should answer campaign-specific questions such as:

- Does the organization consume the offering internally?
- Does it purchase the offering for resale?
- Does it manufacture or supply a substitute?
- Does it distribute competing or complementary products?
- Does it serve the same customers with the same value proposition?
- Is it a marketplace or intermediary rather than the buyer?
- Does it control procurement for the relevant operating unit?
- Is it already known to the workspace as a customer, partner, or blocked account?

### 6.6 Relationship classification contract

```ts
type RelationshipAssessment = {
  campaignCandidateId: string;
  campaignStrategyVersionId: string;

  primaryRelationship: CandidateRelationship;
  secondaryRelationships: Array<{
    relationship: CandidateRelationship;
    confidence: number;
    evidenceIds: string[];
    explanation: string;
  }>;

  confidence: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  unresolvedQuestions: string[];

  decisionBasis:
    | "direct_evidence"
    | "strong_inference"
    | "weak_inference"
    | "insufficient_evidence";

  classifierVersion: string;
  createdAt: string;
};
```

### 6.7 Relationship confidence

Relationship confidence is not the same as overall evaluation confidence.

It should depend on:

- directness of evidence;
- source reliability;
- consistency across sources;
- clarity of the organization’s business model;
- clarity of the campaign objective;
- procurement and target-organization certainty.

A candidate may have strong fit under the assumption that it is a buyer, but low relationship confidence because the organization’s role is unclear. Such a candidate belongs in `requires_research`, not `recommended`.

---

## 7. Exclusion Evaluation

### 7.1 Exclusions are scoped rules

Exclusions must be evaluated using the scoped-memory principles from Document 02.

Possible scopes include:

- workspace/company;
- offering;
- campaign;
- candidate;
- provisional campaign memory.

Every exclusion must specify applicability and must not be treated as universal by default.

### 7.2 Exclusion strength

Exclusions are classified as:

- **hard** — confirmed violation makes the candidate ineligible;
- **soft** — lowers fit, changes relationship interpretation, or creates a conditional review state;
- **provisional** — active in the current campaign but not automatically reusable elsewhere;
- **informational** — shown to reviewers but does not alter eligibility by itself.

### 7.3 Exclusion rule contract

```ts
type CompiledExclusionRule = {
  id: string;
  sourceScope: "workspace" | "offering" | "campaign" | "candidate";
  sourceScopeId: string;

  name: string;
  description: string;
  strength: "hard" | "soft" | "informational";
  status: "confirmed" | "provisional";

  applicability: {
    objectives?: string[];
    offeringIds?: string[];
    geographyIds?: string[];
    archetypeIds?: string[];
    relationshipTypes?: CandidateRelationship[];
  };

  condition: ExclusionCondition;
  reason: string;
  precedence: number;
};
```

### 7.4 Exclusion evaluation states

For each applicable rule, evaluation returns:

```ts
type ExclusionRuleState =
  | "triggered"
  | "suspected"
  | "not_triggered"
  | "unknown"
  | "not_applicable";
```

Interpretation:

- `triggered` requires sufficient evidence that the rule applies;
- `suspected` means evidence points toward exclusion but is not strong enough for automatic rejection;
- `not_triggered` means available evidence sufficiently contradicts the rule;
- `unknown` means evidence is insufficient;
- `not_applicable` means the rule does not apply in this context.

### 7.5 Hard exclusions require evidence

A hard rule may exclude automatically only when:

- the rule is applicable;
- the condition is `triggered`;
- the supporting evidence meets the rule’s minimum reliability and confidence;
- no higher-precedence user override exists.

A suspected competitor must not be auto-excluded solely because it uses similar keywords.

### 7.6 Exclusion precedence

Precedence follows these principles:

1. explicit current user instruction;
2. candidate-specific confirmed rule;
3. campaign-specific confirmed rule;
4. offering-level confirmed rule;
5. workspace-level confirmed rule;
6. provisional campaign rule;
7. AI-inferred suggestion.

Specific context overrides broader context, but the overridden rule remains stored.

### 7.7 Exclusion exceptions

An active campaign may define an exception to a broad rule.

Example:

```text
Workspace rule:
Competitors are excluded from direct-customer campaigns.

Campaign objective:
Strategic technology partnerships.

Campaign exception:
Include complementary competitors with integration potential.
```

The exception affects the campaign evaluation without deleting or weakening the workspace rule.

### 7.8 Exclusion assessment contract

```ts
type CandidateExclusionAssessment = {
  campaignCandidateId: string;

  ruleId: string;
  state: ExclusionRuleState;
  confidence: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  explanation: string;

  effect:
    | "exclude"
    | "route_to_other_relationship"
    | "reduce_fit"
    | "requires_research"
    | "informational"
    | "none";
};
```

---

## 8. Eligibility

### 8.1 Eligibility taxonomy

```ts
type CandidateEligibility =
  | "eligible"
  | "conditional"
  | "requires_research"
  | "excluded"
  | "rejected"
  | "invalid_entity"
  | "duplicate_or_merged";
```

### 8.2 Meaning of each state

#### Eligible

The candidate has the desired or acceptable relationship, no triggered hard exclusions, sufficient evidence, and no unresolved critical gate preventing review.

#### Conditional

The candidate is commercially plausible but has a confirmed limitation, weaker archetype match, or campaign-specific condition that reviewers must understand.

#### Requires research

The candidate may be relevant, but one or more critical questions remain unresolved.

This state is appropriate when:

- relationship is unclear;
- procurement authority is unknown and critical;
- a hard exclusion is suspected but unconfirmed;
- identity remains partially unresolved;
- evidence is too sparse for a reliable score;
- conflicting evidence materially changes the conclusion.

#### Excluded

A confirmed applicable hard exclusion was triggered, or the candidate has a confirmed incompatible relationship for the campaign objective.

#### Rejected

The candidate is a valid organization but is not sufficiently relevant after evaluation. Rejection is not necessarily a global exclusion.

#### Invalid entity

The record is not a valid target organization, such as a directory page, category page, inactive anonymous listing, or non-company object.

#### Duplicate or merged

The candidate has been resolved into another campaign candidate or canonical organization and must not be reviewed separately.

### 8.3 Eligibility is not a score threshold alone

Eligibility depends on:

- relationship;
- exclusion outcomes;
- critical gates;
- evidence sufficiency;
- identity state;
- campaign policy.

A candidate with a calculated fit of 85 may still be `requires_research` if purchasing authority is a critical unknown. A candidate with fit 70 may be `eligible` if evidence is strong and the campaign accepts broader coverage.

### 8.4 Eligibility decision order

The deterministic decision order is:

```text
1. invalid entity? → invalid_entity
2. merged duplicate? → duplicate_or_merged
3. triggered hard exclusion? → excluded
4. confirmed incompatible primary relationship? → excluded or route to another campaign type
5. unresolved critical exclusion or relationship? → requires_research
6. unresolved critical gate? → requires_research
7. evidence below minimum review threshold? → requires_research
8. fit below rejection threshold with adequate confidence? → rejected
9. confirmed limiting condition? → conditional
10. otherwise → eligible
```

The exact thresholds are versioned in the campaign strategy.

---

## 9. Qualification Rubric Compilation

### 9.1 Standard library plus campaign specialization

Opptium should maintain a standard factor library, but every campaign strategy selects and specializes the relevant factors.

The campaign rubric determines:

- which factors apply;
- whether each factor affects fit, potential, confidence, eligibility, or multiple outputs;
- factor weight;
- positive and negative evidence definitions;
- criticality;
- minimum evidence expectations;
- archetype-specific interpretation;
- scoring mapping;
- exclusion interaction.

### 9.2 No universal ICP score

There is no universal formula where company size, industry, and geography always produce the same score.

A factor can have different meaning by campaign:

- large size may increase potential for enterprise software;
- large size may reduce fit for a highly customized small-batch supplier;
- local procurement may be critical for regional distribution;
- global centralized procurement may be desirable for a worldwide platform campaign;
- reseller behavior may be positive for a channel campaign and incompatible for a direct-user campaign.

### 9.3 Rubric contract

```ts
type QualificationRubric = {
  id: string;
  campaignStrategyVersionId: string;
  version: string;

  factors: QualificationFactorDefinition[];

  thresholds: {
    minimumEvidenceCoverageForScoring: number;
    minimumConfidenceForRecommended: number;
    minimumFitForRecommended: number;
    minimumFitForConditional: number;
    rejectBelowFit: number;
  };

  rankingPolicy: RankingPolicy;
  confidencePolicy: ConfidencePolicy;
  criticalGatePolicy: CriticalGatePolicy;
};
```

---

## 10. Qualification Factor Definition

### 10.1 Factor purposes

A factor may contribute to one or more dimensions:

```ts
type FactorPurpose =
  | "fit"
  | "commercial_potential"
  | "confidence"
  | "eligibility"
  | "relationship"
  | "exclusion";
```

### 10.2 Factor definition contract

```ts
type QualificationFactorDefinition = {
  key: string;
  label: string;
  description: string;

  purposes: FactorPurpose[];
  weight: number;

  applicability: {
    archetypeIds?: string[];
    relationshipTypes?: CandidateRelationship[];
    geographyIds?: string[];
  };

  criticality: "required" | "important" | "supporting";
  unknownPolicy:
    | "reduce_confidence_only"
    | "requires_research_if_required"
    | "not_applicable_when_unresolved";

  positiveEvidenceDefinition: string;
  negativeEvidenceDefinition: string;
  conflictingEvidenceDefinition?: string;

  acceptedSourceTypes?: string[];
  minimumEvidenceReliability?: number;
  maximumEvidenceAgeDays?: number;

  scoring: FactorScoringPolicy;
};
```

### 10.3 Factor stability

Factor definitions are part of the immutable Campaign Strategy version. Editing a factor after discovery creates a new strategy version and invalidates affected candidate evaluations.

---

## 11. Standard Qualification Factor Library

The library below is intentionally cross-industry. A campaign enables only the factors relevant to its offering and objective.

### 11.1 Business-model compatibility

Determines whether the candidate’s method of operating and making money is compatible with the offering.

Positive evidence may include:

- candidate performs the activity the offering supports;
- candidate resells the relevant category when resale is required;
- candidate delivers the type of service that uses the offering;
- candidate has a recurring process the product can improve.

Negative evidence may include:

- candidate is on the opposite side of the value chain;
- candidate only sells its own proprietary products where independent sourcing is required;
- candidate’s operating model eliminates the relevant need;
- candidate is a media or directory business rather than an operator.

### 11.2 Offering-use compatibility

Determines whether the candidate can practically use, consume, integrate, resell, or distribute the selected offering.

This factor is more specific than industry match.

### 11.3 Problem or need compatibility

Determines whether the candidate plausibly experiences the problem the offering solves.

Evidence may include:

- explicit operational pain;
- business processes that naturally create the need;
- current use of substitutes;
- growth or complexity indicating likely need;
- published strategic priorities.

The absence of an explicit public pain statement is normally unknown, not negative.

### 11.4 Transaction-model compatibility

Determines whether the candidate can participate in the expected commercial transaction.

Examples:

- recurring software subscription;
- wholesale purchase;
- minimum order quantity;
- project contract;
- marketplace commission;
- distribution agreement;
- integration partnership;
- pilot engagement.

### 11.5 Procurement compatibility

Determines whether the candidate’s purchasing model is compatible with the offering.

Relevant signals may include:

- independent procurement;
- centralized group purchasing;
- tender requirements;
- approved-vendor restrictions;
- franchise constraints;
- exclusive brand agreements;
- local purchasing authority.

### 11.6 Operational capability

Determines whether the candidate has the infrastructure, team, licenses, channels, or processes required to use or commercialize the offering.

### 11.7 Buyer or decision-unit accessibility

Determines whether the relevant buying function likely exists and can be identified.

This factor should usually affect confidence or outreach readiness more than core fit. A hard-to-reach buyer is not automatically a poor commercial fit.

### 11.8 Scale compatibility

Determines whether the candidate is too small, suitable, or too large for the offering and delivery model.

Scale must be interpreted using campaign-specific indicators such as:

- employees;
- sites;
- stores;
- fleet size;
- revenue band;
- customer base;
- geographic footprint;
- transaction volume;
- production capacity.

### 11.9 Geographic and serviceability compatibility

Determines whether the workspace company can legally, operationally, linguistically, logistically, and commercially serve the candidate.

Geography should not be reduced to headquarters country alone.

### 11.10 Product, category, or portfolio compatibility

Determines whether the candidate’s current portfolio aligns with the offering’s category, quality, price point, technical requirements, or brand position.

### 11.11 Channel compatibility

Used for distributor, reseller, referral, and channel campaigns.

Signals may include:

- existing complementary portfolio;
- sales reach;
- territory coverage;
- service capability;
- channel conflict;
- competing exclusivity;
- partner program experience.

### 11.12 Strategic alignment

Determines whether the candidate’s stated direction, positioning, or priorities align with the relationship.

This is supporting evidence, not a substitute for operational compatibility.

### 11.13 Trigger or timing evidence

Determines whether there is a current event increasing the probability of need or purchase.

Examples:

- expansion;
- funding;
- hiring;
- new location;
- product launch;
- regulatory deadline;
- system migration;
- contract expiration;
- inventory pressure;
- new market entry.

Lack of a public trigger is unknown, not a confirmed lack of need.

### 11.14 Existing solution or substitute

Determines whether the candidate already uses a competing, complementary, or substitute solution.

Interpretation is campaign-specific:

- existing use may prove need;
- it may create switching difficulty;
- it may create integration opportunity;
- it may indicate a hard exclusive relationship.

### 11.15 Competitive conflict

Determines whether the candidate materially competes with the workspace company or offering.

This often contributes to relationship and exclusion rather than fit.

### 11.16 Partnership leverage

Used where the objective is partnership, distribution, integration, or referrals.

Signals may include:

- overlapping customer base;
- complementary offering;
- geographic reach;
- technical integration potential;
- reputation;
- channel access.

### 11.17 Commercial capacity

Determines whether the candidate plausibly has the purchasing or contract capacity for the offering.

Public evidence rarely proves budget directly. This factor should use observable proxies and preserve uncertainty.

### 11.18 Expansion potential

Determines whether a successful initial relationship could expand across locations, business units, territories, products, or customer segments.

### 11.19 Account strategic value

Captures importance not fully represented by near-term transaction size, such as:

- lighthouse-brand value;
- network effects;
- market-entry leverage;
- reference-customer value;
- access to a strategic ecosystem.

### 11.20 Campaign custom factors

Campaigns may define custom factors when standard factors cannot express a critical condition.

A custom factor must still include:

- precise definition;
- positive and negative evidence criteria;
- applicability;
- weight;
- unknown policy;
- source expectations;
- auditability.

Custom factors must not be vague labels such as “good company” or “strong match.”

---

## 12. Factor Evidence States

### 12.1 Canonical states

```ts
type FactorEvidenceState =
  | "positive"
  | "negative"
  | "unknown"
  | "conflicting"
  | "not_applicable";
```

### 12.2 Positive

Available evidence supports compatibility or value for the factor.

### 12.3 Negative

Available evidence supports incompatibility or weakness for the factor.

Negative requires evidence. It must not be inferred from missing information.

### 12.4 Unknown

The factor is applicable, but available evidence is insufficient to support a positive or negative conclusion.

Unknown:

- lowers confidence;
- may trigger research when critical;
- does not contribute a negative value to fit or potential;
- remains visible to the reviewer.

### 12.5 Conflicting

Reliable evidence supports both positive and negative interpretations, or sources materially disagree.

Conflicting evidence should:

- lower confidence;
- retain both sides;
- trigger verification when critical;
- never be silently reduced to unknown.

### 12.6 Not applicable

The factor does not apply to the candidate, archetype, objective, or offering.

Not-applicable factors are excluded from score denominators and confidence coverage calculations.

---

## 13. Evidence Strength

### 13.1 Strength scale

For positive and negative states:

```ts
type EvidenceStrength = 1 | 2 | 3;
```

Interpretation:

- `1` — weak supporting signal;
- `2` — meaningful evidence;
- `3` — direct or decisive evidence.

### 13.2 Strength is not confidence

Strength describes how materially the evidence affects the factor if true. Confidence describes how reliable and complete the evidence is.

A direct statement on an outdated source may be strong but not highly reliable. A recent third-party inference may be credible but only weakly relevant.

### 13.3 Counter-evidence

Every factor evaluation may include counter-evidence. Counter-evidence must not be omitted simply because one conclusion was selected.

---

## 14. Evidence Quality Model

### 14.1 Quality dimensions

Each evidence item should carry at least:

- source reliability;
- claim directness;
- freshness;
- candidate-identity match confidence;
- geographic relevance;
- context completeness;
- extraction confidence.

### 14.2 Source reliability

Examples of higher-reliability sources:

- candidate’s official website for current offerings;
- official registry for legal identity;
- official partner or distributor page;
- regulatory filing;
- candidate’s current job listing for current hiring intent.

Examples of lower-reliability sources:

- search-result snippets without page verification;
- scraped aggregators;
- undated directories;
- copied descriptions;
- anonymous listings.

Source reliability is claim-dependent. A company website may be strong for product positioning but weak for independent financial claims.

### 14.3 Directness

Evidence directness levels:

- direct explicit statement;
- direct structured value;
- strong contextual inference;
- weak contextual inference.

### 14.4 Freshness

Freshness rules vary by claim type.

Examples:

- legal registration may remain valid for longer;
- employee count changes more quickly;
- current product offerings require recent evidence;
- procurement structures may change after acquisition;
- store locations may close;
- hiring and trigger signals age rapidly.

The factor definition may specify maximum evidence age.

### 14.5 Evidence-item contract

```ts
type EvaluationEvidenceReference = {
  evidenceId: string;
  claimId?: string;

  stance: "supports" | "contradicts" | "context";
  relevance: number;

  sourceReliability: number;
  directness: number;
  freshness: number;
  identityMatchConfidence: number;

  excerpt?: string;
  structuredValue?: unknown;
};
```

---

## 15. Factor Evaluation Contract

```ts
type CandidateFactorEvaluation = {
  id: string;
  campaignCandidateEvaluationId: string;
  factorKey: string;

  applicability: "applicable" | "not_applicable";
  state: FactorEvidenceState;
  strength?: EvidenceStrength;

  confidence: number;

  evidence: EvaluationEvidenceReference[];
  counterEvidence: EvaluationEvidenceReference[];

  explanation: string;
  unresolvedQuestions: string[];

  criticalGateState?: "passed" | "failed" | "unresolved" | "not_applicable";

  evaluatorVersion: string;
  createdAt: string;
};
```

The model must return this structure or a schema-compatible intermediate result. It must not return only prose.

---

## 16. Research Question Compilation

### 16.1 Research is factor-driven

Candidate research should be compiled from unresolved factors and critical gates.

The system should not ask a general model to “research whether this company is a good fit.”

Instead, it asks questions such as:

- Does the organization buy externally or produce internally?
- Is procurement controlled by the local entity or parent group?
- Does the organization serve the buyer segment required by this partnership?
- Does it operate enough locations to meet the campaign’s scale requirement?
- Does it already represent an exclusive competing solution?
- Is the relevant product line current or historical?

### 16.2 Research priority

Questions are prioritized by:

1. hard-exclusion uncertainty;
2. relationship uncertainty;
3. critical required factors;
4. factors with high score weight;
5. high-potential candidate uncertainty;
6. low-cost evidence opportunities;
7. supporting factors.

### 16.3 Research stopping

Research stops when:

- all required factors are sufficiently resolved;
- the candidate becomes excluded or rejected with strong evidence;
- additional evidence is unlikely to change the decision;
- per-candidate budget is reached;
- sources are exhausted;
- the candidate is routed to manual review.

---

## 17. LLM Responsibilities

### 17.1 Models may

Models may:

- classify relationship from supplied evidence;
- identify applicable exclusion rules;
- extract factor evidence;
- classify evidence state;
- assess evidence strength;
- identify conflicts;
- identify unknowns;
- propose research questions;
- generate concise explanations;
- compare candidates using structured evidence;
- flag inconsistent evaluations.

### 17.2 Models may not

Models may not:

- invent unsupported facts;
- treat missing evidence as negative;
- silently create permanent exclusion rules;
- calculate or override final deterministic scores;
- alter a Campaign Strategy version;
- merge entities;
- ignore counter-evidence;
- change eligibility without producing structured reasons;
- use provider ranking as proof of fit;
- assign a holistic “vibe” score.

### 17.3 Typed outputs

All model calls must return validated structured output. Invalid output is retried with bounded repair logic and logged.

### 17.4 Evidence-bounded prompts

Prompts must explicitly state:

- use only supplied evidence;
- return unknown when evidence is insufficient;
- distinguish direct evidence from inference;
- include counter-evidence;
- do not generate numerical final scores;
- do not assume that industry similarity proves buying compatibility;
- evaluate the candidate relative to the selected offering and objective.

---

## 18. Deterministic Fit Scoring

### 18.1 Purpose

Fit measures commercial compatibility, not account value, contactability, or evidence completeness.

### 18.2 Factor signed value

For each applicable observed fit factor:

```text
positive strength 1 → +0.3333
positive strength 2 → +0.6667
positive strength 3 → +1.0000
negative strength 1 → -0.3333
negative strength 2 → -0.6667
negative strength 3 → -1.0000
```

Unknown and conflicting factors do not receive a signed fit value until resolved. They affect confidence instead.

A campaign may define a specific deterministic mapping for a factor, but mappings must be versioned and bounded to `[-1, 1]`.

### 18.3 Weighted fit calculation

For observed applicable fit factors:

```text
weighted_mean = Σ(weight_i × signed_value_i) / Σ(weight_i)
fit_score = round(50 + 50 × weighted_mean)
```

Result range:

- `0` — strongly incompatible based on observed factors;
- `50` — balanced or neutral observed evidence;
- `100` — strongly compatible based on observed factors.

### 18.4 No-evidence behavior

If no applicable fit factor has usable positive or negative evidence:

```text
fit_score = null
```

The system must not display 50 as though it were a neutral finding. There is simply insufficient evidence.

### 18.5 Unknown exclusion from denominator

Unknown factors are excluded from the fit denominator so missing evidence does not create a negative score.

However, the resulting fit cannot enter the recommended lane unless evidence coverage and confidence thresholds are satisfied.

### 18.6 Conflicting factors

Conflicting factors are excluded from the fit numerator unless a deterministic conflict-resolution policy produces an observed net value.

They remain in confidence coverage and reduce consistency.

### 18.7 Critical-factor interaction

A high fit score cannot override:

- a failed critical gate;
- a triggered hard exclusion;
- an incompatible relationship;
- unresolved identity;
- insufficient evidence coverage.

### 18.8 Fit band labels

Default display bands may be:

- `85–100`: very strong compatibility;
- `70–84`: strong compatibility;
- `55–69`: plausible compatibility;
- `40–54`: weak or mixed compatibility;
- `0–39`: incompatible.

These labels are configurable and must not determine eligibility alone.

### 18.9 Score trace

Every fit score must preserve:

- included factors;
- excluded unknown factors;
- factor weights;
- signed values;
- calculation version;
- raw weighted mean;
- final rounded score.

---

## 19. Commercial Potential Scoring

### 19.1 Purpose

Commercial potential estimates the likely value or strategic importance of the account if the relationship is valid.

It does not answer whether the candidate is a fit.

### 19.2 Potential factors

Potential may include:

- estimated purchase or contract capacity;
- number of sites or business units;
- geographic reach;
- growth trajectory;
- expansion potential;
- strategic-brand value;
- channel reach;
- customer-base leverage;
- recurrence potential;
- current trigger strength.

### 19.3 Potential score mapping

Potential factors should normally use a bounded `0–1` value rather than signed compatibility.

Example:

```text
low observed potential → 0.25
moderate observed potential → 0.50
high observed potential → 0.75
very high observed potential → 1.00
```

A factor-specific mapping may use normalized quantitative ranges where reliable data exists.

### 19.4 Weighted potential calculation

```text
potential_mean = Σ(weight_i × value_i) / Σ(weight_i)
potential_score = round(100 × potential_mean)
```

Unknown factors are excluded from the denominator and reduce potential confidence.

If no potential factor has usable evidence:

```text
commercial_potential_score = null
```

### 19.5 Potential must not drive eligibility

A famous or large organization with high potential but poor fit remains rejected or excluded. Potential only prioritizes candidates after relationship and eligibility are established.

---

## 20. Confidence Model

### 20.1 Confidence is multidimensional

The evaluation should calculate at least:

- identity confidence;
- relationship confidence;
- fit confidence;
- potential confidence;
- procurement confidence where relevant;
- overall confidence.

The compact UI may show overall confidence while expanded details expose components.

### 20.2 Confidence components

#### Evidence coverage

The proportion of applicable weighted factors with usable evidence.

```text
coverage = Σ(weights of observed applicable factors) / Σ(weights of all applicable factors)
```

Observed means positive, negative, or deterministically resolved conflicting evidence.

#### Evidence quality

The weighted average of source reliability, directness, freshness, and identity match across used evidence.

#### Consistency

The degree to which material evidence and factor findings agree.

#### Identity certainty

Imported from entity resolution.

#### Relationship certainty

Imported from relationship assessment.

#### Procurement certainty

Used when procurement location or authority is commercially critical.

### 20.3 Default fit-confidence calculation

A default versioned policy may use:

```text
fit_confidence =
  0.35 × evidence_coverage
+ 0.25 × evidence_quality
+ 0.15 × evidence_consistency
+ 0.15 × identity_confidence
+ 0.10 × relationship_confidence
```

When procurement is critical, part of the relationship or consistency weight may be assigned to procurement confidence.

All values are normalized to `[0, 1]`, then displayed as `0–100`.

### 20.4 Confidence caps

Confidence must be capped when known limitations exist.

Default examples:

- unresolved canonical identity: maximum 40;
- search snippets only, no opened source: maximum 45;
- primary relationship based only on weak inference: maximum 55;
- unresolved required factor: maximum 60;
- suspected hard exclusion: maximum 50 and `requires_research`;
- unresolved buying organization when procurement is critical: maximum 55;
- materially stale evidence: factor-specific cap;
- unresolved conflicting critical evidence: maximum 50.

Caps are versioned and campaign-configurable.

### 20.5 Overall confidence

Overall confidence should not hide a dangerously weak component.

A suitable policy is:

```text
overall_confidence = min(
  weighted_confidence_average,
  applicable_confidence_caps
)
```

The system may also require minimum component values for recommended status.

### 20.6 Confidence is not probability of purchase

Confidence indicates confidence in the evaluation, not likelihood of conversion. Opptium must not label it as “purchase probability” unless a separately validated predictive model exists.

---

## 21. Critical Gates

### 21.1 Purpose

Some conditions are too important to be represented only as weighted factors.

Examples:

- candidate must have a required license;
- candidate must serve a defined customer category;
- buyer must be able to purchase externally;
- candidate must operate in a legally serviceable market;
- candidate must meet a minimum technical capability;
- candidate must not be an exclusive competitor;
- campaign must target the actual buying organization.

### 21.2 Gate states

```ts
type CriticalGateState = "passed" | "failed" | "unresolved" | "not_applicable";
```

### 21.3 Gate effects

- `passed` allows normal evaluation;
- `failed` causes exclusion or rejection according to strategy;
- `unresolved` causes `requires_research` unless the strategy explicitly allows conditional review;
- `not_applicable` has no effect.

### 21.4 Gate evidence

A gate must reference specific evidence and cannot be passed through generic category similarity.

---

## 22. Review Lanes

### 22.1 Why lanes are needed

A single sorted table hides important differences between:

- qualified candidates;
- potentially valuable candidates with missing evidence;
- conditional fits;
- exclusions;
- invalid records.

The system should assign candidates to explicit review lanes.

### 22.2 Recommended

Requirements normally include:

- eligible;
- desired relationship;
- no failed or unresolved critical gate;
- fit at or above recommended threshold;
- confidence at or above recommended threshold;
- minimum evidence coverage met.

### 22.3 Conditional

Used when:

- candidate is eligible but fits a secondary archetype;
- one confirmed limitation exists;
- fit is plausible but below the strongest threshold;
- campaign strategy permits conditional accounts.

### 22.4 Requires research

Used when:

- critical unknowns remain;
- relationship is uncertain;
- evidence coverage is insufficient;
- exclusion is suspected;
- identity or procurement is unresolved;
- high potential justifies further investigation.

### 22.5 Rejected

Valid organizations that do not meet the strategy with sufficient confidence.

### 22.6 Excluded

Candidates removed by relationship incompatibility or confirmed hard rules.

### 22.7 Invalid and duplicate

Operational cleanup lanes, not commercial evaluation outcomes.

### 22.8 Queue assignment contract

```ts
type CandidateReviewLane =
  | "recommended"
  | "conditional"
  | "requires_research"
  | "rejected"
  | "excluded"
  | "invalid"
  | "duplicate";
```

---

## 23. Ranking Policy

### 23.1 No hidden universal combined score

Opptium must not silently combine fit, potential, and confidence into one user-facing number.

These dimensions remain separate because they answer different questions.

### 23.2 Lane-first ranking

Candidates are ranked first by lane, then according to the campaign’s ranking policy.

A default order is:

1. recommended;
2. conditional;
3. requires research;
4. rejected;
5. excluded;
6. invalid and duplicate.

Excluded, invalid, and duplicate candidates normally appear in separate tabs rather than below qualified candidates.

### 23.3 Default ordering within recommended

Default lexicographic ordering:

1. fit band;
2. commercial potential;
3. fit confidence;
4. directness of strongest positive evidence;
5. candidate freshness;
6. stable tie-breaker.

The exact policy is campaign-versioned.

### 23.4 Ordering within requires research

Research priority should use:

1. plausible desired relationship;
2. potential value;
3. likelihood that one additional research action changes the decision;
4. cost of resolving the uncertainty;
5. current fit estimate;
6. recency and source availability.

### 23.5 Stable ranking

Reprocessing unchanged evidence under the same strategy and evaluator version must produce the same scores, lane, and deterministic ordering.

### 23.6 Rank changes

Every rank change should be traceable to:

- new evidence;
- corrected entity identity;
- updated strategy version;
- changed factor definition;
- user correction;
- comparative consistency correction;
- model or rules version update.

---

## 24. Comparative Ranking

### 24.1 Why comparative evaluation is required

Independent candidate evaluations can be internally consistent but mutually inconsistent.

Common problems include:

- direct evidence receiving less weight than surface category similarity;
- identical evidence being interpreted differently across candidates;
- a competitor ranking above a buyer;
- a high score supported by one weak factor;
- parent and subsidiary both appearing as separate opportunities;
- one archetype being favored because its websites are easier to parse;
- different model calls applying factor definitions unevenly.

A comparative pass detects these problems.

### 24.2 Comparative model input

The comparative model receives only structured campaign and candidate information:

- campaign objective;
- selected offering;
- archetype definitions;
- exclusion policy summary;
- factor definitions;
- relationship assessments;
- factor evaluations;
- fit, potential, and confidence calculations;
- evidence summaries and source references;
- unresolved questions;
- entity relationships.

It must not browse independently or invent facts.

### 24.3 Comparative model output

```ts
type ComparativeBatchAssessment = {
  campaignId: string;
  batchId: string;

  preferredOrder: string[];

  anomalies: Array<{
    type: ComparativeAnomalyType;
    candidateIds: string[];
    factorKeys?: string[];
    explanation: string;
    severity: "low" | "medium" | "high";
    recommendedAction:
      | "none"
      | "re_evaluate_factor"
      | "verify_relationship"
      | "verify_exclusion"
      | "verify_identity"
      | "merge_review"
      | "additional_research";
  }>;

  pairwiseRationales: Array<{
    higherCandidateId: string;
    lowerCandidateId: string;
    rationale: string;
    evidenceIds: string[];
  }>;
};
```

### 24.4 Comparative model authority

The comparative model may:

- propose an order within the same lane;
- flag scoring inversions;
- flag inconsistent factor interpretation;
- request re-evaluation;
- identify suspicious duplicates or relationship conflicts;
- explain relative ordering.

It may not:

- directly overwrite deterministic scores;
- silently change eligibility;
- create new evidence;
- merge organizations;
- bypass hard exclusions;
- promote a candidate with unresolved critical gates into recommended.

### 24.5 Structured correction loop

When an anomaly is material:

```text
comparative anomaly
→ targeted factor or relationship re-evaluation
→ deterministic score recalculation
→ lane reassignment if required
→ comparative batch rerun
```

The anomaly itself does not alter the score.

### 24.6 Batch size

Recommended comparative batch size is approximately 10–20 candidates, depending on evidence payload size and model context limits.

### 24.7 Cross-batch consistency

For campaigns larger than one batch:

- group candidates by lane and archetype;
- use overlapping anchor candidates across adjacent batches;
- compare batch leaders in a final champion batch;
- detect unstable pairwise ordering;
- retain deterministic scores as the stable baseline.

### 24.8 Archetype balance

Comparative ranking must not force equal representation across archetypes. It should only detect whether an archetype is systematically advantaged by weaker evidence standards.

---

## 25. Comparative Anomaly Library

```ts
type ComparativeAnomalyType =
  | "direct_evidence_ranked_below_surface_match"
  | "competitor_ranked_as_buyer"
  | "supplier_or_partner_relationship_mismatch"
  | "high_fit_low_evidence"
  | "same_evidence_different_factor_state"
  | "factor_weight_application_mismatch"
  | "critical_gate_ignored"
  | "hard_exclusion_ignored"
  | "unknown_treated_as_negative"
  | "unknown_treated_as_positive"
  | "parent_subsidiary_double_count"
  | "localized_storefront_double_count"
  | "procurement_organization_mismatch"
  | "stale_evidence_dominates"
  | "archetype_evidence_bias"
  | "geographic_evidence_bias"
  | "potential_confused_with_fit"
  | "contactability_confused_with_fit"
  | "relationship_confidence_too_low"
  | "explanation_not_supported"
  | "other";
```

Each anomaly type should have deterministic prechecks where possible. The LLM comparative pass supplements rather than replaces rule-based detection.

---

## 26. Deterministic Consistency Checks

Before invoking the comparative model, application code should check:

### 26.1 Eligibility-score consistency

- excluded candidate with recommended lane;
- unresolved critical gate with recommended lane;
- null fit with recommended lane;
- confidence below threshold with recommended lane;
- rejected candidate above threshold without recorded negative gate.

### 26.2 Factor-state consistency

- unknown factor with negative signed value;
- not-applicable factor included in denominator;
- factor strength without positive or negative state;
- missing evidence on a decisive factor;
- evidence references from the wrong candidate;
- factor evaluated under an obsolete strategy version.

### 26.3 Relationship consistency

- competitor primary relationship in buyer lane;
- supplier primary relationship in buyer lane;
- target organization different from buying organization without explanation;
- existing customer included despite active existing-customer exclusion.

### 26.4 Entity consistency

- duplicate canonical organization in the same active review lane;
- parent and subsidiary representing one procurement unit;
- merged candidate retaining active rank;
- invalid entity with factor evaluation.

### 26.5 Score calculation consistency

- factor weights not matching rubric;
- score outside valid range;
- unknown included as zero-negative value;
- stale calculation version;
- rounding difference from deterministic implementation.

Any failed deterministic check blocks finalization.

---

## 27. Explanation Requirements

### 27.1 Candidate summary

Every reviewable candidate should have a concise summary containing:

1. likely relationship;
2. why it matches the offering;
3. strongest direct evidence;
4. strongest concern or limitation;
5. important unknown;
6. why it belongs in the assigned lane.

### 27.2 Evidence references

Material statements must reference stored evidence IDs or claims. The UI may render source links rather than raw IDs.

### 27.3 No score restatement without reasoning

Bad explanation:

> Strong fit because the score is 82.

Required explanation:

> The company operates the required business model and publicly confirms the relevant purchasing or usage behavior. Its main uncertainty is whether procurement is controlled locally or by the parent group.

### 27.4 Distinguish evidence from inference

Explanations should use language appropriate to certainty:

- “The company states…” for direct evidence;
- “This suggests…” for inference;
- “No reliable evidence was found…” for unknowns;
- “Sources conflict…” for conflicting evidence.

### 27.5 Comparative explanation

Where relevant, the expanded row may explain why one candidate ranks above another:

> Ranked above comparable candidates because it has direct evidence of the required buying behavior, while the others match the industry but have unresolved procurement compatibility.

### 27.6 Exclusion explanations

An excluded candidate must show:

- relationship or rule triggered;
- scope of the rule;
- supporting evidence;
- whether exclusion applies only to this campaign, this offering, or more broadly.

---

## 28. User Review Actions

### 28.1 Approve

Approval confirms the candidate for the campaign and may allow contact enrichment.

Approval does not automatically make the candidate a permanent ideal-customer example unless the user explicitly promotes that learning.

### 28.2 Reject

Rejection should capture a reason, such as:

- wrong business model;
- wrong relationship;
- too small or too large;
- procurement mismatch;
- competitor;
- existing customer;
- not serviceable;
- weak evidence;
- user preference;
- other.

### 28.3 Reclassify relationship

The user may change the candidate from buyer to partner, competitor, supplier, or another relationship.

This should:

- update the campaign candidate;
- invalidate dependent eligibility and scores;
- trigger targeted recalculation;
- create a campaign correction memory;
- optionally suggest a broader rule later.

### 28.4 Correct a factor

The user may mark a factor positive, negative, unknown, or not applicable and provide a reason or evidence.

User-confirmed factor corrections outrank AI inference.

### 28.5 Change exclusion scope

When appropriate, the UI may offer:

```text
Apply this correction to:
- This candidate only
- This campaign
- Future campaigns for this offering
- All relevant workspace campaigns
```

The default for campaign-time corrections is current candidate or current campaign, not global.

### 28.6 Request more research

The user may request deeper verification of a specific uncertainty. The task must be factor- or question-specific.

---

## 29. Learning and Memory Effects

### 29.1 Immediate correction versus durable learning

Every correction creates:

- an immediate campaign effect;
- a scoped memory record;
- an optional broader-rule proposal.

The system must not automatically promote one correction to workspace-global memory.

### 29.2 Repeated pattern detection

When the same correction recurs across campaigns, Opptium may propose:

- offering-level exclusion;
- offering-level positive signal;
- updated buyer archetype;
- revised factor definition;
- workspace-level relationship rule.

Promotion requires explicit user confirmation unless the information is a direct factual update about a specific candidate.

### 29.3 Benchmark capture

High-confidence user corrections should be eligible for inclusion in internal benchmark fixtures after tenant-safe anonymization or explicit test configuration.

### 29.4 Memory retrieval

Only relevant campaign, offering, workspace, and candidate memory should be compiled into the evaluation context. Full historical notes must not be inserted into every model call.

---

## 30. Candidate Evaluation State Machine

```ts
type CandidateEvaluationStatus =
  | "pending"
  | "relationship_classifying"
  | "exclusion_checking"
  | "research_planning"
  | "researching"
  | "factor_evaluating"
  | "scoring"
  | "consistency_checking"
  | "comparative_pending"
  | "finalized"
  | "requires_manual_review"
  | "failed"
  | "superseded";
```

### 30.1 Valid transitions

```text
pending
→ relationship_classifying
→ exclusion_checking
→ research_planning
→ researching, factor_evaluating, or finalized exclusion
→ factor_evaluating
→ scoring
→ consistency_checking
→ comparative_pending
→ finalized
```

A new strategy or evidence version may move a finalized evaluation to `superseded` and create a new evaluation record.

### 30.2 No destructive overwrite

Re-evaluation creates a new version. Previous evaluation records remain available for audit and comparison.

---

## 31. Evaluation Versioning and Invalidation

### 31.1 Invalidation triggers

An evaluation is invalidated when:

- campaign strategy version changes;
- offering version changes materially;
- candidate identity or buying organization changes;
- hard exclusion rules change;
- factor definition or weight changes;
- new evidence affects a used claim;
- user corrects relationship or factor state;
- scoring-policy version changes;
- evidence becomes stale beyond policy;
- a candidate merge or split occurs.

### 31.2 Selective re-evaluation

The system should re-run only affected stages when safe.

Examples:

- new employee-count evidence may only affect scale and potential;
- new parent-company evidence may require relationship, procurement, exclusions, fit, and ranking recalculation;
- changed campaign objective requires a complete campaign-specific re-evaluation;
- changed score rounding policy requires deterministic recalculation but not new research.

### 31.3 Snapshot integrity

Each finalized evaluation references the evidence snapshot it used so historical results remain reproducible.

---

## 32. Preliminary Data Records

Document 06 will define final tables. Document 05 requires the following logical records:

```text
candidate_relationship_assessments
candidate_exclusion_assessments
candidate_eligibility_decisions
qualification_rubrics
qualification_factor_definitions
candidate_factor_evaluations
candidate_score_calculations
candidate_confidence_calculations
candidate_review_lane_assignments
comparative_batches
comparative_batch_members
comparative_anomalies
candidate_rank_snapshots
candidate_explanations
candidate_evaluation_versions
candidate_evaluation_events
```

Evidence and claims remain in the shared structures defined by Documents 01 and 04.

---

## 33. Aggregate Evaluation Contract

```ts
type CampaignCandidateEvaluation = {
  id: string;
  campaignCandidateId: string;
  campaignStrategyVersionId: string;
  candidateIntelligenceSnapshotId: string;

  status: CandidateEvaluationStatus;

  relationship: RelationshipAssessment;
  exclusions: CandidateExclusionAssessment[];
  eligibility: CandidateEligibility;
  eligibilityReason: string;

  factorEvaluations: CandidateFactorEvaluation[];

  fit: {
    score: number | null;
    confidence: number;
    band?: string;
    calculationId?: string;
  };

  commercialPotential: {
    score: number | null;
    confidence: number;
    band?: string;
    calculationId?: string;
  };

  overallConfidence: number;
  confidenceCaps: string[];

  reviewLane: CandidateReviewLane;
  rank?: number;
  rankWithinArchetype?: number;

  strongestPositiveFactorKeys: string[];
  strongestNegativeFactorKeys: string[];
  criticalUnknownFactorKeys: string[];

  explanationId?: string;

  rulesVersion: string;
  scoringVersion: string;
  modelConfigVersion: string;

  createdAt: string;
  finalizedAt?: string;
};
```

---

## 34. Trigger.dev Task Boundaries

Suggested task boundaries:

```text
candidate.classifyRelationship
candidate.compileExclusions
candidate.evaluateExclusions
candidate.determinePreliminaryEligibility
candidate.compileResearchQuestions
candidate.researchCriticalQuestions
candidate.evaluateFactors
candidate.calculateScores
candidate.calculateConfidence
candidate.assignReviewLane
candidate.runConsistencyChecks
campaign.prepareComparativeBatches
campaign.compareCandidateBatch
candidate.reEvaluateFlaggedFactors
campaign.finalizeCandidateRanking
candidate.generateExplanation
```

### 34.1 Deterministic versus model tasks

Deterministic application tasks:

- compile applicable rules;
- calculate scores;
- calculate coverage;
- apply confidence caps;
- determine eligibility from structured inputs;
- assign lane;
- run schema and arithmetic checks;
- generate stable sort keys;
- handle versioning and invalidation.

Model-assisted tasks:

- classify relationship;
- evaluate exclusion evidence;
- extract factor evidence;
- classify factor state and strength;
- identify conflicts and unknowns;
- generate research questions;
- compare candidates;
- generate evidence-bounded explanations.

### 34.2 Idempotency

Task idempotency keys should include relevant versions, for example:

```text
candidateId
+ campaignStrategyVersionId
+ candidateIntelligenceSnapshotId
+ taskType
+ evaluatorVersion
```

### 34.3 Retry behavior

Retries must not create duplicate evaluation versions or double-apply user corrections.

### 34.4 Partial completion

A candidate may remain in `requires_research` when some sources fail. The pipeline should preserve completed evidence and unresolved questions rather than restarting from zero.

---

## 35. Model Role Configuration

### 35.1 Relationship and strategy-grade reasoning

Use a strong reasoning model for:

- ambiguous relationship classification;
- exclusion conflicts;
- high-impact critical gates;
- comparative ranking;
- difficult cross-source contradiction analysis.

### 35.2 Fast evidence model

Use a faster model for:

- mapping straightforward claims to factors;
- extracting explicit evidence;
- classifying clear positive or negative states;
- generating concise source summaries.

### 35.3 Verification model

Use a stronger verification pass only when:

- candidate potential is high;
- confidence is below threshold;
- sources conflict;
- a hard exclusion is suspected;
- comparative checks flag an inversion;
- user requests deeper verification.

### 35.4 Provider independence

Model configuration must be referenced by role rather than hard-coded provider-specific model names throughout the codebase.

---

## 36. Prompt Contracts

### 36.1 Relationship prompt requirements

The prompt must include:

- selected offering and objective;
- relationship taxonomy;
- candidate identity and business model;
- relevant organization graph;
- supplied evidence;
- active campaign memory;
- instruction to classify relative to the current objective;
- instruction to return unknown when evidence is insufficient.

### 36.2 Factor evaluation prompt requirements

For each factor, include:

- exact factor definition;
- positive evidence definition;
- negative evidence definition;
- unknown policy;
- criticality;
- accepted source types;
- relevant candidate claims and evidence.

The model must return one factor record at a time or a validated batch of independent factor records.

### 36.3 Comparative prompt requirements

The prompt must state:

- do not invent new facts;
- do not recalculate scores;
- compare evidence quality and factor consistency;
- identify scoring inversions;
- cite evidence IDs;
- recommend targeted re-evaluation rather than silently correcting results.

### 36.4 Explanation prompt requirements

The explanation generator receives only finalized structured results. It must not perform new qualification reasoning.

---

## 37. Performance and Cost Controls

### 37.1 Cheap gates first

Before deep model evaluation:

- reject invalid entities;
- remove duplicates;
- apply deterministic known exclusions;
- reuse fresh existing evidence;
- stop research after decisive exclusion.

### 37.2 Evaluate plausible candidates deeply

Deep factor research should focus on candidates that survive cheap filtering or have enough potential to justify uncertainty resolution.

### 37.3 Batch compatible tasks

Safe batching opportunities include:

- factor extraction from one evidence set;
- comparative candidate batches;
- explanation generation;
- deterministic score calculations.

### 37.4 Cache by evidence snapshot

Unchanged evidence and unchanged factor definitions should reuse prior factor evaluations where tenant and scope rules allow.

### 37.5 Stop low-value research

Do not continue researching a candidate once:

- a confirmed hard exclusion is triggered;
- a decisive incompatible relationship is confirmed;
- sufficient negative evidence supports rejection;
- expected value of additional research is below cost threshold.

---

## 38. Observability

The system should expose metrics for:

- candidates entering qualification;
- relationship distribution;
- exclusion reasons;
- eligibility distribution;
- average factors per candidate;
- unknown-factor rate;
- conflicting-factor rate;
- evidence coverage;
- average confidence;
- fit and potential distributions;
- recommended precision after user review;
- comparative anomaly rate;
- re-evaluation rate;
- user correction rate by factor;
- cost and latency per candidate;
- cost per recommended and approved candidate;
- percentage of evaluations using stale evidence;
- model and prompt version performance.

These metrics must be segmented by campaign type, archetype, geography, and provider source where possible.

---

## 39. Auditability

For every final candidate, an auditor must be able to reconstruct:

1. which strategy version was used;
2. which canonical organization was evaluated;
3. which buying organization was assumed;
4. which relationship was assigned and why;
5. which exclusion rules were compiled;
6. which exclusions triggered or remained uncertain;
7. which factors were applicable;
8. which evidence supported each factor;
9. which unknowns were excluded from scoring;
10. how fit was calculated;
11. how potential was calculated;
12. how confidence was calculated and capped;
13. why the review lane was assigned;
14. which comparative anomalies were detected;
15. which user corrections changed the result;
16. which model, prompt, and rules versions were used.

No user-facing score may exist without this trace.

---

## 40. Tenant and Privacy Boundaries

### 40.1 Public Candidate Intelligence

Reusable public facts may be shared internally across campaigns according to the architecture in Document 04.

### 40.2 Workspace-private evaluation

The following remain tenant-private:

- fit and potential evaluations;
- user corrections;
- custom exclusions;
- campaign strategies;
- candidate approval and rejection history;
- private notes;
- relationship assumptions specific to the workspace;
- memory promotion proposals.

### 40.3 No cross-tenant learning leakage

A rejection by one customer must not become a factual exclusion for another customer.

Aggregated benchmark improvements require appropriate anonymization and product-policy review.

---

## 41. Error Handling

### 41.1 Missing evidence

Return unknown, lower confidence, and route according to criticality. Do not fabricate a negative.

### 41.2 Conflicting evidence

Retain both sides, lower consistency, and trigger targeted verification when material.

### 41.3 Invalid model output

Retry with schema repair. If still invalid, mark the stage failed or route to manual review without losing prior results.

### 41.4 Stale strategy version

Abort evaluation and enqueue against the active immutable version if appropriate.

### 41.5 Candidate merged during evaluation

Supersede the evaluation and move source evidence to the surviving candidate according to Document 04.

### 41.6 Arithmetic mismatch

Block finalization, recalculate deterministically, and log an integrity event.

### 41.7 Comparative instability

When pairwise order remains unstable after re-evaluation, preserve deterministic ordering and flag the candidates for review rather than repeatedly invoking models.

---

## 42. Testing Strategy

### 42.1 Unit tests

Test:

- factor signed-value mapping;
- fit calculation;
- potential calculation;
- unknown exclusion from denominator;
- not-applicable handling;
- confidence coverage;
- confidence caps;
- eligibility decision order;
- exclusion precedence;
- stable ranking;
- version invalidation;
- score traces.

### 42.2 Contract tests

Test model outputs against JSON schemas for:

- relationship assessment;
- exclusion assessment;
- factor evaluation;
- comparative anomaly;
- explanation generation.

### 42.3 Golden evaluation fixtures

Create manually reviewed fixtures across different business models, including:

- B2B SaaS direct buyers;
- industrial equipment buyers;
- distributors and resellers;
- professional-services buyers;
- wholesale buyers;
- marketplaces;
- logistics operators;
- healthcare or regulated organizations;
- local retail;
- strategic partnerships.

Each fixture should contain:

- strong true positives;
- deceptive category-similar false positives;
- competitors;
- suppliers;
- parent and subsidiary duplicates;
- low-evidence candidates;
- high-potential but uncertain candidates;
- explicit unknown-versus-negative cases.

### 42.4 Inversion tests

Include pairs where the correct relative order depends on business-model or procurement compatibility rather than industry similarity.

### 42.5 Scope tests

Verify that:

- campaign exclusions do not leak globally;
- offering rules apply only to that offering;
- campaign exceptions override broad rules only in context;
- candidate corrections do not automatically become workspace rules.

### 42.6 Regression tests

Every validated user correction caused by an intelligence error should be eligible to become a regression fixture.

---

## 43. Evaluation Metrics

Document 08 will finalize targets. Document 05 requires measurement of:

- relationship-classification accuracy;
- hard-exclusion precision and recall;
- eligibility accuracy;
- top-10 precision;
- rank correlation with expert review;
- competitor and supplier leakage;
- unknown-to-negative error rate;
- evidence coverage;
- confidence calibration;
- score inversion rate;
- comparative anomaly correction rate;
- duplicate or parent-group leakage into final queue;
- user override rate;
- cost and latency per finalized candidate.

Confidence calibration should test whether higher-confidence evaluations are actually more accurate after review.

---

## 44. Legacy Migration

### 44.1 Existing holistic scores

Legacy fit scores must not be imported as verified V2 factor evaluations.

They may be retained as historical fields for comparison:

```text
legacy_score
legacy_reason
legacy_pipeline_version
```

### 44.2 Re-evaluation

Candidates shown in active campaigns should be re-evaluated using:

- current canonical identity;
- a compiled V2 campaign strategy;
- reusable evidence where available;
- V2 relationship and factor logic.

### 44.3 Legacy classifications

Legacy labels may be imported as low-confidence hints, never as confirmed relationship facts unless user-validated.

### 44.4 Side-by-side comparison

During rollout, store and compare:

- legacy score and queue;
- V2 relationship;
- V2 eligibility;
- V2 fit;
- V2 potential;
- V2 confidence;
- user approval outcome.

### 44.5 Feature flag

V2 qualification should operate behind the Intelligence V2 feature flag until benchmark criteria are met.

---

## 45. Implementation Phases

### Phase 1 — Contracts and deterministic core

Implement:

- relationship taxonomy;
- eligibility taxonomy;
- factor definitions;
- factor states;
- score calculations;
- confidence calculations;
- critical gates;
- review lanes;
- score traces;
- unit tests.

### Phase 2 — Relationship and exclusions

Implement:

- relationship classifier;
- scoped exclusion compilation;
- exclusion evaluation;
- precedence and exceptions;
- preliminary eligibility;
- user correction flow.

### Phase 3 — Evidence-based factor evaluation

Implement:

- research-question compiler;
- evidence mapping;
- factor evaluation model calls;
- unknown and conflicting handling;
- source-quality evaluation;
- factor explanations.

### Phase 4 — Fit, potential, and confidence

Implement:

- deterministic calculations;
- evidence coverage;
- confidence caps;
- critical-gate enforcement;
- lane assignment;
- expanded audit trace.

### Phase 5 — Comparative consistency

Implement:

- deterministic consistency checks;
- comparative batches;
- anomaly library;
- targeted re-evaluation;
- cross-batch anchors;
- final rank snapshots.

### Phase 6 — Feedback and memory

Implement:

- approve and reject reasons;
- relationship corrections;
- factor corrections;
- scoped learning records;
- promotion proposals;
- regression fixture capture.

### Phase 7 — Optimization

Implement:

- evidence caching;
- selective invalidation;
- model routing;
- research expected-value controls;
- observability dashboards;
- cost tuning.

---

## 46. Acceptance Criteria

Document 05 is implemented successfully when:

1. every candidate is classified by commercial relationship before fit scoring;
2. relationship is evaluated relative to the selected offering and campaign objective;
3. primary and secondary relationships can coexist without ambiguity;
4. scoped exclusion rules are compiled from workspace, offering, campaign, and candidate memory;
5. campaign-time exclusions do not automatically become global;
6. hard exclusions require sufficient evidence before automatic exclusion;
7. suspected exclusions route to research rather than silent rejection;
8. invalid entities and duplicates cannot enter normal scoring;
9. eligibility is a structured decision rather than a score threshold alone;
10. factor definitions are part of the immutable campaign strategy;
11. every material factor has explicit positive and negative evidence definitions;
12. models return factor records rather than holistic final scores;
13. unknown evidence never contributes a negative fit value;
14. conflicting evidence remains explicit and reduces confidence;
15. not-applicable factors are removed from scoring and coverage denominators;
16. fit is calculated deterministically from applicable observed factor records;
17. commercial potential is calculated separately from fit;
18. confidence is calculated separately and includes coverage, quality, consistency, identity, and relationship certainty;
19. confidence caps prevent sparse or weak evidence from appearing authoritative;
20. a high fit score cannot override a hard exclusion or unresolved critical gate;
21. no-evidence candidates receive a null score rather than an arbitrary neutral score;
22. all score calculations are reproducible from stored factor weights and values;
23. recommended candidates meet fit, confidence, coverage, relationship, and critical-gate requirements;
24. requires-research candidates preserve their unresolved questions;
25. comparative ranking receives structured evidence and cannot invent facts;
26. comparative anomalies trigger targeted re-evaluation rather than direct score overrides;
27. deterministic consistency checks block impossible lane, score, and eligibility combinations;
28. parent, subsidiary, storefront, and procurement mismatches are detected before final ranking;
29. explanations cite evidence and distinguish facts, inferences, unknowns, and conflicts;
30. user corrections invalidate and recalculate only affected evaluation stages where safe;
31. user corrections remain scoped unless explicitly promoted;
32. previous evaluation versions remain auditable;
33. unchanged evidence and strategy produce stable deterministic results;
34. legacy holistic scores are not treated as V2 evidence;
35. benchmark fixtures demonstrate that direct commercial compatibility outranks surface category similarity;
36. the final review queue separates recommended, conditional, research, rejected, excluded, invalid, and duplicate candidates;
37. every finalized candidate has a complete audit trail from evidence to rank.

---

## 47. Locked Decisions

The following decisions are fixed for Intelligence V2 unless deliberately revised through architecture review:

- Commercial relationship is classified before scoring.
- Relationship is objective-specific and may differ across campaigns.
- A candidate may have one primary and multiple secondary relationships.
- Hard exclusions are applied before fit scoring.
- Exclusions are scoped and require applicability evaluation.
- Campaign exclusions remain campaign-scoped or provisional unless promoted.
- Eligibility is distinct from fit.
- Factor evidence uses positive, negative, unknown, conflicting, and not-applicable states.
- Unknown is never treated as a negative.
- Models extract and interpret evidence; application code calculates scores.
- Fit, commercial potential, and confidence remain separate.
- No evidence produces a null score, not an artificial neutral score.
- Critical gates can block recommendation regardless of fit.
- Confidence includes evidence coverage and is capped by material uncertainty.
- Contactability does not define commercial fit.
- Account size and brand prestige do not define commercial fit.
- Comparative ranking may flag and propose corrections but cannot silently overwrite deterministic scores.
- Comparative evaluation must use existing recorded evidence only.
- Every score, lane, and rank must be reproducible and auditable.
- User-confirmed corrections outrank AI inference.
- Evaluation versions are immutable and superseded rather than overwritten.

---

## 48. Handoff to Document 06

Document 06 must operationalize the contracts defined here through:

- final Supabase table definitions and relationships;
- Trigger.dev task graphs;
- task idempotency and retry policies;
- evidence and evaluation versioning;
- concurrency controls;
- model-role configuration;
- job state and progress events;
- transaction boundaries;
- invalidation and selective reprocessing;
- audit-event storage;
- cost and token accounting;
- end-to-end workflow orchestration.

Document 06 must preserve the central boundary:

> Models produce evidence-backed structured interpretations; deterministic application logic resolves rules, calculates scores, assigns lanes, and preserves auditability.
