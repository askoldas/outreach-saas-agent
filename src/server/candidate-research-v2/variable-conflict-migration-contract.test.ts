import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000400_resolve_candidate_research_variable_conflicts.sql",
  ),
  "utf8",
);

test("Candidate Research recompiles its existing body with explicit variable resolution", () => {
  assert.match(
    migration,
    /'public\.initialize_candidate_research_batch_v2\(uuid,uuid,text,text,jsonb\)'::regprocedure/,
  );
  assert.match(migration, /select routine\.prosrc\s+into function_source/);
  assert.match(
    migration,
    /'#variable_conflict use_variable' \|\| chr\(10\) \|\| function_source/,
  );
  assert.match(
    migration,
    /create or replace function public\.initialize_candidate_research_batch_v2\(/,
  );
});

test("recompiled Candidate Research initializer remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.initialize_candidate_research_batch_v2\([\s\S]+?\) from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.initialize_candidate_research_batch_v2\([\s\S]+?\) to service_role;/,
  );
});
