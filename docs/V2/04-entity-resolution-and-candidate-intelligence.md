# Opptium Intelligence V2

## Entity Resolution and Candidate Intelligence

**Document:** 04  
**Status:** Implementation specification  
**Depends on:** `00-documentation-map-and-core-principles.md`, `01-company-intelligence-and-profile-creation.md`, `02-campaign-strategy-and-scoped-memory.md`, `03-discovery-architecture-and-provider-abstraction.md`  
**Purpose:** Define how Opptium converts provider source records and normalized discovery candidates into canonical external organizations, organization graphs, actual buying organizations, reusable Candidate Intelligence, and campaign-specific candidate records without leaking campaign assumptions into reusable company facts.

---

## 1. Purpose

Discovery providers return records, pages, listings, database rows, domains, brands, branches, storefronts, and legal entities. These records are not automatically separate companies and are not automatically the organizations that make purchasing decisions.

Entity Resolution and Candidate Intelligence must answer:

- does this record represent a real operating organization;
- is it a company, legal entity, brand, branch, location, storefront, marketplace seller, directory page, or another entity type;
- have we already seen the same organization through another source, domain, country site, alias, or campaign;
- which legal entity or parent group controls it;
- whether several records belong to one commercial organization;
- whether several locations share one buying organization or buy independently;
- which facts are reusable across campaigns;
- which conclusions are specific to the current campaign;
- what remains unknown and requires research;
- how every merge, split, link, and conclusion can be audited and reversed.

The layer must move from:

> one search result = one company = one lead

To:

> provider records → identity evidence → canonical organization graph → buying-organization hypothesis → reusable candidate intelligence → campaign-specific candidate state

This document is critical because poor entity resolution creates several downstream failures at once:

- duplicate companies consume research and model budget;
- localized domains appear as separate leads;
- brands are confused with legal entities;
- competitors and suppliers are evaluated as buyers;
- store branches are treated as independent accounts;
- local subsidiaries are contacted even when purchasing is centralized elsewhere;
- directory pages and marketplaces enter the review queue;
- corrections made to one duplicate do not propagate to its related records;
- fit scores become impossible to interpret because the scored object is unclear.

---

## 2. Desired Outcome

For every discovered candidate, Opptium should be able to explain:

1. which provider records and web pages produced the candidate;
2. what entity each record appears to represent;
3. which canonical external organization the record maps to;
4. whether the record is a legal entity, brand, branch, storefront, or parent group;
5. which domains, names, identifiers, and locations support that mapping;
6. whether the candidate already existed in another campaign;
7. which organization likely controls commercial purchasing;
8. whether purchasing is local, regional, group-level, franchise-level, or unknown;
9. which reusable facts are confirmed or inferred;
10. which facts are current enough to use;
11. what campaign-specific research is still required;
12. whether any merge or split decision is uncertain;
13. how the user can correct the organization structure without losing provenance.

A completed Entity Resolution and Candidate Intelligence stage should produce:

- immutable links from provider source records to resolution decisions;
- canonical external organization records;
- normalized aliases and domains;
- organization-type classification;
- legal-entity, brand, branch, parent, and location relationships;
- a buying-organization hypothesis with confidence;
- reversible merge and split history;
- reusable claims and evidence about the external organization;
- a campaign candidate linked to the exact Campaign Strategy version;
- campaign-specific research questions;
- clear handoff states for qualification in Document 05.

---

## 3. Scope

This document defines:

- canonical external organization identity;
- entity types and organization graphs;
- domain, name, legal identifier, address, and location normalization;
- exact and probabilistic entity matching;
- parent, subsidiary, branch, brand, storefront, franchise, and marketplace relationships;
- buying-organization resolution;
- duplicate grouping, merge, split, and alias handling;
- reusable Candidate Intelligence;
- campaign-specific candidate state;
- evidence and provenance boundaries;
- candidate research planning and evidence collection;
- candidate memory boundaries;
- state transitions;
- preliminary persistence model;
- TypeScript contracts;
- Trigger.dev task boundaries;
- idempotency, concurrency, auditability, privacy, and multi-tenant boundaries;
- validation, benchmarks, implementation phases, and acceptance criteria.

This document does not fully define:

- campaign qualification factor semantics;
- final relationship classification;
- deterministic score calculation;
- fit, potential, and confidence formulas;
- comparative reranking;
- the final complete Supabase migration;
- the complete user interface.

Those are covered in Documents 05–07.

---

## 4. Non-Negotiable Design Rules

### 4.1 Provider records are not canonical companies

A search result, Apollo organization, PDL row, registry entry, map listing, or directory page is a source record. It may represent:

- a real company;
- one legal entity within a group;
- a consumer-facing brand;
- a country storefront;
- a branch or shop location;
- a franchisee;
- a marketplace seller;
- an outdated company;
- a duplicate;
- a non-company page.

No provider record may be exposed as a qualified company until it passes entity resolution.

### 4.2 The canonical organization is source-independent

The canonical external organization belongs to Opptium’s data model, not to Tavily, PDL, Apollo, Coresignal, a registry, or a domain.

Provider-specific IDs and fields must remain in source-link records.

### 4.3 Legal entity, operating organization, brand, and buying organization are different concepts

One record may describe a legal entity, another the brand customers recognize, and another the regional procurement organization.

The system must not force all of these into one flat `company` row.

### 4.4 The buying organization is campaign-relevant but not always campaign-specific

The organization that purchases may be:

- the local company;
- a regional headquarters;
- a parent group;
- a franchisee;
- a category-specific procurement unit;
- an external distributor;
- unknown.

The underlying organization graph is reusable. The relevance of a particular buying unit depends on the offering and campaign objective.

### 4.5 Merges must be reversible

A mistaken merge can corrupt every future campaign. Every merge must preserve:

- original entity IDs;
- source links;
- decision reason;
- identity signals;
- actor or model version;
- timestamp;
- reversible lineage.

Physical deletion is not an acceptable merge strategy.

### 4.6 Uncertainty must remain explicit

When two records may represent the same company but evidence is insufficient, the system must use `possible_match` or `needs_review` rather than silently merging.

### 4.7 Reusable facts must not contain campaign conclusions

Reusable Candidate Intelligence may state:

- what the company does;
- where it operates;
- who owns it;
- which brands it carries;
- whether it appears to buy centrally.

It must not permanently state:

- “bad lead”;
- “not relevant”;
- “perfect customer”;
- “exclude globally”;

unless that conclusion is explicitly scoped, confirmed, and stored as memory according to Document 02.

### 4.8 Candidate fit is recalculated per campaign

The same organization can be:

- a direct buyer in one campaign;
- a partner in another;
- a competitor in a third;
- irrelevant for a different offering.

Entity identity is reusable. Campaign fit is not.

### 4.9 Source provenance is permanent

Every material fact and identity link must be traceable to source records, fetched pages, authoritative identifiers, user input, or explicit inference.

### 4.10 The organization graph must support future providers

The entity model cannot assume that identity comes only from websites. It must support:

- legal identifiers;
- company database IDs;
- domains;
- addresses;
- social profiles;
- parent-child relationships;
- registry data;
- map locations;
- brands and trade names.

### 4.11 Buying autonomy cannot be inferred from country presence alone

A localized website, local office, or local legal entity does not prove local procurement authority.

### 4.12 Entity-level invalidity is separate from commercial exclusion

A directory page or duplicate is invalid as a candidate entity. A real competitor is a valid entity but may be commercially excluded for the current objective.

### 4.13 Shared data must not leak private workspace knowledge

System-level organization identity and public evidence may be reused internally. Workspace corrections, notes, contact restrictions, and commercial conclusions remain tenant-scoped unless deliberately promoted into a safe shared fact.

---

## 5. Shared Terminology

### Provider source record

An immutable record returned by a discovery or enrichment provider, defined in Document 03.

### Normalized provider candidate

A minimal source-independent identity hint derived from one provider source record before canonical resolution.

### External organization

A canonical organization node in Opptium’s system. It may represent a company, group, brand, branch, storefront, franchisee, institution, or another operating entity.

### Legal entity

A registered organization with a legal identifier, jurisdiction, and status.

### Operating organization

The commercial unit that actually performs business activity. It may map one-to-one, one-to-many, or many-to-one with legal entities.

### Brand

A commercial identity under which products or services are marketed. A brand may not be a separate legal entity.

### Parent organization

An organization that owns or controls another organization.

### Subsidiary

A legally or operationally controlled organization below a parent.

### Branch

A non-independent operating location or unit belonging to another organization.

### Storefront

A consumer-facing physical or digital sales presence. A storefront may be a branch, country site, franchise, marketplace shop, or independent company.

### Franchise network

A brand system in which local operating companies may be independently owned while following shared commercial standards.

### Buying organization

The organization or procurement unit likely to make or control purchases relevant to an offering.

### Procurement scope

The set of locations, brands, legal entities, or countries for which a buying organization purchases.

### Canonical organization graph

