# Repository Structure

## 1. Goal

Use a TypeScript monorepo with clear boundaries between the web application, domain rules, AI workflows, persistence, reusable UI, and long-running workers.

The structure should remain understandable to a human developer and predictable for Codex. Avoid premature microservices. Start as a modular monorepo and split deployment units only where runtime requirements justify it.

## 2. Planned top-level structure

```text
outreach-saas-agent/
├─ AGENTS.md
├─ README.md
├─ apps/
│  └─ web/
├─ packages/
│  ├─ domain/
│  ├─ ai/
│  ├─ db/
│  ├─ providers/
│  ├─ ui/
│  ├─ config/
│  └─ observability/
├─ workers/
│  └─ research/
├─ supabase/
│  ├─ migrations/
│  ├─ seed.sql
│  └─ config.toml
├─ tests/
│  ├─ fixtures/
│  ├─ integration/
│  └─ e2e/
├─ docs/
├─ scripts/
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ eslint.config.*
├─ prettier.config.*
└─ .env.example
```

The exact tooling files should be added during the foundation scaffold milestone, not invented before the chosen versions are installed.

## 3. Application and package responsibilities

### `apps/web`

The Next.js dashboard and public application surface.

Responsibilities:

- authentication UI and callbacks;
- workspace selection;
- offer and campaign forms;
- lead tables and detail views;
- review and approval actions;
- route handlers or server actions for short request-response operations;
- CSV export initiation;
- external email-compose links;
- billing and account UI later.

Must not contain:

- provider SDK calls scattered through components;
- long-running research loops;
- reusable domain scoring logic;
- database service-role credentials in client code;
- inline prompt templates.

Suggested internal layout:

```text
apps/web/src/
├─ app/
├─ components/
├─ features/
│  ├─ workspaces/
│  ├─ offers/
│  ├─ campaigns/
│  ├─ leads/
│  ├─ outreach/
│  └─ settings/
├─ lib/
├─ server/
└─ styles/
```

Use feature folders for product behavior and shared components only when reuse is real.

### `packages/domain`

Framework-independent domain types and deterministic business rules.

Responsibilities:

- entity schemas and value objects;
- status transition rules;
- qualification score aggregation;
- confidence calculations;
- URL and domain normalization contracts;
- deduplication decisions;
- permission-independent domain validation;
- shared error types.

This package must not import Next.js, React, Supabase clients, provider SDKs, or worker frameworks.

Suggested layout:

```text
packages/domain/src/
├─ workspace/
├─ offer/
├─ campaign/
├─ lead/
├─ evidence/
├─ qualification/
├─ contact/
├─ outreach/
├─ activity/
└─ shared/
```

### `packages/ai`

Versioned AI tasks, schemas, orchestration contracts, and prompt assets.

Responsibilities:

- structured task input and output schemas;
- prompt templates and versions;
- task-level validation;
- fact/inference separation;
- model execution metadata;
- domain-safe result normalization;
- evaluation fixtures later.

Suggested layout:

```text
packages/ai/src/
├─ tasks/
│  ├─ analyze-offer/
│  ├─ plan-campaign/
│  ├─ extract-company/
│  ├─ qualify-lead/
│  ├─ suggest-contact-role/
│  └─ draft-outreach/
├─ prompts/
├─ schemas/
├─ evaluation/
└─ shared/
```

Each task folder should expose a narrow typed contract rather than one generic agent prompt.

### `packages/db`

Application persistence interfaces and Supabase/PostgreSQL implementations.

Responsibilities:

- typed repository interfaces;
- server and worker database clients;
- query helpers;
- transaction boundaries;
- mapping database rows to domain objects;
- generated database types;
- authorization-safe data access functions.

Do not use this package as a dumping ground for business logic.

### `packages/providers`

Adapters for external services.

Possible provider categories:

```text
packages/providers/src/
├─ search/
├─ crawler/
├─ registry/
├─ enrichment/
├─ llm/
├─ email-compose/
├─ queue/
└─ storage/
```

