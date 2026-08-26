import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260826000100_clear_all_core_intelligence_workspace_data.sql",
  "utf8",
);
const confirmationRepair = readFileSync(
  "supabase/migrations/20260826000200_restore_market_analysis_confirmations_v2.sql",
  "utf8",
);

test("workspace cleanup removes immutable Organization References before provider lineage", () => {
  assert.match(migration, /set_config\('app\.workspace_cleanup_id'/);
  assert.match(
    migration,
    /delete from public\.organization_references_v2[\s\S]*perform public\.clear_workspace_data_before_core_intelligence_v2/,
  );
  assert.match(
    migration,
    /tg_op = 'DELETE'[\s\S]*app\.workspace_cleanup_id[\s\S]*return old/,
  );
});

test("workspace cleanup removes qualification bindings before Core Intelligence versions", () => {
  const qualification = migration.indexOf(
    "delete from public.candidate_qualification_batch_members_v2",
  );
  const relationship = migration.indexOf(
    "delete from public.commercial_relationship_assessment_versions_v2",
  );
  const companyIntelligence = migration.indexOf(
    "delete from public.company_intelligence_versions_v2",
  );
  assert.ok(qualification > 0 && qualification < relationship);
  assert.ok(relationship < companyIntelligence);
});

test("workspace cleanup clears the complete campaign Core Intelligence graph", () => {
  for (const table of [
    "market_research_plan_versions_v2",
    "research_blueprint_versions_v2",
    "market_analysis_confirmations_v2",
    "campaign_target_model_versions_v2",
    "commercial_intelligence_versions_v2",
  ]) {
    assert.match(migration, new RegExp(`delete from public\\.${table}`));
  }
  assert.match(
    migration,
    /update public\.campaign_research_cycles_v2[\s\S]*continuation_of_cycle_id = null/,
  );
});

test("schema repair restores the missing Market Analysis confirmation boundary", () => {
  assert.match(
    confirmationRepair,
    /create table if not exists public\.market_analysis_confirmations_v2/,
  );
  assert.match(confirmationRepair, /enable row level security/);
  assert.match(
    confirmationRepair,
    /market_analysis_confirmations_v2_immutable[\s\S]*reject_core_intelligence_artifact_mutation_v2/,
  );
});
