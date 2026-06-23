# Product Definition

## 1. Product summary

Outreach SaaS Agent is a horizontal AI-assisted B2B prospecting workspace.

A customer describes a product or service, chooses a target market, and receives a structured campaign containing researched companies, evidence-based qualification, public contact routes, and personalized outreach drafts for human review.

The product is not an autonomous salesperson and does not promise to close deals. Its job is to reduce the manual work required to identify, understand, prioritize, and approach suitable business prospects.

## 2. Product promise

> Describe what you sell, choose a market, and receive researched B2B prospects with clear qualification evidence and ready-to-review outreach.

## 3. Horizontal product requirement

The product must support many B2B offers without sector-specific code paths in the shared core.

Supported examples include:

- physical products;
- wholesale and distribution;
- industrial manufacturing capabilities;
- professional services;
- software and SaaS;
- consulting and training;
- maintenance and repair services;
- subcontracting and partnership offers.

Medical equipment and services are the first realistic test scenario. They must validate the generic system rather than define it.

## 4. Target users

Initial users are small and medium B2B sales teams, founders, export managers, independent sales representatives, agencies, and manufacturers entering new markets.

The first versions should work especially well for users who currently research prospects manually through search engines, directories, company websites, spreadsheets, and email drafts.

## 5. Core objects from the user's perspective

### Workspace

The customer's company account, team, billing context, settings, and data boundary.

### Offer

A reusable description of a product or service the customer wants to sell. A workspace may maintain several offers.

### Campaign

A specific prospecting objective combining one offer with geography, target customer characteristics, exclusions, language, and a desired outcome.

### Lead

A candidate company discovered for a campaign.

### Research

Collected public evidence about the lead and its likely fit.

### Qualification

A scored conclusion explaining whether and why the lead appears suitable.

### Contact

A public business contact route or publicly available professional contact relevant to the campaign.

### Outreach draft

A generated message grounded in approved seller information and prospect evidence. It remains a draft until the user takes an explicit external sending action.

## 6. Main user journey

### 6.1 Create workspace

The user creates an account and a company workspace.

Minimum information:

- company name;
- website, when available;
- operating countries;
- default language;
- short company description.

### 6.2 Add an offer

The user may:

- enter a product or service manually;
- provide a relevant web page;
- paste marketing or technical copy;
- upload a brochure or catalogue later in the product roadmap.

The system proposes a normalized Offer Profile containing:

- concise summary;
- category;
- business problems solved;
- main capabilities or features;
- customer value;
- likely buyer types;
- likely use cases;
- differentiators;
- proof points and approved claims;
- limitations and exclusions;
- useful keywords and synonyms.

The user reviews and approves the profile before it is used for outreach.

### 6.3 Create campaign

The user selects an offer and defines:

- target country, region, or market;
- desired company types;
- relevant industries;
- company size preferences, when known;
- campaign objective, such as direct buyers, distributors, resellers, partners, or subcontracting clients;
- exclusions;
- desired lead count;
- campaign and outreach language.

### 6.4 Review proposed strategy

Before discovery begins, the platform proposes:

- target segments;
- search terminology and local-language variants;
- likely source categories;
- qualification criteria;
- exclusion criteria;
- expected data limitations.

The strategy is visible and editable. The user should understand how the campaign will search and qualify prospects.

### 6.5 Run discovery and research

The platform performs durable background work to:

1. discover candidate companies;
2. normalize and deduplicate them;
3. visit allowed public sources;
4. extract relevant facts;
5. assess fit;
6. find public contact routes;
7. record diagnostics and source evidence.

### 6.6 Review leads

The user sees leads in a dashboard with filters, status, scores, warnings, evidence, and outreach readiness.

Each lead should answer:

- What does this company do?
- Why might it fit this offer?
- What evidence supports that conclusion?
- What is uncertain or missing?
- How can it be contacted publicly?
- What outreach angle is appropriate?

### 6.7 Approve or reject

The user can approve, reject, archive, or request further research.

Rejected leads should retain a reason so future searches can improve and avoid repeated unsuitable results.

### 6.8 Prepare outreach

For approved leads, the system produces:

- suggested subject lines;
- a primary email draft;
- a shorter alternative;
- an optional follow-up draft;
- a summary of the evidence used;
- warnings when personalization rests on inference rather than confirmed fact.

### 6.9 External sending

The MVP does not send email automatically.

The user may copy the draft or open a prefilled compose window in an email client. This action does not prove delivery and must not mark the message as sent automatically.

## 7. Lead lifecycle

Recommended initial statuses:

- `discovered`
- `researching`
- `needs_review`
- `qualified`
- `rejected`
- `approved`
- `draft_ready`
- `contacted_manual`
- `replied`
- `converted`
- `archived`

These statuses may evolve. Transitions should be explicit and auditable rather than inferred from UI state.

## 8. Qualification model

The platform should evaluate leads across reusable dimensions:

- industry fit;
- need or use-case fit;
- company-type fit;
- geographic fit;
- commercial plausibility;
- contactability;
- evidence quality;
- exclusion risk.

Each dimension should contain:

- score;
- confidence;
- short explanation;
- supporting source references;
- distinction between confirmed facts and inference.

A total score is useful for sorting, but the user must be able to inspect the contributing reasons.

## 9. Evidence model

The platform must distinguish:

- `fact`: directly supported by a source;
- `inference`: a reasoned conclusion based on one or more facts;
- `unknown`: required information was not found;
- `conflict`: sources disagree or appear outdated.

No prospect-specific factual claim should appear in outreach unless it is supported by stored evidence.

## 10. MVP scope

### Included

- authentication and workspace creation;
- reusable offer profiles;
- campaign creation;
- AI-assisted campaign strategy;
- at least one web-search provider;
- public company-site research;
- lead normalization and deduplication;
- evidence storage;
- reusable qualification scoring;
- public general contact discovery;
- lead review dashboard;
- outreach draft generation;
- manual approval;
- copy and open-in-email-client actions;
- CSV export;
- run diagnostics and basic usage tracking.

### Excluded

- automatic bulk sending;
- autonomous follow-up execution;
- CRM replacement;
- LinkedIn account automation;
- scraping behind authentication;
- automatic negotiation;
- voice agent;
- browser extension;
- complex workflow builder;
- white-label agency mode;
- advanced billing tiers before product validation.

## 11. Quality bar

A useful result is not merely a company name and email address.

A lead is ready for review when the system provides:

- a normalized company identity;
- a working source trail;
- a concise business description;
- a clear fit explanation;
- visible uncertainty;
- a usable contact route or an explicit absence of one;
- no duplicate within the campaign;
- no unsupported personalization.

## 12. Success indicators

Early product validation should measure:

- percentage of discovered candidates accepted as relevant;
- percentage of qualified leads with sufficient evidence;
- duplicate rate;
- percentage with a usable public contact route;
- time saved compared with manual research;
- user edits required before outreach is usable;
- approval and rejection reasons;
- cost per reviewed lead;
- provider and workflow failure rates.

Reply, meeting, and conversion rates matter later, but they are influenced by the seller's offer, reputation, deliverability, and sales process. The platform should not claim sole credit for them.

## 13. Non-goals

The product is not:

- a fully autonomous sales representative;
- an unrestricted web scraper;
- a source of guaranteed verified personal data;
- a mass-email spam system;
- a replacement for legal or compliance review;
- a universal CRM;
- a medical-only sales product.
