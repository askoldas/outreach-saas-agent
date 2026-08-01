# Background Execution

Trigger.dev Cloud is Opptium's only durable background runtime. The local polling
worker, Railway worker path, V1 Campaign Agent, and legacy Campaign executor are
retired.

Company Intelligence V3 and Campaign Workflow V2 are checkpointed graphs. Trigger.dev
owns scheduling, retry, concurrency, and runtime logs; Supabase owns inputs,
idempotency, progress, outputs, audit records, and user-visible failures.

The Campaign V2 parent runs semantic discovery, entity resolution, candidate research,
relationship-first qualification, and deterministic comparative ranking. Pause,
resume, and cancel are durable commands checked at stage boundaries.

Contact enrichment and grounded outreach generation remain separate user-triggered
tasks after company approval.

See `docs/TRIGGER_DEV.md` for environment setup and deployment commands.
