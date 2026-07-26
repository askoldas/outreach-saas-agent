# Opptium Updated-Specification Implementation Record

This record tracks the expanded target in
`opptium-product-technical-specification-updated.md`. The earlier clean-baseline
refactor is complete, but the complete updated product specification is not.

## Phase status

| Phase                          | Status                 | Implemented                                                                                                                                                                                                                                                        | Remaining                                                                                                |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1. Foundation                  | Substantially complete | Clean tenant schema, immutable Profile/Strategy versions, Campaign Runs/events, provider adapters, idempotency, usage provenance                                                                                                                                   | Continue removing temporary compatibility read models                                                    |
| 2. Durable execution           | Substantially complete | Trigger.dev Cloud tasks, retries, parent/child orchestration, persisted status, polling progress UI, durable user-input resume                                                                                                                                     | Trigger realtime UI                                                                                      |
| 3. Campaign Agent              | Partial                | Provider-neutral bounded loop, structured planner, typed tool registry, real discovery tool, checkpoints, isolated iterations, clarification gate/resume, tracing, failure closure                                                                                 | Additional tools and transport modernization                                                             |
| 4. Discovery and qualification | Substantially complete | Bounded Tavily discovery, normalization/deduplication, bounded directory entity extraction, fixture-based precision/recall gates, first-party homepage inspection, source-quality coverage, schema-validated qualification, evidence/confidence, iterative queries | Expand the synthetic evaluation set from observed production-safe failure patterns                       |
| 5. Memory and documents        | Partial                | Proposed/approved Campaign learnings, private bounded text uploads, durable parsing/chunking, scoped lexical planner retrieval                                                                                                                                     | PDF/DOCX parsing and pgvector semantic retrieval                                                         |
| 6. Contacts and outreach       | Partial                | Public route extraction, recipient selection, grounded drafts, approval state, CSV export                                                                                                                                                                          | External enrichment provider, email verification, approval-driven continuation; sending remains excluded |
| 7. Commercial validation       | Partial                | Workspace qualification acceptance, contact-found, email-verification, draft approval/correction, cost-per-qualified-company, repeat-run, export, and usage metrics                                                                                                | Cohort/time-window reporting, response metrics after sending exists, and willingness-to-pay research     |

## Current priority

1. Improve discovery precision and first-party evidence quality.
2. Add semantic document retrieval after selecting an embedding provider.
3. Connect a real contact enrichment provider when selected.

Paid-operation budget gates and configurable campaign cost ceilings are deliberately
deferred by product direction. Existing deterministic iteration, query, result, and
company ceilings remain active.

## Verification gates

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:db` against disposable Supabase
- `pnpm test:e2e` against disposable Supabase

## Locked exclusions

Automatic sending, mailbox draft creation, autonomous follow-ups, reply detection,
production billing, CRM integrations, and self-hosted crawling infrastructure remain
outside the approved current scope unless a later decision explicitly adds them.
