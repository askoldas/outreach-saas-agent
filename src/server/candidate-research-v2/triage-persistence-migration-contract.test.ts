import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = new URL(
  "../../../supabase/migrations/20260904000500_candidate_triage_decisions.sql",
  import.meta.url,
);

test("every cycle-scoped triage decision is durable and queryable", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(
    sql,
    /create table if not exists public\.candidate_triage_decisions_v2/i,
  );
  assert.match(sql, /unique \(research_cycle_id, campaign_candidate_id\)/i);
  assert.match(sql, /decision in \('deep_research', 'hold', 'suppress'\)/i);
  assert.match(sql, /commercial_opportunity_score/i);
  assert.match(sql, /components_json/i);
  assert.match(sql, /suppression_reasons_json/i);
  assert.match(sql, /research_difficulty/i);
  assert.match(sql, /evidence_ids_json/i);
  assert.match(sql, /policy_version/i);
  assert.match(sql, /input_hash/i);
  assert.match(sql, /for select to authenticated/i);
});

test("triage persistence is complete, tenant guarded, and retry immutable", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /auth\.role\(\) <> 'service_role'/i);
  assert.match(sql, /workflow_version = 'v2'/i);
  assert.match(sql, /completed Entity Resolution/i);
  assert.match(sql, /jsonb_array_length\(target_decisions\) <> expected_count/i);
  assert.match(sql, /count\(distinct item->>'campaignCandidateId'\)/i);
  assert.match(sql, /outside the frozen Campaign pool/i);
  assert.match(
    sql,
    /on conflict \(research_cycle_id, campaign_candidate_id\) do nothing/i,
  );
  assert.match(sql, /input changed after it was frozen/i);
});

test("an entirely held or suppressed pool can freeze an empty research batch", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /jsonb_array_length\(target_plans\) > expected_candidate_count/i);
  assert.match(
    sql,
    /\$new\$if jsonb_array_length\(target_plans\) > expected_candidate_count then/,
  );
});

test("a partially applied migration can be rerun safely", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create table if not exists/i);
  assert.match(sql, /create index if not exists/i);
  assert.match(sql, /if not exists \([\s\S]*from pg_policies/i);
  assert.match(
    sql,
    /if position\('plan subset exceeds the resolved pool' in function_definition\) > 0 then\s+return;/i,
  );
});

test("the active stage persists all triage before filtering deep research", async () => {
  const stage = await readFile(new URL("./stage-service.ts", import.meta.url), "utf8");
  const compileAt = stage.indexOf("prepareCampaignTriagePlans(");
  const persistAt = stage.indexOf("persistCandidateTriageDecisions({");
  const filterAt = stage.indexOf(
    '.filter(({ sourcePlan }) => sourcePlan.prioritization.lane === "deep_research")',
  );
  assert.ok(compileAt >= 0 && persistAt > compileAt && filterAt > persistAt);
  assert.ok(
    stage.indexOf("if (frozenBatch) return { ...frozenBatch, triageSummary }", persistAt) >
      persistAt,
  );
});
