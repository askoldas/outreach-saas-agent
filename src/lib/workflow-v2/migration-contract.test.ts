import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260728001600_v2_workflow_orchestration.sql"),
  "utf8",
);

test("V2 orchestration persists runs, attempts, checkpoints, commands, outbox, and usage", () => {
  for (const table of [
    "intelligence_workflow_runs",
    "intelligence_task_runs",
    "intelligence_task_attempts",
    "workflow_checkpoints",
    "workflow_commands",
    "workflow_outbox",
    "intelligence_usage_events",
  ])
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /V2 workflow workspace mismatch/);
});
