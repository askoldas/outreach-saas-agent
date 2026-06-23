# Architecture

## 1. Architectural style

The current implementation starts as one conventional root Next.js application focused on the product interface.

It is an interface-first prototype using typed mock data. It demonstrates the intended workflow without real authentication, persistence, providers, queues, workers, or email sending.

Future production architecture may grow into separate runtime surfaces:

1. a web application for interactive user requests;
2. a durable worker for long-running research workflows.

Those surfaces should be extracted only when real runtime requirements appear. Until then, feature folders inside `src/` are the internal module boundary.

## 2. Working technology direction

The current interface prototype uses:

- Next.js with the App Router for the dashboard and server endpoints;
- TypeScript in strict mode;
- CSS Modules and global design tokens;
- centralized typed mock data.

Later implementation may add:

- PostgreSQL hosted through Supabase;
- Supabase Auth for initial authentication;
- a durable job platform or queue-backed worker for research workflows;
- provider adapters for search, crawling, registries, enrichment, and language models;
- Vercel for the web application, unless runtime constraints require another host.

Provider choices that are not yet accepted remain replaceable. See `docs/DECISIONS.md`.

## 3. System context

```text
User
  |
  v
Web dashboard
  |
  +----> PostgreSQL / Auth / Storage
  |
  +----> Job dispatch
             |
             v
        Research worker
             |
             +----> Search providers
             +----> Public websites / permitted sources
             +----> Registry and directory adapters
             +----> LLM providers
             +----> PostgreSQL checkpoints and results
```

The browser never calls research, crawling, model, or service-role database providers directly.

## 4. Main components

### 4.1 Web application

The web application handles:

- authentication and workspace selection;
- offer creation and approval;
- campaign creation and strategy review;
- short server-side mutations;
- lead browsing, filtering, and review;
- draft review and external compose actions;
- run progress and diagnostics display;
- administrative settings later.

Web requests should remain bounded. Starting a campaign creates a `research_run`, validates permission and quota, and dispatches background work.

### 4.2 Research worker

The worker executes long-running, resumable workflows.

A research run is divided into persisted steps, for example:

1. build or confirm search plan;
2. execute discovery queries;
3. normalize candidate identities;
4. deduplicate candidates;
5. fetch public company sources;
6. extract structured company facts;
7. find additional evidence and contact routes;
8. qualify lead;
9. prepare outreach readiness data;
10. optionally generate drafts for eligible approved leads;
11. finalize diagnostics and usage.

Each step must be retry-safe. The worker should resume from persisted state rather than restart the entire run after a transient failure.

### 4.3 Domain package

The domain package owns deterministic rules and schemas shared across runtimes.

Examples:

- normalized domain identity;
- campaign state transitions;
- lead state transitions;
- scoring aggregation;
- confidence labels;
- evidence claim types;
- outreach eligibility;
- deduplication outcomes.

### 4.4 Database layer

PostgreSQL is the system of record.

It stores:

- tenant and membership data;
- user-approved seller information;
- campaigns and their strategy versions;
- workflow state and checkpoints;
- normalized companies and campaign leads;
- source documents and evidence claims;
- qualification results;
- public contacts;
- outreach drafts;
- activity and audit records;
- provider execution and usage metadata;
- suppression and compliance data when sending is introduced.

The database layer exposes typed repositories or service functions. UI components and prompt code must not issue ad hoc queries throughout the codebase.

### 4.5 AI task layer

The AI layer contains narrow, schema-validated tasks rather than one open-ended autonomous agent.

Examples:

- analyze offer;
- propose ideal customer segments;
- plan campaign sources and queries;
- extract company information from source material;
- assess qualification dimensions;
- suggest a relevant contact role;
- draft evidence-based outreach.

Workflow orchestration remains in application or worker code. Models do not decide authorization, spending, sending, or irreversible state changes.

### 4.6 Provider adapters

External dependencies are accessed through internal interfaces.

Examples:

```ts
interface SearchProvider {
  search(input: SearchRequest): Promise<SearchResultPage>;
}

interface PageFetcher {
  fetch(input: FetchRequest): Promise<FetchResult>;
}

interface LanguageModelProvider {
  generateStructured<T>(input: StructuredGenerationRequest<T>): Promise<ModelResult<T>>;
}
```

The exact interfaces will be refined in code. The important rule is that domain workflows depend on internal contracts, not concrete SDK response shapes.

## 5. Core workflow

### 5.1 Offer analysis

1. User submits seller information.
2. Server stores the raw input.
3. AI task proposes a normalized offer profile.
4. Schema validation rejects malformed output.
5. User reviews and approves claims.
6. Approved version becomes available to campaigns.

AI-proposed claims cannot silently become approved seller claims.

### 5.2 Campaign planning

1. User selects an approved offer and market constraints.
2. System creates a draft campaign.
3. AI proposes segments, local terms, source types, and qualification criteria.
4. User reviews and starts the campaign.
5. System freezes a strategy version for the research run.