The directed graph connecting external organizations through ownership, brand, branch, franchise, domain, legal, and procurement relationships.

### Entity resolution case

A persisted decision process that determines whether one or more source candidates map to an existing organization, a new organization, several organizations, or no valid organization.

### Identity signal

A structured observation used to compare identities, such as matching legal IDs, domains, names, addresses, phones, or parent-company statements.

### Match assessment

A weighted and explainable evaluation of whether two candidate identities refer to the same canonical organization.

### Merge

A reversible action that redirects two or more canonical organization records into one retained identity.

### Split

A corrective action that separates records or relationships previously merged into one entity.

### Candidate Intelligence

Reusable, evidence-backed knowledge about an external organization, separate from campaign-specific qualification.

### Campaign candidate

The representation of one canonical organization within one campaign and one Campaign Strategy version.

---

## 6. Canonical Organization Model

### 6.1 Why a graph is required

A flat company table cannot reliably represent real commercial structures.

Examples:

- one parent group owns several local legal entities;
- one brand operates through franchisees;
- one legal entity owns several consumer brands;
- one e-commerce company has localized country domains but centralized buying;
- one regional distributor purchases for several markets;
- one marketplace page represents hundreds of independent sellers;
- one industrial group has separate procurement by business unit;
- one company has both wholesale and retail divisions.

The system therefore requires canonical organization nodes plus typed relationships.

### 6.2 Canonical node types

The initial node taxonomy should support:

```ts
type ExternalOrganizationType =
  | "company_group"
  | "operating_company"
  | "legal_entity"
  | "business_unit"
  | "brand"
  | "branch"
  | "storefront"
  | "franchisee"
  | "franchisor"
  | "association"
  | "public_institution"
  | "nonprofit"
  | "marketplace"
  | "marketplace_seller"
  | "sole_trader"
  | "unknown";
```

This taxonomy may expand, but providers and prompts must use a controlled enum rather than arbitrary labels.

### 6.3 Canonical node responsibilities

An external organization node stores stable identity and summary fields:

- preferred display name;
- normalized name;
- organization type;
- active or inactive status;
- primary country;
- headquarters location where known;
- primary domain where known;
- canonical description summary;
- creation and update metadata;
- confidence and review status.

Detailed domains, identifiers, locations, aliases, evidence, and relationships belong in separate tables.

### 6.4 Node granularity

Create a separate canonical node only when the unit has independent identity or commercial significance.

Create separate nodes for:

- distinct legal entities;
- independently owned franchisees;
- brands that may be targeted or researched independently;
- business units with materially separate procurement;
- regional operating companies;
- branches when branch-level targeting or local buying is plausible;
- marketplace sellers when the seller itself is a valid business target.

Do not create separate nodes merely for:

- every URL path;
- every language version;
- every duplicate directory listing;
- every social profile;
- every physical location when all locations are centrally operated and branch-level targeting is irrelevant;
- every provider record.

### 6.5 Canonical display identity

The preferred display name should prioritize:

1. the current operating or brand name used publicly;
2. a user-recognizable name;
3. the legal name only when it is the operating identity or no better public name exists.

The legal name remains preserved as an alias and legal-entity record.

### 6.6 Stable identifiers

The canonical organization ID is an Opptium-generated UUID. It must not be derived from:

- domain;
- provider ID;
- legal registration number;
- company name.

All external identifiers are mutable attributes or links, not primary keys.

---

## 7. Organization Relationship Graph

### 7.1 Relationship types

```ts
type OrganizationRelationshipType =
  | "owns"
  | "owned_by"
  | "controls"
  | "controlled_by"
  | "subsidiary_of"
  | "parent_of"
  | "operates"
  | "operated_by"
  | "brand_of"
  | "owns_brand"
  | "branch_of"
  | "has_branch"
  | "storefront_of"
  | "has_storefront"
  | "franchisee_of"
  | "franchisor_of"
  | "business_unit_of"
  | "has_business_unit"
  | "distributor_for"
  | "distributed_by"
  | "procures_for"
  | "procurement_managed_by"
  | "shares_procurement_with"
  | "formerly_known_as"
  | "successor_of"
  | "predecessor_of"
  | "related_company"
  | "possible_relation";
```

Inverse relationships may be generated by application logic rather than stored twice. The implementation must choose one consistent approach.

### 7.2 Relationship metadata

Every relationship must include:

- source organization ID;
- target organization ID;
- relationship type;
- valid-from and valid-to dates where known;
- current status;
- confidence;
- evidence references;
- whether direct evidence or inference;
- created-by source, model, system, or user;
- review status;
- supersession metadata.

### 7.3 Ownership is not procurement

The graph must not infer procurement structure solely from ownership.

A parent may own subsidiaries that purchase independently. Conversely, legally independent franchisees may use centralized procurement.

Ownership and buying relationships must be represented separately.

### 7.4 Historical relationships

Acquisitions, rebrands, closures, and reorganizations must preserve history.

Historical relationships are important because:

- stale providers may return former names;
- old domains may redirect;
- previous campaign evidence may reference a predecessor;
- contacts may remain associated with an acquired company;
- procurement may have changed after acquisition.

### 7.5 Cycles and impossible structures

Validation must prevent impossible direct cycles such as:

- A is parent of B and B is parent of A at the same time;
- an organization is its own branch;
- an organization owns itself;
- mutually exclusive current legal succession links.

Legitimate complex ownership cycles or joint ventures may exist, but they require explicit handling rather than accidental graph loops.

---

## 8. Identity Normalization

### 8.1 General rule

Normalization supports matching but must preserve original values.

Each normalized field should retain:

- raw value;
- normalized value;
- normalization method and version;
- source record;
- confidence;
- timestamp.

### 8.2 Company-name normalization

Name normalization may include:

- Unicode normalization;
- case folding;
- punctuation removal;
- whitespace normalization;
- common legal-suffix normalization;
- localized legal-form mapping;
- removal of non-distinguishing terms for matching only;
- transliteration as an additional matching form;
- token ordering where safe;
- accent-insensitive comparison.

Original names must never be overwritten.

Examples of legal suffixes to normalize include localized equivalents of:

- Ltd;
- LLC;
- GmbH;
- SIA;
- UAB;
- OÜ;
- AS;
- AB;
- BV;
- SAS;
- Sp. z o.o.;
- sole trader forms.

Legal suffix removal is useful for matching but cannot prove identity.

### 8.3 Alias categories

```ts
type OrganizationAliasType =
  | "legal_name"
  | "trade_name"
  | "brand_name"
  | "former_name"
  | "localized_name"
  | "abbreviation"
  | "transliteration"
  | "provider_name"
  | "domain_derived_name"
  | "user_confirmed_alias";
```

### 8.4 Domain normalization

Domain processing should derive:

- full host;
- lowercase normalized host;
- registrable domain;
- subdomain;
- public suffix;
- redirect target where safely verified;
- country-code signal;
- language path or subdomain;
- storefront or branch hint;
- canonical URL candidate.

Normalization should remove:

- protocol;
- `www` where non-distinguishing;
- default ports;
- tracking parameters;
- fragments;
- irrelevant path segments for domain matching.

### 8.5 Domains are strong but not absolute identity keys

One domain may represent:

- a parent group;
- a brand;
- several legal entities;
- a marketplace;
- a franchise network;
- a shared agency-hosted directory;
- a country storefront.

One company may use several domains.

Therefore:

- exact canonical domain match is a strong signal;
- it is not always sufficient for automatic merge;
- path-based company pages on shared domains must not merge with the directory owner;
- localized domains require parent and procurement analysis.

### 8.6 Legal identifier normalization

Support identifiers such as:

- national registration number;
- VAT number;
- LEI;
- DUNS where licensed and available;
- provider-specific company IDs;
- tax identifiers where legally and contractually permitted.

Every identifier record must include:

- identifier type;
- jurisdiction;
- normalized value;
- issuing authority where known;
- validation status;
- source;
- active or historical status.

A verified legal identifier match is usually sufficient for automatic legal-entity matching, but not necessarily for merging brand or operating-company nodes.

### 8.7 Address normalization

Address normalization may include:

- country code;
- administrative region;
- locality;
- postal code;
- street tokens;
- building number;
- standardized country names;
- geocoding where a suitable provider is available later.

Address match is a supporting signal. Shared offices, virtual offices, malls, warehouses, and registered-agent addresses create false positives.

### 8.8 Phone and email normalization

Where public business contact details are collected:

- phone numbers should use E.164 where possible;
- role email domains should be separated from personal addresses;
- generic email services are weak identity signals;
- shared phone numbers may indicate a parent, branch, franchise network, or outsourced call center.

Contact details must be handled according to privacy and permitted-use policies defined elsewhere.

### 8.9 Social and platform identifiers

Public organization profiles may support identity resolution:

- LinkedIn company URL;
- Facebook page;
- Instagram business account;
- GitHub organization;
- app-store publisher;
- marketplace seller ID;
- map place ID.

