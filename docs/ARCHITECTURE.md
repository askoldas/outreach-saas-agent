# Architecture

Opptium is one Next.js 16 application plus a durable Node research worker. Supabase provides authentication, Postgres persistence, and RLS. The browser never receives service-role or provider credentials.

The web layer handles authenticated composition and bounded mutations. Workspace-scoped repositories own database access. The worker claims persisted research tasks and checkpoints retry-safe progress. Provider SDK behavior stays behind Tavily/OpenRouter adapters. Deterministic code owns authorization, transitions, validation, deduplication, cost estimates, cancellation, and user actions; AI is reserved for narrow schema-validated interpretation and generation.

Long-term bounded modules are Company Profile Intelligence, Campaign Strategist, Discovery Engine, Company Research, Identity Resolution, Qualification, Contact Discovery/Enrichment, Outreach Composer, and a deterministic orchestrator. These remain feature/service boundaries inside the current repository rather than speculative microservices.

Company Profile is persisted as one stable workspace record with immutable numbered versions. Campaign creation selects the current version and atomically stores an immutable JSON snapshot through database triggers. Application routes, campaign repositories, and research workers use only Company Profiles, snapshots, and immutable Strategy versions.

Website analysis freezes the current profile-version identifier into a durable task. The worker discovers public website evidence through Tavily, sends only the frozen profile plus retrieved sources to a schema-validated OpenRouter extractor, and saves a new immutable `website_analysis` version through a service-role-only database function. The version retains run and prompt provenance; AI generation logs retain exact source input and raw/structured output. Estimated and actual usage are separate immutable events.

Authenticated progress endpoints expose only the latest workspace-scoped durable run and task aggregates. A shared polling surface renders pending/running state, current step, percentage, task completion, failures, and the last persisted error for Company Profile analysis and campaign operations. Polling stops at a terminal state and refreshes the server-rendered result. Synchronous Strategy generation exposes its pending and error state directly in the Strategy workspace.

Strategy generation and refinement are server-authorized OpenRouter operations grounded in the immutable campaign profile snapshot, canonical campaign brief, and current Strategy version. The complete structured response is schema validated before the existing version RPC creates a new immutable Strategy. AI generation logs retain the prompt version, instruction, frozen inputs, raw response, structured output, and saved Strategy version identifier. Strategy-generation usage is recorded as its own operation.

Campaign Strategy follows the same immutable-version principle. Each campaign owns numbered structured versions; saving creates a new version and supersedes only editable predecessors. A research-run insert freezes the selected version and marks it used. Discovery and qualification workers load that frozen version rather than mutable campaign compatibility columns.

Campaign-local Leads and Outreach pages use workspace-and-campaign-scoped repository queries. Lead rows join persisted qualification dimensions, evidence claims, and public contact routes. Recipient recommendations are deterministic projections over approved leads; user acceptance is persisted in `lead_outreach_states`. Enrichment lifecycle and failures, immutable exports with frozen payloads, and immutable operation-level usage events are persisted.

Historical export downloads are generated on demand from the immutable JSON payload rather than mutable campaign rows. The download route re-establishes the authenticated current workspace, queries the export by both workspace and record identifier, emits CSV locally, and disables shared caching. No provider or public object URL is involved.

Approved-company contact enrichment is a durable worker operation. Tavily receives a company-domain-scoped contact query; returned public evidence is parsed deterministically and combined with saved evidence and shallow first-party page checks. Each provider-derived route persists provider, query, source title, source URL, and verification time. No guessed addresses or private contact data are generated.

Draft generation is queued only for approved leads with accepted recipient selections. Each durable task captures the exact Company Profile and Campaign Strategy version identifiers before execution. The worker loads those frozen inputs with lead evidence and the selected public route, validates structured OpenRouter output, logs generation provenance, and upserts one reviewable primary draft per campaign lead. Retries are idempotent at the draft boundary; generation never sends a message.

Deterministic domain modules own validation, recipient recommendation, export shaping, estimates, and state boundaries. Authentication, tenant isolation, persisted repositories, ordered migrations, provider adapters, and the durable worker are the retained foundations.

Tenant isolation is verified at the database boundary with pgTAP against a disposable local Supabase stack. The suite impersonates separate authenticated owners, exercises campaign profile/strategy creation and the persisted outreach workflow, and asserts that cross-workspace reads and writes are blocked by RLS. CI starts a fresh database, applies ordered migrations, runs these tests, and discards it.

Schema retirement was guarded by a service-role-only readiness audit and completed by migration `20260719000600`. Discovery, qualification, Strategy pages, and draft generation fail closed when canonical frozen context is missing.
