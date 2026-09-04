import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260904000900_restore_research_credit_release_rpc.sql",
  "utf8",
);
const boundary = readFileSync("src/server/credits/budgeted-provider-call.ts", "utf8");

test("failed-provider reservation release RPC is explicitly restored", () => {
  assert.match(migration, /create or replace function public\.release_research_credit_reservation/);
  assert.match(migration, /target_workspace_id uuid[\s\S]*target_campaign_run_id uuid[\s\S]*target_reservation_id uuid/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("credit cleanup failure cannot mask the provider failure", () => {
  assert.match(boundary, /catch \(releaseError\)/);
  assert.match(boundary, /error\.cause = releaseError/);
  assert.match(boundary, /throw error/);
});
