import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");
const qualification = source("src/server/qualification-v2/repository.ts");
const ranking = source("src/server/ranking-v2/stage-service.ts");
const results = source("src/server/campaign-results-v2/repository.ts");
const compatibilityAudit = source("docs/V2/CORE_INTELLIGENCE_COMPATIBILITY_AUDIT.md");

test("Core Intelligence migrations form one forward-only release chain", () => {
  const migrations = [
    "20260824000400_core_intelligence_artifacts_v2.sql",
    "20260824000500_organization_references_v2.sql",
    "20260824000600_company_intelligence_artifacts_v2.sql",
    "20260824000700_commercial_relationship_assessments_v2.sql",
    "20260824000800_bind_qualification_relationship_assessments_v2.sql",
    "20260824000900_dimension_aware_relationship_corrections_v2.sql",
    "20260824001000_bind_qualification_company_intelligence_v2.sql",
  ];
  for (const migration of migrations) {
    assert.doesNotThrow(() => source(`supabase/migrations/${migration}`));
  }
});

test("bound Qualification prefers direct Company Intelligence with historical fallback", () => {
  const direct = qualification.indexOf("loadCompanyIntelligenceVersion({");
  const fallback = qualification.indexOf("loadCompanyIntelligenceForCandidateSource({");
  assert.ok(direct >= 0 && fallback > direct);
  assert.match(qualification, /coreBindings\.companyIntelligenceVersionId/);
  assert.match(compatibilityAudit, /historical member has no direct/);
});

test("Ranking remains deterministic and outside the Intelligence model boundary", () => {
  assert.match(ranking, /createStableRankEntries\(candidates\)/);
  assert.match(ranking, /lane-first-stable-v2\.1/);
  assert.doesNotMatch(
    ranking,
    /generateTextResult|executeValidatedAiTask|openrouter|commercial_relationship_assessment_versions_v2/i,
  );
});

test("Campaign Results prefer direct lineage and retain nullable historical fallback", () => {
  assert.match(results, /"company_intelligence_version_id"/);
  assert.match(
    results,
    /\?\?\s*objectString\(relationshipArtifact, "company_intelligence_version_id"\)/,
  );
  assert.match(results, /relationshipArtifact\?\.assessment_json/);
});
