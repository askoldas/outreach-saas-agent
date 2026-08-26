import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/commercial-relationship-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("Commercial Relationship service loads exact immutable inputs", () => {
  assert.match(service, /loadCompanyIntelligenceVersion/);
  assert.match(service, /loadCampaignTargetModelVersion/);
  assert.match(service, /target\.campaignId !== input\.campaignId/);
  assert.match(service, /compileCommercialRelationshipAssessment/);
  assert.match(service, /matchedArchetypeIds/);
});

test("Commercial Relationship service versions and persists assessments", () => {
  assert.match(service, /loadLatestCommercialRelationshipAssessmentVersionNumber/);
  assert.match(service, /persistCommercialRelationshipAssessment/);
  assert.match(repository, /commercial_relationship_assessment_versions_v2/);
  assert.match(repository, /company_intelligence_version_id/);
  assert.match(repository, /campaign_target_model_version_id/);
});
