# Opptium Intelligence V2

## Company Intelligence and Profile Creation

**Document:** 01  
**Status:** Implementation specification  
**Depends on:** `00-documentation-map-and-core-principles.md`  
**Purpose:** Define how Opptium creates, validates, stores, presents, and evolves a structured commercial understanding of the workspace company before any campaign begins.

---

## 1. Purpose of Company Intelligence

Company Intelligence is the commercial foundation of Opptium.

Its purpose is to answer, in a structured and auditable way:

- what the workspace company is;
- how it makes money;
- what it offers;
- how each offering is purchased, used, consumed, implemented, resold, or distributed;
- what must be true about a company for it to be a plausible customer or partner;
- which company types are superficially similar but commercially incompatible;
- what evidence supports each conclusion;
- what remains uncertain and requires user confirmation.

The Company Profile must no longer be treated as a generated company summary or marketing description. It is a versioned commercial knowledge model used by campaign strategy, discovery, qualification, contact-role selection, and outbound preparation.

The profile must be detailed enough to support different campaign objectives without assuming that every campaign seeks direct buyers.

---

## 2. Desired Outcome

After profile creation, Opptium should be able to produce a statement such as:

> This company operates as a manufacturer and direct supplier. It offers three materially different solutions. The first is purchased by end-user organizations through project contracts, the second is normally sold through distributors, and the third is a recurring support service sold mainly to existing customers. Each offering requires a different buyer profile and must not share one generic ICP.

The user should be able to inspect and correct this interpretation before it becomes the foundation for campaigns.

A completed profile should contain:

1. normalized company identity;
2. business-model analysis;
3. value-chain position and commercial roles;
4. structured offerings;
5. commercial mechanics per offering;
6. buyer, user, beneficiary, and decision-role hypotheses;
7. buyer-archetype hypotheses;
8. relationship hypotheses;
9. positive signals, negative signals, and incompatibilities;
10. company-level and offering-level rules;
11. claims, evidence, confidence, and provenance;
12. unresolved high-impact questions;
13. a user-confirmed published version.

---

## 3. Scope

This document covers:

- profile onboarding from a website and optional materials;
- website and document ingestion;
- factual extraction;
- business-model synthesis;
- offering decomposition;
- commercial-mechanics modelling;
- buyer and relationship hypotheses;
- clarification-question generation;
- profile confirmation and editing;
- claims, evidence, confidence, and provenance;
- profile versions;
- global and offering-scoped exclusions;
- profile-level memory;
- validation and acceptance criteria;
- Trigger.dev tasks related to profile creation;
- required database entities and TypeScript contracts.

This document does not define:

- market-specific campaign strategy;
- campaign-scoped exclusions;
- discovery provider implementation;
- candidate entity resolution;
- candidate scoring;
- comparative ranking;
- complete product UI outside profile creation.

Those are defined in later documents.

---

## 4. Core Design Rules

### 4.1 The profile describes commercial reality, not promotional language

Marketing copy may be used as evidence, but Opptium must translate it into commercial structure.

For example:

- “We help businesses transform” is not a useful offering definition.
- “Fixed-scope ERP implementation for mid-sized manufacturers” is useful.
- “Premium fashion collections” is not enough.
- “Wholesale supply of new branded excess inventory for resale” is useful.

### 4.2 A company may have several business roles

Do not force a company into one category.

A workspace company may simultaneously be:

- manufacturer;
- wholesaler;
- retailer;
- software provider;
- implementation partner;
- marketplace;
- consultant;
- distributor;
- managed-service provider.

The profile must store a primary role, optional secondary roles, and confidence for each.

### 4.3 Each materially different offering has separate buyer logic

Offerings must be separated when they differ materially in one or more of the following:

- buyer type;
- user type;
- transaction model;
- contract or order size;
- buying trigger;
- procurement process;
- decision-maker;
- delivery model;
- geographic availability;
- partner requirement;
- use versus resale behavior;
- qualification rules.

### 4.4 Facts, inferences, and hypotheses are not interchangeable

The system must visibly distinguish:

- directly evidenced facts;
- evidence-backed inferences;
- AI hypotheses;
- unknowns;
- user-confirmed claims;
- user-rejected claims.

### 4.5 Questions are generated only for high-impact uncertainty

The system must not run a fixed generic questionnaire.

A clarification question is justified only when its answer may materially change:

- offering separation;
- campaign objective options;
- target archetypes;
- exclusions;
- qualification factors;
- minimum viable buyer conditions;
- decision-role selection;
- source planning.

Clarification questions are advisory. The user may answer any useful subset, and
unanswered questions must never block profile review or publication.

The pre-review consistency audit is also advisory after the user reviews or edits the
draft. Publication enforces current structural requirements, such as a compiled
business model and at least one active offering, rather than a stale model verdict.

### 4.6 Profile rules are broader than campaign rules

Rules created and explicitly confirmed inside the Company Profile are reusable beyond one campaign.

However, applicability must still be stored. A rule such as “competitors are excluded” is incomplete unless it specifies the objectives or relationships for which it applies.

### 4.7 Company Intelligence is versioned

Campaigns must reference a published profile version. Editing the profile later must not silently change the interpretation used by an already-running campaign.

### 4.8 The system must remain business-model neutral

Schemas and prompts must support:

- SaaS;
- professional services;
- manufacturers;
- wholesalers;
- distributors;
- retailers;
- marketplaces;
- agencies;
- logistics providers;
- subscription services;
- project businesses;
- channel-led businesses;
- mixed models.

---

## 5. Profile Lifecycle

A Company Intelligence profile moves through the following states:

```text
not_started
    ↓
ingesting
    ↓
extracting_facts
    ↓
building_commercial_model
    ↓
needs_review
    ↓
published
    ↓
revision_in_progress
    ↓
published_new_version
```

Additional terminal or exceptional states:

```text
failed
cancelled
archived
```

### 5.1 Draft profile

A draft may contain incomplete claims, unconfirmed assumptions, and open questions. Campaign creation may be blocked until a minimum viable published version exists.

### 5.2 Published profile

A published profile is user-confirmed enough to support campaign strategy creation.

