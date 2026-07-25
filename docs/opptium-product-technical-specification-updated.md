# Opptium
## Product, Agent Architecture and Technical Specification

## Status

This document defines the approved target product and technical architecture for the Opptium MVP.

It is the primary architectural reference for upcoming backend, database, agent, workflow and infrastructure changes.

It describes the target state, not necessarily the current implementation.

No existing code should be assumed to comply with this specification until it has been audited.

Opptium-owned provider-neutral Campaign Agent loop is intentionally excluded from the approved target architecture. Opptium should use a provider-neutral Campaign Agent loop implemented with the Vercel AI SDK and OpenRouter, with Trigger.dev responsible for durable execution.

---

## 1. Product definition

Opptium is an **AI-operated B2B market discovery, lead qualification and outbound preparation platform**.

It is not primarily:

- a static company database;
- an email scraper;
- a traditional CRM;
- a simple outreach sequencer;
- a chat interface wrapped around a fixed search pipeline.

Its core value is that the user gives Opptium a commercial objective, and the system actively determines how to research the market, which companies are relevant, which people should be contacted and how the outreach should be prepared.

The central product promise is:

> Opptium operates the first stage of B2B business development: understanding the offer, discovering the market, qualifying opportunities, identifying decision-makers and preparing relevant outreach.

The product should feel like an **AI campaign operator**, not a collection of disconnected tools.

---

## 2. Primary user journey

The standard user journey is:

```text
Create company profile
        ↓
Create campaign
        ↓
AI interprets the commercial objective
        ↓
AI creates a market-discovery strategy
        ↓
AI searches and evaluates companies
        ↓
AI adjusts the strategy when necessary
        ↓
Relevant companies are qualified
        ↓
Suitable decision-makers are identified
        ↓
Selected contacts are enriched
        ↓
Personalized outreach is prepared
        ↓
User approves, exports or sends
        ↓
Campaign outcomes become reusable knowledge
```

The user should not need to manually design the full discovery pipeline.

The user provides:

- what their company offers;
- which product or service they want to promote;
- the campaign objective;
- target geography;
- relevant market constraints;
- exclusions;
- desired volume or budget.

Opptium determines:

- which market interpretation is appropriate;
- which sources should be searched;
- which search queries should be used;
- how broad or narrow the discovery should be;
- which companies deserve deeper research;
- which decision-maker roles are relevant;
- which contacts justify paid enrichment;
- how the outreach should be personalized.

---

## 3. Product positioning

Opptium should be positioned primarily as:

> **AI-powered B2B opportunity discovery and outbound preparation**

It should not be positioned only as a lead database or email sending service.

Its differentiation from products such as Apollo, Clay and traditional prospecting databases is:

1. The process begins with the user’s offer and commercial objective.
2. The system actively researches markets rather than only filtering a pre-existing contact database.
3. Companies are evaluated using information from websites, business sources and user materials.
4. Qualification is campaign-specific rather than based only on generic firmographics.
5. Decision-makers are selected based on the likely commercial relationship.
6. Outreach is grounded in the discovered company context.
7. The agent can revise its strategy when early results are poor.
8. The system retains structured lessons from previous campaigns.

Opptium may use databases such as People Data Labs, Coresignal or other providers, but those databases are **sources**, not the product itself.

---

## 4. Main application structure

Recommended navigation:

```text
Company Profile
Campaigns
Leads
Sequences
Usage & Credits
Settings
Help
```

A general dashboard is optional.

It should only remain if it provides meaningful operational value, such as:

- active campaign status;
- recently discovered opportunities;
- campaigns waiting for approval;
- credit usage;
- recent replies;
- system alerts.

It should not exist merely to show decorative statistics already available elsewhere.

### 4.1 Company Profile

The company profile contains stable information reused across campaigns.

#### Core fields

