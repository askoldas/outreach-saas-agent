# Delivery Roadmap

## 1. Delivery approach

Build the product as vertical slices, but establish tenant safety, workflow state, and provider boundaries first.

Each milestone should end with a usable, testable state. Codex tasks should normally implement one acceptance criterion or one tightly related group, not an entire milestone in one prompt.

## Milestone 0: Foundation documentation

Status: in progress through the documentation PR.

Deliverables:

- product definition;
- repository-wide Codex instructions;
- repository structure;
- architecture;
- domain model;
- AI pipeline;
- security and compliance requirements;
- testing strategy;
- accepted and proposed decisions;
- Codex working process.

Acceptance:

- medical is clearly a test scenario, not a core specialization;
- MVP excludes automatic sending;
- evidence and inference are separate concepts;
- long-running work is separate from web requests;
- core objects and boundaries are named consistently.

## Milestone 1: Interface-first root application

Goal: create a polished root Next.js dashboard prototype without external business integrations.

Deliverables:

- root Next.js application;
- strict TypeScript configuration;
- responsive application shell;
- offer, campaign, lead, evidence, qualification, and draft review screens;
- centralized typed mock data;
- linting and formatting;
- local development scripts;
- `.env.example`;
- local setup documentation.

Acceptance:

- clean install from a locked dependency graph;
- formatting check, lint, type check, and production build run through documented commands;
- the prototype demonstrates the intended workflow with realistic horizontal mock data;
- no external provider secret is required to render the starter application;
- no backend, provider, queue, worker, or email-sending behavior is implied as working.

Recommended Codex task sequence:

1. root Next.js scaffold and design system;
2. overview dashboard;
3. offers interface;
4. campaign interface;
5. lead review and evidence interface;
6. outreach draft review interface;
7. responsive QA and documentation cleanup.

## Milestone 2: Supabase and tenant foundation

Goal: establish authentication and workspace isolation before product entities.

Deliverables:

- Supabase local setup;
- ordered migrations;
- user profile where required;
- workspace table;
- workspace membership table;
- initial roles;
- RLS policies;
- server and browser client boundaries;
- workspace creation and selection UI;
- authorization service helpers;
- integration tests for cross-workspace denial.

Acceptance:

- a user can sign in and create a workspace;
- the owner can view that workspace;
- another user cannot read or mutate it by ID;
- service-role use exists only in trusted server modules;
- migrations apply from an empty database;
- seed data is fictional.

Do not add campaigns or AI before tenant isolation tests pass.

## Milestone 3: Offer profiles

Goal: let a user define what the business sells and approve a reusable structured version.

Deliverables:

- offer and offer-version migrations;
- offer list and editor;
- manual structured offer input;
- draft, review, approval, and superseding lifecycle;
- approved-claim separation;
- activity records;
- first AI task contract for offer analysis;
- fake model adapter for local tests;
- one configurable real model adapter behind an interface;
- cross-sector fixtures.

Acceptance:

- user can create an offer without AI;
- AI can propose a structured version when configured;
- malformed model output is rejected;
- user must explicitly approve the version;
- only approved versions are eligible for campaigns;
- no medical-only fields or prompts exist in shared code.

## Milestone 4: Campaign planning

Goal: create a campaign from an approved offer and freeze a visible strategy.

Deliverables:

- campaign and strategy-version migrations;
- campaign creation flow;
- free-form geography and target-market input;
- campaign objectives;
- exclusions;
- strategy planning AI task;
- editable strategy review;
- start readiness validation;
- campaign activity history.

Acceptance:

- one offer can support multiple campaigns;
- the same campaign can receive a new strategy version without rewriting old runs;
- the strategy exposes segments, search terms, sources, criteria, and limitations;
- user constraints are distinguishable from AI suggestions;
- campaign cannot start without an approved offer and strategy snapshot.

## Milestone 5: Durable research runner

Goal: establish safe, resumable workflow execution before real discovery volume.

Deliverables:

- selected durable-job platform or queue implementation;
- research run and task tables;
- worker deployment shell;
- task idempotency;
- retry classification;
- cancellation;
- progress events;
- fake discovery provider;
- dashboard run status;
- workflow integration tests.

Acceptance:

