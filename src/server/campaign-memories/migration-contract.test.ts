import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726000500_campaign_memory_idempotency.sql",
  import.meta.url,
);

test("Campaign Agent learnings are retry-idempotent per run and origin", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /campaign_run_id, category, origin/i);
  assert.match(migration, /create unique index/i);
});
