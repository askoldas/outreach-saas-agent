# Opptium Intelligence V2

## Discovery Architecture and Provider Abstraction

**Document:** 03  
**Status:** Implementation specification  
**Depends on:** `00-documentation-map-and-core-principles.md`, `01-company-intelligence-and-profile-creation.md`, `02-campaign-strategy-and-scoped-memory.md`  
**Purpose:** Define how Opptium converts a confirmed Campaign Strategy into provider-independent discovery work, launches with web search as the first discovery provider, tracks market coverage and campaign learning, and later adds structured company databases without another core refactor.

---

## 1. Purpose of Discovery Intelligence

Discovery Intelligence is responsible for finding plausible external organizations that may match a confirmed campaign strategy.

It must answer:

- which parts of the target market need to be searched;
- which source types are suitable for each part;
- what has already been searched;
- which candidates were found and through which source;
- which market segments remain undercovered;
- whether another discovery pass is likely to produce useful results;
- when discovery should stop.

Discovery is not responsible for deciding final commercial fit. It creates a candidate universe and preserves enough context for later entity resolution, research, qualification, and ranking.

The discovery layer must move from:

> generate several search strings → repeat for a fixed number of iterations → classify everything found

To:

> compile semantic discovery segments → route each segment to suitable providers → collect provider source records → normalize and deduplicate → measure coverage and yield → run only targeted gap searches → stop when additional discovery has low expected value

The initial production version may use only web search. However, all core contracts must assume that several providers can exist later.

---

## 2. Desired Outcome

For every campaign, Opptium should be able to explain:

- which buyer archetypes and geographies were searched;
- why each discovery segment exists;
- which providers were selected and why;
- which queries or filters were executed;
- how many raw results, source records, probable organizations, and unique entities were found;
- where market coverage is strong, uncertain, or insufficient;
- what the next discovery action is intended to improve;
- why discovery stopped;
- how much time and provider budget were consumed;
- which candidate facts came from which source.

A complete discovery run must produce:

1. a versioned discovery plan linked to one immutable campaign strategy version;
2. semantic discovery segments;
3. a provider source plan;
4. provider-specific query or filter executions;
5. raw provider source records with full provenance;
6. normalized provider candidates;
7. preliminary duplicate grouping and canonical-identity hints;
8. coverage snapshots by archetype and geography;
9. source and segment yield metrics;
10. gap-analysis decisions;
11. a clear stopping reason;
12. campaign working memory that prevents repeated or contradictory discovery work.

---

## 3. Scope

This document defines:

- semantic discovery segments;
- provider-independent discovery contracts;
- source plans and provider roles;
- provider capabilities and routing;
- the first `WebSearchProvider` implementation;
- future structured database provider adapters;
- query generation and localized search logic;
- parallel segmented discovery;
- source-record ingestion and provenance;
- preliminary normalization and duplicate suppression;
- coverage tracking;
- targeted gap-driven iterations;
- stopping conditions;
- cost, time, and yield tracking;
- discovery working memory;
- discovery state transitions;
- preliminary tables and TypeScript contracts;
- migration from the current fixed-iteration web-search pipeline;
- validation and acceptance criteria.

This document does not fully define:

- canonical company entity resolution;
- parent, legal entity, brand, branch, and buying-organization resolution;
- deep candidate research;
- campaign-specific qualification factors;
- deterministic scoring;
- comparative reranking;
- final Supabase migrations and complete Trigger.dev orchestration.

Those are covered in Documents 04–06.

---

## 4. Non-Negotiable Design Rules

### 4.1 Discovery segments are semantic, not provider-specific

A Campaign Strategy must request a market segment such as:

> Independent industrial equipment distributors in Lithuania that represent multiple manufacturers and sell to industrial buyers.

It must not request:

> Run these eight Tavily queries.

Search strings, database filters, directory parameters, and registry lookups are provider implementations of a semantic segment.

### 4.2 Web search is the first provider, not the architecture

The first production implementation can enable only `web_search`. The rest of the application must not depend on:

- Tavily-specific request fields;
- search-engine result shapes;
- web snippets as the canonical company schema;
- a fixed number of web queries;
- provider-specific IDs in campaign or candidate logic.

Adding PDL, Apollo, Coresignal, a registry, maps, or a specialist directory later must not require changes to Company Intelligence, Campaign Strategy, qualification, scoring, or the results interface.

### 4.3 Providers find candidates; Opptium determines meaning

A provider may return:

- company name;
- domain;
- location;
- industry;
- employee count;
- keywords;
- snippets;
- source URLs;
- provider-specific metadata.

A provider does not determine:

- whether the organization is a buyer, competitor, supplier, or partner;
- whether its business model is compatible;
- whether it has procurement autonomy;
- whether it is excluded by the campaign;
- its final fit, potential, or confidence score.

### 4.4 Provider records are evidence, not truth

Every provider record is an attributed source claim. It may be incomplete, stale, duplicated, or wrong.

Opptium must preserve:

- provider;
- provider record ID where available;
- original query or filter;
- raw payload;
- retrieval time;
- result rank;
- source URL;
- normalization confidence.

The canonical company entity is created above the provider layer.

### 4.5 Discovery is coverage-driven, not iteration-driven

There must be no product rule such as “run five discovery iterations.”

A new pass is justified only by a specific reason, for example:

- one geography has insufficient coverage;
- one priority archetype has low unique yield;
- local-language searches have not been attempted;
- a specialist directory may cover a missing segment;
- the current candidate pool is too concentrated in one company type;
- the user requests broader coverage;
- qualification yield indicates that the initial interpretation was too broad or too narrow.

### 4.6 Broad discovery and deep research are separate

Discovery should initially collect enough information to identify probable organizations and suppress obvious noise. It should not perform expensive deep research on every raw result.

The intended funnel is:

> source results → provider source records → normalized provider candidates → preliminary entity grouping → cheap prefilter → deep research only for plausible candidates

### 4.7 Unknown provider capabilities must not become false filters

If a provider cannot filter by business model, purchasing model, or commercial relationship, the adapter must not pretend that it can.

Unsupported constraints should be recorded and handled later through:

- web-query wording;
- additional providers;
- candidate research;
- qualification.

### 4.8 Discovery must preserve campaign memory

Every pass must know:

- previous queries and filters;
- previously found candidates;
- failed sources;
- low-yield approaches;
- user corrections;
- active coverage gaps;
- the current remaining budget.

The system must not repeatedly rediscover the same market without learning from earlier passes.

### 4.9 Discovery output must be auditable

A reviewer must be able to trace any candidate back to:

- the campaign strategy version;
- the discovery segment;
- the provider;
- the provider execution;
- the original source result;
- the normalization and preliminary matching decisions.

### 4.10 Provider choice must be replaceable and testable

Provider routing should be driven by capabilities and policy rather than hard-coded conditionals scattered through the application.

---

## 5. Shared Terminology

### Discovery plan

A versioned set of semantic discovery segments, provider routing instructions, coverage targets, budgets, and stopping policies compiled from a Campaign Strategy.

### Discovery segment

A coherent portion of the target market defined by:

- buyer archetype;
- geography;
- target relationship;
- commercial characteristics;
- positive and negative signals;
- priority;
- desired coverage.

### Provider

An adapter capable of finding or enriching organizations from a source such as web search, a structured database, a registry, maps, or an industry directory.

