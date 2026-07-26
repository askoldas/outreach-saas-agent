# Opptium current-state audit

Audit date: 2026-07-25

## Audit basis and method

This is a read-only implementation audit against
`docs/opptium-product-technical-specification-updated.md`. The task brief names
`docs/opptium-product-technical-specification.md`, which is not present. The updated file
identifies itself as the approved target, so it is the target used here. One sentence in
its Status section says the Opptium-owned loop is "intentionally excluded" immediately
before requiring that same loop; the rest of the specification and the task brief
unambiguously approve a provider-neutral Opptium-owned loop and exclude LangGraph and
OpenAI Agents SDK. This audit uses that unambiguous interpretation.

Confirmed facts below come from repository code and migrations. Statements marked
**Inference** describe likely intent or production risk that cannot be proven from source
alone. No application code, migration, dependency, or configuration was changed.

## A. Executive summary

The repository is a persisted, tenant-aware MVP and is materially closer to the target
than a prototype. Reusable foundations include Next.js App Router and server actions,
Supabase Auth/PostgreSQL with broad RLS coverage, immutable Company Profile and Campaign
Strategy versions, frozen run context, a separately runnable database-backed worker,
Tavily and OpenRouter adapters, schema-checked AI outputs, evidence-aware lead
qualification, selective contact enrichment, grounded draft generation, activity,
exports, and usage events.

It is not yet the approved architecture. The current worker executes a fixed task graph;
there is no Campaign Agent planning/evaluation loop, Vercel AI SDK, Trigger.dev,
provider/task model routing, canonical company/contact layer, document pipeline,
long-term campaign memory, approvals/waitpoints, or enforceable budget ledger. The
existing worker is useful business behavior and should be wrapped and paralleled before
its orchestration is replaced.

### Five largest architectural gaps

1. **Durable orchestration and agent loop:** `src/workers/research-worker.ts` polls
   `research_tasks` and dispatches a fixed sequence. Trigger.dev and the bounded,
   provider-neutral Campaign Agent loop do not exist.
2. **Canonical prospect model:** `public.leads` contains both company identity and
   campaign membership. `lead_contact_routes` is not a reusable contact/person model.
   There are no `companies`, `campaign_companies`, `contacts`, or
   `campaign_contacts`.
3. **Operational/audit model:** `research_runs` and `research_tasks` provide useful
   execution state, but there are no first-class run events, questions, approvals,
   provider executions, configurable AI requests/models, idempotency ledger, or budget
   reservations.
4. **Documents and memory:** there are no upload buckets, document metadata/chunks,
   embeddings, pgvector, campaign memories, or organisation preferences. Website
   extracts are embedded inside profile JSON and source rows.
5. **AI/provider layer:** AI calls use a custom OpenRouter `fetch` wrapper and a single
   environment-selected model. Vercel AI SDK, per-task routing, typed tool interfaces,
   usage-token/cost capture, and direct-provider fallback adapters are absent.

### Five greatest migration risks

1. Splitting `leads` can alter domain normalization, deduplication, stable IDs, report
   rows, draft foreign references, and current worker output.
2. Replacing worker task claiming/retries in one cutover can duplicate paid provider
   calls or change timing, attempt counts, partial completion, and user-visible progress.
3. Existing production rows use text `campaign_id`/`campaign_external_id` and
   `lead_external_id` in several tables while newer relations use UUIDs. Backfills must
   preserve both routes during transition.
4. AI schema or provider changes can alter qualification scores, evidence, contact
   selection, and drafts even when the surrounding architecture is correct.
5. Existing `usage_events` are estimates/events, not an idempotent balance or provider
   cost ledger. Introducing enforcement without reconciliation could double-charge or
   unexpectedly block runs.

### Where implementation should begin

Begin with contracts and service extraction, not the Campaign Agent and not destructive
database replacement. First freeze current worker behavior with fixtures and trace IDs;
extract provider-neutral, typed services around discovery, qualification, enrichment,
and draft generation; add append-only execution/audit records and idempotency keys. Only
then introduce canonical companies/contacts through additive shadow writes and
backfills. Trigger.dev can subsequently invoke the same services in shadow/feature-
flagged paths while the current worker remains the rollback path.

## B. Current architecture map

### Runtime

```text
Next.js 16.2.9 / React 19.2.7
  -> App Router pages and server components
  -> server actions in src/server/*/actions.ts
  -> repositories using an authenticated Supabase SSR client
  -> Supabase PostgreSQL/Auth with RLS

Long-running path
  -> server action
  -> insert research_runs + research_tasks
  -> separately launched `pnpm worker`
  -> claim_next_research_task(worker_id) with service role
  -> fixed task dispatcher
  -> Tavily/OpenRouter
  -> persisted leads/evidence/contacts/drafts/usage/progress
  -> polling progress route
```

