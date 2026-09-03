import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const trigger = source("src/trigger/research-campaign-candidates-v2.ts");
const repository = source("src/server/candidate-research-v2/repository.ts");
const migration = source(
  "supabase/migrations/20260902000300_block_candidate_research_on_budget_pause.sql",
);

test("candidate budget exhaustion is a successful blocked child outcome", () => {
  assert.match(trigger, /if \(!isResearchBudgetError\(error\)\) throw error/);
  assert.match(trigger, /status: "budget_blocked" as const/);
  assert.match(trigger, /blockCandidateResearchMember/);
  assert.match(trigger, /status: "blocked" as const/);
  assert.match(repository, /block_candidate_research_member_v2/);
});

test("budget-blocked members are persisted and reopened by added authorization", () => {
  assert.match(migration, /create or replace function public\.block_candidate_research_member_v2/);
  assert.match(migration, /error_code = left\(coalesce\(target_error_code/);
  assert.match(migration, /member\.error_code like 'research_budget_%'/);
  assert.match(migration, /set status = 'queued'/);
  assert.match(migration, /set status = 'running',[\s\S]*summary_json = null/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});
