import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000300_replay_duplicate_discovery_candidates_per_run.sql",
  ),
  "utf8",
);
const stage = readFileSync(
  join(
    process.cwd(),
    "src/server/discovery-v2/targeted-discovery-stage.ts",
  ),
  "utf8",
);

test("cross-run duplicate sources remain visible to the current run", () => {
  assert.match(
    migration,
    /create or replace function public\.persist_discovery_provider_response\(/,
  );
  assert.match(
    migration,
    /when exists \(\s+select 1\s+from jsonb_array_elements\(target_response->'normalizedCandidates'\) c\s+where c->>'sourceRecordKey' = source->>'sourceRecordKey'\s+\) then 'normalized'\s+when duplicate_source_id is not null then 'suppressed'/,
  );
  assert.match(migration, /duplicate_of_source_record_id[\s\S]+duplicate_source_id/);
  assert.doesNotMatch(
    migration,
    /if saved_source\.ingestion_status <> 'suppressed' then/,
  );
  assert.match(
    migration,
    /insert into public\.normalized_provider_candidates \(/,
  );
});

test("provider persistence remains a service-role-only worker boundary", () => {
  assert.match(
    migration,
    /revoke all on function public\.persist_discovery_provider_response\([\s\S]+?\) from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.persist_discovery_provider_response\([\s\S]+?\) to service_role;/,
  );
});

test("zero normalized candidates cannot produce a successful review-ready run", () => {
  assert.match(
    stage,
    /if \(decisionKind === "stop" && normalizedCandidateCount === 0\)/,
  );
  assert.match(
    stage,
    /Semantic Discovery completed without normalized candidates/,
  );
  assert.match(
    stage,
    /Semantic Discovery provider failed before returning source records/,
  );
});
