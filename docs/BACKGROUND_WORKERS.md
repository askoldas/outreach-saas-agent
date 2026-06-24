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

`research_tasks` stores retryable units of work. Initial task types are
`search_web` and `evaluate_lead`.

`lead_sources` stores raw Tavily results and deterministic source classification
before or alongside lead creation.

`ai_generations` records prompt version, model, input, output, and errors for AI
tasks such as lead evaluation.

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
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
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
5. The worker claims the task, runs Tavily, and stores `lead_sources`.
6. Candidate sources receive `evaluate_lead` tasks.
7. `evaluate_lead` calls OpenRouter, validates strict JSON, logs
   `ai_generations`, and creates or updates qualified/needs-review leads.

## Current Limitations

- `search_web` and `evaluate_lead` are implemented as worker tasks.
- Contact enrichment is not yet a separate worker task.
- Query generation uses campaign and offer context with small optional geography
  hints. It is not intended to be a full country database.
- Deep website crawling is not yet implemented; lead evaluation uses Tavily
  snippets and stored source metadata.