Hosting assumptions are Vercel for Next.js and a persistent process such as Railway for
the worker (`docs/RAILWAY_WORKER_DEPLOYMENT.md`, `docs/DECISIONS.md`). There is no queue
SDK, Trigger.dev package, cron, or scheduled follow-up runtime.

### Company Profile flow

```text
/company-profile
  -> CompanyWebsiteSettings / CompanyProfileWorkspace
  -> updateCompanyWebsiteAction or analyzeCompanyProfileWebsiteAction
  -> authenticated workspace resolution
  -> versioned profile repository / enqueue analyze_company_profile
  -> worker fetches website through Tavily
  -> analyzeCompanyProfile() through OpenRouter
  -> save_analyzed_company_profile_version_v* RPC
  -> immutable company_profile_versions + current version pointer
  -> campaign creation freezes campaign_profile_snapshots
```

Stable seller context is stored in `company_profile_versions`, including a rich
`structured_profile` JSON document, extracted facts, review questions, readiness and
provenance. The current prompt correctly avoids profile-stage target geographies,
personas, and campaign strategy. Uploaded materials are represented in UI wording and
the target type shape, but no upload/storage/parser implementation exists.

### Campaign flow

```text
/campaigns/new
  -> CampaignBriefForm
  -> createCampaignAction
  -> campaigns row
  -> database trigger freezes Company Profile snapshot
  -> initial immutable campaign_strategy_versions row
  -> optional generateCampaignStrategyAction (synchronous OpenRouter call)
  -> save_campaign_strategy_version RPC
  -> startCampaignResearchAction
  -> research_runs + search_web task
  -> worker expands evaluate_lead and enrich_contacts tasks
  -> lead review, drafts and CSV export
```

Campaign configuration and execution are partially separated: `campaigns` is reusable
and multiple `research_runs` can reference it. Runs freeze a strategy version. There is
no generic resume from an agent checkpoint, user clarification, approval waitpoint,
run-event stream, or run-specific campaign memory. Re-running discovery is possible;
the unique `(workspace_id, campaign_id, url)` source constraint and lead upserts reduce
duplicates but also mean source history is not cleanly run-scoped.

### Worker entry points and working behavior

- Process entry: `src/workers/research-worker.ts`.
- Claim boundary: `src/workers/lib/claim-task.ts` calls
  `public.claim_next_research_task`.
- Status/retry boundary: `src/workers/lib/task-status.ts`.
- Task handlers:
  `search-web.ts`, `evaluate-lead.ts`, `enrich-contacts.ts`,
  `generate-draft.ts`, and `analyze-company-profile.ts`.
- Configuration: `src/workers/lib/worker-config.ts` and `.env.example`.

Working behavior to preserve:

- database leases, attempt counts, maximum attempts, stale-lease recovery, and run
  aggregation;
- immutable profile and strategy context for later tasks;
- Tavily discovery, result classification, domain/url-based duplicate controls and
  discovery reporting;
- one-lead-at-a-time qualification failures without discarding unrelated leads;
- structured evidence and qualification persistence;
- contact enrichment only after qualification/approval paths;
- grounded, idempotent draft upsert;
- persisted progress visible through polling routes;
- service-role isolation to worker code.

Any future orchestration change can affect provider call order, parallelism, rate limits,
retry timing, profile/strategy snapshots, result counts, scoring, enrichment spend,
draft text, and progress. Validate old and new paths in parallel on saved provider
fixtures before cutover.

### Responsibility/coupling findings

UI, actions, repositories, provider adapters, and worker handlers are visibly separated.
However, worker handlers still combine orchestration, reads, provider calls,
normalization, business decisions, and persistence. `evaluate-lead.ts` is especially
large and writes AI audit rows, leads, evidence, dimensions, sources, and downstream
tasks. Campaign strategy generation runs synchronously in a server action
(`src/server/campaign-strategy/actions.ts`), making a potentially 120-second model call
part of a request. Guided interpretation also makes direct model calls from server
actions. These should become bounded services/tasks without changing their schemas.

No circular dependency was proven by static import inspection. **Inference:** the
largest practical coupling is data-contract coupling through text external IDs and
worker handlers, rather than an ES-module cycle.

## C. Current database inventory

There are 26 public tables created by 25 ordered migrations. Migrations are append-only
in practice; `20260719000600` retires the `offers` table and duplicated strategy
columns. No generated Supabase database type file was found. No views, materialized
views, database enums, storage buckets/policies, or pgvector extension were found.
`pgcrypto` is enabled.

All tenant business tables carry `workspace_id` except `profiles`; child lead tables
derive tenant access through their parent but also store workspace ownership where
defined. RLS is enabled on the created business tables, with member-read/admin-write
patterns. Worker-only RPCs are revoked from ordinary roles and granted to
`service_role`.

