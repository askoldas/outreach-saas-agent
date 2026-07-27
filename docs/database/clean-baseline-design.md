# Clean Supabase baseline design

## Status

This document defines Phase 1 of the clean Opptium database baseline. The baseline is
for a brand-new, empty Supabase project. It is not an upgrade migration for the locked
legacy project.

The authoritative source is the 15 ordered files in `supabase/baseline/`. Run
`node scripts/build-clean-baseline.mjs` to reproduce the single deployable migration
`supabase/migrations/20260725000100_opptium_clean_baseline.sql`.

## Design principles

- Supabase owns customer-facing product state; Trigger.dev will own internal durable
  execution state.
- Every customer-owned record is traceable to `workspaces` and protected by RLS.
- Campaign configuration is separate from `campaign_runs`.
- Canonical `companies` and `contacts` are reusable within a workspace.
- Qualification and contact selection remain campaign-specific.
- Immutable profile, snapshot and strategy context grounds runs and drafts.
- Retryable/paid work has first-class idempotency, provider execution, AI request,
  usage and budget records.
- Documents and memories are private, tenant-scoped and structurally ready for pgvector.
- Guided AI state remains non-authoritative until explicitly applied.

The clean baseline intentionally does not contain `offers`, `leads`,
`lead_contact_routes`, `research_tasks`, polling leases, claim RPCs, or Railway-specific
state.

## Schema domains

| Domain                 | Tables                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Tenancy and activity   | `profiles`, `workspaces`, `workspace_members`, `activity_events`                                                              |
| Company Profile        | `company_profiles`, `company_profile_versions`, `campaign_profile_snapshots`                                                  |
| Campaign configuration | `campaigns`, `campaign_strategy_versions`                                                                                     |
| Campaign execution     | `campaign_runs`, `campaign_run_events`, `campaign_questions`, `campaign_approvals`                                            |
| Companies              | `companies`, `company_domains`, `company_sources`, `campaign_companies`                                                       |
| Qualification          | `qualification_results`, `qualification_dimensions`, `qualification_evidence`                                                 |
| Contacts               | `contacts`, `contact_methods`, `contact_sources`, `campaign_contacts`, `contact_enrichments`, `email_verifications`           |
| Outreach               | `outreach_drafts`, `export_records`, minimal `sequences`, `sequence_steps`                                                    |
| Documents/memory       | `documents`, `document_chunks`, `campaign_memories`, `workspace_memories`                                                     |
| AI/cost control        | `ai_model_configs`, `ai_requests`, `provider_executions`, `operation_idempotency_keys`, `usage_ledger`, `budget_reservations` |
| Guided AI              | `ai_guided_drafts`, `ai_conversations`, `ai_messages`, `ai_applied_changes`                                                   |

## Important invariants

- A normalized domain is unique per workspace. Ambiguous normalization is visible
  through `collision_status`; companies without websites are allowed.
- A company appears once per campaign through `(campaign_id, company_id)`.
- A run's Campaign, Strategy and Profile snapshot must belong to the same workspace and
  campaign. `assert_campaign_run_context()` enforces this.
- Cross-workspace Company Profile versions, Strategy versions and campaign-company
  associations are rejected by database triggers in addition to RLS.
- A person contact requires a name. Department/company routes can exist without
  pretending to be people.
- Qualification inputs are versioned by schema, prompt, model config and input hash.
- Drafts freeze Profile snapshot and Strategy version and retain the evidence IDs used.
- Product-facing monetary records default to EUR. Provider currency and amount can be
  retained separately on `provider_executions`.
- Global AI model rows are readable but not client-writable. Workspace overrides are
  admin-managed.

## Initial model registry

The baseline seed is migration history rather than the active runtime router. The
TypeScript registry routes high-impact roles to `anthropic/claude-sonnet-4.6` and
economical roles to `openai/gpt-5-mini`, with an explicit critical fallback to GPT-5
Mini. Gemini 2.5 Flash remains only a future benchmark candidate. Embeddings initially
name `openai/text-embedding-3-small`.

## RLS and storage

All tenant tables have RLS. Members can read and workspace admins can mutate. Membership
and role are resolved through security-definer helper functions using `auth.uid()`.
Service-role callers bypass RLS and must resolve workspace ownership from stored
records.

The private `workspace-documents` bucket uses the first path segment as the workspace
UUID:

```text
<workspace-id>/<document-id>/<file-name>
```

Storage policies resolve membership from that segment. Public access is disabled.

## Reproducibility

### New clean schema

1. Ensure `supabase/migrations/` contains only the clean generated migration.
2. Regenerate it with `node scripts/build-clean-baseline.mjs`.
3. Start the disposable local Supabase stack.
4. Run `supabase db reset`.
5. Run `supabase test db`.

Before any linked or remote command, run:

```text
node scripts/assert-safe-supabase-target.mjs
```

It derives the project reference from `NEXT_PUBLIC_SUPABASE_URL`, verifies that it is
the approved new project `aqhuzmqzeipubxrxadyj`, and confirms that the Supabase CLI is
linked to the same project. No duplicate project-reference environment variables are
required.

### Locked legacy schema

The old chain is preserved in `supabase/migrations-legacy/`. It is never read by the
normal clean reset. To reconstruct the legacy schema, use the locked backup branch or,
in a disposable copy only, copy the legacy SQL files into `supabase/migrations/` and
reset a disposable local stack. Never link that process to the new or locked remote
project.

## Fixture coverage

`supabase/tests/database/tenant_workflow.test.sql` creates two synthetic tenants and a
complete first-tenant path: Profile version, Campaign, snapshot, Strategy, run, company,
qualification, contact/method/selection and grounded draft. It verifies owner access,
cross-tenant invisibility and denied writes. `supabase/fixtures/clean-baseline-example.sql`
provides a small manual starting fixture.

## Phase boundary

The current application still queries legacy tables and cannot use this clean project
until Phase 2 repository adapters are complete. The legacy worker remains in source as
reference behavior; it is not represented in the new database schema and must not be
pointed at the clean project.