### Provider capability

A declared filter, retrieval, geography, language, freshness, pagination, or enrichment capability.

### Provider execution

One concrete search, query, filter request, page retrieval, or provider call made for a segment.

### Provider source record

The immutable record of what a provider returned before Opptium canonicalization.

### Normalized provider candidate

A minimal provider-independent representation extracted from one source record so that records can be compared, grouped, and passed to entity resolution.

### Coverage

An estimate of how thoroughly one archetype/geography segment has been searched and represented by unique plausible organizations.

Coverage is not merely a raw candidate count.

### Yield

The useful output produced by a segment or provider relative to calls, time, cost, and raw results.

### Gap

A specific deficiency in market coverage, source diversity, candidate diversity, or qualified yield that may justify another discovery action.

### Discovery pass

A bounded group of provider executions intended to improve one or more defined gaps.

### Stopping decision

A recorded decision that discovery should stop because targets are satisfied, additional yield is too low, the market appears exhausted, or a budget/time constraint has been reached.

---

## 6. Discovery Inputs

Discovery may start only from a confirmed and immutable `CampaignStrategyVersion`.

The discovery planner receives at least:

- workspace ID;
- campaign ID;
- campaign strategy version ID;
- selected company profile version ID;
- selected offering version ID;
- campaign objective;
- target relationship types;
- geographies;
- target archetypes and priorities;
- incompatible archetypes;
- positive signals;
- negative signals;
- hard exclusion rules;
- qualification-factor definitions relevant to discovery;
- market terminology;
- supported languages;
- source suggestions from the strategy;
- coverage target;
- candidate-volume target if provided;
- campaign budget and time limits;
- applicable campaign memory;
- previously discovered and suppressed entities if the campaign is resumed.

Discovery must not use stale profile or strategy state that changed after the run began.

---

## 7. Semantic Discovery Segments

### 7.1 Why segments are required

A single campaign-level query is too broad and makes coverage impossible to reason about.

For example, a campaign seeking buyers for industrial automation software may have several distinct target archetypes:

- large manufacturers with internal automation teams;
- systems integrators;
- regional distributors;
- logistics operators with complex warehouses.

Each archetype has different terminology, sources, evidence signals, and exclusions.

A discovery segment makes those differences explicit.

### 7.2 Segment boundaries

A segment should normally represent one combination of:

- target archetype;
- country or meaningful region;
- relationship type;
- source strategy where materially different;
- language context where materially different.

Do not create one segment per search query. Queries are children of segments.

Do not create excessively broad segments such as “all B2B companies in Europe.”

Do not create excessively narrow segments that can reasonably be covered by one shared search plan.

### 7.3 Segment contract

```ts
type DiscoverySegmentStatus =
  | "draft"
  | "ready"
  | "running"
  | "paused"
  | "coverage_insufficient"
  | "coverage_sufficient"
  | "exhausted"
  | "stopped_budget"
  | "stopped_user"
  | "failed";

type DiscoverySegment = {
  id: string;
  workspaceId: string;
  campaignId: string;
  campaignStrategyVersionId: string;

  archetypeId: string;
  archetypeVersion?: number;
  label: string;
  description: string;

  targetRelationshipTypes: Array<
    | "direct_buyer"
    | "channel_partner"
    | "reseller"
    | "distributor"
    | "integration_partner"
    | "supplier"
    | "strategic_partner"
    | "other"
  >;

  geography: {
    countries: string[];
    regions?: string[];
    localities?: string[];
    excludeCountries?: string[];
  };

  languages: string[];
  localMarketTerms: string[];

  companyCharacteristics: {
    valueChainRoles?: string[];
    businessModels?: string[];
    industries?: string[];
    productOrServiceCategories?: string[];
    customerTypes?: string[];
    size?: {
      minEmployees?: number;
      maxEmployees?: number;
      sizeBands?: string[];
    };
    ownershipTypes?: string[];
    operatingModels?: string[];
    procurementCharacteristics?: string[];
  };

  positiveSignals: DiscoverySignal[];
  negativeSignals: DiscoverySignal[];
  hardExclusionRuleIds: string[];

  seedTerms: string[];
  seedCompanies?: string[];
  sourceHints?: string[];

  priority: "critical" | "high" | "normal" | "exploratory";

  targets: {
    desiredUniqueCandidates?: number;
    minimumPlausibleCandidates?: number;
    minimumSourceDiversity?: number;
    desiredCoverageConfidence?: number;
  };

  budget: {
    maxProviderCalls?: number;
    maxEstimatedCostMinor?: number;
    maxRuntimeSeconds?: number;
  };

  status: DiscoverySegmentStatus;
  createdAt: string;
  updatedAt: string;
};

type DiscoverySignal = {
  key: string;
  statement: string;
  importance: "required" | "strong" | "supporting" | "weak";
  evidenceExamples?: string[];
};
```

### 7.4 Provider-independent characteristics

`companyCharacteristics` describes the desired company in business terms. It must not contain provider-specific filter syntax.

Good:

```json
{
  "businessModels": ["multi-brand retailer", "off-price retailer"],
  "productOrServiceCategories": ["branded apparel"],
  "procurementCharacteristics": ["purchases inventory for resale"]
}
```

Bad:

```json
{
  "apolloIndustryIds": ["123"],
  "tavilyQueries": ["..."],
  "pdlSql": "..."
}
```

### 7.5 Segment examples across business models

#### B2B SaaS

```text
Archetype: Mid-market logistics operators with in-house dispatch teams
Geography: Germany
Positive signals: Own fleet, multi-location operations, route-planning complexity
Negative signals: Pure freight marketplace, very small operator
Relationship: Direct buyer
```

#### Industrial manufacturer

```text
Archetype: Regional distributors serving food-processing factories
Geography: Poland
Positive signals: Represents several equipment brands, industrial service capability
Negative signals: Manufacturer of competing equipment
Relationship: Distributor
```

#### Professional services

```text
Archetype: Growing regulated businesses lacking an internal compliance team
Geography: Nordics
Positive signals: Recent expansion, regulatory exposure, hiring for compliance
Negative signals: Large mature internal compliance department
Relationship: Direct buyer
```

#### Wholesale

```text
Archetype: Independent retailers capable of purchasing external inventory for resale
Geography: Baltic states
Positive signals: Multi-brand assortment, outlet or discount model, external brand sourcing
Negative signals: Brand-owned store, competing wholesaler, local-design-only concept
Relationship: Direct buyer
```

These examples illustrate the abstraction; no industry-specific wording should be hard-coded in the platform.

---

## 8. Discovery Plan

### 8.1 Plan purpose

The Discovery Plan is the execution-ready interpretation of a Campaign Strategy.

It contains:

- semantic segments;
- provider roles;
- provider routing rules;
- initial pass design;
- coverage targets;
- campaign-level budgets;
- gap-analysis policy;
- stopping policy;
- plan version and provenance.

### 8.2 Plan contract

