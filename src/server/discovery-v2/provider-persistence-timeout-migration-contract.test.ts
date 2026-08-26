import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260825000100_allow_large_discovery_provider_persistence_v2.sql",
  "utf8",
);

test("large Discovery provider persistence receives a function-local timeout budget", () => {
  assert.match(
    migration,
    /alter function public\.persist_discovery_provider_response\([\s\S]*\) set statement_timeout = '120s'/i,
  );
  assert.doesNotMatch(migration, /alter (?:role|database)|set global/i);
});
