import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync("src/server/qualification-v2/stage-service.ts", "utf8");
const repository = readFileSync("src/server/qualification-v2/repository.ts", "utf8");
const worker = readFileSync("src/server/qualification-v2/candidate-worker.ts", "utf8");
const runtime = readFileSync("src/lib/qualification-v2/runtime.ts", "utf8");

test("Qualification freezes exact multi-dimensional relationship assessments", () => {
  assert.match(stage, /compileAndPersistCommercialRelationshipAssessment/);
  assert.match(stage, /marketResearchPlan\.campaignTargetModelVersionId/);
  assert.match(stage, /researchCandidate\.matchedArchetypeIds/);
  assert.match(stage, /commercialRelationshipAssessmentContentHash/);
  assert.match(stage, /bindQualificationRelationshipAssessments/);
  assert.match(repository, /loadBoundCoreIntelligenceIds/);
  assert.match(repository, /loadCompanyIntelligenceVersion/);
});

test("Relationship reasoning consumes dimensions and retains compatibility output", () => {
  assert.match(worker, /commercialRelationshipAssessment/);
  assert.match(worker, /commercialRelationshipDimensions/);
  assert.match(runtime, /multi-dimensional relationship assessment/);
  assert.match(runtime, /primaryRelationship/);
  assert.match(runtime, /secondaryRelationships/);
});
