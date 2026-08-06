# Opptium Intelligence V2

## Campaign Strategy and Scoped Memory

**Document:** 02  
**Status:** Implementation specification  
**Depends on:** `00-documentation-map-and-core-principles.md`, `01-company-intelligence-and-profile-creation.md`  
**Purpose:** Define how Opptium converts Company Intelligence into a market-specific campaign strategy, how the user reviews and adjusts that strategy, and how campaign memory, exclusions, corrections, and provisional learning are scoped and applied.

---

## 1. Purpose of Campaign Strategy

A campaign must not begin as a list of search keywords.

Its first responsibility is to compile a coherent commercial policy answering:

- which workspace offering is being promoted;
- what commercial objective the campaign serves;
- where the campaign operates;
- which organizations are plausible targets;
- why those organizations may buy, partner, resell, distribute, integrate, or otherwise engage;
- which superficially similar organizations are not valid targets;
- what evidence must be found before a candidate can be qualified;
- which conditions are hard exclusions;
- which conditions are merely weak signals or unresolved uncertainty;
- which source types are likely to cover the market;
- when discovery has sufficient coverage and should stop.

The Campaign Strategy is the contract between Company Intelligence and all later tasks.

Discovery, entity resolution, research, candidate evaluation, ranking, contact-role selection, and outbound preparation must reference the same immutable strategy version.

The system must move from:

> region + generic target description + broad search

To:

> published company profile + selected offering + objective + geography + scoped memory + user adjustments → versioned campaign strategy

---

## 2. Desired Outcome

Before full discovery begins, the system should be able to explain:

> For this offering, objective, and geography, these are the most plausible target organization types. These are the commercial reasons they may be relevant. These signals would support qualification. These conditions would make them ineligible. These assumptions remain uncertain. This is how the market will be searched and how coverage will be judged.

The user should be able to confirm, edit, or reject the proposed interpretation without writing the strategy from scratch.

A valid Campaign Strategy must contain:

1. campaign objective;
2. target geography;
3. selected profile and offering versions;
4. offering-specific commercial context;
5. target relationship types;
6. priority, conditional, exploratory, and incompatible archetypes;
7. positive, negative, and disqualifying signals;
8. campaign-specific qualification policy;
9. exclusion rules with scope and applicability;
10. market assumptions and uncertainties;
11. semantic discovery segments;
12. provider-agnostic source plan;
13. coverage and stopping criteria;
14. active campaign memory and corrections;
15. user confirmation state;
16. immutable strategy version metadata.

---

## 3. Scope

This document defines:

- campaign creation states and user flow;
- geography-first setup;
- campaign objectives;
- offering selection and AI proposal;
- target-buyer hypothesis generation;
- market interpretation;
- archetype design;
- campaign-specific qualification policy;
- exclusion scopes and applicability;
- campaign working memory;
- user, workspace, offering, campaign, candidate, and run memory boundaries;
- provisional learning;
- conflict resolution;
- controlled memory promotion;
- campaign strategy versioning;
- strategy compilation and validation;
- campaign-level clarification questions;
- data contracts and preliminary persistence requirements;
- Trigger.dev workflow for strategy generation;
- implementation and acceptance criteria.

This document does not define in full:

- provider implementations and web-query generation;
- entity resolution;
- candidate research;
- deterministic score calculation;
- comparative reranking;
- the complete Supabase migration;
- the complete product interface.

Those are covered in Documents 03–07.

---

## 4. Core Design Rules

### 4.1 Geography comes first

A campaign must define its target country, countries, or region before the target strategy is compiled.

Geography affects:

- market terminology;
- company structures;
- industry concentration;
- local versus centralized procurement;
- relevant directories and registries;
- provider coverage;
- language variants;
- market size;
- feasible candidate volume;
- legal or operational constraints;
- likely buyer archetypes.

A generic target profile created without geography is only a reusable hypothesis, not a campaign strategy.

### 4.2 The AI proposes; the user confirms

The system should derive the most likely offering and target hypothesis from Company Intelligence.

It should not force the user to define an ICP manually from an empty form.

The user must be able to:

- accept the proposal;
- choose a different offering;
- edit the campaign objective;
- modify target archetypes;
- add or remove constraints;
- reject assumptions;
- add campaign-specific exclusions;
- request broader or narrower targeting.

### 4.3 Strategy precedes discovery

Discovery may not start until a strategy version has been compiled and confirmed or explicitly auto-approved according to a future workspace policy.

For the initial implementation, explicit user confirmation is required.

### 4.4 The campaign targets relationships, not categories

“Fashion retailer,” “software company,” or “manufacturer” is not enough.

A strategy must specify the intended commercial relationship:

- direct buyer;
- end-user customer;
- reseller;
- distributor;
- channel partner;
- implementation partner;
- supplier;
- strategic partner;
- marketplace participant;
- acquisition target;
- investor target;
- other explicitly defined objective.

The same external company may be excluded from one relationship and desirable for another.

### 4.5 Business-model compatibility is more important than industry resemblance

The strategy must describe why a target organization can realistically transact with the selected offering.

It must distinguish:

- organizations that use the offering;
- organizations that resell it;
- organizations that distribute it;
- organizations that compete with it;
- organizations that merely operate in the same sector.

### 4.6 Campaign rules are scoped by default

An exclusion or correction introduced during campaign creation must not silently become a permanent workspace rule.

Default behavior:

- apply it to the current campaign;
- preserve it as a provisional memory item;
- record possible broader applicability;
- do not enforce it in other campaigns unless confirmed or promoted.

### 4.7 More specific context overrides broader context

A campaign may intentionally override an offering or workspace rule when its objective differs.

The override must be explicit, visible, and auditable. It must not delete the broader rule.

### 4.8 Unknown is not exclusion

Missing information must not be converted into a hard exclusion.

Uncertainty should produce:

- an open question;
- a research requirement;
- lower confidence;
- conditional eligibility;

not a false negative.

### 4.9 Strategy versions are immutable

Once discovery starts, all tasks must reference an immutable campaign strategy version.

Editing the campaign produces a new version and an explicit recomputation plan.

### 4.10 Campaign memory stores conclusions, not private reasoning

The system may store:

- user corrections;
- market findings;
- strategy adjustments;
- query history;
- coverage state;
- candidate evidence;
- explicit lessons;

but not hidden chain-of-thought or unrestricted model scratchpads.

---

## 5. Campaign Lifecycle

A campaign should use the following high-level state machine:

```text
draft
  ↓
collecting_inputs
  ↓
compiling_initial_hypothesis
  ↓
ready_for_market_analysis
  ↓
analysing_market
  ↓
strategy_review
  ↓
strategy_confirmed
  ↓
discovering
  ↓
evaluating
  ↓
ready_for_review
  ↓
completed
```

Optional or exceptional states:

```text
paused
strategy_revision_required
cancelled
failed
archived
```

### 5.1 Draft

The user has created the campaign but has not supplied the minimum inputs.

Minimum inputs:

- target geography;
- campaign objective;
- selected offering or explicit custom offering;
- initial target hypothesis, either AI-proposed or user-entered.

### 5.2 Compiling initial hypothesis

The system uses the latest published Company Intelligence version to propose:

- the likely offering;
- target relationship;
- buyer hypothesis;
- essential constraints;
- profile memories relevant to this campaign.

This should be fast and based primarily on existing structured intelligence.

### 5.3 Ready for market analysis

The user has confirmed the basic campaign direction and initiates strategy compilation.

The primary action may be labelled:

> Analyse market

or:

> Build campaign strategy

It should not yet imply that full candidate discovery has begun.

### 5.4 Analysing market

The system performs a bounded market-orientation step to adapt the profile hypothesis to the chosen geography.

This step is not broad lead discovery. It should gather enough evidence to understand:

- local terminology;
- market structure;
- likely organization categories;
- procurement patterns;
- obvious market limitations;
- relevant source types;
- rough candidate availability;
- regional variations.

### 5.5 Strategy review

The user reviews:

