import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902000700_increase_company_research_target.sql",
  "utf8",
);
const action = readFileSync("src/server/campaign-results-v2/actions.ts", "utf8");
const controls = readFileSync(
  "src/features/campaigns/ResearchCheckpointActions.tsx",
  "utf8",
);

test("target increase is serialized, append-only, and reopens the same run", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /insert into public\.campaign_run_target_revisions/);
  assert.match(migration, /outcome_state = 'active'/);
  assert.match(
    migration,
    /update public\.intelligence_workflow_runs set status = 'queued'/,
  );
  assert.doesNotMatch(migration, /insert into public\.campaign_runs/);
  assert.match(migration, /update public\.usage_ledger/);
  assert.match(migration, /':target-' \|\| target_run\.requested_company_count/);
  assert.doesNotMatch(migration, /delete from public\.usage_ledger/);
});

test("continuation reuses queued work before buying more discovery", () => {
  assert.match(migration, /member\.status = 'queued'/);
  assert.match(migration, /then 'research_existing_pool' else 'discover_more'/);
  assert.match(migration, /continuation_of_cycle_id/);
});

test("find-more UI sends quantity and shows an incremental quote", () => {
  assert.match(controls, /Find \{additionalCompanyCount\} more companies/);
  assert.match(controls, /requestedCompanyCount: nextTarget/);
  assert.match(controls, /incremental estimated price/);
  assert.match(action, /increaseCompanyResearchTarget/);
  assert.doesNotMatch(action, /authorizeAdditionalResearchCredits/);
});

test("a repeated target request can redispatch the idempotent revision", () => {
  assert.match(migration, /requested_count = target_run\.requested_company_count/);
  assert.match(migration, /'idempotent', true/);
  assert.match(migration, /event\.details->>'requestedAction'/);
  assert.match(migration, /event\.details->>'incrementalAuthorizedCredits'/);
  assert.match(action, /input\.requestedCompanyCount < run\.requested_company_count/);
});
