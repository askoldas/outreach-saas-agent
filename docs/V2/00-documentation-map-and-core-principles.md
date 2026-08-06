# Opptium Intelligence V2

## Documentation Map, System Boundaries, and Core Principles

**Document:** 00  
**Status:** Foundation specification  
**Purpose:** Define the complete documentation set, shared terminology, architectural boundaries, and non-negotiable principles for the Opptium Intelligence V2 refactor.

---

## 1. Why Intelligence V2 Exists

The current Opptium pipeline can discover real companies, collect website information, classify candidates, and present results. However, testing exposed a fundamental problem: the system can spend significant time discovering and evaluating companies while still ranking them according to superficial category similarity instead of actual commercial compatibility.

The core product must therefore move from:

> website summary → generic search queries → many candidates → holistic AI score

To:

> company understanding → offering-specific commercial logic → market-specific campaign strategy → segmented discovery → entity resolution → evidence-based qualification → comparative ranking

This is not a complete rewrite of Opptium. Existing infrastructure such as authentication, workspaces, Supabase, Trigger.dev, search integrations, progress handling, reusable UI components, campaigns, leads, and results views can remain. The refactor is focused on the intelligence contracts, commercial reasoning, discovery planning, candidate evaluation, scoped memory, and provider abstraction.

---

## 2. Product Definition

Opptium is an AI-led B2B commercial intelligence and outbound preparation system.

Its primary responsibility is not merely to find companies. It must determine:

- what the user’s company actually sells;
- how that company makes money;
- what conditions make an organization a plausible buyer, partner, reseller, distributor, supplier, or competitor;
- how those conditions change by offering, objective, geography, and campaign;
- what evidence supports or contradicts a candidate’s commercial relevance;
- which companies should be prioritized for review and later contact discovery.

Search APIs, databases, registries, maps, directories, and company websites are replaceable sources. Opptium’s durable value is the intelligence layer that interprets those sources.

---

## 3. Core Intelligence Layers

Intelligence V2 is divided into six connected layers.

### 3.1 Company Intelligence

A structured commercial model of the user’s company and workspace.

It includes:

- company identity and value-chain position;
- business model and revenue mechanics;
- structured offerings;
- customer and buyer logic;
- partner, supplier, distributor, reseller, and competitor relationships;
- reusable buyer hypotheses;
- confirmed facts, evidence-backed inferences, hypotheses, unknowns, and user corrections.

Company Intelligence is created during profile onboarding and evolves through controlled user feedback.

### 3.2 Campaign Strategy

A versioned, market-specific commercial policy compiled from:

- Company Intelligence;
- selected offering;
- campaign objective;
- target geography;
- user adjustments;
- applicable memory and exclusions.

It defines:

- priority buyer archetypes;
- conditional buyer archetypes;
- incompatible archetypes;
- qualification factors;
- hard exclusions;
- positive and negative evidence signals;
- discovery segments;
- source plan;
- stopping and coverage criteria.

Discovery must not begin until a campaign strategy version exists.

### 3.3 Discovery Intelligence

A coverage-driven process that finds candidate organizations by archetype, geography, and source capability.

Discovery does not decide final fit. It creates and expands a candidate universe while tracking:

- segments searched;
- queries and filters already used;
- sources attempted;
- candidates found;
- duplicates and merged entities;
- market gaps;
- qualified yield;
- remaining budget and stopping conditions.

### 3.4 Candidate Intelligence

A reusable understanding of an external organization plus a campaign-specific evaluation.

Reusable candidate knowledge includes:

- identity;
- domains;
- legal entities;
- brands and branches;
- parent organization;
- locations;
- business model;
- products and services;
- public evidence and freshness.

Campaign-specific evaluation includes:

- relationship to the user’s offering;
- eligibility;
- fit;
- commercial potential;
- confidence;
- matched buyer archetype;
- positive and negative evidence;
- missing evidence;
- exclusion reason where applicable.

### 3.5 Memory and Learning

Opptium uses structured, scoped commercial memory rather than a single opaque agent history.

Memory may belong to:

- a user;
- a workspace/company;
- an offering;
- a campaign;
- a candidate;
- an active workflow run.

Memory records must preserve scope, applicability, origin, confidence, status, and whether they are confirmed or provisional.

### 3.6 Provider Layer

Discovery sources are interchangeable adapters.

Initial implementation uses web search as the only enabled discovery provider. Later providers may include:

- People Data Labs;
- Apollo;
- Coresignal;
- national company registries;
- maps providers;
- industry directories;
- funding, jobs, and news sources.

Providers produce candidate source records. They do not define campaign logic and do not assign final qualification scores.

---

## 4. Documentation Set

The specification is intentionally split into smaller files. Each file should remain independently readable while using the shared principles and terminology defined here.