- market brief;
- target archetypes;
- exclusions;
- assumptions;
- qualification logic;
- discovery plan;
- estimated breadth or expected scarcity where available.

The user may edit before starting discovery.

### 5.6 Strategy confirmed

An immutable strategy version is published.

The campaign may now enter discovery.

### 5.7 Strategy revision

If the strategy changes after discovery has begun, the system must:

1. create a new draft strategy version;
2. show the changed rules;
3. estimate which existing results are affected;
4. ask the user whether to re-evaluate all, only affected, or future candidates;
5. preserve the original strategy version for auditability.

---

## 6. Campaign Creation Flow

The recommended user flow is intentionally AI-led but reviewable.

### Step 1 — Choose geography

The user selects:

- one country;
- several countries;
- a named region;
- optionally specific cities or subregions;
- optional exclusions inside the geography.

The system should normalize the selection into explicit geography records.

Example:

```text
Displayed region: Baltics
Countries: Latvia, Lithuania, Estonia
Excluded subregions: none
Languages likely needed: Latvian, Lithuanian, Estonian, English, Russian where relevant
```

The user should not need to define search languages manually.

### Step 2 — Confirm campaign objective

The system proposes the most likely objective based on the selected offering and prior usage.

Initial supported objectives should include:

- find direct buyers;
- find end-user customers;
- find distributors;
- find resellers;
- find channel partners;
- find implementation or referral partners;
- find suppliers;
- find strategic partners;
- custom commercial objective.

The objective controls relationship interpretation and exclusions.

### Step 3 — Confirm offering

The system proposes one or more offerings from the published profile.

For each option, show:

- offering name;
- concise commercial description;
- typical buyer relationship;
- important constraints;
- profile confidence.

The user may:

- select one offering;
- combine offerings only when commercial logic is compatible;
- create a campaign-specific offer variant;
- return to the profile to correct the base offering.

Combining offerings must not be allowed merely because they belong to the same company. The system must warn when their target logic differs.

### Step 4 — Review AI-proposed target hypothesis

The AI proposes:

- intended target relationship;
- initial buyer archetypes;
- why they may care;
- minimum viability conditions;
- likely incompatible organizations;
- likely decision or procurement roles at a high level.

The user may edit in natural language or through structured controls.

### Step 5 — Add campaign constraints

Optional constraints may include:

- company size;
- revenue or purchasing-capacity proxy;
- ownership type;
- operating footprint;
- minimum locations;
- certifications;
- required technologies;
- existing business model;
- product category;
- existing customer exclusion;
- known account exclusion;
- required local presence;
- centralized or independent procurement;
- custom rules.

Every constraint must be classified as:

- hard requirement;
- preference;
- research signal;
- exclusion;
- unknown needing verification.

### Step 6 — Build market strategy

The user starts the bounded market analysis and strategy-compilation workflow.

### Step 7 — Review strategy

The system presents the strategy in a compact but inspectable form.

### Step 8 — Confirm and start discovery

The user confirms the strategy version. Discovery begins against that exact version.

---

## 7. Campaign Objective Model

### 7.1 Why objective must be explicit

An external company does not have one universal relevance state.

For example, a distributor may be:

- excluded from a direct-buyer campaign;
- the primary target of a distribution-partner campaign;
- a competitor in a market-entry campaign;
- a useful source of market intelligence.

Therefore, qualification requires an explicit objective.

### 7.2 Objective contract

```ts
type CampaignObjective = {
  code:
    | "direct_buyer"
    | "end_user_customer"
    | "distributor"
    | "reseller"
    | "channel_partner"
    | "implementation_partner"
    | "referral_partner"
    | "supplier"
    | "strategic_partner"
    | "custom";

  label: string;
  description: string;

  targetRelationshipTypes: RelationshipType[];
  normallyExcludedRelationshipTypes: RelationshipType[];

  customDefinition?: string;
  userConfirmed: boolean;
};
```

### 7.3 Custom objectives

A custom objective must be translated into:

- desired relationship;
- desired commercial action;
- target organization capability;
- evidence requirements;
- incompatible relationships.

The raw user sentence may be retained, but downstream tasks must use the structured interpretation.

### 7.4 Objective changes

Changing the objective after strategy confirmation is a major strategy change and normally requires:

- new archetypes;
- new exclusions;
- new qualification policy;
- candidate re-evaluation;
- potentially new discovery segments.

---

## 8. Geography Model

### 8.1 Geography is structured

```ts
type CampaignGeography = {
  mode: "country" | "multi_country" | "region" | "subregion";

  displayName: string;
  countryCodes: string[];
  includedRegions?: string[];
  includedCities?: string[];
  excludedRegions?: string[];
  excludedCities?: string[];

  localLanguages: string[];
  workingLanguages: string[];

  requireLocalEntity?: boolean;
  requireLocalOperations?: boolean;
  allowCrossBorderProcurement?: boolean;

  userConfirmed: boolean;
};
```

### 8.2 Geography compatibility

The system must distinguish:

- registered in the geography;
- physically operates in the geography;
- serves the geography remotely;
- has a local subsidiary;
- has a localized storefront only;
- has procurement controlled outside the geography;
- is a regional parent serving the geography.

These distinctions affect qualification but are handled fully in candidate intelligence.

### 8.3 Region labels are not entity locations

“Baltics,” “Nordics,” or “DACH” may be used as campaign regions, but final candidate records require explicit country and entity information where available.

### 8.4 Geography assumptions

The strategy may infer likely local-market behavior, but it must label the inference and attach evidence where possible.

---

## 9. Offering Selection and Campaign Offer Variants

### 9.1 Profile offering reference

A campaign should reference an immutable offering version from the selected Company Intelligence profile version.

```ts
type CampaignOfferingReference = {
  companyProfileVersionId: string;
  offeringId: string;
  offeringVersionId: string;
};
```

### 9.2 Campaign-specific offer variant

The campaign may narrow or package the base offering without rewriting the profile.

Examples:

- only one service tier;
- only wholesale orders above a minimum amount;
- a regional pilot package;
- a distributor-specific commercial arrangement;
- a seasonal stock category;
- a particular integration.

```ts
type CampaignOfferVariant = {
  baseOfferingVersionId: string;
  name: string;
  description: string;

  includedCapabilities: string[];
  excludedCapabilities: string[];
  campaignSpecificConstraints: CommercialRule[];

  differsFromProfile: boolean;
  shouldProposeProfileUpdate: boolean;
};
```

### 9.3 Offer variants do not automatically update the profile

A campaign-specific package may be temporary. It should remain campaign-scoped unless the user confirms that it represents a reusable offering.

### 9.4 Multiple offerings

Multiple offerings may share one campaign only when:

- the intended target relationship is the same;
- buyer archetypes substantially overlap;
- qualification logic is compatible;
- decision roles are compatible;
- discovery sources are compatible;
- the combined message is commercially coherent.

Otherwise, Opptium should recommend separate campaigns.

---

## 10. Compiled Commercial Context

The strategy compiler should not send the entire profile to every model task.

It should produce a compact campaign context containing only relevant profile knowledge.

```ts
type CompiledCampaignCommercialContext = {
  workspaceId: string;
  profileVersionId: string;
  offeringVersionIds: string[];

  companyRoles: CommercialRole[];
  offeringSummary: string;
  valueDelivered: string[];
  transactionModels: string[];
  buyerUseModes: Array<
    "use" | "consume" | "resell" | "distribute" | "integrate" | "refer"
  >;

  requiredBuyerCapabilities: IntelligenceClaim[];
  reusableBuyerHypotheses: BuyerHypothesis[];
  applicableProfileRules: CommercialRule[];
  applicableOfferingRules: CommercialRule[];

  confirmedFacts: IntelligenceClaim[];
  relevantHypotheses: IntelligenceClaim[];
  unresolvedHighImpactQuestions: IntelligenceClaim[];
};
```

Compilation must filter by:

- selected offering;
- objective;
- geography;
- target relationship;
- rule applicability;
- version.

---

## 11. Market Interpretation

### 11.1 Purpose

