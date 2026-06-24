# Architecture Decision Register

## 1. Purpose

This file records decisions that shape implementation. Codex must treat `accepted` decisions as binding until a later decision explicitly supersedes them.

Statuses:

- `proposed`: working direction, still open to change;
- `accepted`: implementation should follow it;
- `superseded`: replaced by a later decision;
- `rejected`: considered and intentionally not selected;
- `deferred`: not required for the current milestone.

When changing an accepted decision, add a new entry explaining the reason and mark the previous entry as superseded. Do not silently rewrite history.

---

## D-001: Horizontal product core

**Status:** accepted  
**Date:** 2026-06-17

### Decision

The product supports arbitrary B2B products and services. Medical sales is the first validation scenario only.

Shared entities, prompts, scoring dimensions, UI components, and provider interfaces must remain sector-neutral.

### Consequences

- cross-sector fixtures are required;
- medical-specific criteria belong in campaign data, not shared code;
- generic names such as `offer`, `campaign`, `lead`, and `qualification` are preferred;
- any niche optimization must enter through configurable strategy, source adapters, or optional modules.

---

## D-002: Human approval before external outreach

**Status:** accepted  
**Date:** 2026-06-17

### Decision

The MVP researches leads and prepares drafts but does not automatically send outreach.

Users may copy a draft or open a prefilled external email compose window. That action does not prove sending.

### Consequences

- no bulk-send endpoint in the MVP;
- no automatic follow-up execution;
- outreach drafts and sent messages remain distinct concepts;
- integrated sending requires a future decision and separate security/compliance controls.

---

## D-003: Modular TypeScript monorepo

**Status:** superseded  
**Date:** 2026-06-17

### Decision

Use a TypeScript monorepo organized into a web application, shared packages, and a separately deployable research worker.

### Superseded by

D-017 begins the MVP implementation as a single root Next.js application. Separate packages and workers remain possible later when real runtime requirements justify extraction.

### Consequences

- start modular rather than with many microservices;
- enforce package dependency direction;
- share domain and provider contracts across runtimes;
- split services later only when deployment or scaling requirements justify it.

---

## D-004: Next.js dashboard as primary interface

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Use a custom web dashboard as the primary user interface.

Chat or Telegram may become optional notification or command surfaces later, but they are not the main interface for campaign lists, lead review, evidence, drafts, and status management.

### Consequences

- the product is designed around pages, forms, tables, filters, detail views, and activity history;
- workflow state must be persistently visible outside a chat transcript;
- the web application should be deployable on Vercel unless later constraints require a change.

---

## D-005: Long-running research outside web requests

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Discovery, crawling, enrichment, qualification, and batch draft preparation run through durable background execution, not normal request-response handlers.

### Consequences

- research runs and checkpoints are persisted;
- tasks are retry-safe and idempotent;
- the worker can deploy separately from the web app;
- selecting the concrete durable-job provider remains a separate proposed decision.

---

## D-006: PostgreSQL through Supabase as initial system of record

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Use PostgreSQL hosted through Supabase for the initial application database, with Supabase Auth for initial authentication and row-level security as defense in depth.

### Consequences

- all schema changes use ordered migrations;
- tenant ownership and RLS begin with the first migration;
- service-role credentials remain server-side;
- provider portability is less important than correct PostgreSQL modeling at this stage;
- storage may use Supabase when document upload is introduced.

---

## D-007: Evidence-backed prospect claims

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Prospect facts, inferences, unknowns, and conflicts are distinct data concepts. Qualification and outreach preserve references to supporting evidence.

### Consequences

- factual prospect claims require sources;
- AI inference cannot be presented as confirmed fact;
- the UI exposes evidence and uncertainty;
- outreach generation receives selected evidence rather than unrestricted research notes.

---

## D-008: Narrow AI tasks, not one unrestricted agent

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Implement AI capabilities as versioned, schema-validated tasks within deterministic workflows.

### Consequences

- prompts are task-specific product assets;
- model output never directly authorizes access, billing, deletion, or sending;
- workflow state is stored in the database, not model memory;
- task results are validated before persistence;
- model providers remain replaceable.

---

## D-009: Provider adapters

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Search, crawling, registries, enrichment, models, queues, and future email integrations are accessed through internal provider contracts.

### Consequences

- provider SDK payloads do not become domain entities;
- adapters normalize errors and usage metadata;
- test fakes can replace live providers;
- changing a provider should not require rewriting core campaign logic.

---

## D-010: n8n is optional, not the core runtime

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Do not build the SaaS around n8n workflows. A future n8n connector may expose events or integrations, but the core product state and research orchestration remain in the application and durable worker.

### Consequences

- product behavior is versioned with application code;
- customers do not need n8n accounts;
- workflow state is represented by product entities;
- n8n-specific nodes and credential models do not leak into the domain.

---

## D-011: Package manager

**Status:** accepted  
**Date:** 2026-06-17

### Decision

Use `pnpm` for the root Next.js application.

### Rationale

It provides a locked dependency graph and efficient local installs without requiring a monorepo workspace.

### Consequences

- the root `package.json` declares the pnpm version;
- the committed `pnpm-lock.yaml` is the install source of truth;
- no `pnpm-workspace.yaml` is required in the current single-app phase.

---

## D-012: Monorepo task orchestration

**Status:** rejected  
**Date:** 2026-06-17

### Proposal

Use Turborepo for build, lint, type-check, and test task orchestration.

### Alternatives

- plain `pnpm` recursive scripts;
- Nx.

