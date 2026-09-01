import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("src/server/discovery-v2/provider-repository.ts", "utf8");
const initialStage = readFileSync(
  "src/server/discovery-v2/initial-discovery-stage.ts",
  "utf8",
);
const targetedStage = readFileSync(
  "src/server/discovery-v2/targeted-discovery-stage.ts",
  "utf8",
);
const workflow = readFileSync("src/server/workflow-v2/repository.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260824000100_optimize_discovery_source_duplicate_lookup_v2.sql",
  "utf8",
);

test("Discovery retries only timed-out persistence while retaining the provider response", () => {
  assert.match(repository, /for \(let attempt = 1; attempt <= 3/);
  assert.match(repository, /error\.code === "57014"/);
  assert.match(repository, /statement timeout/i);
});

test("Discovery segment persistence is serialized", () => {
  assert.match(initialStage, /mapWithConcurrency\(executionRequests, 2/);
  assert.match(targetedStage, /mapWithConcurrency\(batches, 2/);
});

test("duplicate identity branches have supporting indexes", () => {
  assert.match(migration, /provider_record_id/);
  assert.match(migration, /source_url/);
  assert.match(migration, /raw_payload_hash/);
});

test("terminal workflow failure settles exhausted child retry state", () => {
  assert.match(workflow, /input\.status === "failed"/);
  assert.match(workflow, /"retry_wait"/);
  assert.match(workflow, /Could not settle failed V2 child runs/);
});