Market interpretation adapts reusable Company Intelligence to a specific geography and objective.

It is not intended to create an academic market report. It should produce only information that affects:

- target archetypes;
- terminology;
- exclusions;
- source selection;
- expected market coverage;
- procurement assumptions;
- candidate evaluation.

### 11.2 Required output

```ts
type MarketInterpretation = {
  geography: CampaignGeography;
  summary: string;

  marketStructureFindings: MarketFinding[];
  localTerminology: LocalTerm[];
  procurementPatterns: IntelligenceClaim[];
  ownershipAndGroupPatterns: IntelligenceClaim[];
  sourceAvailability: SourceAvailabilityAssessment[];

  marketConstraints: IntelligenceClaim[];
  likelyCoverageRisks: IntelligenceClaim[];
  estimatedMarketBreadth?: "very_small" | "small" | "medium" | "large" | "unknown";

  evidenceIds: string[];
  generatedAt: string;
};
```

### 11.3 Bounded research

The market-analysis step must have explicit limits:

- maximum search calls;
- maximum pages opened;
- maximum execution time;
- maximum model calls;
- required output schema.

It should not enumerate hundreds of companies.

### 11.4 Market findings

```ts
type MarketFinding = {
  key: string;
  statement: string;
  significance:
    | "changes_targeting"
    | "changes_qualification"
    | "changes_source_plan"
    | "changes_expected_volume"
    | "context_only";
  confidence: number;
  evidenceIds: string[];
};
```

Context-only findings should be minimized.

### 11.5 Market analysis uncertainty

When the market is poorly documented, the strategy should say so and use exploratory discovery segments rather than invent certainty.

---

## 12. Target Buyer and Partner Hypotheses

### 12.1 Hypothesis structure

A target hypothesis must explain the commercial mechanism.

```ts
type CampaignTargetHypothesis = {
  id: string;
  label: string;
  relationshipType: RelationshipType;

  organizationDescription: string;
  whyRelevant: string;
  expectedCommercialAction: string;

  requiredCapabilities: IntelligenceClaim[];
  likelyNeedStates: IntelligenceClaim[];
  buyingTriggers: IntelligenceClaim[];
  procurementAssumptions: IntelligenceClaim[];

  positiveSignals: SignalDefinition[];
  negativeSignals: SignalDefinition[];
  disqualifyingSignals: SignalDefinition[];

  confidence: number;
  source: "profile" | "market_analysis" | "user" | "combined";
  userStatus: "proposed" | "confirmed" | "edited" | "rejected";
};
```

### 12.2 Minimum content

Every hypothesis must answer:

- what type of organization this is;
- why it may transact with the offering;
- whether it will use, consume, resell, distribute, integrate, or refer the offering;
- what capability or need makes the relationship possible;
- what evidence would support the hypothesis;
- what evidence would contradict it.

### 12.3 Hypothesis confidence

Confidence should reflect the strength of:

- profile evidence;
- market evidence;
- user confirmation;
- repeated prior campaign results.

A hypothesis may still be used when confidence is low, but it should normally be exploratory rather than priority.

---

## 13. Buyer Archetypes

### 13.1 Why archetypes are needed

Archetypes translate commercial hypotheses into searchable and evaluable organization patterns.

They are not merely industries or personas.

An archetype combines:

- organization role;
- business model;
- target relationship;
- use or resale behavior;
- required capability;
- likely need;
- scale or operational constraints;
- geography;
- evidence signals.

### 13.2 Archetype priority classes

Each strategy should support:

- **priority** — strongest expected commercial compatibility;
- **conditional** — plausible but requires specific evidence;
- **exploratory** — uncertain segment worth testing with limited budget;
- **incompatible** — normally not a valid target for this objective;
- **excluded relationship** — supplier, competitor, or other role explicitly outside the campaign.

### 13.3 Archetype contract

```ts
type CampaignArchetype = {
  id: string;
  strategyVersionId: string;

  label: string;
  priority: "priority" | "conditional" | "exploratory" | "incompatible";
  relationshipType: RelationshipType;

  organizationRoles: CommercialRole[];
  businessModels: string[];
  industries?: string[];
  useModes: Array<"use" | "consume" | "resell" | "distribute" | "integrate" | "refer">;

  description: string;
  commercialRationale: string;

  requiredConditions: RuleCondition[];
  preferredConditions: RuleCondition[];
  negativeConditions: RuleCondition[];
  exclusionConditions: RuleCondition[];

  positiveSignals: SignalDefinition[];
  negativeSignals: SignalDefinition[];
  requiredEvidenceQuestions: ResearchQuestion[];

  discoveryHints: DiscoveryHint[];
  targetCoverage: CoverageTarget;

  confidence: number;
  userConfirmed: boolean;
};
```

### 13.4 Conditional archetypes

A conditional archetype must state the condition explicitly.

Bad:

> Premium retailers may be relevant.

Better:

> Premium multi-brand retailers are relevant only when they independently purchase external inventory rather than operating solely through exclusive brand agreements.

### 13.5 Incompatible archetypes

Incompatible archetypes help discovery and evaluation avoid repeated false positives.

They are not always permanent exclusions. Their scope depends on objective and offering.

### 13.6 Archetype overlap

Two archetypes may overlap. The system should preserve multiple matches but avoid duplicate candidate entities.

A candidate may later be evaluated against the best-matching archetype or against several where commercially useful.

---

## 14. Signals and Evidence Requirements

### 14.1 Signal classes

```ts
type SignalDefinition = {
  key: string;
  label: string;
  description: string;

  class:
    | "positive"
    | "negative"
    | "disqualifying"
    | "trigger"
    | "capability"
    | "relationship";

  expectedEvidenceTypes: EvidenceType[];
  reliability: "high" | "medium" | "low";
  requiredForQualification: boolean;
};
```

### 14.2 Signals are not facts until observed

The strategy defines what to look for. Candidate intelligence later records whether the signal is:

- positive;
- negative;
- unknown;
- conflicting.

### 14.3 Direct and proxy signals

The strategy must distinguish direct evidence from proxies.

Examples:

- direct: the company explicitly states that it operates as a reseller;
- proxy: the company carries many third-party brands;
- direct: the company publishes a partner programme;
- proxy: the company serves a market where channel sales are common.

Proxy signals may support research prioritization but should not carry the same weight as direct evidence.

### 14.4 Required research questions

Each archetype should define a small set of campaign-specific questions, such as:

- Does the organization purchase this class of product externally?
- Does it have sufficient operational capability?
- Is procurement local or controlled by a parent company?
- Does it use the offering or compete with it?
- Is there evidence of the relevant need or trigger?

These questions guide candidate research and factor extraction.

---

## 15. Qualification Policy

Document 05 defines factor evaluation and deterministic scoring in detail. Campaign Strategy must define the policy those systems consume.

### 15.1 Standard dimensions

The strategy compiler should select and configure from a reusable factor library such as:

- business-model compatibility;
- use-case compatibility;
- target-relationship compatibility;
- purchasing or partnership capability;
- operational capability;
- procurement autonomy;
- active need or buying trigger;
- geographic compatibility;
- scale and commercial potential;
- strategic conflict;
- evidence quality;
- accessibility or contactability, only when appropriate at this stage.

### 15.2 Campaign-specific interpretation

The same factor has different meaning across campaigns.

Example:

```text
Factor: Procurement autonomy
Direct-buyer campaign: local entity must be able to purchase independently
Distributor campaign: regional parent procurement may be desirable
```

### 15.3 Policy contract

```ts
type CampaignQualificationPolicy = {
  factorDefinitions: CampaignFactorDefinition[];
  hardExclusionRules: CommercialRule[];
  eligibilityRules: CommercialRule[];

  minimumEvidenceRequirements: EvidenceRequirement[];
  unknownHandling: "lower_confidence" | "requires_research" | "conditional_review";

  qualificationThresholds: {
    recommendedFit?: number;
    minimumConfidence?: number;
    minimumEvidenceCoverage?: number;
  };

  rankingObjectives: Array<
    "commercial_fit" | "commercial_potential" | "confidence" | "strategic_priority"
  >;
};
```