### Document 00 — Documentation Map, System Boundaries, and Core Principles

This file.

Defines:

- purpose of Intelligence V2;
- system layers;
- shared terminology;
- locked principles;
- boundaries between intelligence, infrastructure, and providers;
- complete documentation map.

### Document 01 — Company Intelligence and Profile Creation

Will define:

- company ingestion;
- factual extraction;
- business-model synthesis;
- offering decomposition;
- commercial mechanics;
- buyer hypotheses;
- clarification-question generation;
- profile confirmation flow;
- profile versioning;
- claims, evidence, confidence, and provenance;
- profile-level and offering-level exclusions.

### Document 02 — Campaign Strategy and Scoped Memory

Will define:

- campaign creation flow;
- geography-first setup;
- objective and offering selection;
- AI-proposed target strategy;
- buyer archetypes;
- qualification rubric;
- exclusion scopes;
- campaign memory;
- provisional learning;
- conflict resolution;
- promotion of campaign knowledge to offering or company scope;
- immutable campaign strategy versions.

### Document 03 — Discovery Architecture and Provider Abstraction

Will define:

- semantic discovery segments;
- provider-independent contracts;
- WebSearchProvider implementation;
- future database adapters;
- source plans;
- parallel segmented discovery;
- coverage tracking;
- gap-driven iterations;
- stopping conditions;
- source provenance;
- cost and yield tracking.

### Document 04 — Entity Resolution and Candidate Intelligence

Will define:

- provider source records;
- canonical external companies;
- domain normalization;
- parent companies;
- legal entities;
- brands, branches, and localized storefronts;
- buying organizations;
- duplicate detection and merging;
- reusable candidate facts;
- campaign-specific candidate state.

### Document 05 — Qualification, Scoring, and Comparative Ranking

Will define:

- relationship classification;
- hard exclusions;
- eligibility states;
- evaluation factors;
- evidence extraction;
- unknown versus negative evidence;
- deterministic scoring;
- fit, potential, and confidence separation;
- comparative reranking;
- consistency checks;
- explanation requirements.

### Document 06 — Workflow Orchestration, Tasks, and Data Model

Will define:

- Trigger.dev task graph;
- idempotency and retries;
- version-aware execution;
- Supabase tables and relationships;
- schemas and TypeScript contracts;
- run state;
- model-role configuration;
- auditability;
- event and progress reporting.

### Document 07 — Product Flows and Interface Requirements

Will define:

- Company Profile UI;
- campaign creation flow;
- strategy confirmation;
- discovery progress;
- review queues;
- compact results table;
- expanded candidate evidence;
- exclusion and scope controls;
- correction and memory promotion UX;
- user-facing terminology.

### Document 08 — Validation, Benchmarks, Migration, and Rollout

Will define:

- benchmark campaign suite;
- expected metrics;
- top-10 precision;
- recall;
- competitor and supplier exclusion accuracy;
- duplicate rate;
- confidence calibration;
- cost and time per qualified company;
- Intelligence V2 feature flag;
- legacy coexistence;
- migration phases;
- removal criteria for the legacy pipeline.

---

## 5. Shared Terminology

### Workspace Company

The user’s own company represented by the Company Profile. A workspace may later support multiple companies, but Intelligence V2 operates against one active workspace company at a time.

### Offering

A materially distinct product, service, supply category, commercial package, or partnership proposition. Offerings are separated when they require meaningfully different buyers, triggers, procurement logic, qualification rules, or decision-makers.

### Campaign Objective

The commercial relationship the campaign intends to create, such as:

- direct buyer;
- distributor;
- reseller;
- channel partner;
- integration partner;
- supplier;
- pilot customer;
- strategic account;
- another explicitly defined objective.

The same external organization may be excluded for one objective and relevant for another.

### Buyer Archetype

A structured hypothesis describing a class of organizations likely to have compatible commercial needs and purchasing behavior for a specific offering and campaign objective.

An archetype is not simply an industry label. It contains business-model, procurement, capability, scale, and evidence expectations.

### Discovery Segment

A provider-independent search unit derived from one buyer archetype, geography, and source strategy.

### Provider Source Record

The raw or normalized record returned by a discovery source, such as a web result, PDL company, Apollo organization, registry entry, or directory listing.

### Canonical Candidate Company

Opptium’s normalized representation of an external organization after entity resolution. Multiple provider records, domains, branches, or storefronts may map to one canonical company or buying organization.

### Relationship

The candidate’s likely commercial role relative to the current offering and objective:

- probable buyer;
- possible buyer;
- partner;
- reseller;
- distributor;
- supplier;
- competitor;
- irrelevant adjacent company;
- unknown.

Relationship must be classified before scoring.

### Eligibility

