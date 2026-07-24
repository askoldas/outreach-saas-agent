import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20260723000500_recover_expired_research_tasks.sql",
    import.meta.url,
  ),
  "utf8",
);

test("expired worker leases are retried or failed instead of remaining running", () => {
  assert.match(sql, /where status = 'running'\s+and locked_until < now\(\)/i);
  assert.match(sql, /attempt_count < max_attempts then 'retrying' else 'failed'/i);
  assert.match(sql, /status in \('pending', 'retrying'\)/i);
  assert.match(
    sql,
    /grant execute on function public\.claim_next_research_task\(text\) to service_role/i,
  );
});
