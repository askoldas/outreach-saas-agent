# Trigger.dev

Trigger.dev Cloud is Opptium's durable execution platform. Supabase remains
authoritative for workflow state and customer-visible results.

## Current tasks

- `create-company-intelligence-v3`
- `run-company-profile-v3-stage`
- `execute-campaign-v2`
- `run-campaign-v2-stage`
- `research-campaign-candidate-v2`
- `qualify-campaign-candidate-v2`
- `process-campaign-document`
- `enrich-company-contacts`
- `generate-outreach-draft`
- `verify-campaign-run`

The retired `execute-campaign`, `discover-campaign-companies`, and
`analyze-company-profile` tasks are not part of the deployment.

## Environment

Set these in the Trigger.dev environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `TAVILY_API_KEY`

The Supabase publishable key is not required by server-side Trigger tasks. Model,
fallback, and timeout variables are optional overrides. `CAMPAIGN_AGENT_ENABLED` no
longer exists.

The Next.js runtime uses its environment-specific `TRIGGER_SECRET_KEY`.
`TRIGGER_ACCESS_TOKEN` is only a personal CLI/CI deployment credential.

## Commands

```bash
npm run trigger:dev
npm run trigger:deploy:check
npm run trigger:deploy
```

Deploy Trigger after any change under `src/trigger`, any imported task service, or a
task input/output contract.

## Execution guarantees

Trigger payloads contain persisted identifiers. Services resolve workspace ownership
and frozen context from Supabase. Stable idempotency keys and workflow checkpoints
prevent completed paid work from being repeated on retry. Task-level failure handlers
persist terminal state only after the task has exhausted its retry policy.

Historical V1 Campaign Runs cannot be dispatched. Runtime dispatch accepts only a
persisted `workflow_version = 'v2'`.