Whether the candidate may continue through the current campaign:

- eligible;
- requires research;
- excluded;
- rejected;
- invalid entity;
- duplicate or merged.

### Fit

How compatible the candidate is with the offering, buyer archetype, and campaign objective.

### Commercial Potential

The likely account value or strategic importance if the relationship is valid.

### Confidence

How strongly available evidence supports the relationship and evaluation. Confidence is separate from fit.

### Evidence

A source-backed observation used to support or contradict a claim. Evidence should include source, retrieval time, excerpt or structured value, freshness, and reliability.

### Claim

A structured statement about the workspace company, offering, campaign, or candidate. A claim has status, confidence, provenance, and evidence references.

### Memory

A structured record of a fact, preference, correction, exclusion, strategy pattern, or provisional lesson that may be retrieved in a defined scope.

### Campaign Iteration

A targeted discovery or research pass executed because the system identified a specific coverage gap, unresolved uncertainty, or high-value segment. A blind repeated search is not a valid iteration.

---

## 6. Non-Negotiable Product Principles

### 6.1 Commercial compatibility is more important than category similarity

A candidate must be evaluated according to whether it can plausibly buy, use, resell, distribute, integrate, or partner around the selected offering. Industry and keyword similarity are only supporting signals.

### 6.2 The company profile is a commercial knowledge model

The profile is not marketing copy. It must explain how the workspace company makes money, what each offering requires from a buyer, and which relationships are commercially possible.

### 6.3 Campaign strategy precedes discovery

Discovery must not start until the system has compiled a versioned strategy defining:

- objective;
- offering;
- geography;
- buyer archetypes;
- evidence expectations;
- exclusions;
- qualification factors;
- source plan.

### 6.4 Discovery sources do not define the ICP

Web search, Apollo, PDL, Coresignal, registries, and directories are candidate sources. Provider filters must not replace Opptium’s commercial reasoning.

### 6.5 Web-search-first must remain provider-independent

The first Intelligence V2 release may use only web search. However, all discovery tasks must operate on semantic segments and provider contracts so database providers can be added later without another core refactor.

### 6.6 Evidence precedes scoring

Models extract facts, classify evidence, and explain conclusions. Scores are derived from structured factor records and deterministic application code.

### 6.7 Hard exclusions occur before scoring

A confirmed competitor, invalid entity, duplicate, or incompatible relationship should be excluded with a reason. It should not receive an arbitrary reduced fit score.

### 6.8 Unknown is not negative

Missing evidence reduces confidence. It must not automatically be treated as proof that a capability, need, or procurement condition is absent.

### 6.9 Fit, potential, and confidence remain separate

One combined score hides important differences. The user must be able to distinguish a strong but small buyer from a high-value but uncertain account.

### 6.10 Memory is scoped and controlled

A campaign-level exclusion or correction does not automatically become global. Profile-level rules are broader, offering rules apply only to that offering, and provisional campaign lessons may be suggested for promotion later.

### 6.11 Specific context overrides broad context

When valid rules conflict, the more specific applicable rule wins. A campaign exception may override an offering or workspace rule without deleting it.

### 6.12 User-confirmed knowledge outranks AI inference

Explicit user decisions take precedence over inferred or provisional intelligence. AI-generated permanent rules require user confirmation.

### 6.13 Every conclusion must be auditable

The system must preserve:

- strategy version;
- model and prompt version;
- provider source;
- evidence;
- factor evaluation;
- score calculation;
- user corrections;
- entity merges;
- task history.

### 6.14 Discovery iterations must learn

Each pass must use campaign memory, previous queries, coverage, candidate yield, and corrections. Repeating near-identical broad searches is a pipeline failure.

### 6.15 Contact enrichment follows company qualification

People and contact discovery should usually begin only after a company is approved or reaches a defined qualification threshold.

### 6.16 The system must work across business models

No architecture, prompt, or schema may assume that every workspace company is SaaS, every target is a direct buyer, or every transaction follows the same sales motion.

---

## 7. System Boundaries

### Intelligence layer responsibilities

The intelligence layer owns:

- commercial interpretation;
- claims and evidence;
- buyer hypotheses;
- campaign strategy;
- relationship classification;
- exclusions and applicability;
- qualification factors;
- memory retrieval and promotion proposals;
- coverage and gap reasoning;
- comparative ranking.

### Provider layer responsibilities

The provider layer owns:

- translating discovery segments into provider-specific queries or filters;
- executing provider requests;
- pagination and rate limits;
- returning source records;
- preserving provider provenance;
- reporting capabilities, costs, and failures.

Providers must not assign final campaign fit.

### Workflow layer responsibilities

The workflow layer owns:

- task scheduling;
- retries;
- idempotency;
- concurrency;
- progress events;
- budgets;
- stopping conditions;
- version consistency;
- error recovery.