### Decision

Do not use Turborepo in the current interface-first single-app phase.

### Consequences

- root scripts call Next.js, TypeScript, ESLint, and Prettier directly;
- task orchestration can be reconsidered if multiple runtime packages or CI cache needs appear.

---

## D-017: Single root Next.js application for MVP interface

**Status:** accepted  
**Date:** 2026-06-18

### Decision

Begin implementation as one conventional Next.js application in the repository root.

The first build target is a polished, responsive SaaS dashboard prototype using typed mock data. Internal organization uses `src/app`, `src/components`, `src/features`, `src/data/mock`, `src/lib`, and `src/types`.

### Rationale

The project currently needs a credible product interface and workflow prototype more than separate runtime packages. A root application reduces setup overhead, keeps iteration fast, and avoids speculative packages, workers, providers, and infrastructure.

### Consequences

- do not create `apps/`, `packages/`, `workers/`, Turborepo, Supabase, provider SDKs, queues, or future API routes in this phase;
- feature folders are the internal module boundary;
- mock data must be centralized and fictional;
- backend services, shared packages, and a separate worker may be extracted later when persistence, authorization, provider adapters, or durable execution create real pressure;
- the horizontal product requirement and human approval before outreach remain binding.

---

## D-013: Durable job platform

**Status:** accepted  
**Date:** 2026-06-24

### Decision

Use a direct Supabase/PostgreSQL-backed queue for the first durable research worker.

The web application creates `research_runs` and `research_tasks` inside Supabase.
Campaign discovery returns quickly after enqueueing work. A separate worker process
deployed from the same repository claims tasks through a Postgres RPC using row
locking and `FOR UPDATE SKIP LOCKED`.

The first worker deployment target is Railway using the same repo and the start
command `npm run worker`. The dashboard/frontend remains deployable on Vercel.

The first production task type is `search_web`, which runs Tavily discovery
outside the HTTP/server-action path and records raw sources, accepted leads,
diagnostics, and baseline non-AI qualification. AI qualification, contact
enrichment, and outreach drafting become later worker task types.

### Rationale

The project now has real long-running discovery work and provider failure modes.
Keeping Tavily, future AI qualification, and future enrichment inside a server
action creates fragile request lifetimes and poor retry behavior.

A direct Supabase queue is the smallest durable implementation that fits the
current stack:

- Supabase is already the system of record;
- no extra orchestration vendor is required before product validation;
- row-level security can remain the user-facing access boundary;
- service-role access stays isolated to trusted worker/server code;
- Railway can run the same repository as a separate worker service;
- the schema is inspectable and debuggable during early product iteration.

Trigger.dev, Inngest, or another job platform may be reconsidered later if the
direct queue becomes too costly to operate or lacks required observability,
scheduling, fan-out, cancellation, or workflow-versioning features.

### Implementation shape

- `research_runs` stores user-visible run status, progress, current step, and
  final error state.
- `research_tasks` stores retryable task units, attempts, locks, payloads,
  results, and errors.
- `lead_sources` stores raw and classified Tavily results before or alongside
  lead creation.
- `ai_generations` stores future prompt/model/output logs.
- `claim_next_research_task(worker_id text)` is the claim boundary for workers.
- `SUPABASE_SERVICE_ROLE_KEY` is required only in server/worker environments and
  must never be exposed as a `NEXT_PUBLIC_*` variable.

### Consequences

- discovery must not perform Tavily work inside normal request-response handlers;
- server actions enqueue work and return a run id;
- worker tasks must be retry-safe and tolerate duplicate provider results;
- progress endpoints read `research_runs` and `research_tasks`;
- local development uses two terminals: `npm run dev` and `npm run worker`;
- Railway worker deployment uses the same repository with `npm run worker`;
- introducing another queue/job provider now requires a superseding decision.

### Relationship to D-017

D-017 remains correct for the MVP interface: the repository is still a single
root Next.js app, not a monorepo. This decision activates the later extraction
path allowed by D-017 by adding a separately deployable worker command inside
the same repo, because persistence, provider adapters, and durable execution now
create real runtime pressure.

---

## D-014: Initial search provider

**Status:** proposed  
**Date:** 2026-06-17

### Proposal

Begin with one search API behind `SearchProvider`, selected based on result quality, source URLs, regional coverage, rate limits, cost, and terms. Tavily is an initial candidate because it was used in the earlier prototype discussion, but it is not accepted as a permanent dependency.

### Acceptance condition

Evaluate with the medical test campaign and at least one unrelated campaign. Preserve the adapter boundary regardless of selection.

---

## D-015: Initial language-model provider

**Status:** proposed  
**Date:** 2026-06-17

### Proposal

Support one production-capable model adapter first, with a fake deterministic adapter for tests. OpenAI direct or OpenRouter may be evaluated, but the shared task layer should use internal model profiles rather than provider-specific names.

### Acceptance condition

Evaluate structured-output reliability, multilingual quality, cost, latency, data terms, and observability. Record the concrete selection when implementing Milestone 3.

---

## D-016: Cross-tenant reuse of public research

**Status:** deferred  
**Date:** 2026-06-17

### Decision

Do not initially share normalized source content, company records, or contact enrichment across workspaces, even when the underlying data is public.

### Rationale

Tenant isolation, provenance, deletion, freshness, licensing, and product expectations should be clear before introducing a shared knowledge layer.

### Consequences

The MVP may perform duplicate public research across tenants. Optimize later through an explicit reviewed decision.