These are supporting identifiers, not canonical organization IDs.

### 8.10 Location interpretation

The system must distinguish:

- registered address;
- headquarters;
- operating country;
- store location;
- warehouse;
- service area;
- market served;
- country inferred only from a localized domain.

A label such as `Baltics` is a market-coverage region, not a valid company identity location.

---

## 9. Source-Page and Record-Type Classification

### 9.1 Purpose

Before matching companies, Opptium must classify what a source record actually represents.

### 9.2 Initial record types

```ts
type SourceRecordEntityType =
  | "official_company_site"
  | "official_brand_site"
  | "official_group_site"
  | "official_branch_page"
  | "official_storefront"
  | "legal_registry_record"
  | "company_database_record"
  | "directory_company_profile"
  | "directory_category_page"
  | "marketplace"
  | "marketplace_seller"
  | "map_listing"
  | "social_profile"
  | "news_or_article"
  | "association_member_profile"
  | "product_or_category_page"
  | "person_profile"
  | "invalid_or_unknown";
```

### 9.3 Operating-organization validity

A source record may be usable identity evidence even if it is not itself a candidate organization.

Examples:

- a registry record is identity evidence;
- an article is relationship evidence;
- a category page is a discovery source containing several companies;
- a mall directory page may point to a tenant brand;
- a marketplace seller page may represent a valid independent company;
- a map listing may represent a branch rather than a company.

### 9.4 Invalid candidate cases

The following should not become standalone canonical candidate companies without additional evidence:

- generic directory category pages;
- search-result pages;
- product pages;
- maps without a resolvable operating identity;
- anonymous marketplace listings;
- social accounts without a business identity;
- editorial lists;
- duplicate redirects;
- parked domains;
- inactive or broken pages with no surviving organization evidence.

The source record remains stored for audit and discovery provenance.

---

## 10. Entity Resolution Pipeline

### 10.1 Overview

```text
Provider source records
        ↓
Normalized provider candidates
        ↓
Record-type classification
        ↓
Identity-signal extraction
        ↓
Deterministic exact matching
        ↓
Probabilistic candidate matching
        ↓
Match verification or review
        ↓
Create or link canonical organization nodes
        ↓
Resolve graph relationships
        ↓
Resolve buying-organization hypotheses
        ↓
Create campaign candidate
        ↓
Plan reusable and campaign-specific research
```

### 10.2 Step 1 — Intake validation

Validate that each normalized provider candidate has at least one usable identity signal:

- name;
- domain;
- legal identifier;
- official source URL;
- provider company ID with attributable data;
- resolvable marketplace or directory identity.

Candidates without usable identity become `invalid_identity` and do not proceed automatically.

### 10.3 Step 2 — Extract identity signals

Extract and normalize:

- names and aliases;
- domains and URLs;
- legal identifiers;
- countries and addresses;
- phone numbers;
- public emails;
- social/company profiles;
- parent or group statements;
- brand statements;
- redirect targets;
- organization-type hints.

### 10.4 Step 3 — Exact matching

Attempt deterministic matches against existing canonical data using strong keys.

### 10.5 Step 4 — Candidate-set generation

When exact matching does not resolve the record, find possible existing organizations using blocking keys such as:

- normalized name + country;
- domain family;
- legal suffix-stripped name;
- address locality;
- provider ID mapping;
- social profile;
- parent group;
- brand name;
- phone number.

Candidate-set generation should prioritize recall. Final merge decisions require stricter evidence.

### 10.6 Step 5 — Match assessment

Evaluate each possible match using weighted identity signals, contradictions, entity type, and source reliability.

### 10.7 Step 6 — Decision

Possible outcomes:

- link to existing organization;
- create new organization;
- create related organization node;
- merge with existing organization;
- mark possible match for review;
- reject as invalid entity;
- suppress as duplicate source record;
- defer pending better evidence.

### 10.8 Step 7 — Graph enrichment

Resolve:

- legal entity relationships;
- brand ownership;
- parent and subsidiary links;
- branches and storefronts;
- franchise relationships;
- country sites;
- procurement relationships.

### 10.9 Step 8 — Campaign projection

Create one campaign candidate for the canonical targetable organization or buying organization, while preserving links to all discovered records and matched discovery segments.

---

## 11. Deterministic Exact Matching

### 11.1 Strong exact keys

Strong automatic matching keys include:

1. same verified legal identifier and jurisdiction;
2. same provider record ID previously mapped to a canonical organization;
3. same verified canonical domain when both records represent the same entity type;
4. same verified official organization profile ID;
5. explicit redirect from an old official domain to the current official domain with matching identity;
6. user-confirmed identity link.

### 11.2 Exact legal ID handling

A legal-ID match should normally link to the same legal-entity node.

It must not automatically collapse:

- a consumer brand into its owner;
- a branch into its legal company;
- a storefront into a parent group;
- a business unit into a legal entity when separate targeting matters.

Instead, create or use the legal-entity node and link the operating or brand node appropriately.

### 11.3 Domain exact-match safeguards

Before auto-linking by domain, check:

- whether the source page is hosted on a shared directory or marketplace;
- whether the domain is a group site representing several companies;
- whether the candidate is a country storefront;
- whether the page represents a brand rather than the owner;
- whether the domain changed ownership;
- whether the organization is active.

### 11.4 No exact match from name alone

Identical names without another strong signal are not sufficient for automatic merge.

Common names may refer to unrelated businesses in different countries or industries.

---

## 12. Probabilistic Matching

### 12.1 Purpose

Probabilistic matching resolves cases where no single exact identifier exists.

### 12.2 Identity factors

Potential positive factors:

- normalized-name similarity;
- alias match;
- same registrable domain or verified domain family;
- same legal address;
- same phone;
- same official social profile;
- same parent organization;
- explicit “formerly known as” evidence;
- same company description and market;
- same executive or ownership context;
- same logo or branding only as weak support;
- redirect relationship;
- same provider cross-reference.

Potential contradictions:

- different verified legal identifiers in the same jurisdiction;
- conflicting countries with no group relationship;
- incompatible entity types;
- different official domains with distinct operating identities;
- explicit independent ownership;
- different addresses and phone numbers where no branch relationship exists;
- concurrent active organizations with the same name;
- one record representing a marketplace and another a seller;
- one record representing a brand and another a franchisee.

### 12.3 Match assessment contract

```ts
type IdentitySignalAssessment = {
  key: string;
  category:
    | "legal_identifier"
    | "domain"
    | "name"
    | "address"
    | "phone"
    | "social_profile"
    | "parent_relationship"
    | "brand_relationship"
    | "description"
    | "location"
    | "redirect"
    | "provider_mapping"
    | "user_confirmation"
    | "contradiction";

  state: "match" | "partial_match" | "conflict" | "unknown";
  weight: number;
  confidence: number;
  evidenceIds: string[];
  explanation: string;
};

type EntityMatchAssessment = {
  candidateId: string;
  existingOrganizationId: string;
  sourceEntityType: SourceRecordEntityType;
  targetOrganizationType: ExternalOrganizationType;

  signals: IdentitySignalAssessment[];
  aggregateConfidence: number;
  contradictionSeverity: "none" | "low" | "medium" | "high";

  recommendation:
    | "auto_link"
    | "link_as_related_entity"
    | "create_new"
    | "needs_review"
    | "reject_match";

  reasoningSummary: string;
  modelVersion?: string;
  rulesVersion: string;
};
```

### 12.4 Recommended decision bands

Initial bands should be configurable and benchmarked, not treated as universal truth.

A practical starting policy:

- very high confidence with no material contradiction → automatic link;
- high confidence but entity-type mismatch → create or link a related node;
- medium confidence → review or gather additional evidence;
- low confidence → create a separate provisional organization;
- strong contradiction → reject match.

The exact numeric thresholds belong in configuration and must be validated against benchmark data.

### 12.5 Conservative merge policy

False merges are more damaging than temporary duplicates.

When uncertain:

- keep records separate;
- link them as `possible_relation`;
- schedule verification;
- allow later merge.

### 12.6 Model role

An LLM may summarize identity evidence and classify ambiguous relationships. It must not merge records directly without:

- typed output;
- explicit evidence;
- deterministic threshold or review policy;
- persisted resolution decision.

---

## 13. Special Entity Patterns

### 13.1 Localized country storefronts

Examples include separate `.lv`, `.lt`, `.ee`, `/de`, `/fr`, or language subdomains.

The system must determine whether they are:

- language versions of one company;
- country storefronts of one regional operator;
- separate legal subsidiaries;
- independently operated franchises;
- separate buying organizations.

Required checks:

- shared legal terms and company details;
- shared checkout and customer service;
- shared parent company;
- shared assortment and pricing structure;
- local company registration;
- local warehouse or operations;
- procurement statements;
- careers and management information.

Localized domains should normally resolve into one organization graph, not automatically one flat company and not automatically separate leads.

