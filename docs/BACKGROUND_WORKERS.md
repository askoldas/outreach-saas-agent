# Background Workers

Agentfarm discovery now uses durable database-backed work instead of running Tavily
inside a browser request or server action.

## Why

Lead discovery can take longer than a Vercel request should stay open. Tavily,
contact checks, and future AI qualification can fail independently, hit provider
limits, or need retries. A worker lets the app enqueue work quickly while a
separate process claims and completes tasks from Supabase.

## Tables

`research_runs` is the user-visible unit of background work for a campaign. It
stores status, progress, the current step, and any last error.

`research_tasks` stores retryable units of work. The first production task type
is `search_web`, which runs Tavily discovery and saves lead sources/leads.

`lead_sources` stores raw Tavily results and deterministic source classification
before or alongside lead creation.

`ai_generations` is a scaffold for future prompt/model/output logging. AI
qualification and outreach drafting should write there when those worker tasks
are added.

## Claiming And Retries

Workers call `public.claim_next_research_task(worker_id text)`. The function uses
`FOR UPDATE SKIP LOCKED` so multiple Railway workers cannot claim the same task.
Claiming sets the task to `running`, increments `attempt_count`, and sets
`locked_by`/`locked_until`.

If a task throws, the worker marks it `retrying` until `max_attempts` is reached.
After the final failure it marks the task `failed` and stores `error_message`.
One failed task does not stop the worker loop.

## Local Development

Run the web app:

```bash
npm run dev
```

Run the worker in a second terminal:

```bash
npm run worker
```

Required local env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TAVILY_API_KEY=
WORKER_ID=local-worker
WORKER_POLL_INTERVAL_MS=3000
```

`SUPABASE_SERVICE_ROLE_KEY` is only for server/worker processes. Do not expose it
to browser code.

## Current Flow

1. User clicks `Discover leads`.
2. The server action validates workspace/campaign access.
3. It creates a `research_run` and initial `search_web` task.
4. The UI polls `/api/campaigns/[id]/discovery-progress`.
5. The worker claims the task, runs Tavily, stores `lead_sources`, saves accepted
   company-site leads, and updates the campaign discovery report.

## Current Limitations

- Only `search_web` is implemented as a worker task.
- AI qualification is not yet a separate worker task. The worker saves baseline
  deterministic qualification so score cards are not empty.
- Contact enrichment is not yet a separate worker task.
- Query generation is generic but currently has extra Italy/local-language
  handling because that is the active test scenario.