Workflow orchestration must not contain hidden commercial rules.

### Application code responsibilities

Application code owns:

- schema validation;
- deterministic score calculation;
- rule precedence;
- state transitions;
- access control;
- database persistence;
- provider registration;
- UI data shaping.

### Model responsibilities

AI models may:

- extract and synthesize facts;
- generate buyer hypotheses;
- propose clarification questions;
- compile campaign strategy drafts;
- classify evidence;
- detect contradictions;
- compare candidates;
- identify coverage gaps.

AI models must not:

- silently promote provisional rules to global rules;
- assign unsupported holistic scores;
- treat missing evidence as confirmed negative evidence;
- merge entities without preserved reasoning and confidence;
- override explicit user-confirmed facts;
- invent source evidence.

---

## 8. High-Level End-to-End Flow

```text
Workspace website and materials
        ↓
Company fact extraction
        ↓
Business model and offering intelligence
        ↓
High-impact clarification and user confirmation
        ↓
Versioned Company Intelligence
        ↓
Geography + objective + offering selection
        ↓
Market interpretation and campaign strategy draft
        ↓
User confirmation and campaign-specific adjustments
        ↓
Immutable Campaign Strategy Version
        ↓
Semantic discovery segments and source plan
        ↓
Web search provider now; database providers later
        ↓
Provider source records
        ↓
Entity resolution and canonical candidate companies
        ↓
Cheap prefilter and relationship classification
        ↓
Campaign-specific web research and evidence extraction
        ↓
Eligibility, fit, potential, and confidence
        ↓
Comparative reranking and consistency checks
        ↓
Coverage analysis and targeted gap discovery
        ↓
Ready for review
        ↓
User corrections and scoped memory proposals
        ↓
Contact discovery and outbound preparation
```

---

## 9. Refactor Strategy

Intelligence V2 should be implemented behind a feature flag and coexist temporarily with the current pipeline.

```text
Existing Opptium infrastructure
        ├── Legacy intelligence workflow
        └── Intelligence V2 workflow
```

The V2 path should be tested against benchmark campaigns before replacing the legacy flow.

Implementation should proceed in this order:

1. shared schemas and intelligence contracts;
2. Company Intelligence and profile confirmation;
3. Campaign Strategy compiler and scoped memory;
4. provider-independent discovery segments;
5. WebSearchProvider adapter;
6. entity resolution;
7. evidence-based candidate evaluation;
8. deterministic scoring;
9. coverage-driven discovery;
10. comparative ranking;
11. benchmark suite and side-by-side validation;
12. legacy migration and removal.

---

## 10. Definition of Success

Intelligence V2 is successful when Opptium can consistently:

- understand materially different business models and offerings;
- explain why a target type would buy;
- separate buyers from competitors, suppliers, partners, and adjacent companies;
- generate market-specific campaign strategies before discovery;
- discover candidates through web search without hardcoding the system to web search;
- add structured database providers later without changing downstream intelligence;
- preserve campaign memory across iterations;
- apply exclusions only in their correct scope;
- show evidence for qualification decisions;
- rank candidates according to commercial compatibility rather than visual or category similarity;
- improve through user corrections without overgeneralizing them.

---

## 11. Locked Decisions from the Design Discussion

The following decisions are considered accepted foundations for all later documents:

1. Company Profile becomes structured Company Intelligence.
2. Every materially distinct offering has its own commercial logic.
3. Campaign creation begins with geography, then confirms offering and target hypothesis.
4. Campaign objective is explicit and affects relationships and exclusions.
5. Discovery starts only after strategy confirmation.
6. Fixed blind iteration counts are replaced by coverage-driven passes.
7. Current-campaign memory is required.
8. Exclusions and corrections are scope-aware.
9. Campaign rules remain campaign-scoped by default unless confirmed or promoted.
10. Web search remains the first discovery provider.
11. Discovery architecture is provider-independent from the first V2 implementation.
12. Structured databases can be wired later through adapters.
13. Company websites and public evidence remain important for business-model understanding even after database integration.
14. Contacts are enriched after company qualification.
15. Evidence factors are extracted before deterministic scoring.
16. Relationship and eligibility are separate from fit.
17. Fit, commercial potential, and confidence remain separate values.
18. Candidate comparison is performed after individual evidence extraction.
19. User feedback creates immediate campaign changes and possible broader learning proposals.
20. Intelligence V2 is a serious core refactor, not a complete application rewrite.

---

## 12. Next Document

The next specification should be:

**01-company-intelligence-and-profile-creation.md**

It will define the complete Company Intelligence schema, onboarding workflow, offering model, commercial reasoning process, clarification logic, evidence handling, profile memory, exclusions, and confirmation UI requirements.
