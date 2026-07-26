import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations-legacy/20260719000600_retire_legacy_offer_and_strategy_columns.sql",
    import.meta.url,
  ),
  "utf8",
);

test("legacy removal aborts unless the production audit remains ready", () => {
  assert.match(migration, /legacy_retirement_readiness\(\)/i);
  assert.match(migration, /raise exception 'Legacy schema retirement blocked/i);
});

test("database strategy functions are replaced before compatibility columns drop", () => {
  const replacement = migration.indexOf(
    "create or replace function public.save_campaign_strategy_version",
  );
  const removal = migration.indexOf("alter table public.campaigns");
  assert.ok(replacement >= 0 && removal > replacement);
  assert.match(migration, /drop column offer_external_id/i);
  assert.match(migration, /drop column strategy_terms/i);
  assert.match(migration, /drop table public\.offers/i);
});