### 15.4 Thresholds are not the intelligence

Thresholds should help route results, but they must not replace explicit factor evidence and relationship classification.

### 15.5 Hard exclusions precede scoring

A candidate meeting a confirmed hard exclusion must be marked ineligible before fit scoring.

---

## 16. Exclusion Model

### 16.1 Exclusions require scope

An exclusion must specify:

- what is excluded;
- why;
- for which offering;
- for which objective;
- for which geography if relevant;
- whether it is hard or soft;
- whether it is confirmed or provisional;
- who or what created it;
- whether it can be overridden.

### 16.2 Exclusion scopes

Supported scopes:

- `workspace` — broadly applicable company-level rule;
- `offering` — applies only to a specific offering;
- `campaign` — applies only to one campaign;
- `candidate` — applies to one external organization;
- `run` — temporary operational exclusion within a run;
- `provisional` — remembered as potentially broader but not enforced outside current scope.

`provisional` is a status characteristic rather than a true business scope, but it is included here because it changes behavior.

### 16.3 Rule contract

```ts
type CommercialRule = {
  id: string;

  scope: "workspace" | "offering" | "campaign" | "candidate" | "run";
  scopeId: string;

  kind:
    | "hard_exclusion"
    | "soft_exclusion"
    | "requirement"
    | "preference"
    | "exception"
    | "classification_rule";

  statement: string;
  reason: string;
  conditions: RuleCondition[];

  applicability: {
    offeringIds?: string[];
    campaignObjectiveCodes?: string[];
    geographies?: string[];
    archetypeIds?: string[];
    relationshipTypes?: RelationshipType[];
  };

  strength: "hard" | "soft";
  status:
    | "proposed"
    | "provisional"
    | "confirmed"
    | "rejected"
    | "superseded"
    | "expired";

  source: "user" | "profile" | "campaign" | "ai" | "system";
  confidence: number;

  originCampaignId?: string;
  originCandidateId?: string;
  evidenceIds: string[];

  canOverride: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 16.4 Profile exclusions

Rules explicitly confirmed in the Company Profile may be reusable across campaigns.

However, a profile exclusion still requires applicability.

Bad:

> Exclude competitors globally.

Better:

> Exclude direct competitors when the objective is direct customer acquisition; do not apply when the objective is partnership or competitor analysis.

### 16.5 Campaign exclusions

Rules added during campaign creation default to campaign scope.

The system may infer that the rule could apply more broadly, but it must not enforce broader scope automatically.

### 16.6 Candidate exclusions

Examples:

- do not contact this company;
- existing customer;
- active legal dispute;
- duplicate brand of an already-known parent;
- account reserved for another sales owner.

Candidate exclusions should be checked against every campaign, but applicability still matters. For example, “do not contact” is broader than “not relevant to this offer.”

### 16.7 Hard versus soft

**Hard exclusion:** the candidate must not enter the qualified buyer list when the rule applies.

**Soft exclusion:** the candidate may remain discoverable but should be deprioritized or routed for review.

### 16.8 Explicit exceptions

A campaign may override a broader rule through an explicit exception.

Example:

```text
Workspace rule:
Agencies are excluded from direct end-customer campaigns.

Campaign exception:
Include agencies because this campaign seeks referral partners.
```

The exception should not delete or weaken the workspace rule.

### 16.9 Exclusion presentation

The UI should show:

- rule statement;
- active scope;
- reason;
- whether it is hard or soft;
- source;
- status;
- any broader rule it overrides.

The scope control may offer:

```text
Apply to:
● This campaign
○ Campaigns for this offering
○ All relevant campaigns
```

Default: **This campaign**.

---

## 17. Scoped Memory Architecture

### 17.1 Opptium as an agentic system

Opptium may be treated as an AI agent at the product level because it:

- maintains goals;
- plans actions;
- calls tools and providers;
- observes results;
- updates structured state;
- uses prior corrections;
- decides which gaps to investigate next;
- stops according to policy.

However, it should not depend on opaque conversation memory.

Its durable intelligence is structured, scoped, versioned, and auditable.

### 17.2 Memory layers

The system should support:

1. user memory;
2. workspace/company memory;
3. offering memory;
4. campaign memory;
5. candidate memory;
6. run memory.

### 17.3 User memory

User memory concerns how an individual prefers to operate Opptium.

Examples:

- prefers stricter precision over broad recall;
- wants to review strategy before discovery;
- prefers concise evidence summaries;
- routinely approves campaign suggestions without editing;
- prefers a particular language for output.

User memory must not override shared company facts.

### 17.4 Workspace/company memory

Shared commercial knowledge:

- business-model corrections;
- company-wide commercial constraints;
- reusable relationship definitions;
- globally confirmed rules;
- terminology;
- company-level exclusions;
- confirmed competitor or partner logic.

This memory belongs to the workspace and is shared across authorized users.

### 17.5 Offering memory

Knowledge that applies only to one offering:

- suitable buyer models;
- unsuitable buyer models;
- minimum viable customer conditions;
- common triggers;
- preferred relationships;
- repeated successful targeting patterns;
- offering-specific exclusions.

### 17.6 Campaign memory

Knowledge and working state for one campaign:

- confirmed strategy;
- market findings;
- user adjustments;
- campaign-specific exclusions;
- query and source history;
- coverage state;
- classification corrections;
- evaluation lessons;
- unresolved gaps;
- strategy revisions.

### 17.7 Candidate memory

Reusable external-company knowledge:

- canonical identity;
- parent organization;
- prior campaign evaluations;
- relationship history;
- known competitor, customer, supplier, or partner status;
- do-not-contact state;
- user corrections;
- evidence and freshness.

Candidate fit must still be recalculated per campaign.

### 17.8 Run memory

Temporary operational context:

- tasks completed;
- queries attempted;
- retries;
- failed pages;
- budget consumed;
- segment yield;
- currently open gaps;
- model and prompt versions;
- stopping decisions.

Run memory may be compacted or archived after completion.

---

## 18. Campaign Memory

Campaign memory is necessary. Without it, iterations are repeated requests rather than cumulative intelligence.

### 18.1 Strategy memory

Stable context for the campaign:

- profile version;
- offering version;
- objective;
- geography;
- confirmed target archetypes;
- qualification policy;
- exclusions;
- user-approved assumptions.

The immutable strategy version is the authoritative form of strategy memory.

### 18.2 Discovery memory

The campaign must remember:

- semantic segments already attempted;
- provider queries already executed;
- providers and sources used;
- candidate counts;
- unique entity counts;
- excluded and qualified yield;
- duplicate rate;
- archetype and geography coverage;
- failed or blocked source paths;
- reasons for further discovery.

### 18.3 Reasoning-summary memory

The system may store concise operational conclusions such as:

```text
Observation:
A discovered segment produced many industry-similar companies but little evidence of the required buying model.

