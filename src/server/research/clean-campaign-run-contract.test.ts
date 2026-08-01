import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260729000400_remove_legacy_write_and_execution_surfaces.sql",
    import.meta.url,
  ),
  "utf8",
);

test("campaign discovery creates and reads native V2 Campaign Runs", () => {
  assert.match(repository, /rpc\("create_clean_campaign_run"/);
  assert.match(repository, /\.from\("campaign_runs"\)/);
  assert.match(repository, /progress_percentage/);
  const campaignSection = repository.slice(
    repository.indexOf("export async function enqueueCampaignDiscoveryRun"),
    repository.indexOf("export async function enqueueLeadContactEnrichmentRun"),
  );
  assert.doesNotMatch(campaignSection, /research_runs|research_tasks/);
});

test("Campaign Run creation freezes context and appends a user-visible event", () => {
  assert.match(migration, /target_campaign\.current_strategy_version_id/);
  assert.match(migration, /target_campaign\.profile_snapshot_id/);
  assert.match(migration, /target_campaign\.workflow_version <> 'v2'/);
  assert.match(migration, /'execute-campaign-v2:' \|\| created_run\.id::text/);
  assert.match(migration, /insert into public\.campaign_run_events/i);
  assert.match(migration, /'campaign_run_queued'/);
});

test("native V2 Campaign Run creation does not create a legacy provider execution", () => {
  const functionBody = migration.slice(
    migration.indexOf("create or replace function public.create_clean_campaign_run"),
    migration.indexOf(
      "create or replace function public.reject_retired_provider_execution",
    ),
  );
  assert.match(functionBody, /insert into public\.campaign_runs/i);
  assert.doesNotMatch(functionBody, /insert into public\.provider_executions/i);
  assert.doesNotMatch(functionBody, /campaign_discovery/i);
});
