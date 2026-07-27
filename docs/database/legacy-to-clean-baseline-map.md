# Legacy-to-clean baseline map

The locked legacy database is not migrated in place. This map defines the future Phase
2/backfill compatibility work and records intentional omissions.

| Legacy entity                   | Clean entity                                           | Mapping rule                                                                                       | Compatibility impact                                            |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `profiles`                      | `profiles`                                             | Preserve user UUID and locale                                                                      | Compatible                                                      |
| `workspaces`                    | `workspaces`                                           | Preserve UUID, slug, creator and status                                                            | Compatible                                                      |
| `workspace_members`             | `workspace_members`                                    | Preserve composite identity and roles                                                              | Compatible                                                      |
| `company_profiles`              | `company_profiles`                                     | Preserve workspace identity/current pointer after versions load                                    | Pointer must be assigned after version inserts                  |
| `company_profile_versions`      | `company_profile_versions`                             | Project current structured JSON, facts, questions, readiness and provenance                        | Legacy flat columns become compatibility projections only       |
| `campaign_profile_snapshots`    | `campaign_profile_snapshots`                           | Preserve frozen profile version and JSON; assign new snapshot UUID where needed                    | Campaign pointer becomes UUID-based                             |
| `offers`                        | omitted                                                | Products/services remain in structured Profile JSON                                                | Intentionally not recreated                                     |
| `campaigns`                     | `campaigns`                                            | Preserve scoped external ID, objective and user-visible settings                                   | Old duplicated strategy columns remain omitted                  |
| `campaign_strategy_versions`    | `campaign_strategy_versions`                           | Preserve immutable version and project detailed columns into `strategy` JSON                       | Read adapter required                                           |
| `research_runs`                 | `campaign_runs`                                        | Map campaign external ID to Campaign UUID; preserve status/progress/error/timestamps               | Status mapping and frozen snapshot backfill required            |
| `research_tasks`                | omitted                                                | Trigger.dev will own internal task state; important outcomes become run events/provider executions | Intentionally not recreated; current worker cannot run          |
| `lead_sources`                  | `company_sources`                                      | Resolve canonical company and preserve provider/query/URL/content provenance                       | URL uniqueness changes from campaign-wide to provider/workspace |
| `leads`                         | `companies` + `company_domains` + `campaign_companies` | Deduplicate normalized domain within workspace; move campaign state to join row                    | Collision report/manual review required                         |
| `lead_qualification_dimensions` | `qualification_dimensions`                             | Attach to a versioned `qualification_result`                                                       | Requires result backfill                                        |
| `lead_evidence_claims`          | `qualification_evidence` + `company_sources`           | Preserve kind/statement/URL/confidence and resolve source when possible                            | Orphan URLs remain permitted                                    |
| `lead_contact_routes`           | `contacts` + `contact_methods` + `contact_sources`     | Person rows become contacts; general routes become company methods without fake people             | Ambiguous routes require classification                         |
| `lead_outreach_states`          | `campaign_contacts` + `contact_enrichments`            | Map selected route and enrichment state to campaign selection/execution                            | Read adapter required                                           |
| `outreach_drafts`               | `outreach_drafts`                                      | Resolve campaign company/contact and preserve frozen context, variants, edits and review state     | Legacy external IDs become UUID FKs                             |
| `export_records`                | `export_records`                                       | Resolve Campaign/Run UUID; preserve payload/history                                                | Field rename adapter required                                   |
| `usage_events`                  | `usage_ledger`                                         | Convert estimates/actuals into typed ledger entries                                                | Not a balance migration; reconciliation required                |
| `ai_generations`                | `ai_requests` + `provider_executions`                  | Preserve prompt/model/status/output metadata and derive execution attempts when possible           | Token/cost data may remain unknown                              |
| `activity_events`               | `activity_events` and selected `campaign_run_events`   | Keep user-visible history; execution-specific records may be copied to run events                  | Entity external IDs require resolution                          |
| `ai_guided_drafts`              | `ai_guided_drafts`                                     | Preserve scope/version/proposal/status                                                             | Compatible with UUID entity mapping                             |
| `ai_applied_changes`            | `ai_applied_changes`                                   | Preserve version, actor, changes and undo metadata                                                 | Compatible                                                      |
| `ai_conversations`              | `ai_conversations`                                     | Preserve scope/entity and timestamps                                                               | Compatible                                                      |
| `ai_messages`                   | `ai_messages`                                          | Preserve conversation order/content/metadata                                                       | Compatible                                                      |

## Historical artifacts intentionally omitted

- the `offers` table;
- permanent polling queue rows;
- task leases, `locked_by`, `locked_until`, attempt claiming and stale-lease RPCs;
- the conflated Campaign Lead as primary company storage;
- the conflated contact route as a person;
- Railway deployment state.

No production backfill is performed in Phase 1. The old project remains locked and is
the rollback reference.