```ts
type DiscoveryPlan = {
  id: string;
  version: number;
  workspaceId: string;
  campaignId: string;
  campaignStrategyVersionId: string;

  segments: DiscoverySegment[];
  sourcePlan: SourcePlan;

  campaignTargets: {
    desiredUniqueCandidates?: number;
    desiredQualifiedCandidates?: number;
    desiredReviewCandidates?: number;
    desiredCoverageConfidence?: number;
  };

  budget: {
    maxProviderCalls?: number;
    maxEstimatedCostMinor?: number;
    maxRuntimeSeconds?: number;
    maxDeepResearchCandidates?: number;
  };

  stoppingPolicy: DiscoveryStoppingPolicy;
  gapPolicy: DiscoveryGapPolicy;

  status:
    | "draft"
    | "confirmed"
    | "running"
    | "paused"
    | "completed"
    | "cancelled"
    | "failed";

  generatedByModel?: string;
  generatedByPromptVersion?: string;
  createdAt: string;
};
```

### 8.3 Plan versioning

If the user changes:

- offering;
- objective;
- geography;
- target archetypes;
- campaign exclusions;
- qualification interpretation;

Opptium must publish a new Campaign Strategy version and then compile a new Discovery Plan version.

Existing provider records remain linked to the plan under which they were found. They may be reused only after explicit compatibility checks.

---

## 9. Source Plan and Provider Roles

### 9.1 Provider roles

A source plan may assign providers to three roles.

#### Primary discovery provider

Used to enumerate the initial candidate universe for a segment.

Examples:

- web search in the initial implementation;
- PDL for conventional B2B companies later;
- maps for local-location businesses;
- a trade directory for specialist industries.

#### Supporting discovery provider

Used to improve coverage or fill gaps that the primary provider misses.

#### Verification provider

Used primarily to validate identity, status, legal existence, or commercial evidence after candidate discovery.

The same provider may play different roles in different campaigns.

### 9.2 Initial source plan

Until a company database API is integrated, the default plan is:

```json
{
  "primaryProviders": ["web_search"],
  "supportingProviders": [],
  "verificationProviders": ["company_website"]
}
```

This is a valid production configuration, not a temporary bypass.

### 9.3 Future source plans

A conventional enterprise SaaS campaign may later use:

```json
{
  "primaryProviders": ["pdl"],
  "supportingProviders": ["web_search"],
  "verificationProviders": ["company_website", "registry"]
}
```

A local-business campaign may use:

```json
{
  "primaryProviders": ["maps", "web_search"],
  "supportingProviders": ["registry"],
  "verificationProviders": ["company_website"]
}
```

### 9.4 Source plan contract

```ts
type SourcePlan = {
  primaryProviders: ProviderAssignment[];
  supportingProviders: ProviderAssignment[];
  verificationProviders: ProviderAssignment[];
};

type ProviderAssignment = {
  providerId: string;
  segmentIds?: string[];
  role: "primary" | "supporting" | "verification";
  priority: number;
  maxCalls?: number;
  maxEstimatedCostMinor?: number;
  conditions?: ProviderUseCondition[];
};

type ProviderUseCondition = {
  type:
    | "always"
    | "coverage_below"
    | "unique_yield_below"
    | "geography_matches"
    | "archetype_matches"
    | "manual_only";
  value?: unknown;
};
```

---

## 10. Provider Architecture

### 10.1 Provider families

Providers may support one or more families of capability:

- company discovery;
- company enrichment;
- contact discovery;
- legal verification;
- location discovery;
- news, funding, jobs, or intent signals;
- website content retrieval.

Document 03 focuses on company discovery. Contact discovery should remain downstream of company qualification unless a campaign explicitly requires another flow.

### 10.2 Base discovery-provider interface

```ts
interface CompanyDiscoveryProvider {
  readonly id: string;
  readonly version: string;

  getCapabilities(): Promise<DiscoveryProviderCapabilities>;

  estimate(request: ProviderDiscoveryRequest): Promise<ProviderDiscoveryEstimate>;

  search(request: ProviderDiscoveryRequest): Promise<ProviderDiscoveryResponse>;
}
```

### 10.3 Provider request

```ts
type ProviderDiscoveryRequest = {
  workspaceId: string;
  campaignId: string;
  discoveryPlanId: string;
  segment: DiscoverySegment;

  cursor?: string;
  pageSize?: number;

  executionContext: {
    passNumber: number;
    gapId?: string;
    previousExecutionIds: string[];
    excludedCanonicalKeys: string[];
    previousQueryFingerprints: string[];
  };

  budget: {
    maxResults?: number;
    maxCalls?: number;
    maxEstimatedCostMinor?: number;
    deadlineAt?: string;
  };
};
```

The provider receives semantic segment information plus execution context. It is responsible for translating that request into provider-specific queries or filters.

### 10.4 Capability declaration

```ts
type DiscoveryProviderCapabilities = {
  providerId: string;
  providerVersion: string;

  sourceTypes: Array<
    | "web_search"
    | "company_database"
    | "registry"
    | "maps"
    | "industry_directory"
    | "marketplace"
    | "funding"
    | "jobs"
    | "news"
  >;

  supports: {
    countryFilter: boolean;
    regionFilter: boolean;
    localityFilter: boolean;
    languageTargeting: boolean;
    industryFilter: boolean;
    keywordFilter: boolean;
    companySizeFilter: boolean;
    employeeRangeFilter: boolean;
    revenueRangeFilter: boolean;
    technologyFilter: boolean;
    businessModelFilter: boolean;
    ownershipFilter: boolean;
    jobSignalFilter: boolean;
    fundingSignalFilter: boolean;
    pagination: boolean;
    totalCountEstimate: boolean;
    recordFreshness: boolean;
  };

  supportedCountries?: string[];
  supportedLanguages?: string[];
  maximumPageSize?: number;
  rateLimit?: {
    calls: number;
    periodSeconds: number;
  };

  costModel?: {
    type: "free" | "per_call" | "per_record" | "credit" | "unknown";
    estimatedMinorPerCall?: number;
    estimatedMinorPerRecord?: number;
  };
};
```

### 10.5 Estimate contract

```ts
type ProviderDiscoveryEstimate = {
  providerId: string;
  supported: boolean;
  unsupportedConstraints: string[];
  estimatedCalls?: number;
  estimatedRecords?: number;
  estimatedCostMinor?: number;
  estimatedRuntimeSeconds?: number;
  warnings: string[];
};
```

The system should not require every provider to return perfect estimates. Unknown values are acceptable and must remain explicit.

### 10.6 Provider response

```ts
type ProviderDiscoveryResponse = {
  providerId: string;
  executionId: string;
  records: ProviderSourceRecordInput[];
  nextCursor?: string;
  exhausted: boolean;

  usage: {
    calls: number;
    recordsReturned: number;
    estimatedCostMinor?: number;
    runtimeMs: number;
  };

  warnings: string[];
  errors: ProviderExecutionError[];
};
```

### 10.7 Provider registry

Provider implementations must be registered centrally:

```ts
type ProviderRegistry = Record<string, CompanyDiscoveryProvider>;
```

Business logic should resolve providers through the registry. It must not import individual adapters directly throughout the campaign code.

---

## 11. Provider Source Records

### 11.1 Immutable raw record

Each returned result becomes an immutable source record before normalization.

