# Phase 1 clean-baseline validation report

Date: 2026-07-25

## Completed

- Created 15 reviewable schema parts under `supabase/baseline/`.
- Generated the single new-project migration
  `supabase/migrations/20260725000100_opptium_clean_baseline.sql`.
- Archived 29 historical migrations under `supabase/migrations-legacy/`.
- Added clean-baseline design and legacy mapping documents.
- Added canonical Campaign run, Company, Qualification, Contact, Outreach,
  Document/memory, AI/provider/idempotency/cost and guided-AI structures.
- Added tenant helper functions, cross-workspace invariants, RLS, private document
  storage policies and indexes.
- Added a synthetic lifecycle/RLS database test and manual fixture support.
- Added deterministic migration generation and fail-closed hosted-project safety
  scripts.
- Repointed historical migration contract tests to the archived chain.
- Updated architecture, domain, AI, worker, testing, Trigger.dev and Railway-transition
  documentation.
- Added task-specific paid model configuration records without changing current prompts,
  AI transport or application behavior.

No dependencies were added. Trigger.dev and Vercel AI SDK were not installed. Phase 2
application repository adaptation was not started.

The baseline intentionally does not recreate `offers`, `leads`,
`lead_contact_routes`, `research_tasks`, worker leases, claim RPCs or Railway state.

## Validation

Passed:

- `node scripts/build-clean-baseline.mjs`
- `node --check scripts/build-clean-baseline.mjs`
- `node --check scripts/assert-safe-supabase-target.mjs`
- `corepack.cmd pnpm run test` — 85 passed, 0 failed
- `corepack.cmd pnpm run lint`
- `corepack.cmd pnpm run typecheck`
- baseline contract checks for generated-file equality, required/forbidden entities and
  RLS coverage

Expected safety failure:

- `node scripts/assert-safe-supabase-target.mjs` refused to continue because
  the Supabase CLI was not linked to the approved clean project. This is the required
  fail-closed behavior.

Not executed:

- empty local `supabase db reset`;
- `supabase test db`;
- application against the new empty project;
- remote migration application;
- generated Supabase TypeScript types;
- manual UI flows.

The machine exposes neither a Supabase CLI command nor Docker. A remote command was not
attempted because the new and legacy project references were not safely configured and
the prompt requires the locked project to remain untouched.

## Risks

- PostgreSQL/Supabase compilation and actual RLS behavior remain unproven until the
  clean migration runs against a completely empty disposable stack.
- The current application still targets legacy repositories/tables and must not be
  pointed at the clean project before Phase 2.
- The lifecycle SQL fixture is structurally reviewed but has not executed.
- Seeded model IDs record the approved routing structure; availability and output parity
  remain Phase 4 work.
- `vector(1536)` is an initial structural dimension and must match the selected embedding
  model before embeddings are generated.
- Historical contract tests validate preserved legacy behavior only; they do not make
  legacy entities part of the clean architecture.

## Next-phase readiness

**Not ready to continue to Phase 2.**

Phase 1 requires the following before review can approve continuation:

1. Install/enable Supabase CLI and Docker (or provide an equivalent disposable local
   Supabase environment).
2. Run a clean reset and `supabase test db`.
3. Link the Supabase CLI to `aqhuzmqzeipubxrxadyj`, then pass
   `pnpm db:safety-check` using the existing Supabase URL configuration.
4. Apply the single migration to the confirmed new empty project.
5. Generate database types and record any schema/type corrections.

No remote project was modified.
