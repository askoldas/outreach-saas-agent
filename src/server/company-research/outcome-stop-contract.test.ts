import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync("src/server/workflow-v2/stage-service.ts", "utf8");
const research = readFileSync("src/trigger/research-campaign-candidates-v2.ts", "utf8");
const qualification = readFileSync(
  "src/trigger/qualify-campaign-candidates-v2.ts",
  "utf8",
);
const progress = readFileSync("src/server/company-research/outcome-progress.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260902000500_authoritative_outcome_progress.sql",
  "utf8",
);

test("every independently retried stage checks the persisted outcome before work", () => {
  assert.match(workflow, /loadCompanyResearchOutcomeProgress\(input\)/);
  assert.match(workflow, /reason: "target_reached"/);
  assert.match(workflow, /await completeWorkflowTask/);
});

test("research and qualification fan-outs check the outcome between bounded waves", () => {
  assert.match(research, /for \(const \[waveIndex, memberIds\] of waves\.entries\(\)\)/);
  assert.match(research, /loadCompanyResearchOutcomeProgress\(input\)/);
  assert.match(qualification, /DEFAULT_QUALIFICATION_WAVE_SIZE = 4/);
  assert.match(qualification, /const outcomeAfterWave/);
  assert.match(qualification, /unscheduledMembersRemainResumable: true/);
});

test("delivered progress is deduplicated by canonical organization and persisted", () => {
  assert.match(progress, /get_company_research_outcome_progress/);
  assert.match(migration, /count\(distinct candidate\.display_organization_id\)/);
  assert.match(migration, /'recommended', 'conditional'/);
  assert.match(migration, /set delivered_company_count = delivered/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
});