### 13.2 Brands and owners

A brand may be the correct campaign target even when it is not the legal entity.

Store:

- the brand as a node;
- the owner or operator as another node;
- `brand_of` or `operated_by` relationship;
- the legal entity responsible for contracting where known;
- the relevant buying organization.

Qualification should later evaluate the commercially actionable organization while preserving the recognizable brand identity in the UI.

### 13.3 Parent groups and subsidiaries

The system should not automatically choose the top parent as the candidate.

Selection depends on:

- campaign geography;
- offering scope;
- procurement structure;
- local autonomy;
- account size;
- whether the parent is operational or only a holding company.

### 13.4 Branches and store locations

Multiple store locations usually belong to one operating company. They may still matter as evidence of scale.

Create branch nodes only when needed for:

- local operational targeting;
- independent management;
- branch-specific procurement;
- franchise structures;
- location-level service offerings.

### 13.5 Franchise systems

Franchises require special handling because brand identity and purchasing authority may be split.

Possible patterns:

- franchisor controls all procurement;
- local franchisees procure approved categories independently;
- regional master franchisee buys for several countries;
- franchisees are independently targetable service buyers;
- the franchisor is the correct partnership target.

The system must not merge franchisees into the franchisor merely because they share a domain or brand.

### 13.6 Marketplace sellers

A seller page may represent:

- a real independent company;
- a sole trader;
- a brand-owned store;
- a reseller with no external identity;
- an anonymous account.

Create a candidate only when identity and commercial relevance can be resolved beyond the marketplace listing.

### 13.7 Distributors and represented brands

A distributor may appear through pages for many represented brands.

The graph should connect:

- distributor operating company;
- represented brands;
- geography;
- distribution relationship;
- procurement or sales scope where known.

Do not merge the distributor with the brands it represents.

### 13.8 Holding companies

A holding company may own targets but have no operational purchasing role.

The system should distinguish:

- ownership relevance;
- operational relevance;
- procurement relevance;
- strategic-account relevance.

### 13.9 Associations and member directories

An association is a valid organization, but a member-directory page is primarily a discovery container.

Each member should be resolved separately. The association becomes a candidate only when the campaign objective makes it relevant.

### 13.10 Rebrands and acquisitions

Rebrands should preserve one continuing organization when the legal and operational identity continues.

Acquisitions may require:

- continued separate subsidiary node;
- new parent relationship;
- changed buying organization;
- stale-domain redirect;
- re-evaluation of previous campaign conclusions.

### 13.11 Closed, inactive, or dormant entities

Inactive legal entities and closed businesses remain in history but should not be active campaign candidates unless the objective explicitly requires them.

Status evidence should include source and date.

---

## 14. Buying-Organization Resolution

### 14.1 Purpose

The commercially relevant target is often not the page or legal entity first discovered. Opptium must identify the organization that likely controls the purchase relevant to the campaign.

### 14.2 Buying-organization types

```ts
type BuyingOrganizationType =
  | "local_operating_company"
  | "local_legal_entity"
  | "regional_headquarters"
  | "global_parent"
  | "business_unit"
  | "franchisee"
  | "franchisor"
  | "central_procurement_unit"
  | "external_distributor"
  | "owner_operator"
  | "unknown";
```

### 14.3 Procurement scope

```ts
type ProcurementScope = {
  countries?: string[];
  regions?: string[];
  organizationIds?: string[];
  brandIds?: string[];
  locationIds?: string[];
  productCategories?: string[];
  offeringContext?: string[];
};
```

### 14.4 Evidence signals

Positive evidence for centralized procurement may include:

- group procurement pages;
- supplier portals;
- centralized careers roles;
- shared assortment and pricing;
- legal terms naming one contracting entity;
- supplier onboarding documentation;
- annual reports;
- explicit corporate statements;
- identical category management across markets;
- user confirmation.

Positive evidence for local procurement may include:

- local buying-team roles;
- separate legal contracting terms;
- local supplier pages;
- locally managed assortment;
- franchise independence;
- local tenders;
- explicit local management statements.

### 14.5 Unknown procurement

When procurement authority cannot be verified:

- keep the candidate eligible for research;
- set procurement confidence low;
- identify the uncertainty explicitly;
- do not assume centralization merely because a parent exists;
- do not assume local autonomy merely because a local entity exists.

### 14.6 Offering-specific buying units

One group may centralize software procurement but decentralize local services, or centralize merchandise purchasing but decentralize maintenance.

Therefore, a buying-organization hypothesis may include:

- applicable offering categories;
- campaign objective;
- confidence;
- evidence;
- valid date range.

### 14.7 Buying-organization hypothesis contract

```ts
type BuyingOrganizationHypothesis = {
  id: string;
  subjectOrganizationId: string;
  buyerOrganizationId?: string;
  type: BuyingOrganizationType;

  procurementScope: ProcurementScope;
  offeringIds?: string[];
  campaignObjectiveTypes?: string[];

  status:
    | "confirmed"
    | "evidence_backed"
    | "hypothesis"
    | "unknown"
    | "rejected"
    | "superseded";

  confidence: number;
  evidenceIds: string[];
  reasoningSummary: string;
  validFrom?: string;
  validTo?: string;
};
```

### 14.8 Campaign target selection

When creating a campaign candidate, Opptium may select:

- the discovered operating organization;
- the resolved buying organization;
- both, with one displayed as target and one as context.

Example structure:

```text
Displayed account: Regional retail brand
Contracting entity: Local operating company
Likely procurement owner: Nordic headquarters
Local presence: 12 stores in target geography
```

The UI and qualification layer must not hide this distinction.

---

## 15. Duplicate Detection and Grouping

### 15.1 Duplicate levels

Duplicates can exist at several levels:

- identical source record;
- same page returned by several queries;
- same domain returned by several providers;
- same legal entity under different names;
- same operating company with several domains;
- country storefronts under one regional buyer;
- branches under one company;
- brand and owner incorrectly treated as duplicates;
- parent and subsidiary incorrectly treated as duplicates.

### 15.2 Preliminary grouping versus canonical merge

Document 03 performs preliminary duplicate grouping to reduce repeated work.

Document 04 performs canonical entity resolution.

Preliminary grouping:

- is campaign-run-oriented;
- may use weaker hints;
- prevents obvious repeated research;
- does not permanently collapse canonical entities.

Canonical merge:

- is system-level identity resolution;
- requires stronger evidence;
- persists across campaigns;
- must be reversible.

### 15.3 Grouping keys

Potential grouping keys:

- canonical domain hint;
- normalized name + country;
- provider ID mapping;
- exact source URL;
- legal identifier;
- redirect target;
- explicit parent or brand relationship;
- shared official profile.

### 15.4 Duplicate-safe task queueing

Before launching deep research:

1. check whether the source record is already linked to a canonical entity;
2. check whether the canonical entity already has sufficiently fresh research;
3. check whether a research task is already running;
4. compile only missing campaign-specific research questions;
5. reuse evidence where permitted.

---

## 16. Merge Policy

### 16.1 Merge prerequisites

A canonical merge requires:

- a retained organization;
- one or more organizations to redirect;
- explicit match assessment;
- no unresolved high-severity contradiction;
- merge reason;
- actor and rules or model version;
- transactionally safe migration of references;
- reversible event history.

### 16.2 Merge behavior

A merge should:

- mark source organizations as merged, not delete them;
- redirect future lookups to the retained organization;
- preserve all aliases, identifiers, domains, evidence, and source links;
- deduplicate equivalent facts without discarding provenance;
- preserve conflicting claims as conflicts;
- update campaign candidate references through a merge map;
- trigger re-evaluation where the merge changes commercial context;
- record affected tasks and scores.

### 16.3 Retained-record selection

Prefer the record with:

- stronger verified identity;
- more authoritative legal or domain evidence;
- better graph connections;
- higher data completeness;
- older stable canonical history;
- user-confirmed identity.

The retained record is an implementation detail. All public references should resolve through the canonical redirect layer.

### 16.4 User-visible merge

Where a user sees duplicate candidates, a merge action should explain:

- why they appear to be the same organization;
- which record will remain visible;
- what domains or aliases will be combined;
- whether branches or buying units remain separate.

---

## 17. Split and Correction Policy

### 17.1 Why split support is mandatory

False merges can cause:

- incorrect exclusions across companies;
- wrong contact targeting;
- misleading group size;
- corrupted parent relationships;
- lost country-level autonomy;
- invalid campaign rankings.

### 17.2 Split inputs

A split decision must specify:

- which source records belong to each resulting organization;
- which aliases, domains, identifiers, claims, and relationships move;
- which campaign candidates are affected;
- whether previous evaluations remain valid;
- whether buying-organization hypotheses must be rebuilt.

### 17.3 Split behavior

A split should:

- create or reactivate canonical nodes;
- reassign source links;
- preserve the original merge event;
- invalidate affected identity and qualification caches;
- re-run entity graph and campaign evaluation tasks;
- retain audit history.