```ts
type ProviderSourceRecord = {
  id: string;
  workspaceId: string;
  campaignId: string;
  discoveryPlanId: string;
  discoverySegmentId: string;
  providerExecutionId: string;

  providerId: string;
  providerVersion: string;
  providerRecordId?: string;

  sourceType: string;
  sourceUrl?: string;
  resultRank?: number;
  queryOrFilterFingerprint: string;

  rawPayload: Record<string, unknown>;
  rawPayloadHash: string;

  retrievedAt: string;
  providerPublishedAt?: string;
  providerUpdatedAt?: string;

  ingestionStatus: "received" | "normalized" | "suppressed" | "failed_normalization";
};
```

### 11.2 Why raw records are retained

Raw source records allow Opptium to:

- re-run normalization without calling the provider again;
- audit provider inaccuracies;
- improve entity resolution later;
- compare provider coverage;
- trace candidate provenance;
- avoid paying twice for the same returned record;
- migrate mappings when a provider schema changes.

### 11.3 Source-record deduplication

Identical provider records may be suppressed using:

- provider ID + provider record ID;
- canonical source URL;
- raw payload hash;
- query fingerprint + result URL;

Suppression must not delete provenance. It should point duplicate source records to the retained record.

---

## 12. Normalized Provider Candidates

### 12.1 Purpose

A normalized provider candidate is a minimal, source-independent representation used before full entity resolution.

It is not yet the canonical external company.

### 12.2 Contract

```ts
type NormalizedProviderCandidate = {
  id: string;
  sourceRecordId: string;
  providerId: string;

  name: string;
  normalizedName?: string;

  websiteUrl?: string;
  canonicalDomainHint?: string;
  sourceUrl?: string;

  country?: string;
  region?: string;
  locality?: string;

  description?: string;
  industries?: string[];
  keywords?: string[];
  employeeCount?: number;

  organizationTypeHint?:
    | "company"
    | "brand"
    | "branch"
    | "storefront"
    | "legal_entity"
    | "directory_listing"
    | "marketplace_seller"
    | "unknown";

  matchedSegmentId: string;
  matchedArchetypeId: string;
  matchedSignals: string[];

  preliminaryQuality: {
    likelyOperatingOrganization: boolean | null;
    likelyTargetGeography: boolean | null;
    hasUsableIdentity: boolean;
    confidence: number;
  };

  createdAt: string;
};
```

### 12.3 Normalization rules

Provider adapters should normalize only fields directly available or safely inferred from the returned record.

They must not perform final commercial evaluation.

Examples:

- converting `https://www.example.com/about` to `example.com` is permitted;
- inferring country from an explicit provider field is permitted;
- marking “directory page” based on the provider result type may be permitted;
- declaring “competitor” based only on an industry label is not permitted;
- assigning a final fit score is not permitted.

### 12.4 Snippet limitations

Search snippets are weak and sometimes generated from stale or unrelated page text.

Snippet-derived claims must be marked as low-confidence source hints and later verified through page or website evidence where material.

---

## 13. WebSearchProvider

### 13.1 Role in the first implementation

`WebSearchProvider` is the initial enabled company-discovery provider.

It must be implemented as a provider adapter, not as campaign logic.

Its responsibilities are:

- translating semantic segments into web query plans;
- generating localized and source-targeted queries;
- checking campaign query memory;
- executing searches within a budget;
- ingesting search results as immutable provider source records;
- normalizing basic candidate identity hints;
- reporting usage, warnings, and exhaustion;
- avoiding repeated equivalent searches.

It must not:

- assign final candidate fit;
- create permanent company entities directly;
- assume that every search result is an organization;
- deep-scrape every website during broad discovery;
- use a fixed number of iterations.

### 13.2 Query-plan generation

For each segment, the provider generates several query families. It should choose only relevant families.

#### Archetype queries

Use business-type terminology corresponding to the target archetype.

```text
"industrial equipment distributor" Lithuania
```

#### Business-model queries

Use terms that indicate how the company operates.

```text
"multi-brand retailer" Latvia
"managed service provider" Estonia
```

#### Offering or use-context queries

Use terminology related to the buyer’s activity rather than only the seller’s offering.

```text
warehouse operators route planning Germany
```

#### Positive-signal queries

Search for explicit evidence such as:

- “authorized reseller”;
- “outlet”;
- “multiple locations”;
- “serves manufacturers”;
- “implementation partner”;
- “fleet of”;
- “wholesale.”

#### Directory and association queries

Search:

- trade associations;
- member lists;
- exhibitor lists;
- partner directories;
- local business directories;
- sector-specific marketplaces;
- chamber-of-commerce pages.

These results may contain list pages rather than direct company pages. They should be classified and later expanded through a dedicated directory extraction path rather than treated as a single candidate.

#### Local-language queries

Generate equivalent searches in relevant market languages when likely to improve coverage.

Local-language generation must preserve commercial meaning rather than translate terms literally when local market terminology differs.

#### Known-entity expansion queries

When a high-quality candidate or known market entity is found, use controlled expansion such as:

- similar companies;
- partner pages;
- brand stockists;
- distributor lists;
- association memberships;
- local competitors;
- portfolio or customer pages.

Expansion must be tied to a recorded gap. It must not become unrestricted browsing.

#### Exclusion-aware queries

Negative terms may be used where search providers support them, but exclusions should not rely only on query syntax. Many search engines handle negative terms inconsistently.

### 13.3 Query object

```ts
type WebDiscoveryQuery = {
  id: string;
  campaignId: string;
  discoverySegmentId: string;
  providerExecutionId?: string;

  query: string;
  normalizedQuery: string;
  fingerprint: string;

  family:
    | "archetype"
    | "business_model"
    | "positive_signal"
    | "use_context"
    | "directory"
    | "local_language"
    | "known_entity_expansion"
    | "gap_targeted";

  language: string;
  country?: string;
  domains?: string[];
  excludedDomains?: string[];

  purpose: string;
  expectedGapId?: string;
  priority: number;

  status:
    | "planned"
    | "running"
    | "completed"
    | "failed"
    | "skipped_duplicate"
    | "skipped_budget";
};
```

### 13.4 Query quality rules

A generated query must:

- target one clear discovery purpose;
- include relevant geography where necessary;
- use local terminology where useful;
- avoid unnecessarily long natural-language sentences;
- avoid repeating equivalent terms across many queries;
- avoid placing all ICP details into one brittle query;
- distinguish company discovery from article or list discovery;
- retain a reason for execution;
- have a deterministic fingerprint for deduplication.

The provider should reject or rewrite queries that are:

- semantically equivalent to completed queries;
- too broad to identify operating organizations;
- dominated by the seller’s own terminology instead of buyer terminology;
- likely to return consumer products rather than companies;
- inconsistent with the campaign strategy;
- unsupported by the target language or geography.

### 13.5 Query generation model task

The query-generation model should receive:

- one discovery segment;
- relevant campaign memory;
- completed query summaries;
- current coverage gap;
- provider constraints;
- maximum query count;
- examples of good and bad query forms.

It should return typed JSON and must not decide qualification.

### 13.6 Search execution

Queries should run in bounded parallel batches.

The batch controller must respect:

- provider rate limits;
- campaign call budget;
- segment call budget;
- global worker concurrency;
- cancellation state;
- deduplication fingerprints;
- remaining deadline.

### 13.7 Result-type classification

Search results should receive a preliminary source-page type:

```ts
type WebResultPageType =
  | "company_homepage"
  | "company_subpage"
  | "directory_list"
  | "association_member_list"
  | "marketplace_listing"
  | "registry_record"
  | "news_article"
  | "social_profile"
  | "map_listing"
  | "document"
  | "unknown";
```

