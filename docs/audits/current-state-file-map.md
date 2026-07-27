# Opptium current-state file map

This map groups important implementation evidence for later focused tasks. It excludes
generic styling files unless they define a domain screen.

## Target and repository guidance

- `docs/opptium-product-technical-specification-updated.md` — approved target
  architecture (the non-`updated` filename named by the audit brief is absent).
- `AGENTS.md` — repository-wide implementation, tenant, AI, worker and safety rules.
- `docs/DECISIONS.md` — binding current implementation decisions.
- `docs/ARCHITECTURE.md` — current application/worker architecture.
- `docs/DOMAIN_MODEL.md` — current canonical terminology.
- `docs/AI_PIPELINE.md` — current AI workflow.
- `docs/BACKGROUND_WORKERS.md` — worker execution and operations.
- `docs/RAILWAY_WORKER_DEPLOYMENT.md` — current worker hosting assumption.
- `docs/SECURITY_AND_COMPLIANCE.md` — security and privacy direction.
- `docs/TESTING.md` — test strategy and available gates.
- `package.json` — framework versions, worker and validation scripts.
- `.env.example` — Supabase, Tavily, OpenRouter and worker configuration.

## Company Profile

- `src/app/(app)/company-profile/page.tsx` — authenticated profile page composition.
- `src/features/company-profile/CompanyWebsiteSettings.tsx` — website input/analysis
  entry UI.
- `src/features/company-profile/CompanyProfileWorkspace.tsx` — structured profile
  review/edit/publish UI.
- `src/features/company-profile/CompanyGuidedSetup.tsx` — guided setup and questions.
- `src/server/company-profile/actions.ts` — validation, workspace authorization, version
  changes and analysis enqueue.
- `src/server/company-profile/repository.ts` — profile/version reads and save RPCs.
- `src/lib/company-profile/structured-profile.ts` — structured seller schema,
  normalization and readiness.
- `src/lib/ai/company-profile-analysis.ts` — website-evidence prompt, parsing and merge.
- `src/workers/tasks/analyze-company-profile.ts` — asynchronous analysis handler,
  generation/usage logging and version save.
- `src/app/api/company-profile/analysis-progress/route.ts` — authenticated polling.
- `supabase/migrations/20260719000100_create_company_profiles_and_campaign_snapshots.sql`
  — profile versions and campaign snapshots.
- `supabase/migrations/20260719000700_add_company_profile_analysis.sql` — analysis
  provenance.
- `supabase/migrations/20260723000200_create_structured_company_profiles.sql` — rich
  profile JSON and save RPCs.
- `supabase/migrations/20260723000300_fix_company_profile_json_projection.sql` through
  `20260723000600_fix_company_profile_prompt_version_column.sql` — compatibility fixes.

## Campaigns and Strategy

- `src/app/(app)/campaigns/page.tsx` — campaign list.
- `src/app/(app)/campaigns/new/page.tsx` — creation page.
- `src/app/(app)/campaigns/[id]/page.tsx` — campaign shell/overview.
- `src/app/(app)/campaigns/[id]/strategy/page.tsx` — strategy review.
- `src/features/campaigns/CampaignBriefForm.tsx` — profile offering selection and
  campaign-specific overrides.
- `src/features/campaigns/CampaignsReportTable.tsx` — campaign table.
- `src/features/campaigns/CampaignControls.tsx` — run controls.
- `src/features/campaigns/StrategyWorkspace.tsx` — versioned strategy review.
- `src/server/campaigns/actions.ts` — creation and mutation actions.
- `src/server/campaigns/repository.ts` — campaign persistence/hydration.
- `src/server/campaigns/page-data.ts` — campaign page read model.
- `src/server/campaign-strategy/actions.ts` — synchronous AI strategy generation.
- `src/server/campaign-strategy/repository.ts` — strategy version reads/save RPC.
- `src/lib/ai/strategy-generation.ts` — prompt and structured parser.
- `supabase/migrations/20260618000500_create_campaigns.sql` — initial campaign table.
- `supabase/migrations/20260719000200_create_campaign_strategy_versions.sql` — immutable
  strategy and run freeze.
- `supabase/migrations/20260719000600_retire_legacy_offer_and_strategy_columns.sql` —
  retires duplicated offer/strategy fields.

## Discovery and research

