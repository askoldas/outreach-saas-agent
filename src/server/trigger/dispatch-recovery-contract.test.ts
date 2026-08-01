import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dispatch = readFileSync(new URL("./dispatch.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260727000300_trigger_dispatch_recovery.sql",
    import.meta.url,
  ),
  "utf8",
);
const removalMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260729000400_remove_legacy_write_and_execution_surfaces.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Trigger dispatches persist recoverable state and stable idempotency keys", () => {
  for (const state of [
    "created",
    "dispatching",
    "dispatched",
    "running",
    "completed",
    "failed",
    "dispatch_failed",
  ])
    assert.match(migration, new RegExp(`'${state}'`));
  assert.match(migration, /dispatch_key text/);
  assert.match(migration, /campaign_runs_recoverable_dispatch_idx/);
  assert.match(migration, /provider_executions_recoverable_dispatch_idx/);
  assert.match(dispatch, /dispatch_attempts: data\.dispatch_attempts \+ 1/);
  assert.match(dispatch, /dispatch_state: "dispatch_failed"/);
  assert.match(dispatch, /reconcileTriggerDispatches/);
});

test("current Campaign Run creation leaves discovery execution to native V2 Trigger tasks", () => {
  const functionBody = removalMigration.slice(
    removalMigration.indexOf(
      "create or replace function public.create_clean_campaign_run",
    ),
    removalMigration.indexOf(
      "create or replace function public.reject_retired_provider_execution",
    ),
  );
  assert.match(functionBody, /insert into public\.campaign_runs/);
  assert.match(functionBody, /'execute-campaign-v2:' \|\| created_run\.id::text/);
  assert.doesNotMatch(functionBody, /insert into public\.provider_executions/);
});