- starting a campaign returns promptly and creates a queued run;
- worker executes outside the web request;
- duplicate task delivery produces no duplicate result;
- transient failure retries;
- permanent failure is visible;
- cancellation stops future bounded steps;
- partial success remains inspectable.

## Milestone 6: Discovery and company research

Goal: produce deduplicated leads with source-backed company facts.

Deliverables:

- first search-provider adapter;
- provider-neutral search contract;
- candidate normalization;
- URL and domain normalization;
- lead and source migrations;
- campaign-level deduplication;
- permitted page-fetch adapter;
- source storage and freshness metadata;
- company extraction AI task;
- evidence-claim storage;
- run diagnostics and provider usage.

Acceptance:

- a campaign can discover candidate companies from a real provider;
- rerunning the same query does not duplicate campaign leads;
- company facts link to source URLs and retrieval time;
- facts and inferences are stored separately;
- failed pages do not fail unrelated leads;
- provider payloads do not leak into shared domain types;
- fixtures include medical and unrelated sectors.

## Milestone 7: Qualification and lead review

Goal: turn researched candidates into transparent, reviewable leads.

Deliverables:

- qualification and dimension migrations;
- reusable scoring contract;
- hard exclusion evaluation;
- qualification AI task;
- deterministic score and readiness post-processing;
- lead table with filters and status;
- lead detail page with evidence;
- approve, reject, archive, and request-more-research actions;
- structured rejection reasons;
- activity history.

Acceptance:

- each qualification dimension shows score, confidence, explanation, and evidence;
- hard exclusions override model recommendations;
- insufficient evidence is not presented as high confidence;
- user can understand why a lead was selected;
- cross-workspace and cross-lead evidence references are rejected;
- rejection feedback is stored for campaign improvement.

## Milestone 8: Public contacts

Goal: identify lawful public contact routes without overstating verification.

Deliverables:

- contact migration and lifecycle;
- extraction of general emails, department emails, contact forms, phones, and public professional references;
- source and verification status;
- suggested relevant department or role;
- contact selection UI;
- optional enrichment provider interface, without logged-in LinkedIn automation.

Acceptance:

- every contact shows its source;
- source-confirmed and provider-verified are distinct;
- general contact is usable when a named person is unavailable;
- the system does not invent a contact person or role;
- invalid or removed contacts can be marked without deleting history.

## Milestone 9: Outreach drafts and external compose

Goal: prepare useful grounded outreach while keeping sending outside the platform.

Deliverables:

- outreach draft and action migrations;
- draft eligibility service;
- primary and short email variants;
- optional follow-up draft;
- evidence selection;
- edit, approve, reject, and supersede behavior;
- copy action;
- safe `mailto:` or supported external compose action;
- manual contacted and replied statuses;
- CSV export.

Acceptance:

- draft uses an approved offer version;
- factual prospect personalization links internally to active evidence;
- unsupported details are absent;
- user can edit before approval;
- opening compose does not mark the message sent;
- no automatic send endpoint exists;
- export remains workspace-scoped.

## Milestone 10: Product hardening and private beta

Goal: make the generic workflow stable enough for real pilot users.

Deliverables:

- onboarding refinement;
- run-cost and quota controls;
- provider fallback where justified;
- operational dashboards;
- deletion and export workflows;
- retention implementation;
- abuse and workspace suspension controls;
- security headers and rate limits;
- production incident notes;
- cross-sector evaluation suite;
- medical pilot campaign;
- at least two non-medical validation campaigns.

Acceptance:

- lead quality and cost can be measured per campaign;
- no known tenant-isolation issue;
- provider failures are understandable and recoverable;
- deletion and export behavior is documented and tested;
- the product works for the three validation sectors without custom core branches;
- private beta limitations are clearly communicated.

## Later milestones

Consider only after private-beta evidence supports them:

- mailbox draft creation through Microsoft or Gmail OAuth;
- explicit integrated sending;
- reply detection;
- scheduled follow-ups;
- CRM integrations;
- team collaboration and assignments;
- billing and lead credits;
- document and catalogue ingestion;
- registry-specific adapters by country;
- agency workspaces;
- API and webhooks;
- optional n8n integration adapter.

Each later sending feature requires the separate controls listed in `docs/SECURITY_AND_COMPLIANCE.md`.

## Current next action

After the interface prototype lands, the next task should add targeted UI tests or begin the next backend milestone only after the product workflow is reviewed.
