# Core Intelligence release readiness

## Status

The Core Intelligence refactor implementation is complete through Package 19. Migrations
`20260824000400` through `20260824001000` have been reported as applied in order.

## Verified release properties

- Core artifacts are immutable, versioned, workspace-scoped, and content-bound.
- Company Intelligence is separated from Campaign Target Model and market artifacts.
- Commercial Relationship assessments are campaign-scoped and multi-dimensional.
- Qualification freezes exact Company Intelligence and relationship assessment versions.
- Ranking remains deterministic, lane-first, and free of model calls.
- Campaign Results expose exact artifact lineage without recomputing historical artifacts.
- Relationship corrections are append-only proposals bound to one dimension and source
  assessment; they do not rewrite frozen evaluations.
- Historical rows retain explicit nullable compatibility behavior.

## Validation baseline

- TypeScript typecheck passes.
- ESLint passes without warnings.
- Core Intelligence suite passes 145 of 145 tests.
- Campaign Results contracts pass 14 of 14 tests.
- Core lineage release contracts pass.
- The optimized Next.js production build compiles successfully and emits a build artifact.
- The full suite has two known unrelated failures: initial Discovery expects concurrency `4`
  while the current runtime uses `1`, and targeted Discovery expects concurrency `2` while the
  current runtime uses `1`.

## Deployment follow-up

`npm run db:types` was attempted after the migrations were applied, but this workspace has no
local Supabase CLI, linked project metadata, or `SUPABASE_ACCESS_TOKEN`. The safety check correctly
refused database operations until project `aqhuzmqzeipubxrxadyj` is linked. No generated type file
was overwritten. From an authenticated environment, link that exact project, rerun
`npm run db:safety-check`, and then run `npm run db:types` before relying on typed queries for the
new tables and columns. Current Core Intelligence access uses deliberately narrow runtime
database adapters and passes typecheck.

No additional Core Intelligence migration is pending.