| Current entity                  | Current purpose / important key and ownership                                             | Used by                                               | Target equivalent                               | Recommendation          |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- | ----------------------- |
| `profiles`                      | User display name/locale; PK/FK `auth.users.id`                                           | workspace/auth repositories                           | user profile                                    | retain                  |
| `workspaces`                    | Tenant root; UUID PK, creator FK, status                                                  | all tenant flows                                      | `organisations`                                 | rename later            |
| `workspace_members`             | Membership/role; composite PK                                                             | auth/workspace/RLS helpers                            | organisation members                            | rename later            |
| `company_profiles`              | One logical profile per workspace, current version pointer                                | company profile repository                            | company profiles                                | retain                  |
| `company_profile_versions`      | Immutable seller context, structured JSON, facts, questions, provenance                   | profile UI, campaign snapshots, worker                | profile versions/products/services              | extend                  |
| `campaign_profile_snapshots`    | Frozen profile version/JSON per campaign                                                  | worker and drafts                                     | campaign profile snapshot                       | retain                  |
| `offers`                        | Former duplicated offering/profile model                                                  | no current application fallback; retired by migration | products/services                               | deprecate               |
| `campaigns`                     | Reusable campaign config; UUID PK + scoped external ID; current profile/strategy pointers | campaign pages/actions/worker                         | campaigns                                       | extend                  |
| `campaign_strategy_versions`    | Immutable interpreted strategy and criteria                                               | strategy UI, runs, worker                             | campaign strategy/config version                | retain                  |
| `research_runs`                 | One execution with status/progress/error and frozen strategy                              | worker, progress UI, repositories                     | campaign runs                                   | extend                  |
| `research_tasks`                | Database queue, payload/result, lease, retry counters                                     | current worker                                        | legacy task queue / provider-neutral executions | retain during migration |
| `lead_sources`                  | Search/extraction rows and classification; unique URL per workspace/campaign              | search/evaluation worker                              | sources + campaign-company evidence             | extend                  |
| `leads`                         | Campaign-scoped company plus qualification summary/state                                  | lead UI/repository/worker                             | `companies` + `campaign_companies`              | replace                 |
| `lead_qualification_dimensions` | Dimension scores/confidence/explanation                                                   | worker/repository/UI                                  | qualification result dimensions                 | retain                  |
| `lead_evidence_claims`          | fact/inference/unknown/conflict with URL/provenance                                       | worker/repository/UI/drafts                           | evidence/qualification evidence                 | retain                  |
| `lead_contact_routes`           | Public route/person-like value and role, verification provenance                          | enrichment, selection, drafts                         | contacts + campaign contacts/routes             | replace                 |
| `lead_outreach_states`          | Per-lead enrichment and recipient selection state                                         | outreach/worker                                       | campaign contact selection                      | merge later             |
| `outreach_drafts`               | Grounded variants and review state; now freezes profile/strategy/task references          | draft worker/UI                                       | outreach drafts/messages                        | extend                  |
| `export_records`                | Persisted CSV payload/history                                                             | outreach routes/repository                            | exports                                         | retain                  |
| `usage_events`                  | Operation-level estimated/actual credits and metadata                                     | strategy, worker, export, usage UI                    | usage/cost ledger                               | extend                  |
| `ai_generations`                | Provider/model/prompt/input/output/status audit                                           | AI worker/action sites                                | AI requests                                     | extend                  |
| `activity_events`               | User-visible changes                                                                      | dashboard/repositories                                | audit/run events                                | extend                  |
| `ai_guided_drafts`              | Non-authoritative guided proposal by scope/entity/version                                 | guided UI/actions                                     | temporary working context                       | retain                  |
| `ai_applied_changes`            | Applied guided changes/audit                                                              | guided repository                                     | audit events                                    | retain                  |
| `ai_conversations`              | Guided UI conversation container                                                          | guided repository                                     | temporary working context                       | retain                  |
| `ai_messages`                   | Guided user/assistant messages                                                            | guided repository                                     | temporary working context                       | retain                  |

### Migrations