Published does not mean every field is known. It means:

- critical commercial structure is present;
- unresolved items are explicitly labelled;
- the user has accepted the profile as a usable basis;
- remaining uncertainty can be handled during campaign strategy creation.

### 5.3 Revision

A revision creates a new draft based on the latest published version. It does not mutate the published record directly.

---

## 6. Profile Creation Inputs

The minimum input is a company website URL.

Optional inputs may include:

- additional URLs;
- product pages;
- pricing pages;
- catalogues;
- PDF brochures;
- presentations;
- company descriptions;
- uploaded documents;
- product or service lists;
- user-entered notes;
- CRM exports;
- public social/company profiles;
- previous profile data from the legacy system.

### 6.1 Input priority

Sources should be treated according to provenance and relevance, not merely ingestion order.

Recommended priority:

1. explicit user-entered corrections and confirmations;
2. official company materials;
3. official website pages;
4. official legal or registry information;
5. official partner or marketplace listings;
6. reputable third-party sources;
7. AI inference.

### 6.2 Required input validation

Before ingestion:

- validate URL format;
- normalize the domain;
- detect obvious redirects;
- reject unsupported local URLs;
- prevent duplicate simultaneous profile runs for the same workspace;
- preserve the original user-entered URL;
- record the final canonical URL after redirects.

---

## 7. Ingestion Architecture

Profile ingestion must collect enough material to understand commercial structure without crawling the entire web presence indiscriminately.

### 7.1 Recommended page categories

The crawler should prioritize:

- homepage;
- about/company page;
- products or services index;
- individual offering pages;
- solutions/use-cases pages;
- industries pages;
- pricing page;
- wholesale/distributor/partner pages;
- customer or case-study pages;
- FAQ;
- contact/location pages;
- terms where they clarify the selling entity or delivery model.

### 7.2 Crawl budget

The initial crawl should use a bounded budget, for example:

- 15–30 pages for a normal company website;
- higher only when the information architecture clearly contains multiple offerings;
- lower for small simple sites.

The crawler should prioritize semantic coverage rather than page count.

### 7.3 Page selection

Page selection should use:

- navigation labels;
- URL patterns;
- page titles;
- internal-link prominence;
- semantic similarity to commercial topics;
- known page-type heuristics.

### 7.4 Content extraction

For each page, store:

- URL;
- canonical URL;
- page title;
- detected language;
- extracted text;
- headings;
- structured metadata;
- retrieval timestamp;
- content hash;
- crawl status;
- extraction method;
- source reliability class.

### 7.5 Multilingual sites

The profile should avoid treating translated versions as separate offerings.

The system should:

- detect language variants;
- prefer the user-selected or primary language for synthesis;
- retain evidence from other languages when it adds unique facts;
- normalize duplicate translated pages by page purpose and content similarity.

### 7.6 Failure handling

If some pages are blocked or fail:

- keep successful pages;
- record failures;
- continue profile construction when enough evidence exists;
- flag missing critical source categories;
- ask the user for additional material only when the missing information affects commercial interpretation.

---

## 8. Factual Extraction

Factual extraction must occur before commercial synthesis.

The extraction model should identify explicit claims without trying to decide the final business model in the same step.

### 8.1 Fact categories

Extract facts about:

#### Company identity

- public company name;
- legal name when available;
- brands and product names;
- parent company;
- subsidiaries;
- founding location;
- headquarters;
- operating locations;
- geographic service area;
- website domains;
- languages.

#### Commercial roles

- manufacturer;
- developer;
- service provider;
- distributor;
- wholesaler;
- retailer;
- marketplace;
- reseller;
- integrator;
- consultant;
- logistics provider;
- agent or broker;
- other value-chain roles.

#### Offerings

- named products;
- product categories;
- services;
- plans or packages;
- solution bundles;
- support or maintenance;
- custom work;
- partner programs;
- distribution rights;
- wholesale categories.

#### Customers and markets

- customer types explicitly mentioned;
- industries served;
- company sizes served;
- countries or regions served;
- B2B, B2C, B2G, or mixed orientation;
- customer examples;
- case-study organizations.

#### Commercial mechanics

- subscription;
- one-off purchase;
- project contract;
- licence;
- recurring supply;
- wholesale order;
- commission;
- marketplace fee;
- usage-based billing;
- minimum order quantity;
- implementation requirement;
- delivery constraints;
- self-service versus sales-assisted purchase.

#### Positioning and differentiation

- claimed outcomes;
- differentiators;
- price positioning;
- quality positioning;
- specialization;
- exclusivity;
- certifications;
- geographic or operational advantages.

#### Relationship information

- named partners;
- named distributors;
- named suppliers;
- technology integrations;
- resellers;
- customer channels;
- competitors explicitly referenced.

### 8.2 Fact extraction output

Each extracted fact must be represented as a claim linked to evidence.

```ts
type ExtractedClaim = {
  key: string;
  subjectType: "workspace_company" | "offering" | "brand" | "location";
  subjectTemporaryId?: string;
  value: unknown;
  claimType: string;
  status: "confirmed_fact";
  confidence: number;
  evidenceIds: string[];
  extractionNotes?: string;
};
```

A claim should not be marked `confirmed_fact` unless the source directly supports it. Ambiguous language should produce an inference or unresolved claim later.

### 8.3 Evidence object

```ts
type CompanyEvidence = {
  id: string;
  workspaceId: string;
  profileDraftId: string;

  sourceType:
    | "official_website"
    | "official_document"
    | "user_input"
    | "registry"
    | "third_party"
    | "legacy_import";

  sourceUrl?: string;
  sourceFileId?: string;
  pageTitle?: string;
  retrievedAt?: string;
  publishedAt?: string;

  excerpt?: string;
  structuredValue?: unknown;

  reliability: "primary" | "authoritative_secondary" | "secondary" | "unknown";

  freshness: "current" | "possibly_stale" | "stale" | "unknown";

  contentHash?: string;
  createdAt: string;
};
```

### 8.4 Evidence limits

The system should store concise excerpts or structured values, not entire copied pages as claim evidence. Raw extracted content may be stored separately for internal retrieval, subject to data-retention rules.

