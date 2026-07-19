# Repository Structure

The repository is one root Next.js application.

- `src/app`: App Router pages and endpoints. `(marketing)`, `(auth)`, and `(app)` own separate layouts without changing URLs; `@modal` intercepts public auth navigation.
- `src/components`: shared layout, UI, and feedback primitives.
- `src/features`: public marketing layout, authentication presentation, and interactive product surfaces including campaign shell/strategy, lead review, and outreach.
- `src/server`: workspace-scoped repositories, actions, and persisted read models.
- `src/lib`: deterministic domain helpers, provider adapters, discovery logic, and Supabase clients.
- `src/workers`: durable research worker and task handlers.
- `src/types`: shared domain/read-model types.
- `supabase/migrations`: immutable ordered database migrations and RLS policies.
- `docs`: current product, architecture, operations, security, testing, decisions, and refactor status.

Provider and service-role access remains server/worker-only. Routes compose data; repositories query persistence; client features own local interactions; domain helpers do not import framework UI.