1. `20260618000100_create_tenant_foundation.sql`
2. `20260618000200_harden_create_workspace_rpc.sql`
3. `20260618000300_create_leads.sql`
4. `20260618000400_create_offers.sql`
5. `20260618000500_create_campaigns.sql`
6. `20260618000600_create_drafts.sql`
7. `20260618000700_create_activity_events.sql`
8. `20260622000100_add_lead_qualification_state.sql`
9. `20260622000200_allow_activity_cleanup.sql`
10. `20260623000100_add_campaign_industry_terms.sql`
11. `20260624000100_add_campaign_discovery_report.sql`
12. `20260624000200_create_research_worker_tables.sql`
13. `20260624000300_add_ai_generation_prompt_version.sql`
14. `20260719000100_create_company_profiles_and_campaign_snapshots.sql`
15. `20260719000200_create_campaign_strategy_versions.sql`
16. `20260719000300_persist_outreach_exports_and_usage.sql`
17. `20260719000400_add_grounded_draft_generation.sql`
18. `20260719000500_add_legacy_retirement_readiness_audit.sql`
19. `20260719000600_retire_legacy_offer_and_strategy_columns.sql`
20. `20260719000700_add_company_profile_analysis.sql`
21. `20260719000800_add_strategy_generation_usage.sql`
22. `20260719000900_add_contact_verification_provenance.sql`
23. `20260723000100_clear_all_workspace_data.sql`
24. `20260723000200_create_structured_company_profiles.sql`
25. `20260723000300_fix_company_profile_json_projection.sql`
26. `20260723000400_make_analyzed_profile_rpc_explicit.sql`
27. `20260723000500_recover_expired_research_tasks.sql`
28. `20260723000600_fix_company_profile_prompt_version_column.sql`
29. `20260723000700_create_ai_guided_workflows.sql`

### Functions and triggers

Functions include tenant helpers (`is_workspace_member/admin/owner`,
`current_workspace_role`), workspace/profile creation, version-save RPCs, campaign
snapshot/strategy freezing, task claiming/stale recovery, guided-data clearing,
legacy-readiness audit, and workspace-data clearing. Update triggers cover mutable
tables; auth-user/workspace/campaign/run triggers create or freeze canonical context.

Important production backfills already visible in migrations include initial Company
Profiles/snapshots, initial strategy versions, outreach states, structured profile
projection, and legacy offer retirement. Future company/contact splitting must backfill
every `lead`, contact route, draft, source, qualification, outreach state, and external
ID reference. Actual production row counts and legacy-readiness RPC output are not
available from the repository.

## D. Feature-by-feature gap analysis

| Area            | Current state                                             | Target state                                         | Gap                                                                                                    | Priority | Risk   |
| --------------- | --------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- | ------ |
| Runtime         | Next.js + Supabase + persistent polling worker            | Next.js + Supabase + Trigger.dev                     | Durable platform migration                                                                             | High     | High   |
| Agent           | Fixed task expansion                                      | One bounded Campaign Agent loop                      | No plan/evaluate/refine/gate cycle                                                                     | High     | High   |
| Company Profile | Rich versioned structured profile and website AI analysis | Stable reusable context + documents                  | No documents/vector retrieval; products live in JSON                                                   | Medium   | Medium |
| Campaign        | Reusable row + immutable strategy + multiple runs         | Config/run/questions/approvals                       | No clarification or approval model                                                                     | High     | Medium |
| Discovery       | Tavily queries, classification, raw sources, report       | Agent-selected iterative multi-source discovery      | One provider; mostly fixed queries; no batch evaluation loop                                           | High     | High   |
| Companies       | Campaign-bound lead row                                   | Canonical company + campaign company                 | Identity/participation conflated                                                                       | High     | High   |
| Qualification   | Structured score/dimensions/evidence                      | target result object and versioned schema            | Missing explicit positive/negative arrays, missingEvidence, relationship hypothesis, recommended roles | High     | High   |
| Contacts        | Public routes discovered/enriched after gating            | reusable contacts + per-campaign selection           | Person/routes conflated; no canonical contact                                                          | High     | High   |
| Outreach        | Grounded reviewed drafts and CSV export                   | drafts, sequences, approvals, optional later sending | No sequence entity, scheduling, reply/stop/unsubscribe                                                 | Medium   | Medium |
| AI              | OpenRouter custom wrapper, prompt constants, parsers      | Vercel AI SDK + model router + typed tools           | Single model config; incomplete cost/usage; custom JSON parsing                                        | High     | Medium |
| Documents       | Website content only                                      | Storage, parse, chunks, embeddings                   | Entire document pipeline absent                                                                        | Medium   | Medium |
| Memory          | Guided conversations and immutable snapshots              | campaign/org/document memory                         | No structured learnings/retrieval                                                                      | Medium   | Medium |
| Usage           | estimated/actual credit events                            | budgets, ledger, provider/model cost                 | No balance, reservation, token/currency cost, idempotency                                              | High     | High   |
| Security        | Authenticated workspace resolution + RLS                  | org-isolated tools/tasks/storage                     | Good base; no storage/provider rate limiting; service-role relies on worker payload integrity          | High     | Medium |
| UI              | All target nav routes exist                               | operational screens backed by target model           | Usage/settings/help partly sparse; Sequences is drafts/export, not sequences                           | Medium   | Low    |

### Discovery details

