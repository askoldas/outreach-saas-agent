import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/company-intelligence-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("Company Intelligence compiles an exact Candidate Intelligence source", () => {
  assert.match(service, /sourceCandidateIntelligenceVersionId/);
  assert.match(service, /compileCompanyIntelligence/);
  assert.match(service, /candidate_intelligence_versions/);
  assert.match(service, /Candidate Intelligence source identity mismatch/);
  assert.match(service, /candidate_research_plans/);
  assert.match(service, /researchBlueprintVersionIds/);
});

test("Company Intelligence uses immutable cached persistence", () => {
  assert.match(service, /loadLatestCompanyIntelligenceVersionNumber/);
  assert.match(service, /persistCompanyIntelligence/);
  assert.match(repository, /company_intelligence_versions_v2/);
  assert.match(repository, /source_candidate_intelligence_version_id/);
  assert.match(repository, /persistImmutableArtifact/);
});