Later edits create a new strategy version; they do not rewrite historical run inputs.

### 5.3 Lead discovery and research

1. Worker generates bounded search tasks from the frozen strategy.
2. Search adapters return candidates and source URLs.
3. Candidate identities are normalized.
4. Existing campaign leads are checked before insert.
5. Allowed sources are fetched with rate limiting.
6. Structured facts and evidence claims are extracted.
7. Qualification runs against campaign criteria.
8. Lead state becomes `needs_review` or an explicit failure state.

### 5.4 Outreach preparation

1. User approves a lead.
2. System checks that the offer version and evidence are sufficient.
3. Draft task receives only approved seller claims and selected prospect evidence.
4. Generated output is validated and stored with prompt/model metadata.
5. User edits, approves, copies, or opens the draft in an external email client.

The platform does not infer that external sending succeeded.

## 6. Data ownership and tenancy

Every tenant-owned aggregate is linked to a workspace directly or through an unambiguous parent.

Authorization sequence:

1. authenticate user;
2. resolve workspace membership;
3. verify role and operation;
4. execute a workspace-scoped query;
5. rely on RLS as defense in depth.

Workers use trusted credentials but must still pass an explicit workspace context and write workspace identifiers to every tenant-owned record.

## 7. Idempotency

Idempotency is required for all background actions.

Suggested keys:

- one discovery task per `research_run + strategy_query`;
- one source fetch per `normalized_url + freshness_window`;
- one campaign lead per `campaign + normalized_company_identity`;
- one qualification per `lead + criteria_version + evidence_version`;
- one draft generation per `lead + offer_version + evidence_selection + prompt_version`.

Retries should return or update the existing result instead of producing duplicates.

## 8. Versioning

Version these product assets:

- approved offer profiles;
- campaign strategies;
- qualification criteria;
- prompt templates;
- structured AI schemas where compatibility changes;
- outreach drafts;
- evidence snapshots or evidence selections used in decisions.

Historical records should preserve which versions produced a result.

## 9. Failure handling

Failures must be categorized rather than collapsed into one generic error.

Suggested categories:

- validation failure;
- permission failure;
- quota or billing limit;
- provider authentication failure;
- provider rate limit;
- transient provider failure;
- blocked or disallowed source;
- page fetch failure;
- extraction failure;
- schema-invalid AI output;
- insufficient evidence;
- workflow cancellation;
- internal error.

Users need concise status messages. Detailed diagnostics belong in run records and protected logs.

A partial run may still produce useful leads. One failed source must not invalidate unrelated successful work.

## 10. Observability

Use structured events carrying identifiers such as:

- request ID;
- workspace ID;
- campaign ID;
- research run ID;
- lead ID;
- workflow step;
- provider category and adapter;
- attempt number;
- duration;
- normalized outcome;
- usage units and estimated cost when available.

Do not log full secrets, authentication headers, unrestricted source bodies, or complete outreach content by default.

The product dashboard should surface operational diagnostics relevant to users:

- progress;
- counts by state;
- failed and retried tasks;
- provider limitations;
- incomplete research;
- estimated usage.

## 11. Caching and freshness

Caching should reduce provider cost without presenting stale facts as current.

Store:

- normalized URL;
- retrieval timestamp;
- content hash;
- fetch status;
- source freshness policy;
- last successful extraction;
- last observed change where detectable.

Company identity may be shared internally across campaigns, but tenant-specific qualification, notes, drafts, and decisions must remain isolated.

Any cross-tenant reuse of public source data requires a deliberate privacy and product decision. Do not implement it accidentally through missing workspace filters.

## 12. File and document ingestion

Document upload is a later MVP extension.

When introduced:

1. upload to workspace-scoped storage;
2. validate type and size;
3. scan or isolate before processing where supported;
4. extract text asynchronously;
5. retain provenance to file and page or section;
6. never treat extracted marketing claims as approved until user review.

## 13. Email integration evolution

### MVP

- copy draft;
- `mailto:` or supported external compose link;
- manual status update by the user.

### Later

- OAuth-based Gmail or Microsoft integration;
- create draft in mailbox;
- explicit send action;
- delivery state where available;
- reply detection;
- follow-up scheduling;
- suppression and compliance controls.

Sending must remain a separate bounded subsystem and must not be embedded into the research worker.

## 14. Deployment boundaries

Initial deployment units:

- `web`: Next.js application;
- `research-worker`: durable job execution;
- `database`: Supabase/PostgreSQL;
- external provider services.

A separate API service is not required initially. Add one only when integration, runtime, or scaling constraints clearly justify it.

## 15. Scaling approach

Scale by workload category rather than splitting by domain entity:

- web traffic scales independently;
- research concurrency is controlled by queue and provider rate limits;
- page fetching has separate concurrency limits;
- model calls have budget and retry controls;
- database indexes follow measured query patterns;
- large exports or imports become background jobs.

Do not optimize for massive bulk outreach before validating lead quality and user workflow.