Adjustment:
Reduce priority of surface industry matching and require stronger procurement-model evidence for this segment.
```

This is not hidden chain-of-thought. It is an auditable strategy adjustment.

### 18.4 User-correction memory

Every user correction should preserve:

- original system decision;
- user correction;
- affected campaign object;
- immediate action;
- possible broader lesson;
- chosen scope;
- timestamp and actor.

### 18.5 Candidate-research memory

Research tasks must reuse:

- pages already inspected;
- evidence already extracted;
- unresolved questions;
- source freshness;
- previous relationship classifications.

### 18.6 Working versus durable campaign memory

**Working memory** exists to complete the current run:

- pending gaps;
- query history;
- temporary hypotheses;
- current task state.

**Durable campaign knowledge** remains after completion:

- final strategy;
- confirmed corrections;
- market findings worth retaining;
- evaluated candidates;
- proposed broader rules;
- final coverage summary.

### 18.7 Memory contract

```ts
type IntelligenceMemory = {
  id: string;
  workspaceId: string;
  userId?: string;

  scope: "user" | "workspace" | "offering" | "campaign" | "candidate" | "run";
  scopeId: string;

  kind:
    | "fact"
    | "preference"
    | "exclusion"
    | "correction"
    | "strategy_pattern"
    | "market_finding"
    | "discovery_lesson"
    | "evaluation_lesson"
    | "hypothesis";

  statement: string;

  applicability?: {
    objectiveCodes?: string[];
    offeringIds?: string[];
    geographyCodes?: string[];
    archetypeIds?: string[];
    candidateIds?: string[];
    relationshipTypes?: RelationshipType[];
    qualificationFactorKeys?: string[];
  };

  strength: "hard" | "soft";
  status:
    | "proposed"
    | "provisional"
    | "confirmed"
    | "rejected"
    | "superseded"
    | "expired"
    | "archived";

  source: "user" | "ai" | "system" | "import";
  confidence: number;

  originCampaignId?: string;
  originRunId?: string;
  originCandidateId?: string;
  evidenceIds: string[];

  createdAt: string;
  updatedAt: string;
  lastAppliedAt?: string;
  expiresAt?: string;
};
```

---

## 19. Memory Retrieval and Context Compilation

### 19.1 Do not inject all memory

Every model task should receive only relevant memory.

Retrieval filters should include:

- current workspace;
- selected offering;
- campaign objective;
- geography;
- target archetype;
- candidate where applicable;
- memory status;
- rule applicability;
- freshness.

### 19.2 Strategy-compilation context

Before compiling a campaign strategy, retrieve:

```text
Published company profile version
+ selected offering memory
+ applicable workspace rules
+ campaign objective
+ target geography
+ relevant prior campaign corrections
+ user workflow preferences
```

### 19.3 Discovery-task context

A discovery task should receive:

```text
Strategy version
+ one semantic discovery segment
+ prior attempts for that segment
+ known candidates and entities
+ current coverage gap
+ relevant campaign corrections
+ provider capabilities
```

### 19.4 Candidate-evaluation context

An evaluation task should receive:

```text
Strategy qualification policy
+ matched archetype
+ candidate facts and evidence
+ relevant candidate memory
+ campaign corrections
+ applicable exclusions and exceptions
```

### 19.5 Context compiler output

```ts
type CompiledTaskContext = {
  taskType: string;
  strategyVersionId: string;

  facts: IntelligenceClaim[];
  applicableRules: CommercialRule[];
  relevantMemories: IntelligenceMemory[];
  unresolvedQuestions: ResearchQuestion[];

  excludedMemories: Array<{
    memoryId: string;
    reason:
      | "wrong_scope"
      | "wrong_objective"
      | "wrong_offering"
      | "superseded"
      | "expired";
  }>;
};
```

Recording excluded memories is useful for debugging scope errors.

---

## 20. Provisional Learning

### 20.1 Why provisional learning is needed

A campaign may reveal a potentially reusable rule that was not known during profile creation.

The system should remember it without immediately enforcing it everywhere.

### 20.2 Default behavior

When a rule or correction is introduced during a campaign:

1. apply it to the current campaign;
2. save the immediate correction;
3. create a provisional broader-memory proposal if justified;
4. record possible offering or workspace applicability;
5. do not activate broader scope automatically;
6. surface the proposal at a useful moment.

### 20.3 Promotion candidates

A campaign lesson may be considered for promotion when:

- the user explicitly requests broader scope;
- the same correction appears repeatedly;
- multiple campaigns for the same offering confirm the pattern;
- strong evidence demonstrates that it is intrinsic to the offering;
- the rule is not dependent on one geography or objective.

### 20.4 Promotion levels

Possible promotion path:

```text
campaign
  ↓
offering
  ↓
