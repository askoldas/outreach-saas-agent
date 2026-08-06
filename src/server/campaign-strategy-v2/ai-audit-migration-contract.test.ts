import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260803000100_campaign_strategy_ai_audit_rpc.sql",
  "utf8",
);
const repository = readFileSync("src/server/campaign-strategy-v2/repository.ts", "utf8");

test("Campaign Strategy auditing uses a tenant-scoped RPC instead of direct writes", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /public\.is_workspace_admin\(target_workspace_id\)/);
  assert.match(migration, /campaign_strategy_drafts/);
  assert.match(migration, /jsonb_array_length\(target_requests\) > 2/);
  assert.match(migration, /insert into public\.ai_requests/);
  assert.match(migration, /strategyDraftId/);
  assert.match(repository, /record_campaign_strategy_ai_requests_v2/);
  assert.doesNotMatch(
    repository.slice(0, repository.indexOf("createCampaignStrategyV2Draft")),
    /\.from\("ai_requests"\)/,
  );
});

test("Campaign Strategy audit RPC is authenticated-only and idempotent", () => {
  assert.match(migration, /revoke all[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.match(migration, /if not exists[\s\S]*request\.metadata->>'outputHash'/);
});
