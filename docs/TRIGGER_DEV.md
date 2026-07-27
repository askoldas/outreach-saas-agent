# Trigger.dev migration

## Approved direction

Trigger.dev Cloud is the approved durable execution platform. It will own queues,
retries, concurrency, schedules and waitpoints. Supabase remains authoritative for
Campaign status, runs, events, questions, approvals, provider/AI executions, costs and
customer-visible results.

The Trigger.dev SDK and CLI are installed at the same version. The repository includes
`trigger.config.ts`, a `src/trigger` task directory, and an initial
`verify-campaign-run` task that proves Trigger Cloud can resolve a clean Supabase
Campaign Run and append a visible event.

Production deployment `20260725.5` includes `analyze-company-profile`. The
application records these jobs in `provider_executions`, dispatches Trigger.dev with
only that execution ID, stores AI audit data in `ai_requests`, and settles successful
usage in `usage_ledger`. No polling `research_tasks` row is created.

The current source also defines `enrich-company-contacts` and
`generate-outreach-draft`, plus `discover-campaign-companies`. Campaign discovery
uses the frozen Campaign Run context, persists canonical companies and sources, and
qualifies accepted candidates with immutable evidence. Contact enrichment persists
`contact_enrichments`, reusable methods and provenance, while draft generation
persists clean `outreach_drafts` plus `ai_requests`. Deploy the current Trigger source
before using these actions outside local Trigger development.

## Account connection

1. Create or open the Trigger.dev Cloud project for this application.
2. Set the non-secret project reference in `trigger.config.ts`.
3. Copy the DEV secret key from the project's API Keys page into
   `TRIGGER_SECRET_KEY` in `.env.local`.
4. Run `corepack pnpm trigger:dev` and authenticate the CLI when prompted.
5. In the Trigger.dev dashboard, add `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` to the Development environment.
6. For production, add the production Supabase values to Trigger.dev's Production
   environment and use the Trigger.dev PROD secret key in the deployed Next.js app.

Company Profile analysis requires `TAVILY_API_KEY` and `OPENROUTER_API_KEY`.
Contact enrichment requires `TAVILY_API_KEY`; draft generation requires
`OPENROUTER_API_KEY`.
Task-specific model, fallback and timeout variables are optional overrides because the
runtime has paid defaults. Production tasks also require the current
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; a publishable Supabase key
is not used by server-side Trigger tasks.

`TRIGGER_ACCESS_TOKEN` is a personal CLI/CI deployment credential. It is not needed by
the Next.js application at runtime and must never be exposed as a public variable.

Run `corepack pnpm trigger:deploy:check` for a local deployment build and
`corepack pnpm trigger:deploy` to publish tasks.

## Connection smoke test

After at least one `campaign_runs` row exists, run `verify-campaign-run` from the
Trigger.dev dashboard with:

```json
{
  "campaignRunId": "<campaign_runs.id>"
}
```

A successful run inserts a `campaign_run_events` row with event type
`trigger_runtime_verified`.

## Task status

Implemented:

- `analyze-company-profile`
- `discover-campaign-companies` (includes candidate qualification)
- `enrich-company-contacts`
- `generate-outreach-draft`

Implemented parent workflow:

- `execute-campaign` resolves the stored Campaign Run and discovery execution;
- it durably invokes and waits for `discover-campaign-companies`;
- it records an explicit optional-enrichment gate after discovery and qualification;
- parent retries reuse the same child idempotency key and do not duplicate lifecycle
  events;
- a Campaign Run cancelled before discovery begins closes its pending provider
  execution without starting the child task;
- enrichment and draft generation remain separately user-triggered while their
  approval-driven parent continuation is deferred.

Contact enrichment is deployed as a provider boundary but is intentionally deferred
for the current product test environment until an external contact database/provider
is connected. Campaign discovery and qualification do not require enrichment.

All durable provider tasks use one retry boundary. The OpenRouter adapter performs
one network request and classifies its failure; Trigger.dev owns retry attempts and
backoff. Each failed attempt appends diagnostic metadata without changing business
records to a terminal state. A task-level `onFailure` hook runs only after retries
are exhausted (or a non-retryable error aborts the run), marks the corresponding
`provider_executions` row failed, and applies operation-specific terminal projections.
Discovery terminal failure also closes the customer-visible `campaign_runs` row and
appends one deduplicated visible failure event.

The `execute-campaign` parent follows the same rule: orchestration state is failed
only in its final `onFailure` hook, never inside an individual attempt.

Each Trigger task is a thin wrapper around a typed application service. Payloads carry
only a `provider_executions.id`; services resolve workspace ownership and domain
references from stored records rather than trusting tenant IDs in task input.

## Environment separation

Use different Trigger.dev projects/keys and Supabase projects for local, preview and
production. Do not connect Trigger tasks to the locked legacy Supabase project.
Keep distinct Trigger.dev projects or environments and distinct Supabase projects for
development, preview, and production.

## Retired polling runtime

The polling worker has been removed. Historical migrations and audit documents may
still describe it, but no application command or live source path uses
`research_tasks`, leases, or a claim RPC.