Each category should define an internal interface and one or more adapters. Provider payloads must be normalized before they enter domain workflows.

### `packages/ui`

Reusable presentational components, tokens, and accessibility helpers shared by applications.

Keep feature-specific business components in `apps/web/src/features`. Do not move components into this package solely to shorten import paths.

### `packages/config`

Shared lint, TypeScript, environment-schema, and build configuration when genuine reuse appears.

### `packages/observability`

Structured logging, tracing, run diagnostics, and error-reporting helpers.

Keep sensitive content out of logs by default.

### `workers/research`

Durable execution of lead discovery, crawling, enrichment, qualification, and draft preparation.

Responsibilities:

- start and resume research runs;
- execute bounded workflow steps;
- persist checkpoints;
- enforce idempotency;
- retry transient provider failures;
- respect concurrency and rate limits;
- emit run events and diagnostics;
- stop cleanly on cancellation.

The worker may be deployed separately from the web application even while sharing monorepo packages.

### `supabase`

Database migrations, local configuration, and seed data.

Rules:

- migrations are append-only;
- RLS policies are versioned in migrations;
- seed data uses obviously fictional tenants and companies;
- generated types are stored in the location selected during scaffold and documented once implemented.

### `tests`

Cross-package fixtures and tests that do not belong beside one unit.

- `fixtures`: fake provider responses, HTML pages, and domain objects;
- `integration`: database, authorization, and workflow integration tests;
- `e2e`: critical browser journeys.

Unit tests should normally live beside the code they test.

### `scripts`

One-off or operational scripts with documented usage.

Scripts must validate environment input, avoid destructive defaults, and clearly distinguish local, test, and production targets.

## 4. Dependency direction

Preferred dependency direction:

```text
apps/web ─┐
          ├─> packages/domain
workers ──┘

apps/web ─────> packages/db
workers ──────> packages/db

apps/web ─────> packages/ai
workers ──────> packages/ai

packages/ai ──> packages/domain
packages/db ──> packages/domain
packages/providers may depend on domain-level contracts but not on apps
```

Avoid cycles. In particular:

- `domain` depends on no application package;
- `ai` must not depend on `apps/web` or a concrete worker framework;
- `providers` must not import UI code;
- `db` must not invoke AI providers;
- the web app must enqueue long work rather than importing a worker entry point.

## 5. Module public APIs

Each package should expose deliberate public entry points through `src/index.ts` or package exports.

Do not import private internals through deep relative paths across packages. A cross-package symbol that is required externally should be promoted to the package's public API.

## 6. Naming rules

Use domain language consistently:

- `workspace`, not `accountCompany`;
- `offer`, not `product` when the entity also supports services;
- `campaign`, not `searchJob` for the user-owned objective;
- `researchRun`, not `agentMemory`;
- `lead`, not `client` before qualification or conversion;
- `source` and `evidence`, not a single unstructured `notes` field;
- `outreachDraft`, not `email` before sending exists.

Provider-specific names belong inside adapters, not shared entities.

## 7. Codex context strategy

The root `AGENTS.md` applies to the whole repository.

Add nested `AGENTS.md` files only when a directory has substantial additional rules, such as:

- database migration conventions under `supabase/`;
- prompt and evaluation conventions under `packages/ai/`;
- worker idempotency rules under `workers/research/`.

Nested instructions should add local detail and must not repeat or contradict the root file.

## 8. Initial scaffold order

Codex should create the implementation scaffold in this order:

1. package manager and workspace configuration;
2. strict TypeScript base configuration;
3. linting and formatting;
4. minimal Next.js application;
5. domain package with one tested primitive;
6. Supabase local structure and first migration;
7. database package and environment validation;
8. worker shell with a deterministic test task;
9. CI checks;
10. local setup documentation.

Do not add all external providers during scaffold. Provider adapters should arrive with the product slice that needs them.
