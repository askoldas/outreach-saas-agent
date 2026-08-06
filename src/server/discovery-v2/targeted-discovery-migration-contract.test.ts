import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728002100_targeted_semantic_discovery_passes.sql",
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

test("targeted action attempts retain pass-scoped immutable plans and outcomes", () => {
  assert.match(migration, /create table public\.discovery_gap_action_executions_v2/);
  assert.match(migration, /unique \(discovery_segment_run_id, discovery_gap_action_id\)/);
  assert.match(migration, /action_plan_hash text not null/);
  assert.match(migration, /outcome_hash text/);
  assert.match(
    migration,
    /create trigger discovery_gap_action_executions_v2_workspace_guard/,
  );
});

test("one atomic targeted-pass start validates the prior decision and global budget", () => {
  const startPass = functionSql("start_targeted_discovery_pass_v2");
  assert.match(startPass, /where id = target_run_id[\s\S]+for update/);
  assert.match(
    startPass,
    /pass_number = target_pass_number - 1[\s\S]+decision_json->>'decision' = 'continue'/,
  );
  assert.match(startPass, /selectedActionPlans/);
  assert.match(startPass, /maximum_provider_calls - consumed_provider_calls/);
  assert.match(startPass, /start_discovery_segment_pass_once_v2/);
  assert.match(startPass, /Targeted Discovery action retry changed frozen work/);
});

test("segment completion requires coverage and resolves only absent gaps", () => {
  const complete = functionSql("complete_targeted_discovery_segment_pass_v2");
  assert.match(complete, /coverage\.settlement_hash is not null/);
  assert.match(complete, /Targeted Discovery outcome retry changed settled work/);
  assert.match(complete, /set status = 'resolved', resolved_at = now\(\)/);
  assert.match(complete, /not \(remaining_gap_ids \? gap_key\)/);
});

test("targeted finalization rejects incomplete actions before aggregate settlement", () => {
  const finalize = functionSql("finalize_targeted_discovery_pass_v2");
  assert.match(finalize, /action_execution\.status = 'completed'/);
  assert.match(finalize, /action_execution\.outcome_hash is not null/);
  assert.match(finalize, /Targeted Discovery actions are not fully settled/);
  assert.match(finalize, /public\.finalize_discovery_pass_v2/);
});

test("targeted mutations are worker-only while members retain RLS reads", () => {
  assert.match(
    migration,
    /create policy "Members can read discovery_gap_action_executions_v2"/,
  );
  for (const workerFunction of [
    "start_targeted_discovery_pass_v2",
    "complete_targeted_discovery_segment_pass_v2",
    "finalize_targeted_discovery_pass_v2",
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
});
