import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkpoint = readFileSync("src/server/company-research/checkpoint.ts", "utf8");
const stage = readFileSync("src/server/workflow-v2/stage-service.ts", "utf8");
const trigger = readFileSync("src/trigger/execute-campaign-v2.ts", "utf8");
const bootstrap = readFileSync(
  "src/trigger/bootstrap-company-research-context-v2.ts",
  "utf8",
);
const researchFanOut = readFileSync(
  "src/trigger/research-campaign-candidates-v2.ts",
  "utf8",
);
const actions = readFileSync("src/server/campaign-results-v2/actions.ts", "utf8");
const page = readFileSync("src/app/(app)/campaigns/[id]/research/page.tsx", "utf8");

test("checkpoint counts canonical company candidates rather than source URLs", () => {
  assert.match(checkpoint, /from\("campaign_candidates"\)/);
  assert.match(checkpoint, /display_organization_id/);
  assert.doesNotMatch(checkpoint, /source_url|provider_source_records/);
  assert.match(checkpoint, /qualified/);
  assert.match(checkpoint, /rejected/);
  assert.match(checkpoint, /pending/);
});

test("pending-work estimate is grounded in settled company-linked usage", () => {
  assert.match(checkpoint, /from\("usage_ledger"\)/);
  assert.match(checkpoint, /entry_type", "settlement"/);
  assert.match(checkpoint, /not\("company_id", "is", null\)/);
  assert.match(checkpoint, /observedCompanies >= 3/);
  assert.match(checkpoint, /expected \* 0\.8/);
  assert.match(checkpoint, /expected \* 1\.25/);
});

test("budget denial settles usable partial results rather than pausing for more credits", () => {
  assert.match(stage, /researchBudgetPauseReason/);
  assert.match(stage, /status: "blocked"/);
  assert.match(stage, /recordResearchBudgetPause/);
  assert.match(trigger, /settleTerminalOutcome\(payload, "internal_cost_guard"\)/);
  assert.match(trigger, /status: "completed_partial"/);
  assert.match(trigger, /parent-\$\{ctx\.run\.id\}/);
  assert.match(researchFanOut, /stage-\$\{input\.stageExecutionId\}/);
  assert.match(bootstrap, /researchBudgetPauseReason/);
  assert.match(bootstrap, /status: "blocked"/);
  assert.match(bootstrap, /recordResearchBudgetPause/);
});

test("a higher outcome target continues on the same campaign", () => {
  assert.match(actions, /increaseCompanyResearchTarget/);
  assert.match(actions, /requestedCompanyCount: input\.requestedCompanyCount/);
  assert.match(actions, /previousQuote\.complexity/);
  assert.match(actions, /campaignRunId: run\.id/);
  assert.match(page, /ResearchCheckpointSummary/);
  assert.match(page, /ProgressiveCompanyResults/);
});