### 17.4 User corrections

A user correction such as:

> These are different companies.

should become:

- an immediate split or non-merge decision;
- candidate-specific or workspace-specific memory where appropriate;
- a training or benchmark example for entity resolution;
- not a broad global rule unless safely generalizable.

---

## 18. Reusable Candidate Intelligence

### 18.1 Purpose

Candidate Intelligence is the reusable factual and interpretive profile of an external organization.

It reduces repeated research across campaigns while preserving freshness and provenance.

### 18.2 Reusable identity fields

- canonical name;
- aliases;
- organization type;
- domains;
- legal entities and identifiers;
- parent and subsidiary relationships;
- brands;
- branches and locations;
- operating markets;
- active status.

### 18.3 Reusable commercial fields

- primary business model;
- secondary business models;
- value-chain roles;
- products and services;
- customer types;
- routes to market;
- sales channels;
- distribution model;
- company scale signals;
- ownership and group structure;
- procurement structure hypotheses;
- public technology, hiring, funding, or operational signals where relevant;
- current public positioning.

### 18.4 Claim model

Every reusable conclusion should be stored as a claim:

```ts
type CandidateClaim = {
  id: string;
  organizationId: string;
  key: string;
  value: unknown;

  status:
    | "confirmed_fact"
    | "evidence_backed_inference"
    | "hypothesis"
    | "unknown"
    | "user_confirmed"
    | "user_rejected"
    | "conflicting"
    | "superseded";

  confidence: number;
  evidenceIds: string[];
  validFrom?: string;
  validTo?: string;
  observedAt?: string;
  freshnessClass?: "stable" | "slow_changing" | "dynamic" | "volatile";

  sourceScope: "system_public" | "workspace_private";
  createdBy: "provider" | "extractor" | "reasoning_model" | "user" | "system";
  modelVersion?: string;
  promptVersion?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 18.5 Facts versus interpretations

Examples of facts:

- official website lists five locations;
- registry identifies a legal entity;
- company states that it distributes three brands;
- careers page lists a regional procurement role.

Examples of interpretations:

- procurement is probably centralized;
- company is likely an off-price retailer;
- business model appears compatible with a certain buyer archetype.

Interpretations must remain distinguishable from direct facts.

### 18.6 No permanent generic fit label

Candidate Intelligence must not store a global `fit_score`.

It may store reusable commercial characteristics that later influence campaign-specific evaluation.

### 18.7 Candidate intelligence versioning

A candidate intelligence profile should have version snapshots or claim-level history sufficient to reconstruct what was known when a campaign was evaluated.

Campaign evaluation must reference:

- organization ID;
- relevant claim versions or profile snapshot;
- evidence retrieval times;
- strategy version.

---

## 19. Evidence Model

### 19.1 Evidence categories

```ts
type CandidateEvidenceType =
  | "official_web_page"
  | "official_document"
  | "legal_registry"
  | "company_database"
  | "directory_profile"
  | "news_article"
  | "job_posting"
  | "social_company_profile"
  | "map_listing"
  | "marketplace_profile"
  | "user_input"
  | "system_observation";
```

### 19.2 Evidence record

```ts
type CandidateEvidence = {
  id: string;
  organizationId?: string;
  sourceRecordId?: string;

  type: CandidateEvidenceType;
  sourceUrl?: string;
  sourceTitle?: string;
  publisher?: string;

  extractedValue?: unknown;
  excerpt?: string;
  contentHash?: string;

  publishedAt?: string;
  updatedAtSource?: string;
  retrievedAt: string;

  reliability: "authoritative" | "strong" | "supporting" | "weak" | "unknown";
  freshness: "current" | "acceptable" | "stale" | "unknown";
  accessStatus: "available" | "blocked" | "removed" | "partial";

  extractionMethod: "structured" | "deterministic" | "llm" | "user";
  extractorVersion?: string;
  rawArtifactRef?: string;
};
```

### 19.3 Evidence deduplication

Equivalent evidence may be linked by:

- canonical URL;
- content hash;
- provider source record;
- structured identifier;
- document fingerprint.

Do not discard multiple independent sources that corroborate the same claim.

### 19.4 Source reliability

Suggested reliability hierarchy:

1. official legal registry or authoritative filing;
2. official company website or document;
3. verified company database with known provenance;
4. reputable third-party publication;
5. industry directory;
6. map or social listing;
7. search snippet;
8. unattributed aggregator.

Reliability is claim-dependent. A company website is authoritative about its current offering, but may be incomplete about ownership or scale.

### 19.5 Freshness policy

Different facts age differently:

- legal registration number: stable;
- current parent company: slow-changing but important;
- employee count: dynamic;
- store count: dynamic;
- current assortment: volatile;
- procurement team: dynamic;
- domain ownership: dynamic;
- business model: slow-changing but may shift.

Freshness requirements should be field-specific.

---

## 20. Candidate Research

### 20.1 Research purpose

Entity resolution establishes who the organization is. Candidate research establishes what the organization does and gathers evidence required for later campaign qualification.

### 20.2 Reusable research versus campaign-specific research

Reusable research asks:

- what is the company’s business model;
- what does it sell;
- who are its customers;
- where does it operate;
- what is its organizational structure;
- what are its brands and channels;
- how large is it;
- who appears to control procurement.

Campaign-specific research asks:

- does it buy, use, resell, distribute, integrate, or compete with the selected offering;
- which campaign archetype does it match;
- what evidence supports the required buying conditions;
- whether a campaign exclusion applies;
- what commercial trigger exists;
- what material uncertainty remains.

### 20.3 Research-question compilation

For each campaign candidate, compile questions from:

- Campaign Strategy qualification policy;
- matched buyer archetype;
- exclusion rules;
- existing candidate claims;
- missing evidence;
- procurement uncertainty;
- campaign memory and corrections;
- candidate potential and research budget.

### 20.4 Research plan contract

```ts
type CandidateResearchQuestion = {
  id: string;
  key: string;
  question: string;
  purpose:
    | "identity"
    | "business_model"
    | "relationship"
    | "eligibility"
    | "qualification_factor"
    | "commercial_potential"
    | "procurement"
    | "freshness"
    | "conflict_resolution";

  required: boolean;
  priority: number;
  reusableScope: "organization" | "offering_context" | "campaign_only";
  expectedEvidenceTypes: CandidateEvidenceType[];
};