- company name;
- website;
- company description;
- products and services;
- primary value propositions;
- typical customer types;
- case studies;
- industries served;
- differentiators;
- supported markets;
- commercial constraints;
- uploaded materials.

#### Uploaded materials

Users may upload:

- presentations;
- brochures;
- product catalogues;
- price lists;
- case studies;
- technical documents;
- PDF specifications;
- sales materials;
- screenshots and diagrams.

Documents should be:

1. stored;
2. text-extracted;
3. divided into retrievable chunks;
4. embedded;
5. linked to their source document;
6. made available to the campaign agent when relevant.

The company profile should not force the user to define every possible future target market or decision-maker. Those details normally belong to an individual campaign.

### 4.2 Campaigns

A campaign represents a reusable commercial objective and its settings.

#### Campaign fields

- campaign name;
- selected product or service;
- objective;
- target geography;
- initial target description;
- industries;
- company characteristics;
- relevant use case;
- exclusions;
- target volume;
- budget or credit limit;
- preferred outreach language;
- outreach enabled or disabled;
- approval settings.

A campaign should be capable of having multiple runs.

```text
German Distributor Campaign
├── Run 1: initial broad discovery
├── Run 2: refined industrial distributors
└── Run 3: additional companies added one month later
```

This distinction is important:

```text
Campaign
= configuration and commercial objective

Campaign run
= one execution of that campaign
```

### 4.3 Leads

Leads should be primarily displayed as **companies with expandable contacts**.

Compact view:

```text
Company
Location
Industry
Qualification
Status
Contacts
Last activity
```

Expanded company row:

- qualification explanation;
- relevant website evidence;
- products or services;
- size and geography;
- potential commercial relationship;
- discovered signals;
- source links;
- relevant contacts;
- outreach status;
- research history;
- user notes.

Contacts belong to companies rather than being displayed as an unstructured global list.

The system may also provide a contact-focused view for outreach operations.

### 4.4 Sequences

Sequences contain:

- email steps;
- delay between steps;
- follow-up rules;
- optional LinkedIn or manual tasks;
- stop conditions;
- sending limits;
- approval requirements.

Initially, sequences should focus on:

- draft generation;
- manual approval;
- optional sending;
- follow-up scheduling.

Full-scale deliverability infrastructure should not be the first product priority.

---

## 5. Agentic behaviour

Opptium should be genuinely agentic, but its autonomy must be bounded.

The Campaign Agent should be able to:

- interpret an objective;
- build a plan;
- select tools;
- examine intermediate results;
- revise queries;
- repeat research when necessary;
- identify uncertainty;
- request clarification;
- decide where additional research is justified;
- produce a reasoned qualification result.

It should not have unrestricted control over:

- user permissions;
- billing;
- credits;
- bulk email sending;
- spending limits;
- arbitrary database operations;
- compliance rules;
- deletion of user data;
- provider credentials.

### 5.1 Agent execution cycle

The core execution cycle is:

```text
PERCEIVE
↓
RETRIEVE
↓
PLAN
↓
ACT
↓
EVALUATE
↓
REFINE OR CONTINUE
↓
GATE
↓
COMPLETE
↓
REFLECT
```

#### Perceive

The agent reads:

- company profile;
- campaign configuration;
- selected product;
- uploaded materials;
- budget and operational limits;
- previous run status;
- existing leads;
- user corrections.

#### Retrieve

The system retrieves relevant memory:

- previous successful queries;
- market terminology;
- rejected company patterns;
- user qualification corrections;
- known source quality;
- relevant document sections;
- similar previous campaigns.

#### Plan

The agent generates a structured discovery strategy.

```json
{
  "marketInterpretation": "European industrial automation distributors",
  "targetCompanyTypes": [
    "industrial automation distributor",
    "systems integrator",
    "specialized electrical wholesaler"
  ],
  "excludedTypes": [
    "consumer electronics retailer",
    "manufacturer with no distribution activity"
  ],
  "geographies": ["Germany", "Austria"],
  "initialSources": ["web_search", "company_database"],
  "searchQueries": [],
  "qualificationSignals": [],
  "risks": []
}
```

