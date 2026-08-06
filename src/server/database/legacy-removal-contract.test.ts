import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");
const migration = source(
  "supabase/migrations/20260729000400_remove_legacy_write_and_execution_surfaces.sql",
);
const dispatch = source("src/server/trigger/dispatch.ts");
const legacyStrategy = source("src/features/campaigns/StrategyWorkspace.tsx");
const profileRepository = source("src/server/company-profile/repository.ts");
const strategyRepository = source("src/server/campaign-strategy/repository.ts");

test("WP-23.3 drops retired constructors and blocks old provider operations", () => {
  for (const fn of [
    "save_clean_company_profile_version",
    "save_analyzed_company_profile_version",
    "save_clean_campaign_strategy_version",
    "create_clean_campaign",
    "create_campaign_strategy_v2_draft",
    "enable_workspace_controlled_beta_v2",
    "rollback_workspace_intelligence_v2",
  ]) {
    assert.match(migration, new RegExp(`drop function if exists public\\.${fn}`));
  }
  assert.match(migration, /company_profile_analysis/);
  assert.match(migration, /campaign_discovery/);
  assert.match(migration, /before insert on public\.provider_executions/);
});

test("runtime dispatch is V2-only while historical strategy readers remain", () => {
  assert.match(dispatch, /campaignRun\.workflow_version !== "v2"/);
  assert.match(dispatch, /Historical V1 Campaign Runs are read-only/);
  assert.doesNotMatch(dispatch, /trigger\/execute-campaign"/);
  assert.match(legacyStrategy, /V1 read-only/);
  assert.match(profileRepository, /getCurrentCompanyProfile/);
  assert.doesNotMatch(profileRepository, /saveCompanyProfileVersion/);
  assert.match(strategyRepository, /getCurrentCampaignStrategy/);
  assert.doesNotMatch(strategyRepository, /saveCampaignStrategyVersion/);
});

test("retired runtime modules are absent from production references", () => {
  const packageJson = source("package.json");
  const environment = source(".env.example");
  assert.doesNotMatch(packageJson, /test:discovery-quality/);
  assert.doesNotMatch(environment, /CAMPAIGN_AGENT_ENABLED/);
});
