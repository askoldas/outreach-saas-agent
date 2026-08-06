import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260729001100_allow_semantic_gap_progress_updates.sql",
  ),
  "utf8",
);
const searchPathRepair = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000100_restore_semantic_gap_pgcrypto_search_path.sql",
  ),
  "utf8",
);

test("Semantic Discovery preserves gap identity while updating progress observations", () => {
  assert.match(
    migration,
    /create or replace function public\.persist_discovery_segment_coverage_once_v2\(/,
  );
  assert.match(
    migration,
    /if saved_gap\.discovery_segment_id <> segment\.id\s+or saved_gap\.gap_type <> gap->>'type'\s+then/,
  );
  assert.doesNotMatch(
    migration,
    /or saved_gap\.description <> gap->>'description'/,
  );
  assert.match(
    migration,
    /update public\.discovery_gaps_v2\s+set\s+description = gap->>'description',\s+supporting_metrics_json = gap->'supportingMetrics',\s+severity = gap->>'severity',\s+status = gap->>'status'/,
  );
  assert.match(
    migration,
    /Semantic Discovery coverage retry changed settled work\./,
  );
  assert.doesNotMatch(migration, /(?<!extensions\.)digest\(/);
  assert.match(migration, /extensions\.digest\(/);
});

test("corrected gap persistence remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.persist_discovery_segment_coverage_once_v2\([\s\S]+?\) from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.persist_discovery_segment_coverage_once_v2\([\s\S]+?\) to service_role;/,
  );
});

test("already-applied gap persistence regains the pgcrypto search path", () => {
  assert.match(
    searchPathRepair,
    /alter function public\.persist_discovery_segment_coverage_once_v2\(\s*uuid,\s*uuid,\s*uuid,\s*jsonb,\s*jsonb\s*\)\s*set search_path = public, extensions;/,
  );
});