#### Act

The agent invokes approved tools.

#### Evaluate

The agent evaluates:

- relevance ratio;
- duplicate ratio;
- geographic coverage;
- source quality;
- missing company categories;
- false-positive patterns;
- cost per accepted company;
- whether additional research is justified.

#### Refine

The agent may:

- narrow terminology;
- broaden terminology;
- change source;
- add exclusions;
- alter geographic scope;
- research market-specific terminology;
- request user clarification.

#### Gate

The workflow pauses when:

- the objective has two materially different interpretations;
- paid enrichment exceeds a configured threshold;
- a new target segment is proposed;
- the user must approve outreach;
- sending is about to begin;
- campaign cost may exceed the agreed budget.

#### Reflect

At the end of the run, the system creates structured campaign learnings.

---

## 6. Agent structure

Begin with **one Campaign Agent**.

Do not initially implement multiple artificial roles such as:

- Market Research Agent;
- Qualification Agent;
- Contact Agent;
- Copywriting Agent;
- Supervisor Agent.

That structure would increase model calls and complexity without proving that separate agents improve the result.

The initial Campaign Agent can use specialized deterministic tools and internal sub-tasks.

```text
Campaign Agent
├── campaign interpretation
├── discovery planning
├── query selection
├── result evaluation
├── qualification decisions
├── clarification requests
└── completion summary
```

Later, individual tasks may become sub-agents if there is clear evidence that they require separate:

- instructions;
- context;
- model configuration;
- evaluation criteria;
- memory.

---

## 7. Agent tools

The agent must not receive unrestricted database or internet access.

It receives a controlled toolset.

### 7.1 Context tools

```text
read_company_profile
read_campaign
read_campaign_run
retrieve_relevant_documents
retrieve_campaign_memory
read_existing_leads
```

### 7.2 Discovery tools

```text
search_web
search_company_database
search_business_directory
search_registry
inspect_company_website
extract_company_information
find_similar_companies
```

### 7.3 Evaluation tools

```text
evaluate_discovery_batch
qualify_company
compare_company_to_campaign
detect_duplicate_company
identify_missing_information
```

### 7.4 Contact tools

```text
identify_relevant_roles
search_company_contacts
enrich_contact
verify_email
estimate_enrichment_cost
```

### 7.5 Outreach tools

```text
generate_outreach_draft
generate_followup_draft
create_sequence_draft
request_outreach_approval
schedule_approved_message
```

### 7.6 Operational tools

```text
record_progress_event
request_user_clarification
save_campaign_learning
finish_campaign_phase
```

Each tool must have:

- a typed input schema;
- a typed output schema;
- permission checks;
- campaign-run context;
- cost checks;
- idempotency;
- logging;
- timeout handling;
- error classification.

---

## 8. AI usage

AI should be used where interpretation or reasoning adds value.

### 8.1 Suitable AI tasks

#### Company-profile understanding

- interpret the business model;
- identify products and offers;
- extract relevant market terminology;
- summarize uploaded materials;
- identify possible customer types.

#### Campaign interpretation

- understand the commercial objective;
- detect ambiguity;
- translate user language into structured criteria;
- propose a discovery strategy.

#### Search strategy

- generate source-specific search queries;
- infer synonyms and industry terminology;
- identify adjacent company categories;
- revise queries after evaluating results.

#### Website analysis

- extract relevant business information;
- determine whether the company performs the required activity;
- identify products, markets and signals;
- distinguish weak keyword matches from real commercial relevance.

#### Qualification

- compare evidence against campaign criteria;
- assign a structured qualification result;
- explain positive and negative factors;
- identify missing evidence.

#### Contact-role selection

- infer which job roles likely own the relevant commercial decision;
- distinguish procurement, partnership, distribution, technical and executive roles.

