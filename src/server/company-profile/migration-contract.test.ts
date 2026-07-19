import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260719000100_create_company_profiles_and_campaign_snapshots.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Company Profile migration enables tenant RLS on every new table", () => {
  for (const table of [
    "company_profiles",
    "company_profile_versions",
    "campaign_profile_snapshots",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(migration, new RegExp(`on public\\.${table}`, "i"));
  }
});

test("campaign snapshots are captured and legacy Offer references become optional", () => {
  assert.match(migration, /alter column offer_external_id drop not null/i);
  assert.match(migration, /before insert on public\.campaigns/i);
  assert.match(migration, /after insert on public\.campaigns/i);
  assert.match(migration, /unique references public\.campaigns\(id\)/i);
});

test("profile versions can only be advanced through an admin-checked RPC", () => {
  assert.match(migration, /function public\.save_company_profile_version/i);
  assert.match(migration, /is_workspace_admin\(target_workspace_id\)/i);
  assert.doesNotMatch(migration, /company_profile_versions for update/i);
});