A directory list is not itself one company candidate. It may create a follow-up extraction task that yields several source records.

### 13.8 Domain extraction

The provider may derive a canonical-domain hint by:

- removing protocol;
- removing `www`;
- removing paths and query parameters;
- normalizing internationalized domains;
- rejecting known search, social, and directory domains as canonical company domains;
- preserving source URL separately.

Domain hints remain provisional until Document 04 entity resolution.

### 13.9 Lightweight page inspection

Where a search result is ambiguous, the web provider may perform a lightweight page inspection to extract:

- page title;
- organization name;
- canonical URL;
- declared country or locality;
- basic description;
- whether the page is a directory or operating-company site.

This should be limited and budgeted. Deep commercial research belongs downstream.

### 13.10 Failure handling

The provider should classify failures such as:

- timeout;
- rate limit;
- blocked result;
- invalid URL;
- empty result;
- malformed provider response;
- duplicate query;
- unsupported language;
- extraction failure.

A failed query should not automatically trigger unlimited retries or model-generated rewrites.

---

## 14. Future Structured Database Providers

### 14.1 Integration principle

A future database provider receives the same `DiscoverySegment` and maps supported characteristics to provider filters.

For example:

```text
Semantic segment
→ location filter
→ industry filters
→ employee range
→ keyword filters
→ pagination
→ provider records
→ normalized provider candidates
```

The provider must list constraints it could not represent.

### 14.2 Adapter responsibilities

A database adapter must:

- declare capabilities;
- map semantic fields to provider-specific filters;
- paginate safely;
- preserve raw records;
- normalize identity hints;
- track credits or per-record cost;
- preserve provider timestamps where available;
- record unsupported constraints;
- never treat database classification as final commercial truth.

### 14.3 Unsupported semantic conditions

Conditions such as:

- “buys previous-season inventory”;
- “has independent procurement authority”;
- “uses the product internally rather than reselling it”;
- “is likely open to external implementation partners”

may not exist as database filters.

The adapter should still return a broad candidate pool based on available structured proxies. Later website research and qualification resolve the commercial conditions.

### 14.4 Adding a provider later

Adding PDL, Apollo, Coresignal, or another provider should require:

1. implementing the provider interface;
2. mapping segment fields to supported filters;
3. mapping responses to source records and normalized candidates;
4. registering capabilities;
5. defining source-plan routing conditions;
6. adding provider secrets and rate limits;
7. adding cost accounting;
8. benchmarking coverage and precision;
9. adding provider-specific tests.

It should not require:

- rewriting profile intelligence;
- rewriting campaign strategy;
- changing candidate qualification contracts;
- changing score calculation;
- changing the final results UI.

### 14.5 Discovery versus enrichment

Some providers support both company search and company enrichment.

These must remain separate operations:

- discovery finds candidate records based on a segment;
- enrichment retrieves more structured information for a known company identity.

The same adapter package may implement both, but the task contracts and cost accounting must remain distinct.

---

## 15. Provider Routing

### 15.1 Routing inputs

Provider selection may consider:

- target geography;
- target archetype;
- business-model type;
- company-size expectations;
- provider coverage;
- provider capabilities;
- configured credentials;
- cost limits;
- prior yield in similar segments;
- source diversity requirements;
- campaign urgency;
- user preferences or restrictions.

### 15.2 Routing output

For each segment, the router returns an ordered provider plan:

```ts
type SegmentProviderRoute = {
  segmentId: string;
  providers: Array<{
    providerId: string;
    role: "primary" | "supporting" | "verification";
    priority: number;
    reasons: string[];
    unsupportedConstraints: string[];
    activationCondition?: ProviderUseCondition;
  }>;
};
```

### 15.3 Initial routing policy

With only web search configured:

- route every discovery segment to `web_search`;
- vary query strategy by archetype, geography, language, and source hints;
- use `company_website` later for verification and research;
- record that structured-database constraints were unavailable rather than pretending the source plan was complete.

### 15.4 Future adaptive routing

Provider routing may later learn from measured performance, but it should begin with explicit rules and benchmark data.

Avoid opaque autonomous provider selection before reliable provider-level metrics exist.

---

## 16. Discovery Execution Flow

### 16.1 Stage A — Initialize plan

1. Load immutable Campaign Strategy version.
2. Load applicable campaign memory.
3. Validate discovery segments.
4. Resolve configured providers and capabilities.
5. Compile segment provider routes.
6. create the initial coverage matrix.
7. reserve campaign and segment budgets.

### 16.2 Stage B — Initial breadth pass

For each high-priority segment:

1. generate provider-specific query/filter plans;
2. execute bounded calls in parallel;
3. persist raw source records;
4. normalize provider candidates;
5. suppress exact duplicate source records;
6. produce preliminary candidate identity keys;
7. update segment metrics.

Critical and high-priority segments should run before exploratory segments when budget is limited.

### 16.3 Stage C — Preliminary normalization and prefilter

Before deep research:

- remove invalid URLs;
- classify obvious non-company pages;
- suppress exact domain duplicates;
- group identical provider IDs;
- suppress known campaign exclusions where deterministic;
- preserve possible parent/brand/storefront relationships for Document 04;
- avoid expensive evaluation of clearly unusable records.

### 16.4 Stage D — Coverage snapshot

Compute coverage and yield by:

- archetype;
- country or region;
- provider;
- source type;
- language;
- query family.

### 16.5 Stage E — Gap analysis

Determine whether another action is justified.

Possible actions:

- run local-language searches;
- search a specialist directory;
- expand from known high-quality companies;
- narrow a noisy archetype;
- broaden an overly restrictive segment;
- search one missing geography;
- activate a supporting provider;
- stop the segment;
- request user input if a strategy assumption is blocking progress.

### 16.6 Stage F — Targeted pass

Run only the actions selected by gap analysis.

Each targeted pass must reference:

- one or more gap IDs;
- expected improvement;
- maximum call budget;
- stopping criteria.

### 16.7 Stage G — Finalize discovery

Discovery finalization records:

- final coverage snapshot;
- stopping reason per segment;
- campaign-level stopping reason;
- provider usage;
- total raw and unique records;
- unresolved gaps;
- candidate handoff status;
- reusable campaign findings.

---

## 17. Parallelism and Batching

Discovery should run independent segments and queries in parallel where safe.

Parallelism must be bounded by:

- provider rate limits;
- Trigger.dev concurrency;
- campaign budget;
- workspace plan limits;
- database write capacity;
- cancellation state.

Recommended pattern:

```text
Campaign discovery coordinator
├── Segment A execution
│   ├── Query batch A1
│   └── Query batch A2
├── Segment B execution
│   ├── Query batch B1
│   └── Query batch B2
└── Segment C execution
    └── Query batch C1
```

Do not serialize every web query unless required by the provider.

Do not launch all possible queries at once before early yield can be inspected.

Use bounded batches so later calls can adapt to initial results.

---

## 18. Preliminary Deduplication Before Entity Resolution

Full entity resolution belongs to Document 04, but discovery must prevent obvious duplicate work.

### 18.1 Temporary identity keys

Generate preliminary keys from:

- provider + provider record ID;
- canonical-domain hint;
- normalized legal or trading name + country;
- canonical source URL;
- known social or registry ID;
- normalized name + locality where no domain exists.

