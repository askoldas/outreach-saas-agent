import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260904000400_pre_research_relationship_suppression.sql",
  "utf8",
);
const stage = readFileSync("src/server/candidate-research-v2/stage-service.ts", "utf8");

test("relationship memory loader is workspace scoped and service-role only", () => {
  assert.match(migration, /load_pre_research_suppression_context_v2/);
  assert.match(migration, /campaign\.workspace_id = target_workspace_id/);
  assert.match(migration, /assessment\.workspace_id = target_workspace_id/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /to service_role/);
});

test("suppression matching runs before Candidate Research plan selection", () => {
  assert.match(stage, /loadPreResearchSuppressionContext/);
  assert.match(stage, /matchRelationshipSuppression/);
  assert.ok(
    stage.indexOf("matchRelationshipSuppression({") <
      stage.indexOf("persistCandidateTriageDecisions({"),
  );
  assert.ok(
    stage.indexOf("persistCandidateTriageDecisions({") <
      stage.indexOf(
        '.filter(({ sourcePlan }) => sourcePlan.prioritization.lane === "deep_research")',
      ),
  );
});