`src/lib/discovery/query-builder.ts` deterministically creates queries from Campaign
Strategy. `search-web.ts` invokes Tavily, classifies results, persists `lead_sources`,
normalizes/collapses candidate websites, upserts leads, and queues evaluation. Tavily
extract is used for website content. Source URLs, retrieval time (row creation), content,
classification, score and query are retained. The unique source constraint is
campaign-wide, not run-wide. Retry occurs at task level, not adapter level; Tavily has
no explicit timeout in its adapter. Search is asynchronous and user-triggered but not
agent-selected. Existing adapter/query/classification/report functions are strong
service/tool candidates.

### Companies and qualification

Companies and contacts are not separate canonical entities. A company can appear in
multiple campaigns only as duplicated `leads` rows. Qualification is correctly
campaign-specific because it hangs from a campaign lead and a frozen Strategy. Evidence
is preserved separately. Current report rows can map to `campaign_companies`, while
company identity fields should be backfilled to canonical `companies`.

`src/lib/ai/lead-evaluation.ts` accepts company/source evidence plus profile and strategy
context, uses prompt `lead-evaluator-v1`, and parses a structured response. Stored
results include fit score, confidence, summary, dimensions, evidence kinds and
qualification state. Against the target object:

- `status`: partial equivalent in `qualification_status` and lead status;
- `score`: present as `fit_score`;
- `confidence`: present;
- `positiveSignals` / `negativeSignals`: not first-class output arrays;
- `missingEvidence`: represented indirectly by unknown/conflict evidence and summaries;
- `relationshipHypothesis`: not first-class;
- `recommendedRoles`: strategy contains roles but result does not;
- `summary`: present.

There is no stored qualification schema-version column separate from prompt version.
Worker fallback persists failure/manual-review states rather than corrupting success.

### Contacts and paid work

Contact enrichment uses Tavily (`src/lib/providers/contact-enrichment.ts`) and runs
after relevant lead states, rather than enriching every raw discovery result. It stores
source attribution and verification provenance, handles duplicates, and records a usage
event. It does not perform independent email verification; "source_confirmed" means a
public source showed the route. There is no monetary provider-cost record, pre-call
budget reservation, or provider-call idempotency record. Retries may repeat Tavily paid
calls after a failure occurring between the provider response and persistence.

### Outreach and sequences

Draft generation freezes Company Profile and Strategy references and uses saved lead
evidence and a selected public route. Drafts support primary/short/follow-up variants,
manual edits, approval/rejection and CSV export. There is no send integration by
accepted MVP decision. Sequence scheduling, delay rules, replies, automatic stop rules,
suppression/unsubscribe and sending are absent. `/sequences` is therefore an outreach
draft/export workspace, not a true sequence engine. Marketing pages that imply
automation are positioning pages, not proof of implementation.

### Documents and state classification

- Authoritative operational data: workspaces, profiles, profile/strategy versions,
  campaigns/runs/tasks, leads, evidence, qualifications, contacts/routes, drafts,
  exports, usage, activities.
- Temporary working context: `research_tasks.payload_json/result_json`,
  `ai_guided_drafts`, `ai_conversations`, `ai_messages`.
- Document memory: absent.
- Campaign memory: absent; discovery reports are operational summaries, not retrievable
  structured learning.
- Organisation preference: some preference fields are embedded in structured Company
  Profile JSON; no separate promotion/approval model.
- Disposable/redundant: retired `offers`; duplicated company fields across campaign
  leads; raw AI output can be retention-sensitive.

## E. AI-call inventory

All calls use `src/lib/providers/openrouter.ts`, a direct OpenRouter Chat Completions
`fetch` with JSON mode, temperature 0.2, environment primary/fallback models and a
default 120-second timeout. It validates transport shape and truncation but returns only
text; downstream parsers validate application schemas. Token usage returned by
OpenRouter is discarded. No Vercel AI SDK is installed.

| Call/site                                                             | Purpose                                            | Model/provider                                                      | Input/output and validation                                                                               | Proposed future role                                    |
| --------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `analyzeCompanyProfile()` in `src/lib/ai/company-profile-analysis.ts` | turn website evidence into grouped seller context  | env model / OpenRouter; prompt `company-profile-website-v3-grouped` | sources + current structured profile -> facts/profile/questions; extensive deterministic parser/readiness | synchronous AI service invoked by document/profile task |
| `generateCampaignStrategy()` in `src/lib/ai/strategy-generation.ts`   | interpret profile + brief into strategy            | env model / OpenRouter; versioned prompt                            | profile snapshot + brief -> validated strategy                                                            | Campaign Agent tool/service; currently request-bound    |
| `evaluateLead()` in `src/lib/ai/lead-evaluation.ts`                   | campaign-specific qualification                    | env model / OpenRouter; `lead-evaluator-v1`                         | strategy/profile/company evidence -> structured score/dimensions/evidence                                 | `qualify_company` tool/service                          |
| `generateDraft()` in `src/lib/ai/draft-generation.ts`                 | grounded outreach variants                         | env model / OpenRouter; versioned prompt                            | frozen seller claims + evidence + route -> validated subject/body/warnings                                | `generate_outreach_draft` service/tool behind approval  |
| guided interpretation in `src/lib/ai/guided-interpretation.ts`        | propose non-authoritative profile/campaign changes | env model / OpenRouter                                              | scope, canonical version, conversation -> validated proposal                                              | ordinary guided UI service, not Campaign Agent memory   |

