import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260804000600_intelligence_cache_feedback_metrics.sql",
  "utf8",
);
const strategy = readFileSync(
  "src/server/campaign-strategy-v2/stage-service.ts",
  "utf8",
);
const outreach = readFileSync("src/server/draft-generation/service.ts", "utf8");
const usage = readFileSync("src/app/(app)/usage/page.tsx", "utf8");

test("cache reuse is recorded exactly at durable reuse boundaries", () => {
  assert.match(migration, /create table public\.intelligence_runtime_events/);
  assert.match(migration, /event_type in \('cache_hit'\)/);
  assert.match(strategy, /claimed\.status === "completed"[\s\S]*recordIntelligenceCacheHit/);
  assert.match(outreach, /if \(generated\)[\s\S]*recordIntelligenceCacheHit/);
});

test("feedback metrics use authoritative review tables and remain tenant scoped", () => {
  assert.match(migration, /outreach_drafts/);
  assert.match(migration, /candidate_review_decisions_v2/);
  assert.match(migration, /profile_change_events/);
  assert.match(migration, /workspace_id = target_workspace_id/g);
  assert.match(migration, /is_workspace_member\(target_workspace_id\)/);
  assert.match(usage, /getIntelligenceFeedbackMetrics/);
  assert.match(usage, /IntelligenceFeedbackHealth/);
});
