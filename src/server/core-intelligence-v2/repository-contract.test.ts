import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("repositories validate every artifact at the persistence boundary", () => {
  for (const schema of [
    "commercialIntelligenceSchema",
    "campaignTargetModelSchema",
    "marketAnalysisSchema",
    "marketResearchPlanSchema",
    "researchBlueprintSchema",
  ]) {
    assert.match(repository, new RegExp(`${schema}\\.parse\\(input\\.artifact\\)`));
  }
  assert.match(repository, /artifact payload identity does not match its row/);
});

test("repositories reuse immutable versions by frozen input identity", () => {
  assert.match(repository, /\.eq\("input_hash", input\.artifact\.version\.inputHash\)/);
  assert.match(
    repository,
    /\.eq\("schema_version", input\.artifact\.version\.schemaVersion\)/,
  );
  assert.match(
    repository,
    /\.eq\("compiler_version", input\.artifact\.version\.compilerVersion\)/,
  );
  assert.match(repository, /inserted\.error\.code === "23505"/);
  assert.match(repository, /loadCachedAfterConflict/);
});

test("Market Analysis persistence requires complete model provenance", () => {
  assert.match(repository, /requiredModelProvenance\(artifact\)/);
  assert.match(
    repository,
    /Persisted Market Analysis requires complete model provenance/,
  );
  assert.match(repository, /requires_user_confirmation/);
  assert.match(repository, /requested_model: input\.requestedModel/);
  assert.match(repository, /actual_model: input\.actualModel/);
  assert.match(repository, /fallback_used: input\.fallbackUsed/);
});
