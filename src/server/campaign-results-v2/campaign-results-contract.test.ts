import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260728002900_v2_campaign_results_review.sql",
);
const repository = source("src/server/campaign-results-v2/repository.ts");
const results = source("src/features/campaigns/CampaignV2Results.tsx");
const page = source("src/app/(app)/campaigns/[id]/leads/page.tsx");

test("V2 results are selected by immutable run and workspace boundaries", () => {
  assert.match(repository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(repository, /\.eq\("campaign_run_id", run\.id\)/);
  assert.match(repository, /candidate_rank_snapshots/);
  assert.match(page, /v2Results \?/);
  assert.match(page, /CampaignLeadReview/);
});

test("results expose canonical queues and independent qualification measures", () => {
  for (const label of [
    "Recommended",
    "Conditional",
    "Needs research",
    "Rejected",
    "Excluded",
    "Invalid & duplicates",
  ])
    assert.match(results, new RegExp(label.replace("&", "\\&")));
  assert.match(results, />Fit</);
  assert.match(results, />Potential</);
  assert.match(results, />Confidence</);
  assert.match(results, /Not enough data/);
});

test("results default to every evaluated company and expose each outcome", () => {
  assert.match(results, /useState<ResultView>\("all"\)/);
  assert.match(results, /All evaluated \(\{results\.candidates\.length\}\)/);
  assert.match(results, /view === "all" \|\| candidate\.lane === view/);
  assert.match(results, /<th scope="col">Outcome<\/th>/);
  assert.match(results, /laneLabels\[candidate\.lane\]/);
});

test("results expose evidence, identity, corrections, and accessible table semantics", () => {
  assert.match(results, /Factors and evidence/);
  assert.match(results, /Identity:/);
  assert.match(results, /entity-resolution cases/);
  assert.match(results, /Propose correction/);
  assert.match(results, /<caption/);
  assert.match(results, /scope="col"/);
  assert.match(results, /aria-label="Result lanes"/);
  assert.doesNotMatch(results, /JSON\.stringify/);
});

test("coverage rows use their persisted identity instead of a non-unique label key", () => {
  assert.match(repository, /id: item\.id/);
  assert.match(results, /<li key=\{item\.id\}>/);
  assert.doesNotMatch(results, /key=\{`\$\{item\.archetype\}-\$\{item\.geography\}`\}/);
});

test("results translate frozen strategy identifiers into user-facing labels", () => {
  assert.match(repository, /campaignStrategyV2Schema\.safeParse/);
  assert.match(repository, /labels\.archetypes\.set\(archetype\.id, archetype\.label\)/);
  assert.match(repository, /geography\.displayName/);
  assert.match(repository, /archetypeLabel\(item\.archetype_key, labels\)/);
  assert.match(repository, /archetypeLabel\(value, labels\)/);
});

test("review decisions and corrections are auditable and cannot silently rewrite evaluations", () => {
  assert.match(migration, /candidate_review_decisions_v2/);
  assert.match(migration, /candidate_corrections_v2/);
  assert.match(migration, /supersedes_decision_id/);
  assert.match(migration, /candidate_evaluation_events/);
  assert.match(migration, /target_scope text default 'campaign'/);
  assert.match(migration, /public\.is_workspace_admin\(target_workspace_id\)/);
  assert.doesNotMatch(migration, /update public\.candidate_evaluation_versions/);
});
