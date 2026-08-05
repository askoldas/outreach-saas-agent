import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260804000500_intelligence_runtime_metrics.sql",
  "utf8",
);
const repository = readFileSync(
  "src/server/intelligence-runtime/metrics-repository.ts",
  "utf8",
);

test("runtime metrics are tenant-scoped, bounded, and service-readable", () => {
  assert.match(migration, /get_intelligence_runtime_metrics/);
  assert.match(migration, /attempts\.workspace_id = target_workspace_id/);
  assert.match(migration, /is_workspace_member\(target_workspace_id\)/);
  assert.match(migration, /last 90 days/);
  assert.match(migration, /grant execute.*authenticated, service_role/s);
});

test("runtime metrics expose failures, repairs, fallback, latency, usage, and cost", () => {
  for (const field of [
    "repair_rate",
    "fallback_rate",
    "timeout_rate",
    "truncation_rate",
    "p95_latency_ms",
    "total_input_units",
    "total_output_units",
    "total_cost",
  ])
    assert.match(migration, new RegExp(field));
  assert.match(repository, /get_intelligence_runtime_metrics/);
});