---

## 9. Company Identity Model

The workspace company must have a normalized identity independent of marketing names.

```ts
type WorkspaceCompanyIdentity = {
  id: string;
  workspaceId: string;

  publicName: string;
  legalName?: string;
  tradingNames: string[];
  brands: string[];

  canonicalDomain: string;
  additionalDomains: string[];

  headquarters?: CompanyLocation;
  operatingLocations: CompanyLocation[];
  marketsServed: GeographyRef[];

  parentCompanyName?: string;
  legalEntityIds?: string[];

  primaryLanguage?: string;
  supportedLanguages: string[];
};
```

The identity object should not overreach. Parent or legal-entity information may remain unknown until authoritative evidence exists.

---

## 10. Business-Model Intelligence

Business-model synthesis translates extracted facts into an explanation of how the company creates, delivers, and captures value.

### 10.1 Business-model dimensions

The model should infer:

#### Value creation

- what problem or demand the company addresses;
- what outcome it creates;
- what resource, product, capability, or access it provides.

#### Value delivery

- direct delivery;
- digital delivery;
- physical shipment;
- project implementation;
- recurring service;
- channel distribution;
- marketplace intermediation;
- local branch delivery;
- partner-assisted delivery.

#### Value capture

- licence fee;
- recurring subscription;
- service fee;
- wholesale margin;
- retail margin;
- project fee;
- commission;
- usage fee;
- transaction fee;
- retainer;
- recurring supply order.

#### Customer relationship

- self-service;
- sales-assisted;
- account-managed;
- tender-based;
- procurement-led;
- distributor-led;
- long-term contract;
- recurring reorder;
- one-off purchase.

#### Position in value chain

- creates/manufactures;
- imports;
- aggregates;
- distributes;
- resells;
- implements;
- services;
- advises;
- connects buyers and sellers;
- consumes an upstream product to produce another outcome.

### 10.2 Business roles

```ts
type BusinessRole = {
  role:
    | "manufacturer"
    | "software_provider"
    | "service_provider"
    | "consultancy"
    | "agency"
    | "wholesaler"
    | "distributor"
    | "reseller"
    | "retailer"
    | "marketplace"
    | "integrator"
    | "managed_service_provider"
    | "logistics_provider"
    | "broker"
    | "other";

  importance: "primary" | "secondary" | "supporting";
  confidence: number;
  evidenceIds: string[];
  explanation: string;
};
```

### 10.3 Business model object

```ts
type CompanyBusinessModel = {
  summary: string;
  roles: BusinessRole[];

  valueCreation: string[];
  valueDelivery: string[];
  valueCapture: string[];

  customerRelationshipModels: string[];
  salesMotions: string[];
  revenuePatterns: string[];

  sellsForOwnUse: boolean | null;
  sellsForResale: boolean | null;
  sellsThroughPartners: boolean | null;

  directSalesImportance?: "low" | "medium" | "high" | "unknown";
  channelSalesImportance?: "low" | "medium" | "high" | "unknown";

  constraints: CommercialConstraint[];
  confidence: number;
  evidenceIds: string[];
};
```

### 10.4 Reasoning requirements

The synthesis model must explain:

- which facts support each commercial role;
- which interpretation is inferred rather than explicit;
- whether multiple models coexist;
- where website language is ambiguous;
- which unanswered question would change the interpretation.

It must not treat company category labels as sufficient business-model analysis.

---

## 11. Offering Decomposition

An offering is a materially distinct commercial proposition.

### 11.1 Offering-separation test

Two products or services should be separate offerings when at least one of these conditions is true:

- they are bought by different organization types;
- they solve materially different problems;
- they use different budgets;
- they have different users or decision-makers;
- one is purchased for use and another for resale;
- one is a product and another is implementation or support;
- one uses recurring contracts and another uses one-off orders;
- one requires a partner or distributor and another is direct;
- one has different qualification requirements;
- one is available only in certain markets;
- one has materially different commercial value.

### 11.2 Do not over-separate variants

Product colours, sizes, minor packages, language versions, or closely related plan tiers should not automatically become separate offerings.

They may remain:

- variants;
- packages;
- plans;
- subcategories;
- modules;
- optional add-ons.

### 11.3 Offering structure

```ts
type OfferingIntelligence = {
  id: string;
  profileVersionId: string;

  name: string;
  slug: string;
  shortDescription: string;
  category?: string;

  offeringType:
    | "physical_product"
    | "digital_product"
    | "software"
    | "service"
    | "managed_service"
    | "project"
    | "subscription"
    | "wholesale_supply"
    | "marketplace_access"
    | "licence"
    | "partnership_program"
    | "other";

  parentOfferingId?: string;
  variants: OfferingVariant[];

  customerProblem: string[];
  promisedOutcomes: string[];
  useCases: string[];

  commercialMechanics: OfferingCommercialMechanics;
  buyerLogic: OfferingBuyerLogic;
  relationshipOptions: OfferingRelationshipOption[];

  availability: OfferingAvailability;
  constraints: CommercialConstraint[];

  status: "active" | "inactive" | "uncertain";
  confidence: number;
  claimIds: string[];
  evidenceIds: string[];
};
```

### 11.4 Offering commercial mechanics

```ts
type OfferingCommercialMechanics = {
  transactionModels: Array<
    | "subscription"
    | "one_time_purchase"
    | "project_contract"
    | "retainer"
    | "recurring_order"
    | "wholesale_order"
    | "licence"
    | "commission"
    | "usage_based"
    | "tender"
    | "other"
  >;

  purchaseMotion:
    | "self_service"
    | "sales_assisted"
    | "procurement_led"
    | "partner_led"
    | "tender_led"
    | "mixed"
    | "unknown";

  customerUseMode:
    | "own_use"
    | "resale"
    | "distribution"
    | "integration"
    | "implementation_for_clients"
    | "mixed"
    | "unknown";

  typicalRelationship:
    | "transactional"
    | "recurring"
    | "long_term_contract"
    | "project_based"
    | "channel_relationship"
    | "mixed"
    | "unknown";

  pricingPosition?:
    | "budget"
    | "mid_market"
    | "premium"
    | "enterprise"
    | "mixed"
    | "unknown";
  minimumOrderOrContract?: CommercialValueRange;
  typicalOrderOrContract?: CommercialValueRange;
  salesCycle?: DurationRange;
  implementationRequired?: boolean | null;
  onboardingRequired?: boolean | null;

  confidence: number;
  evidenceIds: string[];
};
```

