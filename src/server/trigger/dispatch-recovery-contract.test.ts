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

test("Campaign run and initial discovery execution are created transactionally", () => {
  const functionBody = migration.slice(
    migration.indexOf("create or replace function public.create_clean_campaign_run"),
  );
  assert.match(functionBody, /insert into public\.campaign_runs/);
  assert.match(functionBody, /insert into public\.provider_executions/);
  assert.match(functionBody, /'provider-dispatch:' \|\| execution_idempotency_key/);
});
