import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("research batch selects prioritized plans within the centralized cycle ceiling", async () => {
  const stage = await readFile(new URL("./stage-service.ts", import.meta.url), "utf8");
  assert.match(stage, /prepareCampaignResearchPlans/);
  assert.match(stage, /loadCandidateTriageEvidence/);
  assert.match(stage, /opportunityLanes: marketResearchPlan\?\.opportunityLanes/);
  assert.match(stage, /\.slice\([\s\S]*maxDeepResearchCandidates/);
  assert.doesNotMatch(stage, /slice\(0, 40\)/);
});