All monetary and duration values may remain unknown. The AI must not invent them solely to complete the schema.

---

## 12. Offering Buyer Logic

Buyer logic explains why an organization would purchase or enter a relationship around the offering.

### 12.1 Required buyer-logic fields

For each offering, determine:

- economic buyer;
- operational user;
- beneficiary;
- technical evaluator where relevant;
- procurement participant;
- partner role where relevant;
- problem or trigger;
- required organizational capabilities;
- required scale or maturity;
- incompatible conditions;
- alternatives or substitutes;
- evidence signals that indicate probable need;
- evidence signals that indicate poor fit.

### 12.2 Buyer-role model

```ts
type BuyerRoleHypothesis = {
  roleType:
    | "economic_buyer"
    | "decision_maker"
    | "operational_user"
    | "technical_evaluator"
    | "procurement"
    | "champion"
    | "beneficiary"
    | "partner_owner"
    | "other";

  jobFunctions: string[];
  seniority?: string[];
  department?: string[];
  relevance: "primary" | "secondary" | "conditional";
  conditions?: string[];
  confidence: number;
  evidenceIds: string[];
};
```

These are hypotheses used later for campaign and contact strategy. They are not contact records.

### 12.3 Buyer logic object

```ts
type OfferingBuyerLogic = {
  whyBuy: string[];
  buyingTriggers: BuyingTrigger[];
  requiredCapabilities: BuyerCondition[];
  preferredCharacteristics: BuyerCondition[];
  incompatibleCharacteristics: BuyerCondition[];

  buyerRoles: BuyerRoleHypothesis[];
  procurementModel: ProcurementHypothesis;

  likelyAlternatives: string[];
  likelyObjections: string[];

  positiveEvidenceSignals: EvidenceSignal[];
  negativeEvidenceSignals: EvidenceSignal[];

  confidence: number;
  evidenceIds: string[];
};
```

### 12.4 Required versus preferred conditions

The system must separate:

- **required conditions:** absence makes the offering unusable or commercially impossible;
- **preferred conditions:** increase probability or value but are not mandatory;
- **conditional conditions:** matter only for certain campaign objectives, geographies, or variants.

Example:

```text
Required:
- buyer must operate an e-commerce store.

Preferred:
- buyer sells in at least two markets.

Conditional:
- local warehouse required only for same-day fulfilment package.
```

---

## 13. Relationship Hypotheses

Company Intelligence must not assume that every suitable external organization is a direct buyer.

For each offering, generate possible relationship types:

- direct buyer;
- end user;
- distributor;
- reseller;
- implementation partner;
- referral partner;
- integration partner;
- supplier;
- strategic partner;
- marketplace participant;
- competitor;
- incompatible adjacent company.

```ts
type OfferingRelationshipOption = {
  relationshipType:
    | "direct_buyer"
    | "end_user"
    | "distributor"
    | "reseller"
    | "channel_partner"
    | "implementation_partner"
    | "integration_partner"
    | "referral_partner"
    | "supplier"
    | "strategic_partner"
    | "competitor"
    | "other";

  relevance: "primary" | "secondary" | "possible" | "avoid";
  rationale: string;
  requiredConditions: BuyerCondition[];
  incompatibleConditions: BuyerCondition[];
  confidence: number;
  evidenceIds: string[];
};
```

A company type may be `avoid` for direct-sales campaigns and `primary` for partner campaigns. This applicability must be preserved later in campaign strategy.

---

## 14. Reusable Buyer Archetype Hypotheses

The profile should generate reusable, offering-specific buyer hypotheses. These are not final campaign archetypes because they are not yet adjusted for geography or campaign objective.

### 14.1 Archetype contents

```ts
type ProfileBuyerArchetype = {
  id: string;
  offeringId: string;

  name: string;
  description: string;

  relationshipType: string;
  priority: "priority" | "conditional" | "low_priority" | "avoid";

  businessRoles: string[];
  businessModels: string[];
  industries: string[];
  sizeGuidance?: CompanySizeGuidance;

  commercialNeed: string[];
  whyCompatible: string[];

  requiredConditions: BuyerCondition[];
  preferredConditions: BuyerCondition[];
  incompatibleConditions: BuyerCondition[];

  positiveEvidenceSignals: EvidenceSignal[];
  negativeEvidenceSignals: EvidenceSignal[];

  likelyBuyerRoles: BuyerRoleHypothesis[];

  status: "proposed" | "user_confirmed" | "user_rejected" | "superseded";
  confidence: number;
  claimIds: string[];
  evidenceIds: string[];
};
```

### 14.2 Archetypes must be behavior-based

Bad archetype:

> Manufacturing companies.

Better archetype:

> Mid-sized manufacturers operating several production sites that maintain internal engineering teams and purchase external predictive-maintenance software through an operational-improvement budget.

Industry remains useful, but it is not the entire archetype.

### 14.3 Avoid overconfidence

If the website does not contain enough information, buyer archetypes must be explicitly labelled as hypotheses. The user may confirm, edit, reject, or postpone them.

---

## 15. Claims, Statuses, and Provenance

All material profile intelligence must be represented by structured claims.

### 15.1 Claim schema

