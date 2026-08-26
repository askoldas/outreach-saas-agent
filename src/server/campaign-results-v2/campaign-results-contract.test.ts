import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260728002900_v2_campaign_results_review.sql",
);
const relationshipCorrectionMigration = source(
  "supabase/migrations/20260824000900_dimension_aware_relationship_corrections_v2.sql",
);
const actions = source("src/server/campaign-results-v2/actions.ts");
const repository = source("src/server/campaign-results-v2/repository.ts");
const results = source("src/features/campaigns/CampaignV2Results.tsx");
const page = source("src/app/(app)/campaigns/[id]/leads/page.tsx");

test("V2 results are selected by immutable run and workspace boundaries", () => {
  assert.match(repository, /\.from\("campaigns"\)\s*\.select\("id"\)/);
  assert.match(
    repository,
    /\.from\("discovery_runs_v2"\)\s*\.select\("id,discovery_plan_id"\)/,
  );
  assert.match(
    repository,
    /\.from\("discovery_plans_v2"\)\s*\.select\("memory_snapshot_id"\)/,
  );
  assert.match(repository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(repository, /\.eq\("campaign_run_id", run\.id\)/);
  assert.match(repository, /candidate_rank_snapshots/);
  assert.match(page, /v2Results \?/);
  assert.match(page, /CampaignLeadReview/);
});

test("research funnel reaches provider executions through Discovery lineage", () => {
  assert.match(repository, /from\("discovery_segment_runs_v2"\)/);
  assert.match(
    repository,
    /from\("discovery_provider_executions"\)[\s\S]*discovery_segment_run_id/,
  );
  assert.doesNotMatch(
    repository,
    /from\("discovery_provider_executions"\)[\s\S]{0,180}\.eq\("campaign_run_id"/,
  );
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

test("results expose decision provenance without hidden reasoning", () => {
  for (const label of [
    "Applied memory snapshot",
    "Why discovered",
    "Query / source path",
    "Preclassification",
    "Resolved identity",
    "First-party evidence",
  ]) {
    assert.match(results, new RegExp(label));
  }
  assert.match(repository, /discovery_queries_v2/);
  assert.match(repository, /provider_candidate_preclassifications_v2/);
  assert.match(repository, /query_or_filter_fingerprint/);
  assert.doesNotMatch(results, /chain.of.thought/i);
});

test("results expose exact Core Intelligence lineage without breaking historical rows", () => {
  assert.match(repository, /artifactVersions:/);
  assert.match(repository, /qualificationEvaluationVersionId: evaluation\.id/);
  assert.match(repository, /candidateIntelligenceVersionId:/);
  assert.match(repository, /commercialRelationshipAssessmentVersionId:/);
  assert.match(repository, /companyIntelligenceVersionId:/);
  assert.match(repository, /campaignTargetModelVersionId:/);
  assert.match(repository, /relationshipDimensions:/);
  assert.match(repository, /relationshipAssessmentVersionId\s*\?/);
});

test("Campaign result projection does not change deterministic lane-first Ranking", () => {
  const ranking = source("src/server/ranking-v2/stage-service.ts");
  assert.match(ranking, /createStableRankEntries\(candidates\)/);
  assert.match(ranking, /lane-first-stable-v2\.1/);
  assert.doesNotMatch(ranking, /generateObject|generateText|streamObject|streamText/);
});

test("results progressively disclose relationship dimensions and artifact lineage", () => {
  for (const label of [
    "Commercial relationships",
    "Artifact lineage",
    "Qualification evaluation",
    "Company Intelligence",
    "Commercial Relationship assessment",
    "Campaign Target Model",
  ]) {
    assert.match(results, new RegExp(label));
  }
  assert.match(results, /candidate\.relationshipDimensions\.map/);
  assert.match(results, /<details className=\{styles\.lineage\}>/);
  assert.match(results, /Not available for historical evaluation/);
  assert.match(results, /<code title=\{value\}>\{value\}<\/code>/);
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

test("relationship corrections bind one dimension to the exact frozen assessment", () => {
  assert.match(relationshipCorrectionMigration, /relationship_dimension text/);
  assert.match(
    relationshipCorrectionMigration,
    /source_relationship_assessment_version_id uuid/,
  );
  assert.match(
    relationshipCorrectionMigration,
    /evaluation\.commercial_relationship_assessment_version_id/,
  );
  assert.match(
    relationshipCorrectionMigration,
    /assessment\.assessment_json -> 'relationships'\s*\? target_relationship_dimension/,
  );
  assert.match(relationshipCorrectionMigration, /jsonb_strip_nulls/);
  assert.doesNotMatch(
    relationshipCorrectionMigration,
    /update public\.candidate_evaluation_versions/,
  );
  assert.match(actions, /commercialRelationshipTypeSchema\.safeParse/);
  assert.match(results, /name="relationshipDimension"/);
  assert.match(results, /Propose relationship correction/);
});

test("results show correction proposals by dimension without rewriting frozen assessments", () => {
  assert.match(repository, /relationshipCorrectionProposals/);
  assert.match(repository, /correction\.correction_type !== "relationship"/);
  assert.match(repository, /source_relationship_assessment_version_id/);
  assert.match(results, /proposal\.dimension === dimension\.type/);
  assert.match(results, /correction proposal/);
  assert.match(
    results,
    /This proposal does not change the frozen\s+assessment\./,
  );
  assert.doesNotMatch(
    repository,
    /relationshipDimensions\s*=\s*relationshipCorrectionProposals/,
  );
});
