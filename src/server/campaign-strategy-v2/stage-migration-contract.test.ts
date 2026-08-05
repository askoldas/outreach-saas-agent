import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260804000100_campaign_strategy_stage_checkpoints.sql",
  "utf8",
);
const repository = readFileSync(
  "src/server/campaign-strategy-v2/stage-repository.ts",
  "utf8",
);
const baselineMigration = readFileSync(
  "supabase/migrations/20260804000200_campaign_strategy_baseline_stage.sql",
  "utf8",
);
const advisoryMigration = readFileSync(
  "supabase/migrations/20260804000300_campaign_strategy_advisory_delta_stage.sql",
  "utf8",
);
const enrichmentStatusMigration = readFileSync(
  "supabase/migrations/20260804000400_campaign_strategy_enrichment_status.sql",
  "utf8",
);
const service = readFileSync(
  "src/server/campaign-strategy-v2/service.ts",
  "utf8",
);

test("Campaign Strategy stages are version-bound and tenant scoped", () => {
  assert.match(migration, /campaign_strategy_stage_runs_v2/);
  for (const field of [
    "cache_key",
    "input_hash",
    "prompt_version",
    "schema_version",
    "context_compiler_version",
    "model_route_version",
  ]) assert.match(migration, new RegExp(field));
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test("Strategy stage transitions are service-role-only RPCs", () => {
  for (const name of [
    "claim_campaign_strategy_stage_v2",
    "complete_campaign_strategy_stage_v2",
    "fail_campaign_strategy_stage_v2",
  ]) {
    assert.match(migration, new RegExp(name));
  }
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(repository, /createServiceRoleClient/);
});

test("campaign creation persists a deterministic baseline before AI enrichment", () => {
  assert.match(baselineMigration, /'baseline'/);
  assert.match(repository, /\| "baseline"/);
  assert.match(service, /persistDeterministicBaseline/);
  assert.match(service, /buildNativeCampaignStrategyV2/);
  assert.match(service, /compileCampaignStrategyV2/);
  assert.match(service, /persistCampaignStrategyV2Compilation/);
  assert.match(service, /stageId: "baseline"/);
  assert.match(service, /"ready_for_review"/);
});

test("Strategy enrichment uses a durable advisory-delta stage", () => {
  assert.match(advisoryMigration, /'advisory_delta'/);
  assert.match(repository, /\| "advisory_delta"/);
});

test("tenant members can read the latest durable enrichment status", () => {
  assert.match(enrichmentStatusMigration, /get_campaign_strategy_enrichment_v2/);
  assert.match(enrichmentStatusMigration, /security invoker/);
  assert.match(enrichmentStatusMigration, /grant execute .* authenticated/);
  assert.match(enrichmentStatusMigration, /distinct on \(stage_id\)/);
});