type CandidateResearchPlan = {
  organizationId: string;
  campaignCandidateId?: string;
  strategyVersionId?: string;
  questions: CandidateResearchQuestion[];
  preferredSources: string[];
  pageBudget: number;
  providerBudget?: number;
  stopPolicy: {
    stopWhenRequiredQuestionsResolved: boolean;
    minimumEvidenceQuality?: string;
    maximumPages?: number;
    maximumRuntimeSeconds?: number;
  };
};
```

### 20.5 Website research priorities

Possible high-value pages:

- home page;
- about/company page;
- products or services;
- brands or partners;
- locations or stores;
- legal terms and privacy pages;
- supplier or procurement pages;
- careers;
- investor relations;
- news;
- contact page;
- country-specific pages;
- wholesale or B2B section.

Page selection should be question-driven, not a blind crawl.

### 20.6 Research reuse

Before fetching:

- check existing evidence freshness;
- check whether the same page was recently fetched;
- check whether the question is already answered with adequate confidence;
- check whether another campaign is actively researching the same organization;
- reuse public evidence without exposing workspace-private conclusions.

### 20.7 Research stopping conditions

Stop when:

- all required questions are resolved at sufficient confidence;
- only low-value optional questions remain;
- source access is exhausted;
- the organization is invalid or duplicate;
- a hard entity-level invalidity is confirmed;
- campaign research budget is reached;
- additional evidence is unlikely to change eligibility or ranking.

### 20.8 Research failure

A blocked or sparse website should not automatically mean low fit.

Record:

- access failure;
- unresolved questions;
- lower confidence;
- alternative source attempts;
- whether manual review is worthwhile.

---

## 21. Business-Model Interpretation for Candidates

### 21.1 Purpose

Candidate business-model understanding must be broad enough to support many campaign types.

### 21.2 Value-chain roles

A candidate may have several roles:

- manufacturer;
- brand owner;
- wholesaler;
- distributor;
- importer;
- exporter;
- retailer;
- marketplace;
- reseller;
- systems integrator;
- implementation partner;
- agency;
- consultancy;
- software provider;
- service operator;
- logistics provider;
- institution;
- association;
- buyer cooperative;
- franchise operator.

Store primary and secondary roles with evidence and confidence.

### 21.3 Commercial motions

Reusable interpretation may include:

- buys for own use;
- buys for resale;
- distributes for brands;
- manufactures for others;
- operates a marketplace;
- provides managed services;
- integrates third-party products;
- sells subscriptions;
- sells projects;
- purchases recurring supplies;
- purchases inventory;
- awards tenders;
- licenses technology;
- acts as intermediary.

### 21.4 Avoid category-only summaries

Bad candidate summary:

> Premium fashion company.

Better reusable summary:

> Multi-brand retail operator selling third-party premium apparel through physical stores and e-commerce; public evidence confirms external brands, while off-price purchasing and local procurement autonomy remain unknown.

The second summary is useful across campaigns and preserves uncertainty.

---

## 22. Campaign Candidate Model

### 22.1 Purpose

A campaign candidate connects one canonical organization to one campaign strategy version.

It stores campaign context without modifying reusable organization identity.

### 22.2 Contract

```ts
type CampaignCandidate = {
  id: string;
  campaignId: string;
  campaignStrategyVersionId: string;

  discoveredOrganizationId: string;
  targetOrganizationId: string;
  buyingOrganizationId?: string;

  displayOrganizationId: string;

  matchedArchetypeIds: string[];
  matchedDiscoverySegmentIds: string[];
  discoverySourceRecordIds: string[];

  state:
    | "discovered"
    | "identity_pending"
    | "identity_resolved"
    | "research_pending"
    | "researching"
    | "research_complete"
    | "qualification_pending"
    | "evaluated"
    | "excluded"
    | "rejected"
    | "merged"
    | "needs_review"
    | "failed";

  identityConfidence: number;
  procurementConfidence?: number;

  duplicateOfCampaignCandidateId?: string;
  mergedIntoCampaignCandidateId?: string;

  createdAt: string;
  updatedAt: string;
};
```

### 22.3 Discovered, target, buying, and display organization

These IDs may differ:

- `discoveredOrganizationId`: organization directly found by the provider;
- `targetOrganizationId`: organization that should be evaluated for the campaign;
- `buyingOrganizationId`: likely purchasing controller;
- `displayOrganizationId`: organization name most useful to the user.

Example:

```text
Discovered: Local country storefront
Target: Regional operating company
Buying organization: Nordic procurement headquarters
Display: Consumer-facing retail brand
```

### 22.4 One canonical organization per campaign candidate

A campaign should generally contain one active candidate per target buying organization and offering context.

Exceptions may exist when:

- separate business units buy independently;
- franchisees are independent targets;
- different local subsidiaries have separate procurement;
- one group should be evaluated for several distinct relationships.

Such exceptions require explicit candidate scope, not accidental duplicates.

### 22.5 Campaign candidate uniqueness key

A practical uniqueness key may include:

```text
campaign_strategy_version_id
+ target_organization_id
+ buying_organization_id or null
+ offering_context or buyer_unit_scope
```

The exact database constraint will be defined in Document 06.

---

## 23. Campaign-Specific Candidate Context

### 23.1 Matched archetypes

A candidate may match several discovery archetypes. Preserve all matches and record:

- which segment found it;
- why it matched;
- source-level signals;
- whether the match remains plausible after research.

### 23.2 Campaign-only assumptions

Examples:

- likely direct buyer for this offering;
- possible regional distributor;
- procurement autonomy unresolved;
- may belong in partner track rather than buyer track.

These belong to campaign candidate claims, not reusable organization claims.

### 23.3 Campaign-specific exclusions

An exclusion applied to a campaign candidate must preserve:

- rule ID;
- scope;
- reason;
- evidence;
- user or system origin;
- whether it suggests broader learning;
- whether it is provisional.

It must not mutate global organization identity.

### 23.4 Existing-customer and do-not-contact status

These may be:

- workspace-global;
- offering-specific;
- campaign-specific;
- candidate-specific;
- temporary.

They belong to scoped memory or CRM state, not public Candidate Intelligence.

---

## 24. Candidate Memory

### 24.1 Purpose

Candidate memory stores durable workspace-specific knowledge about an external organization.

Examples:

- user confirmed that this company is already a customer;
- do not contact until a certain date;
- this subsidiary buys independently;
- this organization is a strategic partner for one offering;
- previous campaign evaluation was corrected;
- local office has no procurement authority.

### 24.2 Candidate memory is not universal truth

A workspace may have a confidential relationship with an organization. That information must not be visible to another workspace.

### 24.3 Scope and applicability

Candidate memory may apply to:

- one candidate only;
- a specific legal entity;
- a parent group;
- one offering;
- one campaign objective;
- one geography;
- a date range.

### 24.4 Promotion and reuse

Campaign corrections may create a provisional candidate memory. Broader promotion follows the scoped-memory rules from Document 02.

### 24.5 Conflict handling

When public evidence conflicts with workspace memory:

- explicit recent user confirmation wins for workspace behavior;
- public claims remain stored with their own scope;
- the conflict is visible;
- the system does not overwrite either record silently.

---

## 25. State Machines

### 25.1 Entity resolution case states

```text
queued
→ normalizing
→ matching
→ verification_pending
→ resolved_existing
→ resolved_new
→ related_entity_created
→ needs_review
→ invalid_entity
→ failed
```

Additional terminal or corrective states:

```text
merged
split
superseded
reopened
```

### 25.2 Canonical organization review states

```ts
type OrganizationReviewState =
  | "provisional"
  | "system_resolved"
  | "user_confirmed"
  | "needs_review"
  | "disputed"
  | "merged"
  | "inactive";
