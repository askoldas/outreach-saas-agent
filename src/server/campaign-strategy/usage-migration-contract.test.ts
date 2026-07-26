import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations-legacy/20260719000800_add_strategy_generation_usage.sql",
    import.meta.url,
  ),
  "utf8",
);

test("usage ledger accepts dedicated Strategy generation events", () => {
  assert.match(migration, /drop constraint usage_events_operation_check/i);
  assert.match(migration, /'strategy_generation'/i);
});
