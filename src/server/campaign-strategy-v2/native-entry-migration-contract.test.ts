import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729000300_native_campaign_strategy_v2_entry.sql",
  "utf8",
);

test("WP-23.2 creates campaign shells without inserting an adapter strategy", () => {
  const campaignFunction = section(
    "create or replace function public.create_native_campaign_v2",
    "create or replace function public.create_native_campaign_strategy_v2_draft",
  );
  assert.match(campaignFunction, /native-campaign\/v1/);
  assert.match(campaignFunction, /campaign_profile_snapshots/);
  assert.doesNotMatch(campaignFunction, /insert into public\.campaign_strategy_versions/);
});

test("native Strategy V2 entry validates the frozen V3 profile and offering graph", () => {
  assert.match(migration, /create_native_campaign_strategy_v2_draft/);
  assert.match(migration, /native-campaign-strategy\/v1/);
  assert.match(migration, /campaign-context\/v2\.1-native/);
  assert.match(migration, /company_offering_versions/);
  assert.match(migration, /profile_version_id = target_profile_version_id/);
  assert.match(migration, /Native V2 campaigns require a native Campaign Strategy/);
});

test("adapter-era campaign and draft constructors are no longer executable", () => {
  assert.match(
    migration,
    /revoke all on function public\.create_clean_campaign\([\s\S]*from authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on function public\.create_campaign_strategy_v2_draft\([\s\S]*from authenticated, service_role/,
  );
});

function section(start: string, end: string) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex);
  return migration.slice(startIndex, endIndex);
}