```ts
type IntelligenceClaim = {
  id: string;
  workspaceId: string;
  profileVersionId?: string;
  profileDraftId?: string;

  subjectType:
    | "workspace_company"
    | "business_model"
    | "offering"
    | "buyer_archetype"
    | "relationship_option"
    | "commercial_rule";

  subjectId: string;
  key: string;
  value: unknown;

  status:
    | "confirmed_fact"
    | "evidence_backed_inference"
    | "hypothesis"
    | "unknown"
    | "user_confirmed"
    | "user_rejected"
    | "superseded";

  confidence: number;
  evidenceIds: string[];

  source:
    | "user"
    | "official_source"
    | "third_party_source"
    | "ai_inference"
    | "legacy_import";

  origin?: {
    taskRunId?: string;
    promptVersion?: string;
    modelId?: string;
  };

  reasoningSummary?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 15.2 Confidence guidance

Confidence is evidence confidence, not business fit.

Suggested interpretation:

- `0.90–1.00`: explicit and current primary evidence, or user confirmation;
- `0.70–0.89`: strong multi-source evidence or clear inference;
- `0.45–0.69`: plausible but incomplete inference;
- `0.20–0.44`: weak hypothesis;
- `0.00–0.19`: effectively unknown.

The UI may translate this into labels rather than showing decimals everywhere.

### 15.3 Contradictory claims

Contradictory claims should not be overwritten silently.

The system should:

- store both claims;
- mark the conflict;
- compare source authority and freshness;
- ask the user only when the conflict affects commercial logic;
- mark the losing claim as superseded after resolution.

---

## 16. Commercial Constraints and Rules

Commercial rules express conditions that should influence future campaign strategies.

### 16.1 Rule types

- minimum company size;
- minimum purchasing capacity;
- minimum order quantity;
- unsupported geography;
- required certification;
- required technical stack;
- required distribution capability;
- required operational capability;
- prohibited industry;
- unsuitable buyer model;
- existing-customer exclusion;
- direct competitor exclusion;
- channel conflict;
- legal or policy restriction;
- custom user rule.

### 16.2 Rule scope

In the Company Profile, rules may be:

- workspace-wide;
- offering-specific.

Campaign-specific rules are defined later and must not be inserted here automatically.

### 16.3 Rule applicability

Even broad rules need conditions.

```ts
type CommercialRule = {
  id: string;
  workspaceId: string;

  scope: "workspace" | "offering";
  scopeId: string;

  kind:
    | "exclusion"
    | "requirement"
    | "preference"
    | "relationship_constraint"
    | "geography_constraint";

  statement: string;
  rationale?: string;

  applicability: {
    campaignObjectives?: string[];
    relationshipTypes?: string[];
    geographies?: string[];
    buyerArchetypeIds?: string[];
    offeringVariantIds?: string[];
  };

  strength: "hard" | "soft";
  status: "proposed" | "confirmed" | "rejected" | "superseded";

  source: "user" | "ai" | "import";
  confidence: number;
  evidenceIds: string[];

  createdAt: string;
  updatedAt: string;
};
```

### 16.4 Promotion into profile scope

A campaign correction must not automatically create a profile rule. It may later be proposed for promotion, but profile-level creation requires explicit user confirmation or a deliberate profile edit.

### 16.5 Default behavior

Rules generated by AI during profile creation should default to `proposed`. The user must confirm any hard exclusion before it is treated as permanent profile knowledge.

---

## 17. Clarification Question Engine

Clarification is a decision-support step, not a questionnaire.

### 17.1 Question-generation input

The clarification model receives:

- extracted facts;
- synthesized business model;
- offering decomposition;
- buyer hypotheses;
- contradictions;
- unknown critical fields;
- confidence values;
- expected impact of each unknown.

### 17.2 Question eligibility

A question should be generated only if:

1. the answer is not already supported by available evidence;
2. the answer cannot be safely inferred;
3. it would materially change campaign strategy or qualification;
4. the user is likely to know the answer;
5. the question can be phrased clearly and answered quickly.

### 17.3 Impact categories

Questions should be ranked by their potential effect on:

- offering separation;
- direct buyer versus partner targeting;
- minimum viable buyer size;
- target business model;
- purchasing capability;
- geography availability;
- exclusion rules;
- decision-role selection;
- commercial value;
- contact enrichment strategy.

### 17.4 Question output

```ts
type ClarificationQuestion = {
  id: string;
  profileDraftId: string;

  question: string;
  explanation: string;

  questionType:
    | "single_select"
    | "multi_select"
    | "boolean"
    | "number"
    | "range"
    | "short_text"
    | "long_text";

  options?: ClarificationOption[];
  allowOther: boolean;
  allowSkip: boolean;

  affectedClaimKeys: string[];
  expectedImpact:
    | "offering_structure"
    | "buyer_logic"
    | "relationship_logic"
    | "qualification"
    | "exclusion"
    | "geography"
    | "decision_roles"
    | "other";

  impactScore: number;
  status: "pending" | "answered" | "skipped" | "obsolete";
};
```

### 17.5 Question limits

Default behavior:

- present no more than 3–5 questions in the first review;
- group related questions;
- do not ask low-impact questions merely to complete fields;
- allow skipping every AI-generated question;
- generate follow-up questions only when an answer creates a meaningful new ambiguity.

### 17.6 Examples of useful questions

- “Do customers purchase this product for their own operations, or mainly for resale?”
- “Can this offering be sold directly, or does it normally require a local implementation partner?”
- “Is there a minimum order or contract size that makes smaller companies commercially unsuitable?”
- “Are you looking for end customers, distribution partners, or both?”
- “Are the listed service packages sold independently, or only together with the core product?”

### 17.7 Examples of weak questions

- “Who is the decision-maker?” when several reasonable roles can be inferred and the answer is not critical yet.
- “Is the product standalone?” repeated for every website item.
- “Which markets do you target?” during profile creation when geography is campaign-specific and no global restriction is needed.
- questions that merely ask the user to repeat information visible on the website.

---

## 18. Profile Review and Confirmation Flow

The review experience must help the user validate commercial reasoning quickly.

### 18.1 Review sequence

Recommended review order:

1. company identity;
2. business model;
3. offerings;
4. commercial mechanics per offering;
5. likely customer and partner relationships;
6. buyer hypotheses;
7. exclusions and constraints;
8. important questions and uncertainties;
9. publish confirmation.

### 18.2 Information presentation

Every section should visually distinguish:

- **Confirmed:** direct evidence or user-confirmed;
- **Inferred:** supported interpretation;
- **Assumption:** useful but uncertain hypothesis;
- **Unknown:** missing information;
- **Conflict:** contradictory evidence.

### 18.3 User actions

The user must be able to:

- confirm a section;
- edit individual fields;
- reject an inference;
- merge or split offerings;
- mark an offering inactive;
- add a missing offering;
- add or remove buyer hypotheses;
- change rule scope between workspace and offering;
- convert a hard exclusion to a soft preference;
- skip a clarification question;
- publish with unresolved non-critical fields.

### 18.4 Editing behavior

User edits must:

- create user-authored claims;
- supersede conflicting AI claims without deleting history;
- receive highest precedence in future synthesis;
- trigger recomputation only for affected downstream sections;
- avoid rerunning the entire crawl unless source refresh is needed.

### 18.5 Publish gate

The profile may be published when:

- at least one active offering exists;
- the company business model has a usable summary;
- each active offering has a basic commercial-mechanics model;
- each active offering has at least one relationship hypothesis;
- critical conflicts are resolved or explicitly accepted as unknown;
- no required validation error remains.

The system should not require completion of every optional field.

---

## 19. Profile Versioning

### 19.1 Version objects

```ts
type CompanyProfileVersion = {
  id: string;
  workspaceId: string;
  companyId: string;

  versionNumber: number;
  status: "draft" | "published" | "superseded" | "archived";

  basedOnVersionId?: string;
  createdByUserId?: string;
  createdByRunId?: string;

  summary: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 19.2 Immutable publication

After publication:

- the version is immutable;
- corrections create a new draft version;
- campaigns reference the exact published version used;
- evidence may be refreshed in a new version;
- old campaigns remain auditable.

### 19.3 Version diff

The profile UI should be able to show meaningful changes:

- offering added, removed, merged, or split;
- business role changed;
- buyer archetype changed;
- commercial constraint added or removed;
- user correction;
- confidence upgrade or downgrade;
- source refresh.

### 19.4 Reusing campaigns after profile changes

Existing campaign strategies should not update automatically. The system may notify the user that a newer profile version exists and offer to create a new campaign strategy revision.

---

## 20. Profile Memory

Profile memory is durable workspace or offering knowledge confirmed during onboarding or later profile revisions.

### 20.1 Suitable profile memories

- preferred terminology;
- confirmed business model;
- offering definitions;
- minimum order requirements;
- unsupported customer types;
- partner model;
- confirmed competitor categories;
- commercial constraints;
- known decision roles;
- confirmed buyer conditions.

### 20.2 Unsuitable profile memories

The following should not be promoted automatically:

- a one-campaign exclusion;
- a temporary market condition;
- a single candidate rejection;
- a speculative AI conclusion;
- a search-query lesson;
- run-state information;
- a user interface preference unrelated to company knowledge.

### 20.3 Memory storage

Confirmed profile claims and commercial rules are themselves the primary structured memory. A separate memory record may be used for reusable instructions that do not map cleanly to profile fields.

```ts
type ProfileMemory = {
  id: string;
  workspaceId: string;
  offeringId?: string;

  kind:
    | "terminology"
    | "commercial_fact"
    | "commercial_rule"
    | "buyer_pattern"
    | "relationship_pattern"
    | "user_instruction";

  statement: string;
  applicability?: Record<string, unknown>;

  status: "proposed" | "confirmed" | "rejected" | "superseded";
  source: "user" | "ai" | "import";
  confidence: number;

  originClaimIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

---

## 21. Model Task Separation

Profile creation should use typed, separate model tasks rather than one prompt that attempts everything.

### 21.1 Extraction task

Responsibilities:

- extract explicit facts;
- identify named offerings;
- identify locations, roles, customers, and commercial terms;
- cite evidence;
- avoid broad synthesis.

Recommended model profile:

- fast;
- reliable structured output;
- low cost;
- strong multilingual extraction.

### 21.2 Commercial synthesis task

Responsibilities:

- infer business model;
- identify value-chain position;
- explain revenue and delivery mechanics;
- distinguish facts from inference;
- identify contradictions.

Recommended model profile:

- strong reasoning;
- good commercial interpretation;
- strict schema compliance.

### 21.3 Offering decomposition task

Responsibilities:

- group products and services;
- decide which offerings are materially distinct;
- avoid over-separation;
- define variants and dependencies.

### 21.4 Buyer-logic task

Responsibilities:

- identify why buyers would purchase;
- infer required and preferred conditions;
- generate relationship options;
- propose buyer roles;
- propose reusable buyer archetypes.

### 21.5 Clarification task

Responsibilities:

- rank unresolved questions by impact;
- generate minimal user-facing questions;
- avoid repetitive or generic questions.

### 21.6 Consistency task

Responsibilities:

- compare business model, offerings, buyer hypotheses, and rules;
- detect contradictions;
- detect unsupported assumptions;
- detect duplicated offerings;
- verify that exclusions have scope and applicability.

### 21.7 Reconciliation after user edits

When the user edits a field:

- determine affected dependent objects;
- rerun only necessary synthesis tasks;
- preserve unaffected confirmed data;
- never overwrite user-confirmed claims without presenting a conflict.

---

## 22. Prompt Requirements

Every profile-related model prompt must include these rules:

1. Return schema-valid JSON only.
2. Separate explicit facts from inference.
3. Attach evidence IDs to every material factual claim.
4. Use `unknown` where evidence is insufficient.
5. Do not invent commercial values, order sizes, sales cycles, or markets.
6. Do not assume every company seeks direct buyers.
7. Do not assume every target is an end user.
8. Do not infer one generic ICP for all offerings.
9. Identify whether the offering is used, resold, distributed, implemented, or integrated.
10. Identify counter-evidence and incompatible interpretations.
11. Prefer concise commercial language over marketing language.
12. Generate questions only when the answer materially changes targeting or qualification.
13. Do not create hard global exclusions from weak evidence.
14. Preserve confidence and source provenance.
15. Avoid industry-only archetypes when behavioral and procurement conditions can be stated.

---

## 23. Trigger.dev Workflow

Recommended profile task graph:

```text
profile.ingest
    ↓
profile.selectPages
    ↓
profile.extractContent
    ↓
profile.extractFacts
    ↓
profile.resolveIdentity
    ↓
profile.buildBusinessModel
    ↓
profile.buildOfferings
    ↓
profile.buildBuyerLogic
    ↓
profile.buildRelationshipHypotheses
    ↓
profile.generateBuyerArchetypes
    ↓
profile.detectConflicts
    ↓
profile.generateClarificationQuestions
    ↓
profile.prepareReview
```

After user edits:

```text
profile.applyUserCorrections
    ↓
profile.recomputeAffectedIntelligence
    ↓
profile.validateDraft
    ↓
profile.publishVersion
```

### 23.1 Task requirements

Every task must be:

- idempotent;
- retryable;
- scoped to one profile draft;
- aware of source and prompt versions;
- safe against duplicate execution;
- able to resume from persisted outputs;
- explicit about input and output schema versions.

### 23.2 Idempotency keys

Suggested pattern:

```text
profile:{profileDraftId}:{taskName}:{inputHash}:{schemaVersion}
```

### 23.3 Partial recomputation

Dependency examples:

- editing company name does not rerun buyer logic;
- merging offerings reruns affected offering, buyer, and archetype synthesis;
- changing transaction model reruns buyer logic and constraints;
- confirming a minimum order may update buyer conditions and questions;
- adding a new source page may rerun extraction and conflict detection.

---

## 24. Database Model

Recommended tables for this document:

```text
workspace_companies
company_profiles
company_profile_versions
company_profile_drafts

company_source_documents
company_source_pages
company_evidence
company_claims
claim_conflicts

company_business_models
company_business_roles

company_offerings
company_offering_versions
company_offering_variants
offering_commercial_mechanics
offering_buyer_logic
offering_buyer_roles
offering_relationship_options

profile_buyer_archetypes
profile_buyer_archetype_conditions
profile_evidence_signals

commercial_rules
profile_memories
clarification_questions
clarification_answers

profile_task_runs
profile_change_events
```

### 24.1 JSONB versus normalized columns

Use normalized columns for:

- IDs;
- ownership;
- scope;
- state;
- version links;
- relationship types;
- rule status;
- confidence;
- timestamps;
- queryable categories.

Use JSONB for:

- flexible condition details;
- provider-specific or source-specific values;
- structured ranges;
- model metadata;
- less frequently queried explanation details.

Do not store the entire profile as one opaque JSON document. A compiled JSON snapshot may be generated for model context and export, but normalized records remain the source of truth.

### 24.2 Suggested unique constraints

- one active workspace company per workspace in the current product phase;
- unique profile version number per company;
- unique offering slug per profile version;
- unique active claim key per subject and version, except intentional conflicts;
- unique published profile version state where business rules require one current version;
- unique task idempotency key.

---

## 25. Compiled Profile Context

Downstream campaign tasks should not receive every raw claim and page.

The system should compile a concise profile context from normalized records.

```ts
type CompiledCompanyIntelligence = {
  profileVersionId: string;

  companyIdentity: WorkspaceCompanyIdentity;
  businessModel: CompanyBusinessModel;

  offerings: Array<{
    offering: OfferingIntelligence;
    buyerArchetypes: ProfileBuyerArchetype[];
    commercialRules: CommercialRule[];
  }>;

  workspaceRules: CommercialRule[];
  confirmedMemories: ProfileMemory[];

  unresolvedCriticalClaims: IntelligenceClaim[];
  sourceSummary: {
    primaryEvidenceCount: number;
    staleEvidenceCount: number;
    lastRefreshedAt?: string;
  };
};
```

The compiler should include only active, applicable, non-superseded records.

---

## 26. Abstract Examples Across Business Models

These examples illustrate the required generality. They are not fixed templates.

### 26.1 B2B SaaS company

Possible offerings:

- self-service team plan;
- enterprise deployment;
- paid implementation;
- integration partner program.

Different buyer logic:

- team plan may target department managers;
- enterprise deployment may require security, IT, and procurement;
- implementation may be sold only with enterprise contracts;
- integration partners are not direct buyers.

### 26.2 Industrial manufacturer

Possible offerings:

- standard equipment;
- custom engineering project;
- spare-parts supply;
- maintenance contract;
- distributor relationship.

Different buyer logic:

- standard equipment may be bought by plant operators;
- custom projects require engineering capability and capital budget;
- spare parts mainly target installed-base customers;
- distributors need territory coverage and service capability.

### 26.3 Professional-services agency

Possible offerings:

- marketing website;
- e-commerce build;
- internal business application;
- ongoing support retainer.

Different buyer logic:

- websites may be triggered by rebranding;
- e-commerce requires a direct sales channel and catalogue complexity;
- internal tools require operational pain and internal process ownership;
- support retainers are usually sold to existing project customers.

### 26.4 Wholesaler

Possible offerings:

- mixed stock lots;
- selected brand collections;
- exclusive distribution;
- private-label supply.

Different buyer logic:

- mixed stock requires resale capability and flexible assortment;
- selected collections may fit traditional retailers;
- exclusive distribution targets regional distributors rather than stores;
- private label targets brands or large retailers with design and volume capacity.

### 26.5 Marketplace

Possible offerings:

- seller acquisition;
- buyer acquisition;
- enterprise procurement access;
- advertising or promoted listings.

Seller candidates are not the same as buyers, and advertisers may be neither.

### 26.6 Logistics provider

Possible offerings:

- parcel delivery;
- freight forwarding;
- fulfilment;
- customs brokerage;
- returns management.

Each offering requires different shipment patterns, volume, geography, infrastructure, and decision roles.

---

## 27. Validation Rules

### 27.1 Schema validation

Every model output must pass runtime schema validation before persistence.

On failure:

- retry with validation feedback;
- use bounded retries;
- store failure metadata;
- do not persist partial invalid records as final intelligence.

### 27.2 Commercial consistency validation

Examples:

- an offering cannot be marked `own_use` and simultaneously described only as wholesale resale without `mixed` or explanation;
- a distributor relationship cannot require the target to be the final end user unless clearly conditional;
- a hard exclusion must include scope and applicability;
- an archetype marked `priority` must have a positive compatibility rationale;
- a claim marked `confirmed_fact` must reference evidence or user input;
- an offering marked active must have a name and commercial description;
- a user-rejected claim must not appear in compiled active context.

### 27.3 Completeness validation

The profile is usable when:

- company identity is sufficient;
- business model exists;
- active offerings exist;
- each offering has basic mechanics and relationship options;
- unresolved critical conflicts are visible;
- the user can understand what the system will target later.

---

## 28. Auditability Requirements

For every generated profile object, store:

- source claims;
- evidence links;
- model identifier;
- prompt version;
- schema version;
- task run ID;
- creation timestamp;
- user edits;
- superseded values;
- confidence;
- reasoning summary safe for user display.

Do not store or expose private model chain-of-thought. Store concise decision summaries and evidence references.

---

## 29. Performance and Cost Guidance

Profile creation should prioritize quality over extreme speed, but it should not perform uncontrolled research.

Recommended design:

- crawl and extraction in parallel where possible;
- deduplicate content before model calls;
- use a fast model for factual extraction;
- use a stronger model for business synthesis and buyer logic;
- batch related offerings when context remains manageable;
- cache unchanged page extractions by content hash;
- rerun only affected intelligence after edits;
- avoid repeated questions and repeated analysis of translated duplicates.

A normal profile should feel like a bounded onboarding process, not a long-running campaign.

---

## 30. Error and Uncertainty Handling

### 30.1 Insufficient website information

If the website is minimal:

- build the profile from available evidence;
- label uncertainty;
- ask a small number of high-impact questions;
- allow the user to add descriptions or materials;
- do not fabricate detailed buyer logic.

### 30.2 Conflicting business models

If the company appears to operate several models:

- preserve all supported roles;
- distinguish core and secondary models;
- separate offerings where needed;
- present the ambiguity to the user only if it changes targeting.

### 30.3 Stale information

Mark stale evidence and avoid treating it as current without corroboration. Profile refresh will be specified later, but versioned evidence must already support freshness metadata.

### 30.4 Unsupported pages

A blocked or unsupported page should not fail the entire profile run. It should become a recorded source failure and may trigger a request for user-supplied material if critical.

---

## 31. Legacy Profile Migration

The existing profile may contain useful company descriptions, products, markets, and generated answers.

Migration should:

1. import legacy values as `legacy_import` claims;
2. avoid marking them user-confirmed unless they were explicitly confirmed;
3. map products into provisional offerings;
4. rerun business-model and offering synthesis using current website evidence;
5. present differences for user review;
6. publish a new Intelligence V2 profile version only after confirmation.

Legacy questions that created repeated or low-value answers should not be retained as mandatory fields.

---

## 32. Implementation Sequence for Document 01

Recommended order:

### Phase 1 — Contracts and persistence

- create core schemas;
- create profile, version, claim, evidence, offering, and rule tables;
- implement runtime validation;
- implement compiled profile context.

### Phase 2 — Ingestion and extraction

- website crawl selection;
- page extraction;
- source persistence;
- factual extraction;
- evidence linking.

### Phase 3 — Commercial synthesis

- identity resolution;
- business-model synthesis;
- offering decomposition;
- commercial mechanics;
- buyer logic;
- relationship options;
- profile buyer archetypes.

### Phase 4 — Review intelligence

- conflict detection;
- clarification questions;
- confidence and status labels;
- draft validation.

### Phase 5 — Profile UI

- structured review;
- editing;
- offering merge and split;
- rule scope control;
- question answering and skipping;
- publication.

### Phase 6 — Incremental recomputation

- change dependency map;
- partial task reruns;
- version diff;
- profile revision flow.

---

## 33. Acceptance Criteria

Document 01 is considered implemented when all of the following are true.

### Functional

- a user can create a profile from a website;
- the system identifies the company’s major commercial roles;
- the system separates materially different offerings;
- each offering has commercial mechanics and buyer logic;
- buyer, partner, distributor, supplier, and competitor relationships are not collapsed into one ICP;
- profile rules have scope, applicability, strength, and status;
- questions are limited to high-impact uncertainty;
- the user can edit, reject, merge, split, skip, and confirm;
- publication creates an immutable profile version;
- later edits create a new version;
- campaigns can reference a compiled published profile version.

### Intelligence quality

- generated content explains how the company makes money;
- offerings are not merely copied navigation labels;
- buyer archetypes contain behavior and procurement logic, not only industries;
- unknown information remains unknown;
- hard global exclusions are not inferred from weak evidence;
- every material factual claim has evidence or user provenance;
- contradictions are visible and auditable.

### Technical

- tasks are idempotent and resumable;
- outputs are schema validated;
- source and model metadata are stored;
- user edits outrank AI claims;
- partial recomputation works for major edit types;
- compiled profile context excludes rejected and superseded claims.

### UX

- the review process does not force repetitive questions;
- profile sections clearly distinguish facts, inference, assumptions, and unknowns;
- the user can publish without filling every optional field;
- the user understands that market geography will be confirmed during campaign creation;
- the user can see which rules apply globally and which apply only to an offering.

---

## 34. Output of Company Intelligence

The final published output of this document is:

```text
Published Company Profile Version
    ├── Company identity
    ├── Business model
    ├── Commercial roles
    ├── Active offerings
    │     ├── Commercial mechanics
    │     ├── Buyer logic
    │     ├── Relationship options
    │     ├── Buyer-role hypotheses
    │     ├── Buyer archetype hypotheses
    │     └── Offering rules
    ├── Workspace-level commercial rules
    ├── Confirmed profile memory
    ├── Claims and evidence
    └── Explicit unresolved uncertainties
```

This version becomes one of the required inputs to the Campaign Strategy compiler defined in Document 02.

---

## 35. Next Document

The next specification is:

**02-campaign-strategy-and-scoped-memory.md**

It will define geography-first campaign creation, campaign objectives, offering selection, market interpretation, target archetypes, qualification policy, campaign-specific exclusions, campaign working memory, provisional learning, conflict resolution, strategy confirmation, and immutable campaign strategy versions.
