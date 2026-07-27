# Background Execution

Trigger.dev Cloud is Opptium's only durable background runtime. The former local
polling worker and Railway deployment path have been retired because the clean
Supabase baseline intentionally has no polling queue, leases, or claim RPC.

Current tasks:

- `execute-campaign`
- `analyze-company-profile`
- `discover-campaign-companies`
- `enrich-company-contacts`
- `generate-outreach-draft`
- `verify-campaign-run`

The application records durable domain and execution state in Supabase before
dispatching a task. Trigger payloads contain stored execution identifiers, not
client-provided workspace identifiers. Task services use the service-role client to
resolve tenant ownership and frozen Campaign context from those records.

Trigger.dev owns task scheduling, retries, concurrency, and runtime logs. Supabase
remains authoritative for Campaign Runs and events, provider executions, AI requests,
contact enrichments, qualification results, drafts, usage, and user-visible errors.

For configuration, local development, deployment, and smoke testing, see
`docs/TRIGGER_DEV.md`.

`execute-campaign` owns the staged lifecycle. Its discovery child idempotently creates
or reloads Market Analysis and Discovery Plan artifacts, saves raw Tavily candidates
with query/path provenance, classifies candidates cheaply, and sends only promising
candidates to evidence-aware qualification. Trigger retries reuse persisted planning
artifacts and stable execution IDs.

Candidate classification is deterministic-first. Duplicate domains and obvious
non-company sources are rejected locally. Plausible company results are sent in one
schema-validated economical-model batch per iteration. Completed classification output
is retained on the iteration execution's `ai_requests` record and reused on retry.

When the target has not been reached and the market is not exhausted, the parent starts
the next bounded discovery iteration. Each iteration has its own idempotent provider
execution, auditable refinement path, metrics, yield decision, and cumulative progress.
The loop stops at the qualified-company target, market exhaustion, low-yield refinement
ceiling, cancellation, or the five-iteration hard limit.

Pause is a durable boundary rather than a display-only Campaign status. The parent checks
persisted state before and after every child iteration, changes the run to
`waiting_for_input/paused`, and exits without deleting completed results. Continue
reactivates the Campaign, restores the same run to discovery planning, and dispatches an
idempotent resume keyed by run and completed iteration.