`analyze-company-profile.ts`, `evaluate-lead.ts`, and `generate-draft.ts` write
`ai_generations`; campaign strategy action also logs a generation. Guided interpretation
does not use the same generation audit path. Usage events exist for several operations,
but no site captures prompt/completion tokens, actual provider currency cost, HTTP
attempt ID, or fallback model actually selected. The single wrapper is a useful
provider boundary but cannot route logical roles or direct providers without extension.

Prompts are centralized by task file rather than routes, but they are still inline
system strings rather than standalone prompt assets. There is no duplicated
qualification prompt proven outside `lead-evaluation.ts`; profile parsing contains
legacy and grouped-shape compatibility branches.

## F. Candidate service extraction map

| Existing function/code                               | Proposed service                 | Side effects          | Agent tool candidate? | Trigger task candidate? |
| ---------------------------------------------------- | -------------------------------- | --------------------- | --------------------- | ----------------------- |
| `buildDiscoveryQueries`                              | discovery planning/query service | none                  | yes                   | no                      |
| Tavily `searchWeb`                                   | web-search adapter/service       | paid network call     | yes                   | child                   |
| Tavily `extractWebPages`                             | website inspection service       | paid network call     | yes                   | child                   |
| result classifier/normalizer in discovery modules    | candidate normalization service  | none                  | yes                   | no                      |
| search persistence in `search-web.ts`                | discovery repository transaction | DB writes/tasks       | no                    | parent/child boundary   |
| `evaluateLead`                                       | qualification AI service         | model call            | yes                   | child                   |
| evidence/dimension persistence in `evaluate-lead.ts` | qualification repository         | DB writes             | no                    | child                   |
| contact enrichment provider                          | contact-search service           | paid network call     | yes                   | child                   |
| deterministic `recommendContact`                     | recipient-selection service      | none                  | yes                   | no                      |
| `generateDraft`                                      | grounded draft AI service        | model call            | yes, gated            | child                   |
| draft upsert                                         | draft repository transaction     | DB writes             | no                    | child                   |
| profile website analysis                             | profile-understanding service    | Tavily/model/DB today | context tool/service  | child                   |
| CSV shaping                                          | export service                   | DB insert/download    | no                    | synchronous             |
| task status aggregation                              | execution progress service       | DB writes             | no                    | parent                  |

## G. Trigger.dev task candidates

These are future candidates only.

### `campaign-run`

- Current initiator: `startCampaignResearchAction` ->
  `enqueueCampaignResearchRun`.
- Payload: workspace/organisation ID, campaign UUID/external ID, run UUID, frozen
  profile/strategy IDs, budget and idempotency key.
- Result: terminal run summary, counts, cost, warnings and memory proposals.
- Dependencies: context readers, agent loop, discovery/qualification/enrichment tasks,
  events and budget service.
- Retry safety: only after every child operation has stable idempotency keys.
- Protection: unique run launch key and provider-execution keys.

### `discover-market-batch`

- Current initiator: `search_web` research task.
- Payload: run ID, planned queries/source, iteration, existing canonical company keys.
- Result: normalized candidate IDs, source IDs and batch metrics.
- Dependencies: Tavily adapter, normalizer, source/company repositories.
- Retry safety: partial today; campaign URL uniqueness helps but paid calls can repeat.
- Protection: query/source/iteration key and persisted provider execution before call.

### `qualify-company`

- Current initiator: tasks inserted by `search-web.ts`.
- Payload: run/campaign-company ID, profile/strategy versions, evidence snapshot/hash.
- Result: versioned qualification object and evidence links.
- Dependencies: AI router, schema parser, qualification repository.
- Retry safety: persistence upserts are mostly safe; model call can repeat/change.
- Protection: input hash + prompt/model configuration version.

### `enrich-qualified-company`

- Current initiator: evaluation or explicit outreach action.
- Payload: run/campaign-company ID, recommended roles, spend ceiling.
- Result: canonical contacts/routes, sources, verification and actual cost.
- Dependencies: qualification gate, contact provider, budget ledger.
- Retry safety: duplicate inserts are handled, but paid call repetition is possible.
- Protection: company/role/provider/input key and budget reservation.

### `generate-outreach-draft`

