# Railway Worker Deployment

Deploy the same GitHub repository as a second Railway service.

## Service Setup

Use the existing repo. Do not create a separate worker repository.

Start command:

```bash
npm run worker
```

The Vercel deployment remains the Next.js frontend/dashboard. Railway runs only
the background worker process.

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TAVILY_API_KEY=
WORKER_ID=railway-research-worker
WORKER_POLL_INTERVAL_MS=3000
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

`OPENROUTER_*` is optional for the current `search_web` worker, but should be set
before AI qualification or draft-generation tasks are enabled.

## Database Requirements

Apply the Supabase migrations through `20260624000200_create_research_worker_tables.sql`.
The worker requires:

- `research_runs`
- `research_tasks`
- `lead_sources`
- `ai_generations`
- `claim_next_research_task(worker_id text)`

## Operations

The worker logs claimed, completed, and failed tasks. If no task is available it
sleeps for `WORKER_POLL_INTERVAL_MS`.

Multiple Railway replicas are safe because task claiming uses row locks and
`SKIP LOCKED`.

Failed tasks are retried until `max_attempts`; after that they stay `failed` with
an error message visible through the run progress endpoint.

## Verification

1. Start the Vercel/local web app.
2. Start Railway worker or run `npm run worker` locally.
3. Click `Discover leads` on a campaign.
4. Confirm a `research_run` and `search_web` task are created.
5. Confirm the worker claims and completes the task.
6. Confirm `/api/campaigns/[id]/discovery-progress` shows status/progress.
7. Confirm `lead_sources` and campaign leads are written.
