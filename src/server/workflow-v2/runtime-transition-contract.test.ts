import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fingerprintJson } from "../../lib/workflow-v2/fingerprint.ts";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728001800_v2_workflow_runtime_transitions.sql",
  ),
  "utf8",
);
const repository = readFileSync(
  join(process.cwd(), "src/server/workflow-v2/repository.ts"),
  "utf8",
);

test("V2 workflow initialization rejects non-V2 Campaign Runs", () => {
  assert.match(migration, /campaign_run\.workflow_version <> 'v2'/);
  assert.match(migration, /on conflict \(campaign_run_id\)/);
  assert.match(repository, /ensure_campaign_workflow_v2/);
});

test("task claiming is atomic, input-bound, and attempt-aware", () => {
  assert.match(migration, /where idempotency_key = target_idempotency_key\s+for update/);
  assert.match(migration, /idempotency key was reused with different input/);
  assert.match(migration, /next_attempt := saved\.attempt_count \+ 1/);
  assert.match(migration, /insert into public\.intelligence_task_attempts/);
  assert.match(repository, /target_input_fingerprint: fingerprintJson/);
});

test("task completion and failure settle the current attempt separately", () => {
  assert.match(migration, /complete_intelligence_task_v2/);
  assert.match(migration, /fail_intelligence_task_attempt_v2/);
  assert.match(migration, /target_retryable then 'retry_wait' else 'failed'/);
  assert.match(migration, /update public\.intelligence_task_attempts/);
});

test("runtime transition RPCs are service-role only", () => {
  assert.match(migration, /revoke all on function[\s\S]+from anon, authenticated/);
  assert.match(migration, /grant execute on function[\s\S]+to service_role/);
});

test("JSON fingerprints are stable across object key ordering", () => {
  assert.equal(
    fingerprintJson({ campaignRunId: "run-1", stage: "discover" }),
    fingerprintJson({ stage: "discover", campaignRunId: "run-1" }),
  );
  assert.notEqual(
    fingerprintJson({ campaignRunId: "run-1" }),
    fingerprintJson({ campaignRunId: "run-2" }),
  );
});
