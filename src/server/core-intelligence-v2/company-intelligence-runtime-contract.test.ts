import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const researchWorker = readFileSync(
  "src/server/candidate-research-v2/candidate-worker.ts",
  "utf8",
);
const qualificationStage = readFileSync(
  "src/server/qualification-v2/stage-service.ts",
  "utf8",
);
const qualificationRepository = readFileSync(
  "src/server/qualification-v2/repository.ts",
  "utf8",
);
const qualificationWorker = readFileSync(
  "src/server/qualification-v2/candidate-worker.ts",
  "utf8",
);

test("Candidate research activates replay-safe Company Intelligence compilation", () => {
  assert.match(researchWorker, /compileAndPersistCompanyIntelligence/);
  assert.match(researchWorker, /ensureCompanyIntelligenceForCandidateSource/);
  assert.match(researchWorker, /completed\.intelligenceVersionId/);
});

test("Qualification freezes and validates the exact Company Intelligence projection", () => {
  assert.match(qualificationStage, /ensureCompanyIntelligenceForCandidateSource/);
  assert.match(qualificationStage, /companyIntelligenceVersionId/);
  assert.match(qualificationStage, /companyIntelligenceContentHash/);
  assert.match(qualificationRepository, /loadCompanyIntelligenceForCandidateSource/);
  assert.match(
    qualificationRepository,
    /compatibility projection references an unavailable claim/,
  );
  assert.match(qualificationWorker, /companyIntelligenceVersionId/);
});
