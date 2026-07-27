# Repository Structure

The repository is one root Next.js application.

- `src/app`: App Router pages and endpoints. `(marketing)`, `(auth)`, and `(app)` own separate layouts without changing URLs; `@modal` intercepts public auth navigation.
- `src/components`: shared layout, UI, and feedback primitives.
- `src/features`: public marketing layout, authentication presentation, and interactive product surfaces including campaign shell/strategy, lead review, and outreach.
- `src/server`: workspace-scoped repositories, actions, and persisted read models.
- `src/trigger`: thin Trigger.dev task definitions.
- `src/lib`: deterministic domain helpers, provider adapters, discovery logic, and Supabase clients.
- `src/types`: shared domain/read-model types.
- `supabase/migrations`: immutable ordered database migrations and RLS policies.
- `docs`: current product, architecture, operations, security, testing, decisions, and refactor status.

Provider and service-role access remains server/Trigger-only. Routes compose data;
repositories query persistence; Trigger tasks call typed server services; client
features own local interactions; domain helpers do not import framework UI.