### 18.2 Duplicate levels

Discovery should distinguish:

- exact source duplicate;
- probable same domain;
- probable same organization;
- possible parent/subsidiary relation;
- possible brand/storefront relation;
- unresolved.

Only exact duplicates should be automatically collapsed at this stage. More complex cases must be handed to entity resolution with evidence.

### 18.3 Why early suppression matters

It prevents:

- repeated page retrieval;
- repeated LLM preclassification;
- inflated candidate counts;
- distorted coverage metrics;
- duplicate credit consumption.

---

## 19. Coverage Model

### 19.1 Coverage is multidimensional

Coverage cannot be represented by one number such as “391 candidates discovered.”

At minimum, coverage should be tracked by:

- target archetype;
- geography;
- provider;
- language;
- source family;
- unique probable organizations;
- plausible-candidate yield;
- source diversity;
- evidence or identity quality.

### 19.2 Coverage cell

A coverage cell represents one archetype/geography combination.

```ts
type DiscoveryCoverageCell = {
  campaignId: string;
  discoverySegmentId: string;
  archetypeId: string;
  geographyKey: string;

  providerCalls: number;
  queriesExecuted: number;
  rawRecords: number;
  normalizedCandidates: number;
  uniqueCandidateHints: number;
  plausibleCandidateCount?: number;
  qualifiedCandidateCount?: number;

  duplicateRate?: number;
  invalidRecordRate?: number;
  uniqueYieldPerCall?: number;
  plausibleYieldPerCall?: number;

  sourceDiversityCount: number;
  languagesAttempted: string[];

  confidence: number;
  status:
    | "not_started"
    | "insufficient"
    | "developing"
    | "sufficient"
    | "exhausted"
    | "blocked";

  reasons: string[];
  updatedAt: string;
};
```

### 19.3 Coverage confidence

Coverage confidence should consider:

- number of distinct relevant query families attempted;
- local-language coverage;
- source diversity;
- unique yield trend;
- duplicate rate;
- invalid-result rate;
- whether known benchmark companies were found;
- whether major market categories are represented;
- whether recent calls produce new plausible organizations.

It must not be an arbitrary LLM feeling. A model may explain market gaps, but the confidence should be grounded in explicit metrics and rules.

### 19.4 Known-market anchors

Where available, known representative companies or manually supplied seed companies can act as coverage anchors.

Failure to find known anchors may indicate:

- poor query terminology;
- weak provider coverage;
- an entity-resolution issue;
- an overly restrictive segment.

Known anchors should not be automatically qualified; they are coverage diagnostics.

---

## 20. Gap-Driven Iteration

### 20.1 No fixed iteration count

A “pass number” is operational metadata, not a product goal.

The system may stop after one strong pass or continue through several targeted passes. It must always preserve the reason.

### 20.2 Gap object

```ts
type DiscoveryGap = {
  id: string;
  campaignId: string;
  discoverySegmentId?: string;

  type:
    | "geography_undercovered"
    | "archetype_undercovered"
    | "language_not_attempted"
    | "source_diversity_low"
    | "unique_yield_low"
    | "plausible_yield_low"
    | "known_anchor_missing"
    | "candidate_mix_unbalanced"
    | "provider_failure"
    | "strategy_ambiguity"
    | "other";

  description: string;
  supportingMetrics: Record<string, number | string | boolean | null>;
  severity: "critical" | "high" | "normal" | "low";

  recommendedActions: DiscoveryGapAction[];
  status: "open" | "addressing" | "resolved" | "accepted" | "blocked";
};
```

### 20.3 Gap action

```ts
type DiscoveryGapAction = {
  type:
    | "run_new_queries"
    | "translate_queries"
    | "activate_provider"
    | "expand_directory"
    | "expand_from_seed"
    | "broaden_segment"
    | "narrow_segment"
    | "request_user_clarification"
    | "stop_segment";

  reason: string;
  expectedImprovement: string;
  maxCalls?: number;
  maxEstimatedCostMinor?: number;
};
```

### 20.4 Gap-analysis rules

Another pass is justified only when:

- the gap is material to the campaign objective;
- a concrete action exists;
- the action has reasonable expected yield;
- sufficient budget remains;
- the action does not repeat completed equivalent work;
- the campaign has not already met its target.

### 20.5 Example

Bad iteration decision:

```text
Iteration 4: Discover more companies.
```

Good iteration decision:

```text
Gap: Estonia has only one unique plausible candidate in the priority distributor archetype.
Action: Run Estonian-language distributor and trade-association queries.
Budget: Four web-search calls.
Stop after: Two new plausible organizations or marginal unique yield below 0.5 per call.
```

---

## 21. Stopping Conditions

### 21.1 Campaign stopping policy

```ts
type DiscoveryStoppingPolicy = {
  stopWhenAny?: Array<
    | "target_review_candidates_reached"
    | "target_qualified_candidates_reached"
    | "budget_exhausted"
    | "deadline_reached"
    | "user_cancelled"
    | "fatal_provider_failure"
  >;

  stopWhenAll?: Array<
    "priority_segments_sufficient" | "marginal_yield_low" | "no_actionable_gaps"
  >;

  marginalYieldWindowCalls?: number;
  minimumUniqueYieldPerCall?: number;
  minimumPlausibleYieldPerCall?: number;
  maximumConsecutiveLowYieldPasses?: number;
};
```

### 21.2 Segment stopping reasons

A segment may stop because:

- its coverage target is satisfied;
- sufficient plausible candidates were found;
- qualified yield is sufficient;
- recent calls produce mostly duplicates;
- recent calls produce mostly invalid or incompatible records;
- all relevant query families and languages have been attempted;
- the market appears small or exhausted;
- no suitable provider is available;
- budget or time is exhausted;
- the user stops or changes the campaign.

### 21.3 Small markets

The system must not assume that every campaign should produce hundreds of companies.

A small specialist market may be complete with 15 organizations. A broad horizontal market may still be undercovered with 500.

Stopping logic must use market structure, archetype coverage, and marginal yield—not a universal count.

### 21.4 Discovery target versus commercial target

A campaign may request 50 approved leads, but discovery may need a larger candidate universe.

The discovery planner should estimate a funnel based on expected qualification yield while remaining transparent that this is an estimate.

---

## 22. Cost, Time, and Yield Tracking

### 22.1 Why it matters

The current pipeline can spend substantial time processing duplicates and weak candidates. Intelligence V2 must identify where time and credits are consumed.

### 22.2 Usage dimensions

Track per provider execution:

- provider calls;
- raw records returned;
- normalized records;
- unique candidate hints;
- duplicate records;
- invalid records;
- plausible records after prefilter;
- runtime;
- provider cost;
- LLM query-generation cost;
- lightweight page-inspection cost;
- retries;
- errors.

### 22.3 Yield metrics

Useful metrics include:

```text
unique candidates / provider call
plausible candidates / provider call
qualified candidates / provider call
provider cost / unique candidate
provider cost / plausible candidate
provider cost / qualified candidate
runtime / qualified candidate
duplicate rate
invalid-result rate
```

Qualified yield may only become available later. Discovery metrics should be updated retrospectively when candidate evaluation completes.

### 22.4 Do not optimize raw count

A provider returning 1,000 records is not necessarily better than one returning 100 records.