#### Outreach

- generate grounded personalization;
- explain why the company is relevant;
- adapt language to the recipient’s role;
- create follow-ups without inventing facts.

#### Reflection

- summarize what worked;
- identify recurring false positives;
- propose reusable search lessons;
- record user corrections in structured form.

### 8.2 Tasks that should remain deterministic

- duplicate detection;
- credit deduction;
- budget enforcement;
- provider rate limits;
- permissions;
- workflow status;
- email sending limits;
- unsubscribe rules;
- campaign ownership;
- database writes;
- record deletion;
- exact calculations;
- retries;
- idempotency;
- audit logging.

AI may recommend an action, but application logic validates and executes it.

---

## 9. Model strategy

Opptium should not be tied to one model or one model provider.

Use a model-routing layer.

```text
Opptium AI services
        ↓
Model router
        ↓
OpenRouter or direct provider
├── OpenAI
├── Anthropic
├── Google
├── Mistral
└── other supported models
```

### 9.1 Model roles

Suggested logical roles:

```text
campaign_planning
search_query_generation
website_extraction
company_qualification
contact_role_selection
outreach_generation
document_analysis
reflection
embedding
```

Configuration table:

```text
ai_model_configs
- id
- task_type
- provider
- model_id
- fallback_model_id
- temperature
- max_output_tokens
- timeout
- cost_limit
- enabled
```

Example strategy:

- stronger reasoning model for campaign interpretation;
- inexpensive fast model for extraction;
- reliable structured-output model for qualification;
- strong writing model for outreach;
- low-cost embedding model for memory and document retrieval.

Model selection should be configurable without changing business logic.

---

## 10. Memory architecture

Opptium needs several different types of memory.

They must not be treated as one large chat history.

### 10.1 Working memory

Working memory contains the immediate context for one agent run:

- current objective;
- current plan;
- current search iteration;
- recent tool results;
- unresolved uncertainty;
- current agent messages.

This is temporary execution context.

SDK session history should not become Opptium’s authoritative business memory.

### 10.2 Operational state

Operational state is stored in normal relational tables:

- campaigns;
- campaign runs;
- discovery queries;
- companies;
- contacts;
- qualification records;
- messages;
- approvals;
- usage;
- provider calls.

This is authoritative product data.

### 10.3 Document memory

Document memory contains chunks extracted from:

- company profile documents;
- campaign-specific files;
- product materials;
- case studies;
- previous research reports.

Each chunk should store:

```text
document_chunks
- id
- organisation_id
- document_id
- content
- page_number
- section
- embedding
- metadata
- created_at
```

### 10.4 Campaign memory

Campaign memory contains structured observations learned during one campaign.

Examples:

- a query that returned strong results;
- a source that produced mostly irrelevant companies;
- a recurring false-positive type;
- market-specific terminology;
- a qualification rule corrected by the user;
- a contact role that proved more appropriate than expected.

Schema:

```text
campaign_memories
- id
- organisation_id
- campaign_id
- campaign_run_id
- scope
- category
- statement
- evidence_ids
- confidence
- user_approved
- embedding
- created_at
- expires_at
```

Categories:

```text
successful_query
failed_query
false_positive_pattern
positive_signal
negative_signal
source_quality
qualification_correction
role_correction
user_preference
market_terminology
```

### 10.5 Organisation memory

Organisation memory contains stable preferences that may apply across campaigns:

- preferred tone;
- excluded company types;
- minimum company size;
- industries the user does not want;
- qualification corrections repeatedly confirmed;
- outreach style requirements.

Information should only be promoted from campaign memory to organisation memory when:

- the user explicitly confirms it;
- it has been repeatedly observed;
- it is clearly not campaign-specific.

### 10.6 Market memory

Market memory contains reusable, non-client-specific discoveries:

- industry terminology;
- common company categories;
- relevant public directories;
- registry availability;
- common job titles;
- source quality by geography.

