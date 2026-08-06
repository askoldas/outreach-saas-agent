import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728002000_retry_safe_semantic_discovery.sql",
  ),
  "utf8",
);

function functionSql(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `Migration must define ${name}.`);
  const bodyStart = migration.indexOf("as $$", start);
  assert.notEqual(bodyStart, -1, `${name} must have a PL/pgSQL body.`);
  const end = migration.indexOf("$$;", bodyStart);
  assert.notEqual(end, -1, `${name} must terminate its function body.`);
  return migration.slice(start, end + 3);
}

test("Memory snapshots, plans, and runs freeze one V2 Campaign Run identity", () => {
  assert.match(
    migration,
    /alter table public\.campaign_memory_snapshots[\s\S]+add column campaign_run_id uuid/,
  );
  assert.match(
    migration,
    /alter table public\.discovery_plans_v2[\s\S]+add column campaign_run_id uuid/,
  );
  assert.match(
    migration,
    /alter table public\.discovery_runs_v2[\s\S]+add column campaign_run_id uuid/,
  );
  for (const indexName of [
    "campaign_memory_snapshots_campaign_run_uidx",
    "discovery_plans_v2_campaign_run_uidx",
    "discovery_runs_v2_campaign_run_uidx",
  ]) {
    assert.match(migration, new RegExp(`unique index ${indexName}`));
  }

  const memoryGuard = functionSql("validate_campaign_memory_snapshot_run_v2");
  assert.match(
    memoryGuard,
    /campaign_run\.strategy_version_id = new\.campaign_strategy_version_id/,
  );
  assert.match(memoryGuard, /campaign_run\.workflow_version = 'v2'/);

  const planGuard = functionSql("validate_discovery_plan_campaign_run_v2");
  assert.match(planGuard, /memory_snapshot\.campaign_run_id = campaign_run\.id/);
  assert.match(
    planGuard,
    /campaign_run\.strategy_version_id = new\.campaign_strategy_version_id/,
  );

  const runGuard = functionSql("validate_discovery_campaign_run_v2");
  assert.match(runGuard, /plan\.campaign_run_id = campaign_run\.id/);
  assert.match(
    runGuard,
    /campaign_run\.strategy_version_id = plan\.campaign_strategy_version_id/,
  );

  assert.match(
    migration,
    /unique \(memory_snapshot_id, memory_id, applied_to_type, applied_to_id\)/,
  );
});

test("Memory, plan, and run creation serialize and resume by Campaign Run", () => {
  const loadMemory = functionSql("load_campaign_run_memory_snapshot_v2");
  assert.match(loadMemory, /campaign_run_id = target_campaign_run_id/);

  const freezeMemory = functionSql("freeze_campaign_run_memory_snapshot_v2");
  assert.match(freezeMemory, /where id = target_campaign_run_id[\s\S]+for update/);
  assert.match(
    freezeMemory,
    /if saved_snapshot\.id is not null then return saved_snapshot/,
  );
  assert.match(
    freezeMemory,
    /target_snapshot#>>'\{context,runId\}' <> campaign_run\.id::text/,
  );

  const createPlan = functionSql("create_campaign_discovery_plan_v2");
  assert.match(createPlan, /where id = target_campaign_run_id[\s\S]+for update/);
  assert.match(createPlan, /if saved_plan\.id is not null then return saved_plan/);
  assert.match(createPlan, /memory_snapshot\.campaign_run_id = campaign_run\.id/);

  const startRun = functionSql("start_campaign_discovery_run_v2");
  assert.match(startRun, /where id = target_campaign_run_id[\s\S]+for update/);
  assert.match(startRun, /if saved_run\.id is not null then/);
  assert.match(startRun, /Campaign Run is already linked to another Discovery Plan/);
  assert.match(
    startRun,
    /campaign_strategy_version_id = campaign_run\.strategy_version_id/,
  );
});

test("segment pass retries preserve text gap keys and settled state", () => {
  assert.match(
    migration,
    /alter column gap_ids type text\[\][\s\S]+using gap_ids::text\[\]/,
  );
  const startPass = functionSql("start_discovery_segment_pass_once_v2");
  assert.match(startPass, /target_gap_keys text\[\] default '\{\}'/);
  assert.match(startPass, /where discovery_run_id = target_run_id[\s\S]+for update/);
  assert.match(startPass, /Semantic Discovery pass retry changed its gap keys/);
  assert.match(startPass, /array_agg\(requested\.gap_key order by requested\.gap_key\)/);
  assert.match(startPass, /if saved_run\.id is not null then[\s\S]+return saved_run/);
  assert.match(
    startPass,
    /target_pass_number = 1 and cardinality\(canonical_gap_keys\) > 0/,
  );
  assert.match(startPass, /gap\.status in \('open', 'addressing'\)/);
});

