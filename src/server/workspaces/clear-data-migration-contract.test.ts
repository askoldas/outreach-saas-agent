import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726001000_preserve_empty_profile_after_clear.sql",
  import.meta.url,
);
const legacyMigrationUrl = new URL(
  "../../../supabase/migrations/20260726000600_clear_clean_workspace_data.sql",
  import.meta.url,
);
const candidateResearchMigrationUrl = new URL(
  "../../../supabase/migrations/20260728002300_retry_safe_candidate_research_stage.sql",
  import.meta.url,
);
const publishedV3CleanupMigrationUrl = new URL(
  "../../../supabase/migrations/20260729001000_allow_workspace_clear_of_published_v3.sql",
  import.meta.url,
);
const repositoryUrl = new URL("./repository.ts", import.meta.url);

test("workspace cleanup restores the required empty profile container", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const legacyMigration = await readFile(legacyMigrationUrl, "utf8");
  assert.match(
    legacyMigration,
    /if not public\.is_workspace_admin\(target_workspace_id\)/,
  );
  assert.match(legacyMigration, /delete from public\.company_profile_versions/);
  assert.match(legacyMigration, /delete from public\.company_profiles/);
  assert.match(migration, /rename to clear_workspace_data_delete_all_legacy/);
  assert.match(migration, /create function public\.clear_workspace_data/);
  assert.match(migration, /security definer/);
  assert.match(
    migration,
    /perform public\.clear_workspace_data_delete_all_legacy\(target_workspace_id\)/,
  );
  assert.match(migration, /insert into public\.company_profiles \(workspace_id\)/);
  assert.match(migration, /on conflict \(workspace_id\) do update/);
  assert.match(migration, /set current_version_id = null/);
  assert.match(
    migration,
    /revoke all on function public\.clear_workspace_data_delete_all_legacy\(uuid\) from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\) to authenticated/,
  );
});

test("workspace cleanup can delete published V3 children only inside its scoped transaction", async () => {
  const candidateResearchMigration = await readFile(
    candidateResearchMigrationUrl,
    "utf8",
  );
  const publishedV3CleanupMigration = await readFile(
    publishedV3CleanupMigrationUrl,
    "utf8",
  );

  assert.match(
    candidateResearchMigration,
    /perform set_config\(\s*'app\.workspace_cleanup_id',\s*target_workspace_id::text,\s*true\s*\)/,
  );
  assert.match(
    publishedV3CleanupMigration,
    /create or replace function public\.prevent_published_v3_child_mutation\(\)/,
  );
  assert.match(publishedV3CleanupMigration, /if tg_op = 'DELETE'/);
  assert.match(
    publishedV3CleanupMigration,
    /current_setting\('app\.workspace_cleanup_id', true\) =\s*old\.workspace_id::text/,
  );
  assert.match(publishedV3CleanupMigration, /return old;/);
  assert.match(
    publishedV3CleanupMigration,
    /Published Company Intelligence V3 records are immutable\./,
  );
});

test("workspace repository uses the transactional cleanup RPC", async () => {
  const repository = await readFile(repositoryUrl, "utf8");

  assert.match(repository, /supabase\.rpc\("clear_workspace_data"/);
  assert.match(repository, /\.from\("documents"\)/);
  assert.match(repository, /\.remove\(/);
  assert.doesNotMatch(repository, /const tables = \["outreach_drafts"/);
});
