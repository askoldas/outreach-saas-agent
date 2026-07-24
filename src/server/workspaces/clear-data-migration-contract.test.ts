import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260723000100_clear_all_workspace_data.sql",
  import.meta.url,
);
const repositoryUrl = new URL("./repository.ts", import.meta.url);

test("workspace cleanup is admin-authorized, atomic, and covers all workspace data", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const expectedDirectDeletes = [
    "activity_events",
    "export_records",
    "usage_events",
    "ai_generations",
    "lead_sources",
    "outreach_drafts",
    "research_tasks",
    "research_runs",
    "leads",
    "campaigns",
    "company_profiles",
  ];

  assert.match(migration, /create or replace function public\.clear_workspace_data/);
  assert.match(migration, /security definer/);
  assert.match(migration, /if not public\.is_workspace_admin\(target_workspace_id\)/);

  for (const table of expectedDirectDeletes) {
    assert.match(migration, new RegExp(`delete from public\\.${table}`));
  }

  assert.match(migration, /insert into public\.company_profiles/);
  assert.match(migration, /insert into public\.company_profile_versions/);
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\) to authenticated/,
  );
});

test("workspace repository uses the transactional cleanup RPC", async () => {
  const repository = await readFile(repositoryUrl, "utf8");

  assert.match(repository, /supabase\.rpc\("clear_workspace_data"/);
  assert.doesNotMatch(repository, /const tables = \["outreach_drafts"/);
});