- Current initiator: `generate-draft` task from outreach action.
- Payload: campaign contact, frozen profile/strategy, evidence IDs, language/variant.
- Result: grounded reviewable draft.
- Dependencies: approved seller claims, selected route, model router.
- Retry safety: unique draft upsert is safe; repeated model cost/output variation remains.
- Protection: context hash + variant + prompt/model version.

### `analyze-company-profile`

- Current initiator: Company Profile server action.
- Payload: workspace/profile version, website/document source IDs.
- Result: new immutable structured profile version and questions.
- Dependencies: extraction services and model router.
- Retry safety: version-targeted save RPC guards stale writes; provider calls can repeat.
- Protection: profile version + source hash + prompt/model version.

### Human waitpoints

Campaign ambiguity, new target segment, enrichment budget exceedance, outreach approval,
and any future send action should be durable approval/clarification waits, not ordinary
tasks. Existing manual lead/draft review is UI state rather than a resumable workflow
waitpoint.

## H. Migration risks

### Schema compatibility and backfills

- Add canonical tables first. Do not rename/drop `leads` or text external-ID columns
  during initial migration.
- Backfill normalized domains with collision reports and manual resolution. URL-only
  uniqueness is not equivalent to canonical company identity.
- Create mapping tables from every legacy lead/contact route to new UUIDs.
- Preserve immutable Company Profile and Strategy references on existing runs/drafts.
- Regenerate database types only after additive migrations; currently no generated type
  artifact exists, so introduce one deliberately without mass refactoring.

### Route and UI compatibility

Existing routes use campaign external IDs and lead IDs. Keep read models/adapters that
emit current `Campaign`, `Lead`, `ContactRoute`, and `OutreachDraft` types until all
pages are migrated. Feature flags should select orchestration internally; URLs and
progress response shapes should remain stable.

### Worker and provider behavior

Do not switch task orchestration and data model simultaneously. First call extracted
services from the current worker. Add recorded provider executions before parallel
Trigger runs. Replay saved fixtures and compare candidate count, normalized domains,
evidence, scores/status, contact routes, drafts, calls, latency and retry outcomes.

### Duplicate execution and rollback

Use one global idempotency namespace shared by legacy worker and Trigger.dev. A feature
flag alone cannot prevent both systems claiming equivalent work. Rollback must disable
new dispatch while allowing in-flight tasks to finish or be cancelled, and must keep
dual-written rows readable. Never roll back by dropping additive canonical tables.

### User-visible state

Map legacy run/task/lead statuses explicitly to new run phases and campaign-company
states. Do not silently reinterpret completed, failed, manual-review, source-confirmed,
approved, or exported states. Treat AI/provider changes as product-output changes and
version them.

### Security

Server actions generally resolve `currentWorkspace` rather than trusting client IDs;
workspace switching validates membership, and RLS adds defense in depth. The worker
uses service role and therefore bypasses RLS: every Trigger/service task must resolve
workspace ownership from stored records, not trust payload IDs. No cross-tenant issue
was confirmed in inspected paths. Risks remain for future upload signed URLs, provider
rate limits, raw provider/AI payload retention, and the broad impact of service-role
bugs.

### Cost controls

Paid Tavily/OpenRouter calls lack a pre-call budget reservation and persistent request
idempotency. `estimateCredits` is deterministic display/accounting logic, not
enforcement. Introduce provider execution, reservation and settlement records before
increasing concurrency or retries.

## I. Open questions

These cannot be resolved from repository evidence:

1. Which Supabase project(s) contain production data, and what are row counts/collision
   rates for leads, domains, contact routes, legacy offers, incomplete snapshots, and
   stale tasks?
2. Are Tavily and OpenRouter currently billed per production workspace, and what actual
   rate/concurrency limits and negotiated costs apply?
3. Which current worker outputs are considered the acceptance baseline, and is there a
   saved representative production-safe fixture set?
4. Which geography/privacy retention periods and deletion obligations apply to raw
   source content, AI prompts/outputs and public contact data?
5. Is Trigger.dev Cloud or self-hosting intended, and what deployment region and
   environment separation are required?
6. What is the authoritative credit balance source and commercial conversion between
   credits and provider/model cost?

## J. Recommended implementation sequence

### Stage 1 — freeze current behavior

- Objective: establish a migration acceptance baseline.
- Affected: worker/provider/AI contract tests, synthetic fixtures, audit docs.
- Prerequisite: none.
- Result: repeatable outputs and call-count expectations for each task.
- Risk: low; fixtures may miss production edge cases.
- Validation: fixed input produces expected normalized companies, evidence,
  qualification, contacts, drafts, task transitions and usage rows.

### Stage 2 — extract typed application services

- Objective: separate provider calls, deterministic decisions and persistence from
  worker orchestration without behavior changes.
- Affected: `src/workers/tasks`, `src/lib/providers`, discovery/AI modules,
  repositories.
