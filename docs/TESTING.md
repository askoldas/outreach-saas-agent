# Testing Strategy

## 1. Goals

Tests should protect the product's most important promises:

- one workspace cannot access another workspace's data;
- long-running tasks are retry-safe;
- duplicate discovery does not create duplicate leads;
- facts remain linked to sources;
- AI output is schema-valid before persistence;
- hard exclusions override AI scoring;
- drafts use only approved seller claims and supported prospect evidence;
- opening an external compose window does not mark outreach as sent.

## 2. Test layers

### Unit tests

Use for deterministic logic:

- URL and domain normalization;
- status transitions;
- score aggregation;
- confidence mapping;
- exclusion enforcement;
- eligibility checks;
- idempotency-key construction;
- deduplication decisions;
- schema validation;
- compose-link generation.

Unit tests should be fast and normally live beside the code they test.

### Contract tests

Use at provider boundaries:

- search response normalization;
- crawler fetch outcomes;
- model structured-output wrapper;
- registry adapter normalization;
- queue dispatch contract;
- email-compose adapter behavior.

Fixtures should contain saved, clearly licensed or synthetic responses. Tests must not depend on live external providers by default.

### Database integration tests

Run against a disposable local or CI database.

Cover:

- migrations apply from an empty database;
- required constraints and indexes exist;
- RLS permits expected workspace access;
- RLS denies cross-workspace reads and writes;
- role changes affect permissions correctly;
- transaction boundaries preserve invariants;
- duplicate keys enforce idempotency;
- deletion and archival behavior matches documentation.

### Workflow integration tests

Use a test worker or deterministic workflow harness.

Cover:

- run creation and dispatch;
- step checkpoints;
- transient failure and retry;
- retry exhaustion;
- cancellation;
- partial completion;
- quota stop;
- duplicate task delivery;
- provider rate-limit handling;
- schema-invalid AI result;
- one lead failing without stopping unrelated leads.

### End-to-end tests

Keep the first suite small and focused on critical journeys:

1. sign in and create a workspace;
2. create and version a Company Profile;
3. create a campaign and review its Strategy with provider adapters isolated;
4. inspect a lead, evidence, and qualification;
5. approve a lead and generate a draft;
6. edit and approve a draft;
7. open an external compose action without a false sent state;
8. verify a user cannot access another workspace by changing a URL.

Playwright provides the browser layer. The executable journey uses a disposable local
Supabase stack and verifies unauthenticated routing, account sign-up/sign-in, workspace
creation, Company Profile versioning, campaign creation, and Strategy review. It then
uses the CI-only service-role boundary to seed synthetic worker-completed enrichment and
draft records before exercising recipient acceptance, draft editing, export recording,
and authenticated historical CSV download. Provider calls remain outside the default
browser suite; Tavily and OpenRouter are tested at their adapter and worker boundaries.

Run it after starting local Supabase and exporting its URL and keys:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## 3. AI task tests

### Schema tests

Each AI task must test:

- valid output accepted;
- missing required field rejected;
- out-of-range score rejected;
- unknown enum rejected or safely handled;
- cross-reference validation;
- repair policy and failure behavior.

### Prompt regression fixtures

Maintain curated inputs and expected properties rather than brittle exact prose snapshots.

Assertions may include:

- no unsupported certification appears;
- every fact includes a source reference;
- inferences are labeled;
- hard exclusion is identified;
- draft contains no fabricated need or budget;
- approved seller claim is represented accurately;
- requested language is used;
- irrelevant medical assumptions do not appear in non-medical fixtures.

### Evaluation set

Start with at least three sectors:

- medical equipment;
- B2B software or professional service;
- industrial manufacturing service.

Add rejected and ambiguous examples, not only ideal cases.

## 4. Test data

Use fictional workspaces, users, companies, domains, and contacts.

Reserved example domains such as `example.com` should be preferred where practical. Never commit real customer lists, private documents, API responses containing personal tokens, or production database exports.

Fixtures should be small enough to understand and named by the behavior they test.

## 5. Mocking rules

- Mock external providers at adapter boundaries.
- Do not mock the domain function under test.
- Avoid broad module mocks that make tests pass while contracts are broken.
- Prefer fake provider implementations with deterministic behavior for workflow tests.
- Keep one optional live-provider smoke test outside the default CI path when a provider integration is introduced.

## 6. Snapshot rules

Snapshots are acceptable for stable serialized contracts or small rendered fragments.

Do not use large snapshots as a substitute for meaningful assertions, especially for:

- AI text;
- full pages;
- provider payloads;
- database rows containing irrelevant fields.

## 7. Migration testing

For every migration change:

1. apply all migrations to an empty database;
2. verify generated types or schema checks;
3. test affected constraints and RLS;
4. test upgrade behavior when the migration transforms existing data;
5. document irreversible changes.

Never rewrite an applied migration to make a test pass.

## 8. Security tests

Minimum security coverage:

- unauthenticated access denied;
- guessed record ID from another workspace denied;
- viewer cannot perform member or admin mutation;
- member cannot change workspace ownership;
- client cannot use service-role operations;
- untrusted HTML is not rendered unsafely;
- signed export or file URLs expire and remain workspace-scoped;
- source prompt injection cannot alter protected workflow fields;
- model output cannot trigger sending or authorization.

## 9. Performance and cost tests

Before large-scale launch, add bounded checks for:

- lead-table query performance;
- campaign pagination;
- batch insert and deduplication;
- worker concurrency;
- provider call count per lead;
- pages fetched per lead;
- model usage per task;
- export size;
- cancellation responsiveness.

Optimize from measured behavior, not hypothetical massive volume.

## 10. CI quality gates

Once the scaffold exists, pull requests should run:

- install with a locked dependency graph;
- formatting check;
- lint;
- strict type check;
- unit tests;
- database migration and integration tests;
- production build;
- the minimal Playwright campaign-workflow suite against disposable Supabase;
- dependency and secret scanning.

The exact commands must be added only after the tools are installed and should remain synchronized with `package.json` and CI.

## 11. Definition of done for a code change

A change is complete when:

- behavior is implemented at the correct architectural layer;
- relevant automated tests exist and pass;
- unrelated tests still pass;
- no new type or lint errors remain;
- migrations and environment changes are documented;
- security and tenant impact were considered;
- user-facing and architecture documentation is updated when needed;
- checks actually run are reported accurately.