```

### 25.3 Candidate research states

```text
not_planned
→ planned
→ queued
→ fetching
→ extracting
→ synthesizing
→ complete
```

Alternative states:

```text
partial
blocked
not_worth_researching
cancelled
failed
superseded
```

### 25.4 Campaign candidate transitions

Valid transitions must be enforced.

Examples:

- `discovered → identity_pending`;
- `identity_pending → identity_resolved`;
- `identity_resolved → research_pending`;
- `research_pending → researching`;
- `researching → research_complete`;
- `research_complete → qualification_pending`;
- any active state → `merged` when canonical identity changes;
- any active state → `needs_review` when a blocking conflict appears.

A candidate may not be qualified while identity is unresolved unless an explicit manual override is recorded.

---

## 26. Preliminary Persistence Model

Document 06 will define the complete migrations. Entity Resolution and Candidate Intelligence require at least these logical tables.

### `external_organizations`

Canonical organization nodes.

Key fields:

- ID;
- display name;
- normalized name;
- organization type;
- primary domain;
- primary country;
- active status;
- review state;
- redirect or merged-into ID;
- timestamps.

### `organization_aliases`

Stores names, localized names, former names, abbreviations, and provider names.

### `organization_domains`

Stores domains, subdomains, domain roles, verification status, redirect relationships, and source evidence.

### `organization_identifiers`

Stores legal, registry, provider, social, map, and marketplace identifiers.

### `organization_locations`

Stores registered, headquarters, operating, store, warehouse, and service-area locations.

### `organization_relationships`

Stores parent, subsidiary, brand, branch, franchise, ownership, operating, and procurement relationships.

### `organization_buying_hypotheses`

Stores buying-organization and procurement-scope hypotheses.

### `entity_resolution_cases`

Stores the resolution process for one or more provider candidates.

### `entity_match_assessments`

Stores pairwise identity assessments and signal breakdowns.

### `entity_resolution_decisions`

Stores final link, create, related-node, reject, merge, or review decisions.

### `organization_merge_events`

Stores reversible canonical merge history.

### `organization_split_events`

Stores split history and reassignment plans.

### `organization_source_links`

Links provider source records and normalized candidates to canonical organizations.

### `candidate_evidence`

Stores source-backed observations used by reusable and campaign-specific claims.

### `candidate_claims`

Stores reusable organization claims.

### `candidate_intelligence_versions`

Stores reconstructable snapshots or version metadata.

### `candidate_research_plans`

Stores question-driven research plans.

### `candidate_research_tasks`

Stores page fetch, extraction, verification, and synthesis work.

### `campaign_candidates`

Stores campaign-specific organization projection and state.

### `campaign_candidate_discovery_links`

Links campaign candidates to discovery segments, provider candidates, and source records.

### `campaign_candidate_claims`

Stores campaign-specific assumptions and research conclusions.

### `candidate_memories`

Stores workspace-scoped candidate facts, corrections, restrictions, and provisional lessons.

---

## 27. Core TypeScript Contracts

### 27.1 External organization

```ts
type ExternalOrganization = {
  id: string;
  displayName: string;
  normalizedName: string;
  type: ExternalOrganizationType;

  primaryDomain?: string;
  primaryCountry?: string;

  operatingStatus: "active" | "inactive" | "dormant" | "closed" | "acquired" | "unknown";

  reviewState: OrganizationReviewState;
  identityConfidence: number;

  mergedIntoOrganizationId?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 27.2 Organization relationship

```ts
type OrganizationRelationship = {
  id: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  type: OrganizationRelationshipType;

  status: "current" | "historical" | "possible" | "rejected" | "superseded";
  confidence: number;
  evidenceIds: string[];

  validFrom?: string;
  validTo?: string;

  createdBy: "provider" | "model" | "system" | "user";
  modelVersion?: string;
  createdAt: string;
};
```

### 27.3 Entity resolution decision

```ts
type EntityResolutionDecision = {
  id: string;
  caseId: string;
  normalizedCandidateId: string;

  action:
    | "link_existing"
    | "create_new"
    | "create_related_node"
    | "merge"
    | "reject_invalid"
    | "defer_review";

  targetOrganizationId?: string;
  relatedOrganizationId?: string;
  relationshipType?: OrganizationRelationshipType;

  confidence: number;
  evidenceIds: string[];
  reasoningSummary: string;

  rulesVersion: string;
  modelVersion?: string;
  decidedBy: "rules" | "model" | "user" | "hybrid";
  createdAt: string;
};
```

### 27.4 Candidate intelligence snapshot

```ts
type CandidateIntelligenceSnapshot = {
  id: string;
  organizationId: string;
  version: number;

  identity: {
    displayName: string;
    aliases: string[];
    organizationType: ExternalOrganizationType;
    domains: string[];
    countries: string[];
  };

  structure: {
    parentOrganizationIds: string[];
    subsidiaryOrganizationIds: string[];
    brandIds: string[];
    branchIds: string[];
    buyingHypothesisIds: string[];
  };

  commercial: {
    businessModelClaims: string[];
    valueChainRoleClaims: string[];
    offeringClaims: string[];
    customerTypeClaims: string[];
    channelClaims: string[];
    scaleClaims: string[];
  };

  claimIds: string[];
  evidenceIds: string[];
  unresolvedKeys: string[];

  generatedAt: string;
  sourceCutoffAt: string;
};
```

---

## 28. Trigger.dev Task Boundaries

Exact orchestration belongs to Document 06. Recommended task boundaries:

```text
entityResolution.initializeCase
entityResolution.classifySourceRecord
entityResolution.extractIdentitySignals
entityResolution.findExactMatch
entityResolution.findPossibleMatches
entityResolution.assessMatches
entityResolution.verifyAmbiguity
entityResolution.applyDecision
entityResolution.createOrganization
entityResolution.linkSourceRecord
entityResolution.resolveGraph
entityResolution.resolveBuyingOrganization
entityResolution.finalizeCase
```

Merge and correction tasks:

```text
entityResolution.proposeMerge
entityResolution.applyMerge
entityResolution.proposeSplit
entityResolution.applySplit
entityResolution.rebuildAffectedGraph
entityResolution.requeueAffectedCandidates
```

Candidate Intelligence tasks:

```text
candidateResearch.compilePlan
candidateResearch.selectSources
candidateResearch.fetchPage
candidateResearch.extractEvidence
candidateResearch.updateClaims
candidateResearch.resolveConflicts
candidateResearch.buildSnapshot
candidateResearch.finalize
```

Campaign projection tasks:

```text
campaignCandidate.createOrUpdate
campaignCandidate.attachDiscoveryProvenance
campaignCandidate.selectTargetOrganization
campaignCandidate.resolveBuyingOrganization
campaignCandidate.compileResearchQuestions
campaignCandidate.markQualificationReady
```

---

## 29. Idempotency and Concurrency

### 29.1 Idempotency keys

Recommended keys:

```text
resolution case:
normalized_candidate_id + resolution_rules_version

source link:
source_record_id + canonical_organization_id + link_type

exact match:
normalized_candidate_id + identity_index_version

research fetch:
canonical_url + content_freshness_window

research extraction:
evidence_artifact_hash + extractor_version

candidate snapshot:
organization_id + claims_watermark + snapshot_schema_version

campaign candidate:
campaign_strategy_version_id + target_organization_id + buying_scope_hash
```

### 29.2 Concurrent discovery

Several discovery segments may find the same company simultaneously.

The implementation must handle:

- transactional upsert of exact identifiers;
- advisory locks or equivalent around merge decisions;
- duplicate provisional organizations created concurrently;
- later safe merge;
- one active research fetch per canonical URL and freshness window;
- one active campaign candidate per uniqueness key.

### 29.3 Retry safety

Retries must not:

- create duplicate canonical organizations after a prior successful decision;
- apply the same merge twice;
- duplicate source links;
- increment campaign counts twice;
- overwrite newer user corrections;
- re-fetch unchanged evidence unnecessarily.

### 29.4 Version-aware replay

When rules, models, or schemas change, replay should support:

- re-normalizing raw source records;
- re-running match assessments;
- preserving historical decisions;
- applying new decisions as superseding events;
- comparing old and new outputs;
- selectively rebuilding affected candidates.

---

## 30. Multi-Tenant and Privacy Boundaries

### 30.1 System-public layer

Potentially reusable internally across workspaces:

- canonical public organization identity;
- public domains and legal identifiers;
- public organization graph;
- public evidence;
- public business-model claims;
- public operating status.

### 30.2 Workspace-private layer

Must remain isolated:

- user notes;
- existing customer status;
- do-not-contact instructions;
- private CRM imports;
- campaign corrections;
- internal relationship history;
- commercial evaluation;
- user-confirmed exclusions;
- confidential contacts;
- inferred purchase potential for that workspace.

### 30.3 Access pattern

Users should access canonical organizations through workspace-authorized projections such as campaign candidates or saved accounts.

Direct broad access to the system-wide organization graph should be restricted unless the product deliberately exposes it.

### 30.4 Shared correction safety

A workspace correction should not modify system-public identity unless:

- it concerns a verifiable public fact;
- the correction passes verification;
- provenance is retained;
- no private business context is included.

---

## 31. Error Handling

### 31.1 Error categories

- unusable source record;
- normalization failure;
- contradictory legal identifiers;
- domain resolution failure;
- ambiguous same-name companies;
- suspected false merge;
- cyclic relationship;
- unavailable website;
- stale or conflicting evidence;
- concurrent merge conflict;
- provider source removed;
- user correction conflicts with public data;
- research budget exhausted.

### 31.2 Recoverable errors

Recoverable cases should create a visible state and next action:

- retry normalization;
- fetch an authoritative source;
- request user review;
- keep entities separate;
- mark procurement unknown;
- schedule later refresh;
- continue qualification with lower confidence where safe.

### 31.3 Non-recoverable automatic cases

Automatic processing should stop when:

- verified identifiers directly conflict;
- the target entity cannot be distinguished from unrelated companies;
- a merge would cross tenants’ private records incorrectly;
- required graph invariants fail;
- a user-confirmed correction blocks the proposed action.

---

## 32. Observability and Auditability

For each entity resolution case, capture:

- source records considered;
- identity signals extracted;
- exact indexes queried;
- possible matches considered;
- factor-level match assessment;
- contradictions;
- rules and model versions;
- final decision;
- merge or relationship events;
- task runtime and retries;
- user corrections.

For Candidate Intelligence, capture:

- pages fetched;
- page selection reason;
- evidence extracted;
- claim changes;
- claim conflicts;
- freshness decisions;
- research questions resolved or unresolved;
- costs and model usage;
- snapshot version.

A campaign review should be able to trace:

```text
Candidate row
→ campaign candidate
→ target and buying organization
→ canonical organization graph
→ candidate claims
→ evidence
→ provider source records
→ discovery segment and query
```

---

## 33. Quality Metrics

### 33.1 Entity resolution metrics

- exact-match rate;
- probabilistic-match rate;
- unresolved rate;
- invalid-record rate;
- automatic-merge precision;
- false-merge rate;
- duplicate rate after resolution;
- split rate;
- average source records per canonical organization;
- percentage of candidates with verified domain;
- percentage with legal-entity evidence;
- average resolution runtime and cost.

### 33.2 Buying-organization metrics

- percentage with resolved buying organization;
- percentage marked unknown;
- user correction rate;
- local-versus-central procurement accuracy;
- percentage of qualified candidates later redirected to a parent or business unit;
- contact-enrichment failure caused by wrong account selection.

### 33.3 Candidate Intelligence metrics

- evidence coverage per required reusable field;
- percentage of claims with source evidence;
- stale-claim rate;
- claim conflict rate;
- research reuse rate;
- average page fetches per researched candidate;
- time and cost per research-complete candidate;
- percentage of candidates reaching qualification with unresolved required questions.

### 33.4 Campaign projection metrics

- duplicate campaign candidate rate;
- number of branches collapsed per account;
- number of country storefronts resolved to one buying unit;
- candidates requiring manual identity review;
- downstream scoring changes caused by entity corrections.

---

## 34. Benchmark Cases

The benchmark suite must include difficult identity patterns, not only clean domains.

### 34.1 Localized e-commerce group

Expected behavior:

- recognize country domains or language sites;
- retain local legal entities where present;
- determine whether buying is regional or local;
- avoid duplicate campaign accounts.

### 34.2 Franchise network

Expected behavior:

- keep independently owned franchisees separate;
- connect them to the franchisor;
- determine which unit buys the relevant offering;
- avoid merging by shared branding alone.

### 34.3 Brand owned by a manufacturer

Expected behavior:

- preserve both brand and owner;
- avoid treating them as unrelated duplicates;
- target the commercially actionable unit.

### 34.4 Holding company with operating subsidiaries

Expected behavior:

- preserve ownership graph;
- avoid targeting an inactive holding company for an operational purchase;
- select the correct subsidiary or procurement unit.

### 34.5 Directory and marketplace noise

Expected behavior:

- keep directory pages as sources, not companies;
- resolve named sellers where possible;
- reject anonymous or non-operating listings.

### 34.6 Same-name unrelated companies

Expected behavior:

- avoid name-only merge;
- use country, domain, legal identifier, and business context;
- retain uncertainty when needed.

### 34.7 Rebrand or acquisition

Expected behavior:

- preserve former identity and evidence;
- update parent relationship;
- redirect old domains;
- re-evaluate procurement.

### 34.8 Multi-business-unit enterprise

Expected behavior:

- create separate buying units where relevant;
- avoid one generic group-level candidate when the offering targets a specific division.

### 34.9 Small local business with weak structured data

Expected behavior:

- resolve identity from official website, maps, local registry, and contact details;
- avoid requiring a database ID;
- maintain lower confidence when legal identity is unavailable.

### 34.10 Distributor representing many brands

Expected behavior:

- keep distributor separate from brands;
- record representation relationships;
- select distributor or brand according to campaign objective.

---

## 35. Testing Requirements

### 35.1 Unit tests

Test:

- name normalization;
- legal-suffix handling;
- domain parsing;
- registrable-domain extraction;
- localized-domain recognition;
- legal identifier normalization;
- exact-match rules;
- contradiction rules;
- relationship validation;
- merge redirects;
- campaign candidate uniqueness;
- freshness classification.

### 35.2 Contract tests

Test all provider candidate mappings against:

- missing fields;
- malformed URLs;
- unknown organization types;
- duplicated provider IDs;
- stale records;
- country storefronts;
- directory pages.

### 35.3 Integration tests

Test:

- discovery source record through canonical entity creation;
- simultaneous duplicate discoveries;
- existing-organization reuse across campaigns;
- merge and downstream candidate update;
- split and re-evaluation;
- candidate research reuse;
- workspace-private memory isolation;
- buying-organization selection.

### 35.4 Golden benchmark tests

Maintain manually reviewed cases with expected:

- canonical organizations;
- source-record mappings;
- graph relationships;
- buying organization;
- merge or non-merge decision;
- confidence range;
- unresolved questions.

Prompt or rules changes must run against the golden set.

### 35.5 Regression tests

Every confirmed false merge, missed duplicate, wrong parent, wrong buying organization, and invalid directory candidate should become a regression case.

---

## 36. Migration from the Legacy Candidate Model

### 36.1 Preserve legacy data

Do not overwrite legacy campaign leads in place.

Create Intelligence V2 entities and map legacy rows through migration links.

### 36.2 Migration steps

1. inventory existing lead and candidate tables;
2. identify fields that contain provider-specific or campaign-specific assumptions;
3. create canonical organization tables;
4. import domains and names as provisional identity signals;
5. link existing source URLs and research artifacts;
6. run conservative resolution against legacy candidates;
7. create campaign candidate projections;
8. preserve old scores as legacy evaluation records;
9. avoid treating old scores as reusable Candidate Intelligence;
10. flag ambiguous merges for review;
11. validate campaign counts before switching UI paths.

### 36.3 Legacy duplicates

Legacy duplicate rows should not be deleted immediately.

Map them to canonical organizations and preserve:

- original row ID;
- original campaign;
- old score and classification;
- source URL;
- migration decision.

### 36.4 Legacy profile facts

Any previously extracted candidate company descriptions may be imported as low-confidence claims with source provenance where available. Unattributed summaries should not be upgraded to confirmed facts.

### 36.5 Feature flag

Entity Resolution V2 should run behind the Intelligence V2 feature flag until benchmark and migration acceptance criteria are met.

---

## 37. Implementation Phases

### Phase 1 — Canonical identity foundation

Implement:

- external organizations;
- aliases;
- domains;
- identifiers;
- source links;
- exact-match indexes;
- provisional organization creation;
- campaign candidate projection.

### Phase 2 — Conservative matching

Implement:

- normalized names;
- candidate-set generation;
- typed identity signals;
- contradiction checks;
- match assessments;
- review queue;
- no automatic destructive merge.

### Phase 3 — Organization graph

Implement:

- legal entities;
- parent and subsidiary links;
- brand and branch links;
- localized storefront relationships;
- franchise support;
- graph validation.

### Phase 4 — Buying-organization resolution

Implement:

- procurement hypotheses;
- local versus central buying evidence;
- campaign target selection;
- procurement confidence;
- unresolved procurement handling.

### Phase 5 — Candidate Intelligence

Implement:

- reusable claims and evidence;
- question-driven research;
- freshness;
- conflict handling;
- snapshots;
- cross-campaign reuse.

### Phase 6 — Merge, split, and corrections

Implement:

- reversible merges;
- split workflows;
- lineage;
- affected-campaign reprocessing;
- user correction capture;
- benchmark regression creation.

### Phase 7 — Optimization

Implement:

- concurrent resolution controls;
- research caching;
- source reliability calibration;
- identity index tuning;
- automatic review prioritization;
- monitoring dashboards.

---

## 38. Acceptance Criteria

Document 04 is implemented successfully when:

1. provider records no longer become campaign leads directly;
2. every active campaign candidate links to a canonical external organization;
3. source records remain immutable and traceable;
4. canonical organization IDs are provider-independent;
5. names, domains, identifiers, locations, and aliases are normalized without losing original values;
6. exact and probabilistic matching are separated;
7. name-only automatic merging is prohibited;
8. uncertain matches remain explicit rather than silently merged;
9. legal entities, brands, branches, storefronts, parents, and subsidiaries can be represented separately;
10. localized country sites can resolve to one organization graph without automatically becoming duplicate leads;
11. franchisees are not merged into franchisors by brand similarity alone;
12. directory and category pages cannot reach the review queue as standalone companies;
13. merge decisions are reversible and auditable;
14. split corrections can reassign source records and trigger affected re-evaluation;
15. a campaign candidate distinguishes discovered, target, display, and buying organizations;
16. procurement autonomy may remain unknown without becoming a negative fact;
17. reusable Candidate Intelligence contains evidence-backed facts and interpretations but no global fit score;
18. campaign-specific assumptions and exclusions remain campaign-scoped;
19. workspace-private candidate memory does not leak across tenants;
20. existing public evidence can be safely reused across campaigns;
21. research questions are compiled from the Campaign Strategy and existing evidence gaps;
22. deep research is not repeated when sufficiently fresh evidence already exists;
23. identity, graph, buying organization, claims, evidence, and task history are auditable;
24. benchmark cases meet agreed false-merge, duplicate, and buying-organization accuracy targets;
25. downstream qualification receives one clear target object with explicit uncertainty and provenance.

---

## 39. Locked Decisions

The following decisions are fixed for Intelligence V2 unless deliberately revised through architecture review:

- Provider source records and canonical organizations are separate layers.
- A canonical organization uses an Opptium-generated stable ID.
- Legal entity, brand, operating company, branch, storefront, parent group, and buying organization are not treated as interchangeable.
- The organization model is graph-based.
- Exact matching, probabilistic matching, graph construction, and buying-organization resolution are separate steps.
- False merges are treated as more damaging than temporary duplicates.
- Merges are reversible and do not physically delete original records.
- Campaign candidates are projections of canonical organizations, not canonical organizations themselves.
- Candidate fit is never stored as a global reusable organization property.
- Public reusable facts and workspace-private memory are separate.
- Procurement centralization or autonomy must be evidence-backed or marked unknown.
- Localized domains do not automatically prove separate companies or local buying authority.
- Brands and franchisees are not merged solely because they share branding.
- Directory pages, category pages, and anonymous marketplace listings are sources, not valid companies.
- Candidate research is question-driven and reuses sufficiently fresh evidence.
- Company qualification cannot proceed normally while identity remains materially unresolved.
- Every entity decision must retain evidence, confidence, rules version, and audit history.

---

## 40. Handoff to Document 05

Document 05 must consume:

- canonical external organization identity;
- organization graph;
- selected target and buying organization;
- reusable candidate claims;
- campaign-specific candidate claims;
- matched buyer archetypes;
- Campaign Strategy version;
- candidate evidence;
- unresolved research questions;
- identity and procurement confidence;
- active campaign and candidate memory;
- entity-level invalidity and duplicate state.

Document 05 will define how Opptium:

- classifies the candidate’s commercial relationship;
- applies hard campaign exclusions;
- determines eligibility;
- extracts factor-level positive, negative, unknown, and conflicting evidence;
- calculates fit, commercial potential, and confidence deterministically;
- prevents unknown evidence from becoming a negative;
- compares candidates against one another;
- detects scoring inversions and inconsistent evaluations;
- produces an explainable final review queue.
