import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260726000200_create_clean_campaign_run.sql",
    import.meta.url,
  ),
  "utf8",
);

test("campaign discovery creates and reads clean Campaign Runs", () => {
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
  assert.match(migration, /insert into public\.campaign_run_events/i);
  assert.match(migration, /'campaign_run_queued'/);
});
