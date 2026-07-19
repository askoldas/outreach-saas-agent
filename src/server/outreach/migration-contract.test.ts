import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260719000300_persist_outreach_exports_and_usage.sql",
    import.meta.url,
  ),
  "utf8",
);
test("outreach, export, and usage tables are tenant scoped with RLS", () => {
  for (const table of ["lead_outreach_states", "export_records", "usage_events"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`, "i"));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(migration, new RegExp(`on public\\.${table}`, "i"));
  }
});
test("exports and usage are immutable through authenticated policies", () => {
  assert.match(migration, /exports.* for insert/is);
  assert.match(migration, /usage.* for insert/is);
  assert.doesNotMatch(migration, /export_records for update/i);
  assert.doesNotMatch(migration, /usage_events for update/i);
});
test("recipient selection remains scoped to a lead and contact route", () => {
  assert.match(migration, /lead_id uuid not null unique references public\.leads/i);
  assert.match(
    migration,
    /selected_contact_route_id uuid references public\.lead_contact_routes/i,
  );
});