- `src/server/research/repository.ts` — run/task enqueue and progress queries.
- `src/lib/discovery/query-builder.ts` — deterministic strategy-to-query builder.
- `src/lib/discovery/result-classifier.ts` — result filtering/classification.
- `src/lib/discovery/report.ts` — persisted discovery report shape.
- `src/workers/tasks/search-web.ts` — Tavily search, normalization, source/lead writes
  and downstream task creation.
- `src/lib/providers/tavily.ts` — Tavily search and extraction adapter.
- `src/app/api/campaigns/[id]/discovery-progress/route.ts` — authenticated progress
  polling.
- `src/features/progress/RunProgressPanel.tsx` — run progress UI.
- `supabase/migrations/20260624000100_add_campaign_discovery_report.sql` — report column.
- `supabase/migrations/20260624000200_create_research_worker_tables.sql` — runs, tasks,
  sources and AI generations.

## Worker and asynchronous execution

- `src/workers/research-worker.ts` — process loop and task dispatch entry point.
- `src/workers/lib/worker-config.ts` — worker identity/poll interval.
- `src/workers/lib/claim-task.ts` — atomic database task claim.
- `src/workers/lib/task-status.ts` — completion, retry and run aggregation.
- `src/workers/lib/sleep.ts` — polling delay.
- `src/workers/tasks/*.ts` — fixed task handlers.
- `supabase/migrations/20260723000500_recover_expired_research_tasks.sql` — stale lease
  recovery and claim semantics.
- `docs/BACKGROUND_WORKERS.md` — worker behavior and operations.
- `docs/RAILWAY_WORKER_DEPLOYMENT.md` — separate persistent service deployment.

## Companies, leads, evidence and qualification

- `src/app/(app)/leads/page.tsx` — global Leads landing/read model.
- `src/app/(app)/leads/companies/page.tsx` — company-oriented table.
- `src/app/(app)/leads/contacts/page.tsx` — contact-oriented view.
- `src/app/(app)/campaigns/[id]/leads/page.tsx` — campaign lead review.
- `src/features/leads/GlobalCompaniesTable.tsx` — expandable global company rows.
- `src/features/leads/CampaignLeadReview.tsx` — review/approve/reject UI.
- `src/server/leads/actions.ts` — review mutations.
- `src/server/leads/repository.ts` — lead, evidence, qualification and contact reads/
  writes.
- `src/lib/ai/lead-evaluation.ts` — qualification prompt/schema/parser.
- `src/lib/providers/lead-evaluator.ts` — provider-facing evaluation boundary.
- `src/workers/tasks/evaluate-lead.ts` — qualification orchestration and persistence.
- `src/lib/opptium/domain.ts` — deterministic fit/review/recipient/credit functions.
- `src/types/domain.ts` — current public read-model types.
- `supabase/migrations/20260618000300_create_leads.sql` — conflated campaign lead,
  dimensions, evidence and contact routes.
- `supabase/migrations/20260622000100_add_lead_qualification_state.sql` — qualification
  lifecycle.

## Contacts and enrichment

- `src/lib/providers/contact-enrichment.ts` — Tavily contact discovery and normalization.
- `src/lib/discovery/contact-extractor.ts` — deterministic contact extraction.
- `src/workers/tasks/enrich-contacts.ts` — enrichment gating, provider call, provenance,
  deduplication and usage.
- `src/server/outreach/actions.ts` — explicit enrichment/recipient actions.
- `src/server/outreach/read-model.ts` — outreach company/contact view.
- `supabase/migrations/20260719000300_persist_outreach_exports_and_usage.sql` —
  enrichment and recipient-selection state.
- `supabase/migrations/20260719000900_add_contact_verification_provenance.sql` —
  verification provenance.

## Outreach, drafts, sequences and exports

- `src/app/(app)/sequences/page.tsx` — current drafts/export workspace, not a persisted
  sequence engine.
- `src/app/(app)/campaigns/[id]/outreach/page.tsx` — campaign outreach view.
- `src/features/outreach/OutreachWorkspace.tsx` — recipient, draft, approval and export.
- `src/features/outreach/SequencesReportTable.tsx` — sequence-like report UI.
- `src/lib/ai/draft-generation.ts` — grounded draft prompt and parser.
- `src/workers/tasks/generate-draft.ts` — generation audit, upsert and usage.
- `src/server/drafts/actions.ts` / `repository.ts` — draft review/edit reads/writes.
- `src/server/outreach/actions.ts` / `repository.ts` — enrichment, selection and export.
- `src/lib/exports/csv.ts` — deterministic CSV shaping.
- `src/app/api/exports/[id]/download/route.ts` — authorized historical download.
- `supabase/migrations/20260618000600_create_drafts.sql` — original draft model.
- `supabase/migrations/20260719000400_add_grounded_draft_generation.sql` — frozen context
  and idempotent variants.