Provider quality must be evaluated by downstream usefulness, not volume alone.

---

## 23. Discovery Memory

### 23.1 Working memory

Current campaign discovery memory should include:

- completed query fingerprints;
- provider filters already executed;
- failed and blocked sources;
- high- and low-yield query families;
- candidate identity keys already seen;
- current coverage matrix;
- open gaps;
- accepted stopping decisions;
- user corrections affecting discovery;
- temporary market terminology learned during the run.

### 23.2 Durable campaign findings

After the run, preserve concise findings such as:

- one archetype was much smaller than expected;
- local-language queries materially improved coverage;
- a particular directory produced high-quality candidates;
- one provider repeatedly returned duplicates;
- a market uses different terminology from the profile hypothesis.

These remain campaign-scoped by default. They may later be proposed for offering-level or workspace-level promotion under the rules defined in Document 02.

### 23.3 Do not store opaque chain-of-thought

Store auditable conclusions and action rationales, not hidden model reasoning.

Good:

```text
Finding: English-language searches underrepresented Polish regional distributors.
Action: Add Polish-language trade-directory queries for the remaining distributor gap.
```

Bad:

```text
The model thought extensively and felt another search might help.
```

---

## 24. Discovery State Machine

### 24.1 Campaign discovery states

```text
draft
→ planning
→ ready
→ running_initial_pass
→ normalizing
→ measuring_coverage
→ gap_analysis
→ running_targeted_pass
→ finalizing
→ completed
```

Alternative terminal states:

```text
paused
cancelled
failed
stopped_budget
stopped_user
```

### 24.2 Segment states

```text
draft
→ ready
→ running
→ coverage_insufficient
→ running
→ coverage_sufficient
```

Or:

```text
running
→ exhausted
running
→ blocked
running
→ failed
```

### 24.3 State-transition rules

- a plan cannot run before strategy confirmation;
- a segment cannot run without a provider route;
- gap analysis cannot use incomplete persisted execution metrics;
- targeted passes require at least one open gap;
- completed segments are not reopened without a recorded reason;
- changing the Campaign Strategy creates a new plan version rather than mutating historical execution.

---

## 25. Preliminary Persistence Model

Document 06 will define the full migration. Discovery requires at least these logical tables.

### `discovery_plans`

Stores versioned plan metadata and campaign-level policy.

### `discovery_segments`

Stores semantic segments and coverage targets.

### `discovery_source_plans`

Stores provider assignments and activation conditions.

### `discovery_provider_capability_snapshots`

Stores the provider capabilities used when the plan was compiled.

### `discovery_runs`

Stores campaign-level execution state, budgets, totals, and stopping reason.

### `discovery_segment_runs`

Stores pass-level and segment-level execution state.

### `discovery_provider_executions`

Stores each provider call or bounded provider batch.

### `discovery_queries`

Stores web queries or another provider’s human-readable filter summary, fingerprints, and purpose.

### `provider_source_records`

Stores immutable raw provider results.

### `normalized_provider_candidates`

Stores the provider-independent normalized representation.

### `discovery_candidate_groups`

Stores preliminary duplicate grouping before canonical entity resolution.

### `discovery_coverage_snapshots`

Stores metrics by segment, geography, provider, and pass.

### `discovery_gaps`

Stores identified deficiencies and recommended actions.

### `discovery_gap_actions`

Stores selected targeted-pass actions and outcomes.

### `discovery_usage_events`

Stores provider, LLM, fetch, runtime, and estimated cost usage.

### `campaign_memories`

Stores discovery findings and user corrections under the scoped memory model defined in Document 02.

---

## 26. Trigger.dev Task Boundaries

Exact orchestration belongs to Document 06, but discovery should use tasks similar to:

```text
discovery.compilePlan
discovery.resolveProviderRoutes
discovery.initializeRun

discovery.prepareSegment
discovery.generateProviderRequests
discovery.executeProviderRequest
discovery.ingestSourceRecords
discovery.normalizeSourceRecords
discovery.preliminaryDeduplicate

discovery.calculateCoverage
discovery.detectGaps
discovery.selectGapActions
discovery.runTargetedPass

discovery.finalizeSegment
discovery.finalizeRun
```

Provider-specific tasks may exist internally:

```text
provider.web.generateQueries
provider.web.search
provider.web.inspectResult
provider.pdl.search
provider.apollo.search
```

Campaign orchestration should call the provider abstraction rather than depending directly on these task names.

---

## 27. Idempotency and Replay Requirements

Discovery tasks must be safe to retry.

Recommended idempotency keys:

```text
compile plan:
  campaignStrategyVersionId + plannerVersion

provider execution:
  discoverySegmentId + providerId + requestFingerprint

source record:
  providerId + providerRecordId
  or providerId + sourceUrl + payloadHash

coverage snapshot:
  discoveryRunId + passNumber + segmentId

gap action:
  gapId + actionFingerprint
```

Replaying normalization or coverage calculations must not call the external provider again.

Provider calls should only repeat when:

- the previous call definitively failed before returning usable data;
- the retry policy allows it;
- the request has not already consumed non-refundable provider credits without persisted output;
- the user explicitly requests refresh.

---

## 28. Error Handling

### 28.1 Error categories

- provider authentication failure;
- provider quota exhausted;
- rate limit;
- timeout;
- malformed response;
- no results;
- normalization failure;
- duplicate-only result set;
- unsupported geography;
- unsupported filter;
- invalid query plan;
- campaign cancelled;
- stale strategy version;
- persistence failure.

### 28.2 Recovery policy

- transient provider errors may retry with backoff;
- authentication and quota errors should pause affected provider routes;
- one provider failure should not fail the campaign when alternatives exist;
- normalization failures should retain raw records for later replay;
- repeated low-yield results should trigger gap analysis, not blind retries;
- stale strategy versions must stop the run rather than silently continue with mixed logic.

### 28.3 Partial completion

A discovery run may complete with unresolved gaps if:

- budget is exhausted;
- providers are unavailable;
- the market is too small;
- the user chooses to proceed;
- remaining gaps are low priority.

The final result must state those gaps explicitly.

---

## 29. Observability and Progress Reporting

### 29.1 Internal observability

Log and trace:

- campaign, strategy, plan, segment, and execution IDs;
- provider request fingerprints;
- model and prompt versions;
- source-record counts;
- normalization outcomes;
- duplicate groups;
- coverage snapshots;
- gap decisions;
- usage and runtime;
- stopping reasons.

### 29.2 User-facing progress

The UI should communicate meaningful stages rather than opaque iteration numbers.

Good:

```text
Planning Baltic distributor and retailer segments
Searching Latvia and Lithuania in parallel
Normalizing 126 source records
Resolving obvious duplicates
Coverage sufficient for Latvia; Estonia needs another targeted pass
Searching Estonian-language industry sources
Discovery complete: 42 unique organizations ready for deeper research
```

Bad:

```text
Iteration 3 of 5
Thinking...
```

### 29.3 Progress counts

Counts should use clearly named stages:

- raw source results;
- normalized source records;
- probable organizations;
- unique entities after resolution;
- candidates sent to deep research;
- candidates evaluated;
- qualified candidates;
- ready for review.

These counts must reconcile mathematically or explain why records may belong to several groups.

---

## 30. Privacy, Security, and Data Handling

