import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000300_restore_cycle_aware_ranking_pgcrypto_path_v2.sql",
  "utf8",
);

test("cycle-aware Ranking persistence resolves Supabase pgcrypto", () => {
  assert.match(
    migration,
    /alter function public\.persist_campaign_ranking_v2\([\s\S]*set search_path = public, extensions/,
  );
});

test("Ranking persistence remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.persist_campaign_ranking_v2[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.persist_campaign_ranking_v2[\s\S]*to service_role/,
  );
});