## AI and providers

- `src/lib/providers/config.ts` — environment-based Tavily/OpenRouter config.
- `src/lib/providers/openrouter.ts` — custom Chat Completions adapter, fallback models
  and timeout/error handling.
- `src/lib/providers/tavily.ts` — search/extraction adapter.
- `src/lib/ai/company-profile-analysis.ts` — profile call.
- `src/lib/ai/strategy-generation.ts` — strategy call.
- `src/lib/ai/lead-evaluation.ts` — qualification call.
- `src/lib/ai/draft-generation.ts` — outreach call.
- `src/lib/ai/guided-interpretation.ts` — guided UI call.
- `supabase/migrations/20260624000200_create_research_worker_tables.sql` —
  `ai_generations`.
- `supabase/migrations/20260624000300_add_ai_generation_prompt_version.sql` — prompt
  provenance.
- `supabase/migrations/20260719000800_add_strategy_generation_usage.sql` — strategy
  operation usage.

## Guided temporary state

- `src/features/guided/AiGuidedWorkspace.tsx` — guided workflow UI.
- `src/features/guided/ContextualAiDrawer.tsx` — contextual assistant drawer.
- `src/lib/guided/contracts.ts` — guided proposal/application schemas.
- `src/server/guided/actions.ts` — interpretation and deterministic application.
- `src/server/guided/repository.ts` — drafts/conversations/messages/applied changes.
- `supabase/migrations/20260723000700_create_ai_guided_workflows.sql` — guided temporary
  and audit tables.

## Usage and credits

- `src/app/(app)/usage/page.tsx` — usage view.
- `src/lib/opptium/domain.ts` — simple deterministic credit estimates.
- `src/server/outreach/repository.ts` — usage event reads/writes.
- Worker task files — operation usage inserts.
- `supabase/migrations/20260719000300_persist_outreach_exports_and_usage.sql` —
  `usage_events`.

## Authentication, tenancy and security

- `src/lib/supabase/client.ts` — browser client.
- `src/lib/supabase/server.ts` — SSR cookie client/current workspace helpers.
- `src/lib/supabase/service.ts` — worker-only service-role client.
- `src/lib/supabase/proxy.ts` and root `proxy.ts` — session routing.
- `src/server/auth/actions.ts` / `user.ts` — auth operations/current user.
- `src/server/workspaces/actions.ts` / `repository.ts` — workspace selection/mutation.
- `src/app/(app)/workspaces/select/route.ts` — workspace selection route.
- `supabase/migrations/20260618000100_create_tenant_foundation.sql` — profiles,
  workspaces, membership, RLS helpers.
- `supabase/migrations/20260618000200_harden_create_workspace_rpc.sql` — RPC hardening.
- `supabase/tests/database/tenant_workflow.test.sql` — database/RLS/tenant workflow.

## UI route readiness

- `src/app/(app)/dashboard/page.tsx` — operational dashboard.
- `src/app/(app)/company-profile/page.tsx` — implemented.
- `src/app/(app)/campaigns/**` — implemented campaign/list/strategy/leads/outreach.
- `src/app/(app)/leads/**` — implemented company/contact reports.
- `src/app/(app)/sequences/page.tsx` — implemented drafts/export UI; no sequence backend.
- `src/app/(app)/usage/page.tsx` — implemented event display; no billing ledger.
- `src/app/(app)/settings/page.tsx` — workspace/profile/provider display and data clear;
  not full integration administration.
- `src/app/(app)/help/page.tsx` — lightweight help page.
- `src/components/layout/AppShell.tsx` — target navigation.
- `src/features/marketing/PublicPlaceholder.tsx` — explicit placeholder component used
  by some public legal/resource routes, not application workflow evidence.

## Tests and fixtures

- `src/**/*.test.ts` — unit, schema, provider and migration contract tests.
- `supabase/tests/database/tenant_workflow.test.sql` — database integration coverage.
- `tests/e2e/campaign-workflow.spec.ts` — authenticated persisted workflow.
- `playwright.config.ts` — browser test configuration.
- `.github/workflows/ci.yml` — configured CI gates.
