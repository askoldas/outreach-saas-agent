import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260904000300_candidate_claim_observation_dates.sql",
  import.meta.url,
);

test("volatile Candidate claims preserve cited observation time", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(
    migration,
    /create or replace function public\.complete_candidate_research_member_v2/,
  );
  assert.match(migration, /claim_item \? 'observedAt'/);
  assert.match(migration, /nullif\(claim_item->>'observedAt'/);
  assert.match(migration, /freshnessClass' = 'volatile' then null/);
  assert.match(migration, /then 'unknown'/);
  assert.match(migration, /case when claim_status = 'unknown' then null/);
  assert.match(migration, /saved_intelligence_version/);
  assert.match(migration, /set search_path = public, extensions/);
  assert.doesNotMatch(migration, /pg_proc|regexp_replace|execute format/i);
});
