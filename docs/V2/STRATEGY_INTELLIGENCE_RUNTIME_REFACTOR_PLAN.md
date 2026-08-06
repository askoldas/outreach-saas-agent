# Strategy and Intelligence Runtime Refactor Plan

## Objective

Make Campaign Strategy deterministic-first, durable, independently retryable, and
observable. Use it as the first production vertical slice of the shared Intelligence
runtime, then migrate the remaining V2 model tasks onto the same execution boundary.

The refactor must stop treating model output as a persistence-shaped domain object.
Models produce bounded proposals. Deterministic code owns defaults, invariants, scope,
weights, versioning, persistence, and workflow state.

## Locked invariants

Every pass preserves these rules:

1. Confirmed Campaign objective, geography, offering version, Profile version, and input
   hashes remain frozen.
2. A model cannot confirm rules, invent evidence IDs, authorize discovery, or persist
   final qualification policy directly.
3. Failed model work cannot corrupt or erase the last valid Strategy artifact.
4. Successful task output is reusable by exact task, input, prompt, schema, context, and
   model-route versions.
5. Retry repeats only missing or invalid work.
6. Every model attempt, including failures and repairs, is auditable.
7. V1 historical campaigns remain read-only and unaffected.
8. Each pass must pass focused tests, typecheck, lint, full tests, and production build.
   Database passes additionally require executable database tests.

## Pass 1 — Shared AI execution foundation

### Scope

- Make the existing task and schema registries production-usable.
- Introduce a common execution result with:
  - parsed output;
  - validation diagnostics;
  - request and response hashes;
  - prompt, schema, context, and model-route versions;
  - token, cost, latency, fallback, repair, and truncation metadata.
- Implement a single error taxonomy for transport, timeout, truncation, invalid JSON,
  schema validation, semantic validation, authorization, and configuration failures.
- Define capability-aware output selection: strict schema only when the provider and
  schema support it; otherwise bounded JSON mode.
- Add one bounded repair attempt that receives exact validation issues.
- Persist failed as well as successful attempts.

### Non-goals

- No Campaign Strategy behavior change.
- No new UI.
- No migration of Profile, Research, or Qualification calls yet.

### Gate

- Runtime contract tests cover success, timeout, truncation, unsupported structured
  output, invalid JSON, semantic failure, repair success, and repair failure.
- Existing direct callers remain operational.

## Pass 2 — Durable Strategy stages and cache

### Scope

- Add durable Strategy stage executions for:
  - deterministic baseline;
  - market context;
  - advisory delta;
  - deterministic merge and compilation.
- Persist stage state, attempt count, input hash, output reference, error category,
  validation summary, Trigger run ID, and timestamps.
- Add an exact-result cache key:

  ```text
  taskId + frozenInputHash + promptVersion + schemaVersion
  + contextCompilerVersion + modelRouteVersion
  ```

- Make stage claim and settlement atomic and service-role only.
- Change Retry to resume from the first incomplete stage.

### Non-goals

- Continue producing the current Strategy artifact until the deterministic compiler is
  introduced in Pass 3.

### Gate

- A simulated second-stage failure retains and reuses the first-stage result.
- Duplicate dispatch cannot duplicate paid work.
- PostgreSQL tests execute the functions, permissions, RLS, and retry transitions.

## Pass 3 — Deterministic baseline Strategy

### Scope

- Compile a complete valid review Strategy using only frozen confirmed inputs:
  - objective and compatible relationship types;
  - selected offering and offering-specific buyer logic;
  - geography and language policy;
  - confirmed Profile and Campaign rules;
  - deterministic baseline archetypes;
  - deterministic qualification factors and normalized weights;
  - deterministic source plan and evidence questions.
- Persist the baseline before any model call.
- Make baseline generation pure, reproducible, and fixture-tested.
- A market-model failure leaves a valid baseline Strategy available for review with an
  enrichment warning.

### Gate

- Baselines pass the full Campaign Strategy schema for every benchmark objective.
- Repeated compilation from identical frozen input produces the same content hash.
- No model call is required to open Strategy review.

## Pass 4 — Market context and advisory delta

### Scope

- Replace the full Strategy proposal with two narrow contracts:
  - bounded market observations;
  - bounded advisory Strategy operations.
- Advisory operations are allowlisted, for example:
  - clarify an archetype label or rationale;
  - add bounded local terminology;
  - propose bounded signals or evidence questions;
  - propose a factor-weight adjustment within configured limits;
  - identify an unresolved market risk.
- The model cannot emit complete rules, final persistence records, arbitrary IDs, or a
  replacement qualification policy.
- Market context is persisted independently and supplied to the advisory-delta task.
- Context compilers record omitted counts and enforce deterministic input budgets.

### Gate

- Minimum, maximum, malformed, adversarial, and unknown-reference fixtures pass.
- Schema-valid completion rate is measured across the benchmark portfolio.
- A failed advisory task does not invalidate the baseline.

## Pass 5 — Deterministic merge and review experience

### Scope

- Validate every proposed operation against frozen IDs, objective compatibility,
  evidence scope, and configured bounds.
- Apply accepted operations deterministically to the baseline.
- Never silently truncate or reweight material policy.
- Persist operation dispositions:
  - applied;
  - rejected with reason;
  - requires user review;
  - omitted by budget.
- Expose Strategy progress by stage and show whether the review is baseline-only,
  enriched, partially enriched, or failed enrichment.
- Retry only failed enrichment stages.
- Confirmation freezes the exact merged artifact and its provenance.

### Gate

- UI tests cover queued, running, baseline-ready, partially enriched, enriched, failed,
  retrying, and confirmed states.
- Objective incompatibility and unknown evidence can never enter the merged Strategy.
- User can proceed with a valid baseline when optional enrichment is unavailable.

## Pass 6 — Unified Intelligence runtime rollout

### Scope

- Migrate production callers in controlled order:
  1. Company Profile stages;
  2. Candidate Research extraction;
  3. relationship and factor evaluation;
  4. comparative ranking;
  5. outreach generation.
- Remove subsystem-specific transport, repair, audit, and caching implementations after
  parity tests pass.
- Add `test:intelligence-v2` with cross-industry fixtures and operational metrics:
  - valid completion rate;
  - repair rate;
  - unsupported-claim rate;
  - timeout and truncation rate;
  - cost and latency by task/model;
  - cache reuse rate;
  - user edit and rejection rate.
- Add production dashboards and release thresholds.

### Gate

- No V2 production task calls OpenRouter outside the shared runtime.
- Benchmark and database suites run in CI.
- Failed calls, repairs, fallbacks, and cache reuse are observable and auditable.

## Recommended execution order

Implement Passes 1–5 before broad runtime migration. Pass 6 should be divided by task
family so each migration remains reversible and reviewable.

The next implementation pass is Pass 1. It should add the common runtime foundation and
tests without changing live Strategy output behavior.