- Prerequisite: Stage 1.
- Result: current worker calls typed discovery/qualification/enrichment/draft services.
- Risk: medium.
- Validation: fixture parity and unchanged worker integration tests.

### Stage 3 — add execution, idempotency and cost observability

- Objective: append provider executions, AI request/config metadata, run events and
  budget reservation/settlement.
- Affected: new append-only migrations and service wrappers.
- Prerequisite: Stage 2 service boundaries.
- Result: every paid call has tenant/run context, stable key, attempt, selected provider/
  model, tokens/cost/status and retry classification.
- Risk: medium; dual accounting.
- Validation: duplicate delivery creates one paid execution; reconciliation matches
  legacy usage events.

### Stage 4 — introduce canonical companies additively

- Objective: separate global tenant company identity from campaign qualification.
- Affected: new `companies`, aliases/domains, `campaign_companies`, mappings and read
  adapters.
- Prerequisite: normalization baseline and idempotency.
- Result: shadow writes and backfill reports while `leads` remains authoritative.
- Risk: high due to collisions.
- Validation: every legacy lead maps exactly once or appears in an explicit exception
  report; current UI output is unchanged.

### Stage 5 — introduce canonical contacts additively

- Objective: split person/route identity from campaign-specific selection.
- Affected: contacts, routes, campaign contacts, verification and mappings.
- Prerequisite: canonical companies.
- Result: dual-written enrichment with provenance and no duplicate paid work.
- Risk: high due to ambiguous public routes.
- Validation: current selected recipient/draft context remains identical.

### Stage 6 — complete campaign-run control model

- Objective: add run phases/events/questions/approvals and explicit resume checkpoints.
- Affected: campaign run schema, progress read model and UI panels.
- Prerequisite: execution ledger.
- Result: durable, auditable state compatible with old worker and future Trigger tasks.
- Risk: medium.
- Validation: status mapping, cancellation, retry, clarification and approval tests.

### Stage 7 — add Vercel AI SDK model router

- Objective: provider-neutral logical task configuration with OpenRouter first and
  optional direct providers.
- Affected: provider/model adapters and AI services.
- Prerequisite: AI request ledger and fixture baseline.
- Result: typed structured output, per-task config, actual model/usage capture.
- Risk: high output drift.
- Validation: schema/regression fixtures and explicit old/new output comparison.

### Stage 8 — introduce Trigger.dev behind a feature flag

- Objective: run extracted child services and one parent campaign workflow durably.
- Affected: Trigger project/config, task adapters, deployment and callbacks.
- Prerequisite: Stages 2, 3 and 6.
- Result: shadow runs followed by controlled workspace/campaign rollout.
- Risk: high duplicate execution/timing change.
- Validation: shared idempotency, crash/retry/cancel tests, parity metrics and tested
  rollback to the current worker.

### Stage 9 — add the bounded Campaign Agent loop

- Objective: plan, act, evaluate, refine, gate and reflect using controlled tools.
- Affected: agent loop, typed tools, policy/budget gates and run checkpoints.
- Prerequisite: durable tasks, canonical model and audited tool services.
- Result: adaptive discovery without unrestricted DB/provider access.
- Risk: high cost/output variability.
- Validation: bounded iterations/cost, deterministic enforcement, clarification tests,
  and better fixture metrics than the fixed pipeline.

### Stage 10 — documents and memory

- Objective: Supabase Storage, parsing, chunks/pgvector, campaign/organisation memory
  with approval and retention.
- Affected: storage policies, document tasks, vector schema/retrieval and UI.
- Prerequisite: tenant-safe tools and durable processing.
- Result: source-linked retrieval and inspectable learnings.
- Risk: high security/privacy scope.
- Validation: RLS/signed URL isolation, prompt-injection tests, retrieval provenance,
  deletion and retention tests.

## Validation commands

- `corepack.cmd pnpm run lint` — passed.
- `corepack.cmd pnpm run typecheck` — passed.
- `corepack.cmd pnpm run test` — passed: 82 tests, 0 failures. Node emitted the
  repository's existing `MODULE_TYPELESS_PACKAGE_JSON` performance warnings.
- `corepack.cmd pnpm run format:check` — repository-wide check failed because it found
  the two new audit documents plus two pre-existing unformatted files:
  `docs/opptium-product-technical-specification-updated.md` and
  `src/app/(app)/campaigns/new/page.tsx`.
- `corepack.cmd pnpm exec prettier --write docs/audits/current-state-audit.md docs/audits/current-state-file-map.md`
  — formatted only the two deliverables.
- A final scoped Prettier check for both audit files passed. The two unrelated
  repository formatting findings were deliberately not modified.

Database and Playwright tests were not run because they require a disposable local
Supabase stack and browser setup not established by this audit. A production build was
not run because it writes build artifacts and the task requested non-mutating
validation.
