import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260825000200_allow_relationship_discovery_gaps_v2.sql",
  "utf8",
);

test("persisted Discovery gaps accept relationship coverage gaps", () => {
  assert.match(migration, /discovery_gaps_v2_gap_type_check/);
  assert.match(migration, /'relationship_undercovered'/);
});