Market memory must not contain confidential customer information.

### 10.7 Memory retrieval

Retrieval should combine:

- semantic vector similarity;
- exact keyword matching;
- metadata filters;
- organisation isolation;
- campaign filters;
- recency;
- confidence;
- approval state.

Memory should always be scoped by tenant and context.

The agent must never retrieve memories belonging to another organisation.

### 10.8 Memory-writing rules

The model should not freely create permanent memory.

A proposed memory must include:

- category;
- scope;
- statement;
- evidence;
- confidence;
- origin;
- retention policy.

Sensitive or broadly applicable memories may require user approval.

Users should be able to:

- inspect memories;
- edit them;
- delete them;
- reject proposed learnings;
- prevent specific information from being reused.

---

## 11. Workflow architecture

The recommended orchestration is:

```text
Next.js
    ↓
Trigger.dev
    ↓
Campaign Agent
    ↓
Controlled tools and services
    ↓
Supabase and external providers
```

### 11.1 Trigger.dev responsibility

Trigger.dev runs:

- long-running campaign tasks;
- parallel discovery batches;
- qualification batches;
- retries;
- queues;
- scheduled follow-ups;
- enrichment jobs;
- document processing;
- pause-and-resume workflows;
- realtime progress events.

It replaces the need to build a generic background worker and queue system on Railway during the MVP.

It does not replace all general hosting.

### 11.2 Campaign execution workflow

```text
execute_campaign
    ↓
load_campaign_context
    ↓
retrieve_relevant_memory
    ↓
create_discovery_strategy
    ↓
validate_strategy
    ↓
run_discovery_iteration
    ↓
evaluate_results
    ↓
continue?
├── refine and repeat
├── ask user
└── proceed
    ↓
qualify_companies
    ↓
select_enrichment_candidates
    ↓
request approval if required
    ↓
discover and enrich contacts
    ↓
prepare outreach
    ↓
request sending approval
    ↓
complete run
    ↓
generate campaign learnings
```

### 11.3 Bounded discovery loop

The agent must not loop indefinitely.

Example limits:

```text
max_discovery_iterations: 5
max_queries_per_iteration: 10
max_results_per_query: 50
max_companies_inspected: 500
max_deep_research_companies: 100
max_llm_cost: configured per campaign
max_provider_cost: configured per campaign
```

The agent decides how to use the available budget.

The application decides the maximum budget.

### 11.4 Human-in-the-loop

The system pauses when necessary.

Example:

```text
The phrase “distribution partners” has two plausible meanings:

A. Companies that could distribute your products.
B. Manufacturers looking for distributors.

Which market should I research?
```

---

## 12. Campaign run states

Recommended statuses:

```text
draft
queued
planning
waiting_for_input
discovering
evaluating
qualifying
waiting_for_enrichment_approval
enriching
preparing_outreach
waiting_for_outreach_approval
scheduled
completed
partially_completed
failed
cancelled
```

Recommended phase fields:

```text
current_phase
current_iteration
progress_percentage
companies_discovered
companies_qualified
contacts_found
provider_cost
llm_cost
last_activity_at
```

---

## 13. Database structure

### 13.1 Core tenancy

```text
organisations
organisation_members
users
```

Every business record should contain `organisation_id` or be reachable through an organisation-owned parent.

Use PostgreSQL row-level security where appropriate.

### 13.2 Company profile

```text
company_profiles
company_products
company_services
company_case_studies
company_documents
document_chunks
```

### 13.3 Campaigns

```text
campaigns
campaign_targets
campaign_exclusions
campaign_settings
campaign_runs
campaign_run_events
campaign_approvals
campaign_questions
campaign_memories
```

### 13.4 Discovery

```text
discovery_strategies
discovery_iterations
discovery_queries
discovery_query_results
source_executions
```

### 13.5 Companies and leads