workspace
```

Promotion may skip levels only through explicit user confirmation.

### 20.5 Promotion proposal

```ts
type MemoryPromotionProposal = {
  id: string;
  sourceMemoryIds: string[];

  currentScope: "campaign" | "offering";
  proposedScope: "offering" | "workspace";
  proposedScopeId: string;

  proposedStatement: string;
  proposedApplicability: IntelligenceMemory["applicability"];
  rationale: string;

  supportingCampaignIds: string[];
  supportingEvidenceIds: string[];
  recurrenceCount: number;

  confidence: number;
  status: "pending" | "accepted" | "rejected" | "deferred";
};
```

### 20.6 No silent promotion

Initial versions must require user confirmation for promotion to offering or workspace scope.

### 20.7 Rejected promotions

A rejected promotion should remain recorded so the system does not repeatedly ask the same question without new evidence.

---

## 21. Conflict Resolution

### 21.1 Conflict types

Conflicts may occur between:

- user instruction and AI inference;
- profile rule and campaign exception;
- older and newer rules;
- two users in the same workspace;
- two campaign memories;
- candidate memory and current public evidence;
- market-specific findings and global assumptions.

### 21.2 Precedence rules

Default precedence:

1. explicit current user instruction;
2. explicit confirmed workspace or offering rule, where applicable;
3. confirmed campaign rule;
4. confirmed candidate-specific rule;
5. evidence-backed current fact;
6. provisional rule;
7. AI hypothesis.

Specific context overrides broader context when both are valid.

Newer does not automatically beat older if the newer item has weaker authority or evidence.

### 21.3 Campaign exception behavior

A campaign exception overrides a broader rule only inside that campaign and only under its stated applicability.

### 21.4 Conflicting evidence

When evidence conflicts, the system should:

- preserve both claims;
- mark the relevant factor as conflicting;
- lower confidence;
- request verification if the issue is material;
- avoid converting the conflict into a hard exclusion without stronger evidence.

### 21.5 Multi-user conflicts

For the first version, the most recent explicit user edit may become active, but the previous value and author must remain in the audit trail.

Future workspace permissions may distinguish who can publish profile or strategy rules.

### 21.6 Conflict object

```ts
type IntelligenceConflict = {
  id: string;
  workspaceId: string;

  leftObjectType: string;
  leftObjectId: string;
  rightObjectType: string;
  rightObjectId: string;

  conflictType:
    | "scope"
    | "value"
    | "applicability"
    | "freshness"
    | "authority"
    | "evidence";

  summary: string;
  resolution: "left_wins" | "right_wins" | "merged" | "unresolved" | "user_required";
  resolutionReason?: string;

  resolvedByUserId?: string;
  resolvedAt?: string;
};
```

---

## 22. Campaign Clarification Questions

### 22.1 Purpose

Campaign questions should resolve uncertainty specific to:

- objective;
- geography;
- offer variant;
- target relationship;
- constraints;
- exclusions;
- expected breadth;
- procurement assumptions.

They must not repeat profile questions unless the campaign creates new context.

### 22.2 Question eligibility

Ask only when the answer may materially change:

- archetype selection;
- hard exclusions;
- source plan;
- qualification factors;
- expected market size;
- contact-role selection;
- campaign viability.

### 22.3 Examples of useful campaign questions

- Are you seeking direct end customers or regional distribution partners in this market?
- Must the target have a local legal entity, or is cross-border purchasing acceptable?
- Is the campaign restricted to buyers above a minimum order or contract capacity?
- Should existing distributors be treated as potential partners or excluded as channel conflicts?
- Is local procurement authority required, or can the parent organization purchase centrally?

### 22.4 Examples of weak questions

- Who is your ideal customer?
- What industries do you target?
- Who makes the decision?
- Is the product standalone?

These are too generic unless converted into a specific unresolved commercial question.

### 22.5 Question limits

The strategy compiler should usually ask zero to three high-impact questions.

It may ask more only when the campaign cannot be compiled responsibly without them.

### 22.6 Skip behavior

Questions may be skipped. Skipped questions become explicit assumptions or unknowns in the strategy review.

---

## 23. Discovery Plan Contract

Document 03 defines execution. Document 02 defines the provider-independent semantic plan.

### 23.1 Discovery plan contains segments, not queries

Bad:

```ts
type DiscoveryPlan = {
  queries: string[];
};
```

Required:

```ts
type DiscoveryPlan = {
  segments: DiscoverySegmentRequest[];
  sourcePlan: CampaignSourcePlan;
  coveragePolicy: CoveragePolicy;
  stoppingPolicy: StoppingPolicy;
};
```

### 23.2 Semantic discovery segment

```ts
type DiscoverySegmentRequest = {
  id: string;
  strategyVersionId: string;
  archetypeId: string;

  label: string;
  rationale: string;

  geography: CampaignGeography;

  businessCharacteristics: {
    organizationRoles: CommercialRole[];
    businessModels: string[];
    industries?: string[];
    keywords?: string[];
    sizeRange?: {
      minEmployees?: number;
      maxEmployees?: number;
    };
  };

  relationshipType: RelationshipType;
  useModes: string[];

  positiveSignals: SignalDefinition[];
  negativeSignals: SignalDefinition[];
  exclusionRules: CommercialRule[];

  targetCandidateCount?: number;
  priority: number;
  explorationBudgetClass: "low" | "medium" | "high";
};
```

### 23.3 Provider independence

The semantic segment must not contain Tavily-, PDL-, Apollo-, or Coresignal-specific fields.

Providers translate the segment into their own query or filter syntax.

### 23.4 Source plan

```ts
type CampaignSourcePlan = {
  primaryProviderTypes: string[];
  supportingProviderTypes: string[];
  verificationProviderTypes: string[];

  providerRationale: Array<{
    providerType: string;
    segmentIds: string[];
    reason: string;
  }>;

  currentEnabledProviders: string[];
  missingProviderCapabilities: string[];
};
```

Initial state may be:

```json
{
  "primaryProviderTypes": ["web_search"],
  "supportingProviderTypes": [],
  "verificationProviderTypes": ["company_website"],
  "currentEnabledProviders": ["web_search", "company_website"],
  "missingProviderCapabilities": ["structured_company_database"]
}
```

The strategy remains valid when a database provider is added later.

---

## 24. Coverage and Stopping Policy

### 24.1 Coverage is multidimensional

Coverage should be tracked by:

- archetype;
- geography;
- provider type;
- source type;
- candidate uniqueness;
- plausible candidate yield;
- qualified candidate yield;
- evidence coverage;
- market-breadth expectation.

### 24.2 Coverage target

```ts
type CoverageTarget = {
  minimumUniqueCandidates?: number;
  minimumPlausibleCandidates?: number;
  minimumQualifiedCandidates?: number;
  targetGeographyCoverage?: number;
  targetArchetypeCoverage?: number;
  maximumDuplicateRate?: number;
};
```

### 24.3 Stopping policy

```ts
type StoppingPolicy = {
  stopWhenAny?: Array<
    | "target_qualified_volume_reached"
    | "market_exhaustion_detected"
    | "marginal_yield_below_threshold"
    | "budget_limit_reached"
    | "time_limit_reached"
  >;

  maximumDiscoveryPasses?: number;
  maximumProviderCost?: number;
  maximumRunMinutes?: number;
  minimumMarginalQualifiedYield?: number;
};
```

### 24.4 No fixed five-iteration logic

A maximum pass limit may remain as a safety guard, but it must not be the planning model.

Every new pass requires a recorded reason such as:

- one geography is undercovered;
- one priority archetype has insufficient results;
- a source produced poor-quality candidates;
- a new local term was discovered;
- the current candidate pool lacks evidence diversity.

### 24.5 Small markets

When the market is genuinely small, the system must not fabricate a large candidate count.

It should report:

- likely market exhaustion;
- best available candidates;
- coverage confidence;
- adjacent archetypes that could be explored with user approval.

---

## 25. Strategy Versioning

### 25.1 Version contract

```ts
type CampaignStrategyVersion = {
  id: string;
  campaignId: string;
  versionNumber: number;

  status: "draft" | "review" | "confirmed" | "superseded" | "cancelled";

  companyProfileVersionId: string;
  offeringReferences: CampaignOfferingReference[];
  offerVariant?: CampaignOfferVariant;

  objective: CampaignObjective;
  geography: CampaignGeography;

  commercialContext: CompiledCampaignCommercialContext;
  marketInterpretation: MarketInterpretation;
  targetHypotheses: CampaignTargetHypothesis[];
  archetypes: CampaignArchetype[];
  qualificationPolicy: CampaignQualificationPolicy;
  exclusions: CommercialRule[];
  discoveryPlan: DiscoveryPlan;

  assumptions: IntelligenceClaim[];
  unresolvedQuestions: ResearchQuestion[];

  memorySnapshotId: string;

  generatedByModelConfigId: string;
  promptVersion: string;

  createdByUserId?: string;
  confirmedByUserId?: string;
  createdAt: string;
  confirmedAt?: string;
};
```

### 25.2 Immutable confirmation

Once confirmed, the strategy payload must not be edited in place.

### 25.3 Snapshot memory

The version stores a reference to the memory snapshot used during compilation. This allows later debugging when broader memories change.

### 25.4 Strategy diff

The system should support a structured diff showing changes in:

- objective;
- geography;
- offerings;
- archetypes;
- exclusions;
- factor definitions;
- discovery segments;
- assumptions;
- source plan;
- coverage targets.

### 25.5 Existing candidates after strategy change

The user should choose:

- re-evaluate all candidates;
- re-evaluate only affected candidates;
- apply changes only to future candidates;
- create a new campaign instead.

The system may recommend the safest option based on the diff.

---

## 26. Strategy Compilation Workflow

Recommended task sequence:

```text
campaign.initialize
    ↓
campaign.compileProfileContext
    ↓
campaign.retrieveScopedMemory
    ↓
campaign.generateInitialHypothesis
    ↓
[user confirms geography, objective, offering, target direction]
    ↓
campaign.researchMarket
    ↓
campaign.generateArchetypes
    ↓
campaign.generateQualificationPolicy
    ↓
campaign.generateDiscoveryPlan
    ↓
campaign.detectStrategyConflicts
    ↓
campaign.generateClarificationQuestions
    ↓
campaign.assembleStrategyDraft
    ↓
[user reviews and edits]
    ↓
campaign.reconcileUserEdits
    ↓
campaign.validateStrategy
    ↓