- provider credentials must remain server-side;
- raw provider payload access should be workspace-scoped;
- source records must not leak between workspaces;
- provider terms and permitted retention must be reviewed before integration;
- contact/person data is outside the default company-discovery stage;
- raw payload retention should support provider-specific deletion or expiration policies;
- sensitive or restricted source content must not be used without a lawful and permitted basis;
- the system must preserve public source URLs and retrieval dates for auditability.

---

## 31. Quality Validation

### 31.1 Unit tests

Test:

- segment validation;
- provider capability mapping;
- provider request fingerprints;
- query deduplication;
- domain hint normalization;
- source-record idempotency;
- budget enforcement;
- coverage calculations;
- stopping-policy rules;
- gap-action deduplication.

### 31.2 Provider contract tests

Every provider adapter must pass the same contract suite:

- returns declared provider ID and version;
- reports unsupported constraints;
- preserves raw payload;
- normalizes required fields safely;
- reports usage;
- paginates correctly where supported;
- respects budget and cancellation;
- produces stable fingerprints;
- does not assign final fit or eligibility.

### 31.3 Scenario tests

Use representative campaigns across:

- horizontal B2B SaaS;
- industrial manufacturing;
- wholesale and distribution;
- professional services;
- local physical businesses;
- niche technical sectors;
- partnership discovery.

Evaluate whether segments, queries, and coverage logic reflect each market rather than reusing one generic search style.

### 31.4 Web-provider benchmark

For each benchmark campaign, measure:

- known-company recall;
- unique organizations per query;
- duplicate rate;
- invalid-page rate;
- local-language contribution;
- source diversity;
- downstream top-candidate precision;
- cost and runtime per plausible candidate.

### 31.5 Future provider benchmark

Before choosing a structured database as the primary provider, compare it against the same benchmark set.

Measure:

- recall of known companies;
- geography and small-company coverage;
- entity and domain accuracy;
- parent-company quality;
- record freshness;
- cost per useful organization;
- permitted product use;
- incremental value over web search.

Provider marketing record counts are not sufficient evidence.

---

## 32. Migration From the Current Pipeline

### 32.1 Preserve useful infrastructure

Retain where possible:

- existing web-search API integration;
- Trigger.dev execution infrastructure;
- search response persistence;
- campaign progress events;
- website fetch utilities;
- reusable result-table components;
- existing cancellation and retry utilities.

### 32.2 Replace current assumptions

Refactor away from:

- campaign-level raw query arrays as the discovery plan;
- fixed five-iteration loops;
- direct writes from search results into final candidate tables;
- holistic evaluation of every raw result;
- counts that mix raw, unique, evaluated, and qualified records;
- provider-specific fields in campaign logic;
- repeated research of duplicate domains;
- discovery prompts that reinterpret the company offering independently.

### 32.3 Migration sequence

1. Introduce semantic `DiscoverySegment` contracts.
2. Wrap the existing web search integration in `WebSearchProvider`.
3. Add immutable provider source records.
4. Add normalized provider candidates.
5. Add query fingerprints and campaign query memory.
6. Add preliminary duplicate suppression.
7. Add coverage snapshots.
8. Replace fixed iterations with gap analysis and stopping rules.
9. Integrate Document 04 entity resolution.
10. Integrate Document 05 qualification feedback into yield metrics.
11. Remove legacy discovery paths after benchmark approval.

### 32.4 Feature flag

Run Intelligence V2 under a feature flag until benchmark campaigns show improved:

- top-result precision;
- duplicate control;
- runtime;
- provider cost;
- coverage transparency;
- scoring consistency downstream.

---

## 33. Implementation Phases

### Phase 1 — Contracts and persistence

Implement:

- discovery plans;
- semantic segments;
- provider interfaces;
- source records;
- normalized candidates;
- query fingerprints;
- basic usage tracking.

### Phase 2 — WebSearchProvider

Implement:

- segment-to-query planning;
- local-language query generation;
- query-family classification;
- bounded parallel execution;
- result-type classification;
- lightweight identity extraction;
- source-record persistence.

### Phase 3 — Coverage and gap logic

Implement:

- coverage matrix;
- yield metrics;
- open-gap detection;
- targeted query generation;
- stopping decisions;
- meaningful progress reporting.

### Phase 4 — Entity-resolution handoff

Implement:

- preliminary candidate grouping;
- canonical identity handoff;
- duplicate-safe deep-research queueing;
- retrospective metric updates.

### Phase 5 — Future provider readiness

Implement:

- provider registry administration;
- capability snapshots;
- provider routing rules;
- configuration UI or internal config;
- contract test harness;
- benchmark harness.

No external database integration is required to complete Phases 1–4.

---

## 34. Acceptance Criteria

Document 03 is implemented successfully when:

1. discovery starts from a confirmed Campaign Strategy version;
2. every campaign is decomposed into semantic discovery segments;
3. no downstream intelligence depends on web-search-specific fields;
4. the current web integration runs through `WebSearchProvider`;
5. every provider result is stored as an immutable source record;
6. normalized candidates preserve source provenance;
7. query fingerprints prevent equivalent repeated searches;
8. discovery tracks coverage by archetype and geography;
9. additional passes require explicit gaps and expected improvement;
10. fixed iteration counts are removed from product logic;
11. stopping decisions are recorded and explainable;
12. raw, normalized, unique, researched, evaluated, and qualified counts are distinct;
13. provider cost, runtime, duplicate rate, and useful yield are measurable;
14. campaign discovery memory prevents repeated low-value work;
15. adding a future company database requires only a new provider adapter, routing policy, configuration, and tests;
16. candidate qualification remains independent from the source that discovered the company;
17. benchmark campaigns demonstrate that discovery is at least as complete as the legacy path while producing fewer duplicates and clearer coverage.

---

## 35. Locked Decisions

The following decisions are fixed for Intelligence V2 unless deliberately revised through product architecture review:

- Opptium launches Intelligence V2 with web search as the first enabled discovery provider.
- Web search must be behind a provider abstraction from the first implementation.
- Campaign Strategy produces semantic discovery segments, not provider query strings.
- Search strings and database filters belong inside provider adapters.
- Provider source records are retained separately from canonical companies.
- Providers do not assign final commercial fit.
- Discovery is coverage-driven and gap-driven.
- There is no fixed discovery iteration count.
- Broad discovery, entity resolution, deep research, and qualification are separate stages.
- Discovery memory is campaign-scoped by default.
- Provider performance is judged by downstream useful yield, not raw record volume.
- Structured databases may become primary sources for some campaign types later, but they will complement rather than replace web-based commercial verification.
- Company contacts are generally discovered only after company qualification.
- The architecture must permit adding PDL, Apollo, Coresignal, registries, maps, and specialist sources without another intelligence-core refactor.

---

## 36. Handoff to the Next Documents

Document 04 must consume:

- provider source records;
- normalized provider candidates;
- preliminary duplicate groups;
- source provenance;
- discovery segment and archetype references.

It will define how Opptium resolves those records into canonical external organizations, legal entities, brands, branches, country storefronts, parent groups, and actual buying organizations.

Document 05 will then evaluate resolved candidate organizations against the immutable Campaign Strategy using evidence-based relationship classification, eligibility, fit, commercial potential, confidence, deterministic scoring, and comparative ranking.