```text
companies
company_domains
company_sources
company_snapshots
campaign_companies
qualification_results
qualification_evidence
```

`companies` represents the normalized organisation.

`campaign_companies` stores campaign-specific status and relevance.

The same company may appear in multiple campaigns with different qualification results.

### 13.6 Contacts

```text
contacts
contact_roles
contact_sources
contact_enrichments
campaign_contacts
email_verifications
```

### 13.7 Outreach

```text
sequences
sequence_steps
outreach_drafts
outreach_messages
message_events
sending_accounts
unsubscribe_records
```

### 13.8 Usage and costs

```text
usage_ledger
provider_requests
ai_requests
campaign_costs
credit_transactions
```

Every external call should record:

- provider;
- operation;
- campaign run;
- units used;
- estimated cost;
- status;
- duration;
- retry count.

---

## 14. Idempotency and duplicate protection

Every expensive operation must have an idempotency key.

Examples:

```text
discovery search:
run + provider + normalized query + filters

website inspection:
run + company + website snapshot version

qualification:
run + company + qualification schema version

contact enrichment:
run + contact + provider

outreach generation:
run + contact + sequence step + prompt version
```

Before repeating a provider call, the system checks whether a completed matching execution already exists.

---

## 15. Qualification system

Qualification should not be a single unexplained AI score.

Recommended result:

```json
{
  "status": "qualified",
  "score": 82,
  "confidence": 0.86,
  "positiveSignals": [
    {
      "criterion": "Distributes industrial automation equipment",
      "evidence": "..."
    }
  ],
  "negativeSignals": [],
  "missingEvidence": [],
  "relationshipHypothesis": "Potential regional distributor",
  "recommendedRoles": [
    "Managing Director",
    "Business Development Director",
    "Product Manager"
  ],
  "summary": "..."
}
```

Recommended statuses:

```text
highly_relevant
qualified
possible
insufficient_evidence
not_relevant
excluded
```

The score should help sort companies, but status and evidence are more important than the number.

Qualification criteria should be versioned.

When criteria change, previous results should remain traceable to the version that produced them.

---

## 16. Discovery sources

Discovery should be source-agnostic.

Potential sources:

- search engines;
- Tavily or comparable search APIs;
- company databases;
- People Data Labs;
- Coresignal;
- national business registries;
- industry directories;
- association member directories;
- marketplace and exhibitor directories;
- company websites;
- public LinkedIn information where legally and technically appropriate;
- user-provided lists.

The agent selects sources according to:

- geography;
- industry;
- campaign goal;
- expected coverage;
- cost;
- source reliability;
- legal and operational constraints.

Different campaigns may use different source strategies.

```text
Local restaurants
→ maps and local directories

European manufacturers
→ search, industry directories and company databases

Regulated companies
→ national registries

Technology startups
→ databases, company websites and funding sources
```

---

## 17. Contact discovery and enrichment

Do not enrich every discovered company immediately.

Recommended funnel:

```text
Discovered companies
        ↓
Basic relevance filtering
        ↓
Website inspection
        ↓
Qualification
        ↓
Select qualified companies
        ↓
Identify relevant job roles
        ↓
Search for people
        ↓
Enrich only selected contacts
        ↓
Verify contact data
```

This prevents expensive enrichment from being spent on weak companies.

Contact-selection logic should consider:

- campaign objective;
- product complexity;
- company size;
- probable decision ownership;
- geography;
- available seniority.

---

## 18. Outreach

Outreach must be grounded in evidence.

Each generated message should know:

- why the company was selected;
- which company signal is relevant;
- what Opptium’s customer offers;
- why the recipient’s role is suitable;
- which claims are confirmed;
- which facts must not be invented.

Recommended message data:

```text
recipient
company
campaign
qualification evidence
personalization evidence
message objective
tone
language
sequence step
approval state
```

The interface should allow the user to inspect the evidence used for personalization.

Initially:

- drafts are generated;
- user approves;
- messages may be exported or sent;
- follow-ups are scheduled;
- replies stop the sequence.

Sending limits and compliance remain deterministic.

---

## 19. Progress and transparency

The user should see meaningful progress rather than internal chain-of-thought.

```text
✓ Analysed company profile
✓ Interpreted campaign objective
✓ Created discovery strategy
✓ Generated 7 initial queries

● Discovering companies
  126 companies inspected
  38 retained as candidates

○ Qualification
○ Decision-maker research
○ Outreach preparation
```

Show:

- actions taken;
- result counts;
- source names;
- summarized decisions;
- cost;
- blockers;
- approval requests;
- evidence.

Do not show:

- hidden reasoning;
- raw internal prompts;
- provider secrets;
- arbitrary model thought traces.

---

## 20. Recommended technology stack

### Frontend

```text
Next.js App Router
React
TypeScript
Custom CSS and Opptium design tokens
Zustand only where client state is genuinely needed
TanStack Table or custom compact tables if required
```

The Vercel AI SDK can be used for chat-style streaming interfaces and structured generation in Next.js.

### Backend and database

```text
Next.js server routes / server actions
Supabase PostgreSQL
Supabase Auth
Supabase Storage
PostgreSQL row-level security
pgvector
```

Supabase PostgreSQL remains the authoritative store for business data and can also store embeddings using pgvector.

Do not introduce MongoDB merely for agent memory.

### Agent runtime

Recommended:

```text
Opptium-owned provider-neutral Campaign Agent loop
```

Use this layer for:

- campaign-loop instructions;
- typed tool definitions;
- structured outputs;
- provider-neutral model execution;
- bounded multi-step tool use;
- working-state persistence through Opptium and Trigger.dev;
- application-owned approvals;
- AI usage and trace logging.

The Vercel AI SDK handles model communication, structured outputs, streaming and tool calls. OpenRouter remains the default model gateway, with optional direct provider adapters where needed.

### Model access

```text
OpenRouter as default model gateway
Direct OpenAI access where OpenAI-specific features are required
Optional direct Anthropic or Google connections later
```

Use provider-independent service interfaces.

### Durable execution

```text
Trigger.dev Cloud
```

Use it for:

- campaign jobs;
- queues;
- concurrency;
- retries;
- parallel tasks;
- schedules;
- waiting for user input;
- realtime progress;
- long-running work.

### Hosting

Initial stack:

```text
Vercel
Supabase
Trigger.dev
OpenRouter
External search and enrichment APIs
```

Railway is not required initially.

Add Railway later only for workloads such as:

- persistent Playwright browser pools;
- proxy infrastructure;
- custom crawler services;
- Python services;
- self-hosted models;
- continuously running specialist APIs.

### Observability

Initial:

```text
Trigger.dev run dashboard
Opptium-owned provider-neutral Campaign Agent loop tracing
Application logs
Provider request logs
Campaign run events
Sentry
```

Later:

```text
Langfuse, OpenTelemetry or a dedicated AI-observability platform
```

---

## 21. Security and tenant isolation

Required controls:

- every agent tool receives organisation context;
- database access is tenant-scoped;
- tools never accept arbitrary organisation IDs from the model;
- secrets remain server-side;
- agent run state must not contain provider secrets;
- uploaded files use private storage;
- document retrieval applies organisation filters;
- outreach actions require permission checks;
- destructive actions require explicit application-level authorization.

---

## 22. Cost controls

Every campaign should have configurable limits:

```text
maximum discovery iterations
maximum search queries
maximum companies inspected
maximum deep-research operations
maximum contacts enriched
maximum emails verified
maximum AI cost
maximum data-provider cost
maximum total campaign cost
```

The agent can receive a tool such as:

```text
get_remaining_campaign_budget
```

Every paid tool checks the remaining allowance before execution.

The user interface should show:

```text
Estimated cost
Current spend
Remaining budget
Companies discovered
Qualified companies
Cost per qualified company
Contacts enriched
```

---

## 23. MVP scope

The MVP should prove one central promise:

> Can Opptium independently discover and qualify genuinely relevant B2B companies more effectively than a user manually filtering a database?

### MVP includes

- company profile;
- campaign creation;
- one Campaign Agent;
- campaign planning;
- web and database discovery;
- iterative query refinement;
- company website inspection;
- campaign-specific qualification;
- compact company results table;
- expandable qualification evidence;
- contact-role recommendation;
- limited contact enrichment;
- outreach drafts;
- campaign progress;
- contextual clarification;
- cost tracking;
- structured campaign memory.

### MVP does not require

- multiple cooperating agents;
- LangGraph;
- Temporal;
- a dedicated Railway worker;
- advanced CRM integrations;
- a full email-deliverability platform;
- autonomous bulk sending;
- complex visual workflow builders;
- self-hosted models;
- fully automatic long-term memory;
- hundreds of integrations.

---

## 24. Implementation phases

### Phase 1: Foundation refactor

- finalize company and campaign schemas;
- separate campaign from campaign run;
- create campaign run events;
- extract discovery and qualification into services;
- introduce typed provider adapters;
- add idempotency;
- add provider-cost logging.

### Phase 2: Durable execution

- integrate Trigger.dev;
- move campaign execution out of HTTP requests;
- introduce task queues;
- add retries;
- add run status synchronization;
- build realtime progress UI.

### Phase 3: Campaign Agent

- integrate Opptium-owned provider-neutral Campaign Agent loop;
- create one Campaign Agent;
- expose a limited toolset;
- let it create discovery strategies;
- let it choose and revise queries;
- preserve deterministic budgets.

### Phase 4: Discovery and qualification

- run bounded discovery loops;
- inspect websites;
- normalize companies;
- detect duplicates;
- generate structured qualification;
- provide evidence and confidence.

### Phase 5: Memory and documents

- process uploaded documents;
- enable pgvector;
- implement scoped retrieval;
- save campaign learnings;
- allow users to inspect and reject memory.

### Phase 6: Contacts and outreach

- identify decision-maker roles;
- integrate enrichment providers;
- verify contacts;
- generate grounded outreach;
- add approval flow;
- schedule follow-ups.

### Phase 7: Commercial validation

Measure:

- relevant companies per campaign;
- qualification acceptance rate;
- user correction rate;
- cost per qualified company;
- contact-found rate;
- email verification success;
- draft approval rate;
- response rate;
- repeat campaign usage;
- willingness to pay.

---

## 25. Final architectural decision

The recommended core architecture is:

```text
Next.js + React
        ↓
Supabase PostgreSQL / Auth / Storage / pgvector
        ↓
Trigger.dev durable campaign tasks
        ↓
Opptium-owned provider-neutral Campaign Agent loop
        ↓
Vercel AI SDK / model-routing layer
        ↓
OpenRouter and optional direct providers
        ↓
Search, company-data, enrichment and email services
```

LangGraph is not required.

The system remains agentic because the Campaign Agent can:

- plan;
- select tools;
- evaluate results;
- revise its strategy;
- request clarification;
- continue from saved execution state;
- learn from structured outcomes.

Trigger.dev provides durable execution rather than agent intelligence.

The Agents SDK provides the controlled agent loop rather than general-purpose hosting.

Supabase remains the authoritative store for product state and long-term memory.

OpenRouter preserves model flexibility.

The most important implementation principle is:

> Keep intelligence, orchestration, business state and external services as separate layers.

```text
AI agent
= decides what should happen

Trigger.dev
= ensures the work reliably happens

Application services
= perform controlled operations

Supabase
= stores authoritative state

External providers
= supply search, company and contact data
```

This gives Opptium genuine agentic behaviour without turning the entire application into an opaque AI workflow.