test("query plans freeze a provider-bound request for the exact Segment pass", () => {
  const freezeQueryPlan = functionSql("freeze_discovery_query_plan_v2");
  const replayReturn = freezeQueryPlan.indexOf(
    "if saved_plan.id is not null then return saved_plan",
  );
  const freshValidation = freezeQueryPlan.indexOf(
    "if nullif(btrim(target_provider_key), '') is null",
  );
  assert.ok(replayReturn > -1 && replayReturn < freshValidation);
  assert.ok(freezeQueryPlan.includes("target_content_hash !~ '^[0-9a-f]{64}$'"));
  assert.match(
    freezeQueryPlan,
    /target_request->>'workspaceId'[\s\S]+is distinct from target_workspace_id::text/,
  );
  assert.match(
    freezeQueryPlan,
    /target_request#>>'\{executionContext,passNumber\}'[\s\S]+is distinct from segment_run\.pass_number::text/,
  );
  assert.match(
    freezeQueryPlan,
    /target_request->>'discoveryPlanId'[\s\S]+discovery_run\.discovery_plan_id::text/,
  );
});

test("query audit cannot reparent executions and only settles compatible retries", () => {
  const queryAudit = functionSql("record_discovery_query_audit_v2");
  assert.match(
    queryAudit,
    /provider_execution\.discovery_segment_run_id is not null[\s\S]+provider_execution\.discovery_segment_run_id <> target_segment_run_id/,
  );
  assert.match(queryAudit, /Provider execution is already linked to another Segment Run/);
  assert.match(
    queryAudit,
    /where id = provider_execution\.id[\s\S]+discovery_segment_run_id is null/,
  );
  assert.match(
    queryAudit,
    /Discovery query fingerprint was reused with different content/,
  );
  assert.match(queryAudit, /Settled Discovery query does not match its frozen plan/);
  assert.match(
    queryAudit,
    /existing_query\.status in \('planned', 'running'\)[\s\S]+set status = incoming_status, result_count = incoming_count/,
  );
});

test("segment coverage is unique, retry-checked, and does not finalize the run", () => {
  assert.match(
    migration,
    /unique index discovery_coverage_snapshots_v2_segment_run_uidx[\s\S]+on public\.discovery_coverage_snapshots_v2\(discovery_segment_run_id\)/,
  );
  assert.match(migration, /unique index discovery_gap_actions_v2_fingerprint_uidx/);

  const settleSegment = functionSql("persist_discovery_segment_coverage_once_v2");
  assert.match(settleSegment, /where id = target_segment_run_id[\s\S]+for update/);
  assert.match(settleSegment, /Semantic Discovery coverage retry changed settled work/);
  assert.match(
    settleSegment,
    /if existing_snapshot\.settlement_hash is not null then[\s\S]+return existing_snapshot[\s\S]+set settlement_hash = target_settlement_hash/,
  );
  assert.match(settleSegment, /update public\.discovery_segment_runs_v2/);
  assert.match(settleSegment, /update public\.discovery_segments_v2/);
  assert.doesNotMatch(settleSegment, /update public\.discovery_runs_v2/);
});

