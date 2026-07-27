import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..", "..");
const baselineDirectory = join(root, "supabase", "baseline");
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260725000100_opptium_clean_baseline.sql",
);
const workspaceRepositoryPath = join(
  root,
  "src",
  "server",
  "workspaces",
  "repository.ts",
);

test("clean migration is reproducibly generated from fifteen ordered parts", async () => {
  const files = (await readdir(baselineDirectory))
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  assert.equal(files.length, 15);

  const sections = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(baselineDirectory, file), "utf8");
      return `-- Source: supabase/baseline/${file}\n\n${source.trim()}\n`;
    }),
  );
  const expected = [
    "-- GENERATED FILE: edit supabase/baseline/*.sql and run:",
    "-- node scripts/build-clean-baseline.mjs",
    "-- Clean baseline for a brand-new empty Opptium Supabase project.",
    "",
    ...sections,
  ].join("\n");
  assert.equal(await readFile(migrationPath, "utf8"), expected);
});

test("clean baseline contains target entities and excludes polling-era entities", async () => {
  const migration = await readFile(migrationPath, "utf8");
  for (const table of [
    "campaign_runs",
    "campaign_run_events",
    "campaign_questions",
    "campaign_approvals",
    "companies",
    "company_domains",
    "campaign_companies",
    "qualification_results",
    "contacts",
    "contact_methods",
    "campaign_contacts",
    "documents",
    "document_chunks",
    "campaign_memories",
    "workspace_memories",
    "ai_model_configs",
    "ai_requests",
    "provider_executions",
    "operation_idempotency_keys",
    "usage_ledger",
    "budget_reservations",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "i"));
  }
  assert.doesNotMatch(
    migration,
    /create table(?: if not exists)? public\.(offers|leads|lead_contact_routes|research_tasks)\b/i,
  );
  assert.doesNotMatch(
    migration,
    /\b(locked_by|locked_until|claim_next_research_task)\b/i,
  );
});

test("all clean tenant tables are included in RLS setup", async () => {
  const rls = await readFile(join(baselineDirectory, "014_rls.sql"), "utf8");
  for (const table of [
    "campaign_runs",
    "companies",
    "campaign_companies",
    "qualification_results",
    "contacts",
    "outreach_drafts",
    "documents",
    "document_chunks",
    "campaign_memories",
    "workspace_memories",
    "provider_executions",
    "ai_requests",
    "usage_ledger",
  ]) {
    assert.match(rls, new RegExp(`'${table}'`));
  }
  assert.match(rls, /workspace-documents/);
  assert.match(rls, /is_workspace_member/);
  assert.match(rls, /is_workspace_admin/);
});

test("workspace creation accepts an optional website without requiring one", async () => {
  const functions = await readFile(
    join(baselineDirectory, "013_functions_and_triggers.sql"),
    "utf8",
  );
  assert.match(
    functions,
    /create or replace function public\.create_workspace\(\s*workspace_name text,\s*workspace_website_url text default null\s*\)/i,
  );
  assert.match(functions, /nullif\(trim\(coalesce\(workspace_website_url, ''\)\), ''\)/i);

  const repository = await readFile(workspaceRepositoryPath, "utf8");
  assert.match(repository, /websiteUrl\s*\?\s*\{[\s\S]*workspace_website_url/i);
  assert.match(repository, /:\s*\{\s*workspace_name:\s*input\.name\s*\}/i);
});

test("workspace consistency checks return before accessing another table shape", async () => {
  const functions = await readFile(
    join(baselineDirectory, "013_functions_and_triggers.sql"),
    "utf8",
  );
  assert.match(
    functions,
    /if tg_table_name = 'company_profile_versions' then[\s\S]*?return new;\s*end if;/i,
  );
  assert.match(
    functions,
    /if tg_table_name = 'campaign_strategy_versions' then[\s\S]*?return new;\s*end if;/i,
  );
  assert.doesNotMatch(
    functions,
    /tg_table_name = 'company_profile_versions' and not exists/i,
  );
});