campaign.publishStrategyVersion
```

### 26.1 Parallelizable tasks

After market interpretation, these may run partly in parallel:

- archetype generation;
- qualification-factor proposal;
- source capability assessment;
- exclusion applicability check.

A final synthesis task must reconcile them.

### 26.2 Human review gate

For initial V2, publishing the first strategy version requires explicit user confirmation.

### 26.3 Reconciliation after edits

User edits must update dependent objects.

Examples:

- removing an archetype should remove or archive its discovery segments;
- changing the objective should recompute exclusions;
- changing geography should recompute source plan and market interpretation;
- changing an offer constraint should update qualification factors;
- promoting an exclusion scope should create a memory proposal or broader rule.

---

## 27. Model Task Separation

### 27.1 Initial hypothesis model

Inputs:

- compiled profile context;
- objective candidates;
- geography;
- applicable memories.

Outputs:

- proposed offering;
- target relationship;
- target hypothesis;
- high-impact open questions.

### 27.2 Market interpretation model

Inputs:

- confirmed campaign basics;
- bounded research evidence.

Outputs:

- market structure;
- terminology;
- procurement patterns;
- source availability;
- constraints and coverage risks.

### 27.3 Archetype model

Outputs structured archetypes with commercial mechanisms and signals.

### 27.4 Qualification-policy model

Selects factor definitions, evidence requirements, exclusions, and unknown handling.

It does not assign candidate scores.

### 27.5 Discovery-planning model

Produces semantic discovery segments and provider-capability needs.

It does not generate final provider queries. That happens inside providers.

### 27.6 Consistency model

Checks for:

- archetypes conflicting with objective;
- exclusions contradicting target relationships;
- missing commercial rationale;
- unsupported hard exclusions;
- profile rules applied outside their scope;
- discovery segments not represented in qualification logic;
- qualification factors that cannot be researched realistically.

### 27.7 Reconciliation model

After user edits, updates dependent strategy objects without overwriting explicit user decisions.

---

## 28. Prompt Requirements

Every strategy-generation prompt must:

1. use structured profile claims rather than only raw website text;
2. identify the selected offering and objective explicitly;
3. include geography and market evidence;
4. distinguish facts, inferences, hypotheses, and unknowns;
5. explain the commercial mechanism for each target archetype;
6. separate industry similarity from buyer compatibility;
7. classify likely buyer, partner, supplier, distributor, reseller, and competitor relationships;
8. produce hard exclusions only when justified;
9. label campaign-scoped rules as campaign-scoped;
10. preserve relevant broader rules and explicit campaign exceptions;
11. return typed JSON;
12. attach evidence IDs to material market claims;
13. return `unknown` when evidence is insufficient;
14. avoid fixed generic ICP templates;
15. avoid provider-specific query syntax;
16. list unresolved high-impact questions;
17. avoid generating hidden holistic scores;
18. avoid treating one campaign correction as a permanent global rule.

---

## 29. Preliminary Database Model

The complete schema is defined in Document 06. Document 02 requires at least the following logical entities:

```text
campaigns
campaign_inputs
campaign_strategy_versions
campaign_strategy_drafts
campaign_objectives
campaign_geographies
campaign_offer_variants
campaign_market_findings
campaign_target_hypotheses
campaign_archetypes
campaign_qualification_policies
campaign_factor_definitions
campaign_rules
campaign_assumptions
campaign_clarification_questions
campaign_user_edits
campaign_memory_snapshots
intelligence_memories
memory_promotion_proposals
intelligence_conflicts
campaign_strategy_diffs
```

### 29.1 Suggested key constraints

- one campaign may have many strategy versions;
- only one confirmed strategy version may be active at a time;
- confirmed strategy payloads are immutable;
- every discovery run references one strategy version;
- every campaign rule references its scope and origin;
- every memory item references a valid workspace and scope object;
- superseded rules remain queryable for auditability;
- memory promotions never mutate source memories.

### 29.2 JSONB versus normalized records

Use normalized rows for:

- versions;
- archetypes;
- rules;
- memories;
- evidence references;
- user edits;
- conflicts;
- promotions.

Use JSONB for:

- immutable compiled strategy snapshots;
- model raw outputs;
- provider capability snapshots;
- structured diffs;
- temporary task payloads.

The canonical strategy should be reconstructable from normalized objects while retaining a signed or hashed immutable snapshot for auditability.

---

## 30. Auditability

For every confirmed campaign strategy, Opptium must preserve:

- profile version used;
- offering version used;
- objective selected;
- geography selected;
- memory snapshot used;
- market evidence used;
- model configuration and prompt version;
- AI-generated draft;
- user edits;
- final confirmed rules;
- confirmation actor and timestamp;
- later strategy changes;
- reasons for re-evaluation decisions.

For every applied memory or rule, it must be possible to answer:

- where did this come from;
- what scope did it have;
- why did it apply here;
- whether it was confirmed;
- whether a more specific exception overrode it.

---

## 31. Performance and Cost Guidance

### 31.1 Reuse profile intelligence

Campaign creation should rely heavily on already-published structured profile data rather than repeatedly re-scraping the workspace company website.

### 31.2 Bound market analysis

Market analysis should be much smaller than candidate discovery.

It should stop when sufficient information exists to compile a strategy.

### 31.3 Cache stable market evidence

Market findings may be reused when:

- geography matches;
- offering and objective are similar;
- evidence is fresh;
- the prior finding is not campaign-specific.

Reused findings must retain original provenance and freshness.

### 31.4 Avoid model-call fragmentation

Do not invoke a separate strong model for every small strategy field.

Use typed tasks with coherent responsibilities and deterministic validation.

### 31.5 Strong model allocation

Use the strongest reasoning model for:

- commercial target synthesis;
- archetype design;
- qualification-policy consistency;
- conflict resolution.

Use faster models for:

- memory filtering;
- simple classification;
- formatting;
- deterministic field mapping.

---

## 32. Error and Uncertainty Handling

### 32.1 Missing published profile

Campaign creation should be blocked or routed through a minimal profile-completion flow.

### 32.2 Weak offering intelligence

The strategy may proceed only if the user confirms a usable campaign offer and target relationship. The weakness should be recorded and may create a profile-update proposal.

### 32.3 Market evidence unavailable

The strategy should:

- mark market interpretation as low confidence;
- create exploratory segments;
- avoid unsupported hard exclusions;
- disclose expected coverage limitations.

### 32.4 Contradictory user instructions

The system should surface the conflict and request resolution when both cannot be applied.

### 32.5 Provider unavailable

The strategy should remain valid. The source plan marks unavailable capabilities and routes discovery through enabled providers where possible.

### 32.6 Strategy compilation failure

Partial outputs should be retained. Retry only failed tasks using idempotent keys.

### 32.7 Excessively broad campaign

The system should warn when:

- multiple incompatible offerings are combined;
- geography is too broad for available budget;
- target archetypes span unrelated commercial mechanisms;
- qualification evidence cannot be collected reliably.

### 32.8 Excessively narrow campaign

The system should not silently broaden it. It should report likely scarcity and offer adjacent archetypes for user approval.

---

## 33. Abstract Examples Across Business Models

These examples illustrate the general logic. They are not hard-coded templates.

### 33.1 B2B SaaS — direct buyers

**Offering:** workflow automation software for logistics operators.  
**Objective:** direct end-user customers.  
**Geography:** DACH.

Priority archetype:

- regional logistics companies with operational complexity and internal process ownership.

Conditional archetype:

- freight brokers, only when they operate enough internal workflow volume.

Excluded relationship:

- software implementation agencies selling competing workflow platforms.

Campaign-specific question:

- Is local German-language support required, or can the product be sold cross-border in English?

### 33.2 B2B SaaS — partners

Same offering, different objective:

- target implementation consultancies and logistics technology integrators;
- agencies previously excluded from direct-buyer campaigns become priority partner candidates;
- end-user purchasing capability becomes less important;
- customer portfolio and integration capability become central factors.

### 33.3 Industrial manufacturer

**Offering:** specialized packaging machinery.  
**Objective:** direct buyers.  
**Geography:** Italy.

Priority archetype:

- manufacturers with production lines compatible with the machine.

Conditional archetype:

- contract packers, only where production volume supports the investment.

Hard exclusion:

- machinery distributors, unless the objective changes to channel expansion.

### 33.4 Professional-services agency

**Offering:** e-commerce platform redevelopment.  
**Objective:** direct buyers.  
**Geography:** Nordics.

Priority archetype:

- established retailers with outdated commerce infrastructure and internal ownership of digital sales.

Conditional archetype:

- early-stage brands, only when funding and growth signals indicate sufficient budget.

Campaign memory example:

- after repeated rejection, micro-businesses may become an offering-level exclusion proposal rather than an immediate workspace rule.

### 33.5 Wholesaler

**Offering:** third-party goods for resale.  
**Objective:** direct buyers.  
**Geography:** selected European region.

Priority archetype:

- businesses whose model includes buying external inventory and reselling it.

Conditional archetype:

- multi-brand retailers where procurement autonomy is unknown.

Excluded relationship:

- competing wholesalers and brand-owned stores, unless the campaign objective explicitly seeks partnerships.

### 33.6 Marketplace

**Offering:** seller participation in a vertical marketplace.  
**Objective:** recruit supply-side participants.

Priority archetype:

- providers with suitable inventory and operational capacity.

Buyer terminology is inappropriate here; the relationship is marketplace participant.

### 33.7 Logistics provider

**Offering:** cross-border fulfilment.  
**Objective:** direct buyers.  
**Geography:** Baltic companies shipping to Western Europe.

Priority archetype:

- e-commerce companies with cross-border volume and insufficient internal fulfilment capacity.

Conditional archetype:

- manufacturers, only when they sell direct to consumers or require distributed fulfilment.

---

## 34. Validation Rules

### 34.1 Schema validation

A strategy cannot be confirmed unless:

- profile and offering versions exist;
- objective is valid;
- geography contains explicit countries;
- at least one target hypothesis exists;
- at least one active archetype exists;
- every archetype has commercial rationale;
- qualification policy exists;
- hard exclusions contain reasons and applicability;
- discovery plan contains semantic segments;
- memory snapshot exists;
- unresolved high-impact assumptions are visible.

### 34.2 Commercial consistency validation

Check that:

- target relationships match the campaign objective;
- priority archetypes can realistically transact with the offering;
- use modes align with the offering;
- exclusions do not remove every priority archetype;
- required capabilities are researchable;
- market findings support major regional adaptations;
- provider plan can execute at least part of the discovery plan;
- hard exclusions are not based only on unknowns;
- campaign exceptions are explicit.

### 34.3 Scope validation

Check that:

- campaign rules do not mutate profile rules;
- provisional memories are not enforced outside scope;
- candidate rules are applied only to matching entities;
- broader rules satisfy applicability conditions;
- superseded or rejected memories are not included;
- explicit exceptions are preserved.

### 34.4 Version validation

Check that:

- discovery references only confirmed versions;
- confirmed versions are immutable;
- a strategy revision increments version number;
- memory snapshot and model versions are recorded;
- strategy diffs are generated for revisions.

---

## 35. Product Interface Requirements for Strategy Review

Detailed UI is in Document 07, but the strategy layer requires these behaviors.

### 35.1 Basic setup screen

Show:

- geography first;
- proposed objective;
- proposed offering;
- proposed target hypothesis;
- optional constraints;
- primary action to build market strategy.

### 35.2 Market and strategy review

Show:

- concise market brief;
- priority archetypes;
- conditional archetypes;
- exploratory archetypes;
- exclusions;
- qualification logic;
- assumptions and open questions;
- planned source types;
- expected market breadth or uncertainty.

### 35.3 Editing

Users should be able to:

- edit in structured controls;
- provide a natural-language correction;
- remove archetypes;
- change priority;
- change hard rule to preference;
- change exclusion scope;
- add an exception;
- confirm an assumption;
- leave an item unresolved.

### 35.4 Scope visibility

Each rule should visibly indicate:

- campaign only;
- offering level;
- workspace level;
- candidate-specific;
- provisional.

### 35.5 Confirmation

The final action should clearly indicate:

> Confirm strategy and start discovery

The interface should not hide that discovery uses the confirmed snapshot.

---

## 36. Implementation Sequence for Document 02

### Phase 1 — Contracts and persistence

Implement:

- campaign objective schema;
- geography schema;
- campaign offering references;
- strategy version schema;
- rule and memory contracts;
- strategy draft persistence;
- immutable confirmed versions.

### Phase 2 — Basic campaign setup

Implement:

- geography-first UI;
- objective confirmation;
- offering proposal and selection;
- initial target-hypothesis proposal;
- campaign constraints.

### Phase 3 — Strategy compiler

Implement:

- compiled profile context;
- scoped memory retrieval;
- market interpretation;
- archetype generation;
- qualification-policy generation;
- semantic discovery-plan generation;
- consistency validation.

### Phase 4 — Strategy review UI

Implement:

- market brief;
- archetype editing;
- rule and exclusion editing;
- assumption review;
- source-plan preview;
- confirmation gate.

### Phase 5 — Campaign memory

Implement:

- user corrections;
- market findings;
- strategy adjustments;
- memory context compiler;
- working versus durable memory;
- audit trail.

### Phase 6 — Provisional learning

Implement:

- promotion proposals;
- offering/workspace scope confirmation;
- rejection/defer behavior;
- repeated-correction detection.

### Phase 7 — Strategy revision

Implement:

- version diff;
- affected-candidate analysis;
- re-evaluation options;
- superseded strategy handling.

---

## 37. Acceptance Criteria

### Functional

- Campaign setup begins with geography.
- The system proposes an offering and target hypothesis from Company Intelligence.
- The user can change objective, offering, and target direction.
- A bounded market analysis adapts the strategy to geography.
- The system produces structured archetypes, exclusions, qualification policy, and semantic discovery segments.
- The user confirms a strategy before discovery starts.
- Discovery references an immutable strategy version.
- Campaign corrections are remembered inside the campaign.
- Campaign exclusions do not silently become global exclusions.
- Broader memory promotion requires explicit confirmation.

### Intelligence quality

- Every priority archetype contains an explicit commercial mechanism.
- The strategy distinguishes use, resale, distribution, partnership, and competition.
- Industry similarity alone cannot justify priority status.
- Hard exclusions include scope, applicability, reason, and evidence or user authority.
- Unknown information is represented as uncertainty rather than negative evidence.
- Market-specific adaptations are supported by evidence or labelled hypotheses.
- A change in campaign objective produces materially different relationship logic.

### Technical

- Strategy outputs are schema-validated.
- Confirmed versions are immutable.
- Every run references a strategy version and memory snapshot.
- Provider-specific fields do not appear in semantic discovery segments.
- Rule precedence and scope resolution are deterministic.
- User edits are auditable.
- Failed tasks can be retried idempotently.

### UX

- The user does not need to write an ICP from scratch.
- Strategy review is understandable without exposing internal agent mechanics.
- Rule scope is visible but not presented as a flagship feature.
- The user can apply an exclusion to only the campaign by default.
- Important assumptions are visible before discovery.
- The campaign does not ask repeated generic profile questions.

---

## 38. Output of Campaign Strategy

The final confirmed strategy must be sufficient for downstream systems to answer:

- Which relationship are we looking for?
- Which offering and version are being promoted?
- In which geography?
- Which organization archetypes are priority, conditional, exploratory, or incompatible?
- Why could each target type transact with this offering?
- What must be true before qualification?
- Which signals should research seek?
- Which rules are hard exclusions?
- Which exclusions are campaign-only, offering-level, workspace-level, or candidate-specific?
- Which profile rules are overridden by campaign exceptions?
- What remains unknown?
- Which discovery segments should providers execute?
- Which source capabilities are preferred?
- What coverage target and stopping policy apply?
- Which memory snapshot and user corrections were used?

If those questions cannot be answered from the confirmed strategy object, the strategy is incomplete and discovery must not start.

---

## 39. Locked Decisions from This Document

1. Campaign setup is geography-first.
2. The AI proposes offering and target logic from Company Intelligence.
3. The user confirms the objective, offering, and initial target direction.
4. A bounded market-analysis step adapts the strategy to the target geography.
5. Full discovery starts only after strategy review and confirmation.
6. Campaigns target commercial relationships, not only industries or company categories.
7. Buyer archetypes must describe the commercial mechanism and required evidence.
8. Qualification policy is campaign-specific and versioned.
9. Discovery plans contain semantic segments, not provider-specific queries.
10. Campaign exclusions default to campaign scope.
11. Campaign corrections may create provisional broader-memory proposals but are not promoted silently.
12. Profile and offering rules remain reusable only under their recorded applicability.
13. A more specific campaign exception may override a broader rule without deleting it.
14. Campaign memory is required and includes strategy, discovery, corrections, coverage, and concise operational lessons.
15. Memory retrieval is selective and task-specific.
16. The system stores conclusions and evidence, not private chain-of-thought.
17. Confirmed strategy versions are immutable.
18. Strategy changes after discovery require a new version and an explicit re-evaluation decision.
19. Fixed discovery iteration counts are safety limits, not the discovery logic.
20. Web search may be the only enabled provider initially without changing the strategy contract.

---

## 40. Next Document

`03-discovery-architecture-and-provider-abstraction.md` will define:

- provider-independent discovery execution;
- the `CompanyDiscoveryProvider` interface;
- the initial `WebSearchProvider`;
- later PDL, Apollo, Coresignal, registry, maps, and directory adapters;
- provider capabilities;
- source records and provenance;
- semantic-segment translation;
- parallel discovery;
- coverage state;
- gap-driven passes;
- yield, cost, and stopping decisions;
- how a database provider can be added later without another intelligence refactor.