test("one aggregate decision finalizes the exact settled Segment Run set", () => {
  assert.match(migration, /create table public\.discovery_pass_decisions_v2/);
  assert.match(migration, /expected_segment_run_ids uuid\[\] not null/);
  assert.match(migration, /unique \(discovery_run_id, pass_number\)/);

  const finalizePass = functionSql("finalize_discovery_pass_v2");
  assert.match(finalizePass, /target_expected_segment_run_ids uuid\[\]/);
  assert.match(finalizePass, /where id = target_run_id[\s\S]+for update/);
  assert.match(
    finalizePass,
    /cardinality\(target_expected_segment_run_ids\)[\s\S]+count\(distinct expected\.segment_run_id\)/,
  );
  assert.match(
    finalizePass,
    /array_agg\(expected\.segment_run_id order by expected\.segment_run_id\)/,
  );
  assert.match(
    finalizePass,
    /target_pass_number = 1[\s\S]+expected_count <> plan_segment_count/,
  );
  assert.match(
    finalizePass,
    /started_count <> expected_count[\s\S]+matched_count <> expected_count/,
  );
  assert.match(
    finalizePass,
    /segment_run\.id = any\(canonical_expected_segment_run_ids\)/,
  );
  assert.match(
    finalizePass,
    /segment_run\.completed_at is not null[\s\S]+coverage\.settlement_hash is not null/,
  );
  assert.match(finalizePass, /Semantic Discovery pass retry changed its final decision/);
  assert.match(
    finalizePass,
    /'expectedSegmentRunIds', to_jsonb\(canonical_expected_segment_run_ids\)/,
  );
  assert.match(
    finalizePass,
    /insert into public\.discovery_pass_decisions_v2 \([\s\S]+expected_segment_run_ids/,
  );
  assert.match(
    finalizePass,
    /coalesce\(decision_kind, ''\) not in \([\s\S]+request_user_input/,
  );
  assert.match(
    finalizePass,
    /coalesce\(reason_code, ''\) not in \([\s\S]+strategy_ambiguity/,
  );
  assert.match(
    finalizePass,
    /when decision_kind = 'continue'[\s\S]+when decision_kind in \('pause', 'request_user_input'\)[\s\S]+when reason_code = 'budget_exhausted'/,
  );
  assert.match(finalizePass, /update public\.discovery_runs_v2/);
  assert.match(
    finalizePass,
    /if decision_kind = 'stop' then[\s\S]+update public\.discovery_plans_v2[\s\S]+set status = 'completed'/,
  );
});

test("legacy mutation RPCs are revoked and retry-safe entry points are worker-only", () => {
  for (const legacySignature of [
    String.raw`create_discovery_plan_v2\([\s\S]*?uuid, uuid, uuid, uuid, jsonb, text[\s\S]*?\)`,
    String.raw`start_discovery_run_v2\(uuid, uuid\)`,
    String.raw`start_discovery_segment_pass_v2\([\s\S]*?uuid, uuid, uuid, integer, uuid\[\][\s\S]*?\)`,
    String.raw`persist_discovery_coverage_decision_v2\([\s\S]*?uuid, uuid, uuid, jsonb, jsonb, jsonb[\s\S]*?\)`,
    String.raw`persist_discovery_provider_response\([\s\S]*?uuid, uuid, text, text, text, text, jsonb, text,[\s\S]*?text, text, jsonb, jsonb, text[\s\S]*?\)`,
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${legacySignature}[\\s\\S]*?from public, anon, authenticated, service_role`,
      ),
    );
  }

  for (const workerFunction of [
    "load_campaign_run_memory_snapshot_v2",
    "freeze_campaign_run_memory_snapshot_v2",
    "create_campaign_discovery_plan_v2",
    "load_campaign_discovery_plan_v2",
    "start_campaign_discovery_run_v2",
    "start_discovery_segment_pass_once_v2",
    "freeze_discovery_query_plan_v2",
    "record_discovery_query_audit_v2",
    "persist_discovery_segment_coverage_once_v2",
    "finalize_discovery_pass_v2",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${workerFunction}\\([\\s\\S]*?\\)[\\s\\S]*?from public, anon, authenticated`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${workerFunction}\\([\\s\\S]*?\\)[\\s\\S]*?to service_role`,
      ),
    );
  }

  assert.match(
    migration,
    /revoke all on function public\.finalize_discovery_pass_v2\([\s\S]*?uuid, uuid, integer, uuid\[\], jsonb, jsonb, jsonb[\s\S]*?\) from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_discovery_pass_v2\([\s\S]*?uuid, uuid, integer, uuid\[\], jsonb, jsonb, jsonb[\s\S]*?\) to service_role/,
  );
});

test("authenticated users retain RLS reads but cannot mutate runtime rows directly", () => {
  const revokeStart = migration.indexOf("revoke insert, update, delete on table");
  const revokeEnd = migration.indexOf("from authenticated;", revokeStart);
  const grantStart = migration.indexOf("grant select on table", revokeEnd);
  const grantEnd = migration.indexOf("to authenticated;", grantStart);
  assert.ok(revokeStart > -1 && revokeEnd > revokeStart);
  assert.ok(grantStart > revokeEnd && grantEnd > grantStart);

  const revokeBlock = migration.slice(revokeStart, revokeEnd);
  const grantBlock = migration.slice(grantStart, grantEnd);
  for (const tableName of [
    "campaign_memory_snapshots",
    "memory_application_events",
    "discovery_provider_capability_snapshots",
    "discovery_provider_executions",
    "provider_source_records",
    "normalized_provider_candidates",
    "discovery_plans_v2",
    "discovery_segments_v2",
    "discovery_source_plans_v2",
    "discovery_runs_v2",
    "discovery_segment_runs_v2",
    "discovery_queries_v2",
    "discovery_coverage_snapshots_v2",
    "discovery_gaps_v2",
    "discovery_gap_actions_v2",
    "discovery_usage_events_v2",
    "discovery_pass_decisions_v2",
    "discovery_query_plans_v2",
  ]) {
    assert.ok(
      revokeBlock.includes(`public.${tableName}`),
      `${tableName} must revoke authenticated DML.`,
    );
    assert.ok(
      grantBlock.includes(`public.${tableName}`),
      `${tableName} must retain authenticated SELECT.`,
    );
  }
});
