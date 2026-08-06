import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const candidateResearch = readFileSync(
  "src/server/candidate-research-v2/stage-service.ts",
  "utf8",
);
const qualification = readFileSync(
  "src/server/qualification-v2/stage-service.ts",
  "utf8",
);
const candidateResearchMigration = readFileSync(
  "supabase/migrations/20260728002300_retry_safe_candidate_research_stage.sql",
  "utf8",
);
const qualificationMigration = readFileSync(
  "supabase/migrations/20260728002500_retry_safe_candidate_qualification_stage.sql",
  "utf8",
);

test("runtime stages accept the database-verified frozen Strategy identity", () => {
  for (const source of [candidateResearch, qualification]) {
    assert.match(source, /strategy\.id !== context\.strategyVersionId/);
    assert.match(source, /strategy\.status !== "confirmed"/);
    assert.doesNotMatch(source, /strategy\.campaignId !== context\.campaignId/);
  }
});

test("database loaders bind the confirmed Strategy to the internal Campaign Run", () => {
  for (const migration of [
    candidateResearchMigration,
    qualificationMigration,
  ]) {
    assert.match(
      migration,
      /where id = campaign_run\.strategy_version_id\s+and workspace_id = target_workspace_id\s+and campaign_id = campaign_run\.campaign_id\s+and confirmation_status = 'confirmed'/,
    );
  }
});
