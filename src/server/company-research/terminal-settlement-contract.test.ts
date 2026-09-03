import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const orchestrator = readFileSync("src/trigger/execute-campaign-v2.ts", "utf8");
const controls = readFileSync("src/server/workflow-v2/control-service.ts", "utf8");
const stageService = readFileSync("src/server/workflow-v2/stage-service.ts", "utf8");
const settlementMigration = readFileSync(
  "supabase/migrations/20260902000600_canonical_outcome_settlement_count.sql",
  "utf8",
);

test("adaptive terminal decisions settle the outcome before completing the workflow", () => {
  assert.match(
    orchestrator,
    /completionReasonForAdaptiveAction\(adaptiveDecision\.action\)/,
  );
  assert.match(orchestrator, /settleTerminalOutcome\(payload, completionReason\)/);
  assert.match(
    orchestrator,
    /completionReason !== "target_reached"[\s\S]*"completed_partial"/,
  );
});

test("internal budget guards preserve a partial result instead of pausing for credits", () => {
  assert.match(orchestrator, /settleTerminalOutcome\(payload, "internal_cost_guard"\)/);
  assert.match(orchestrator, /status: "completed_partial"/);
  assert.doesNotMatch(orchestrator, /status: "paused_for_budget"/);
  assert.match(stageService, /workflowTaskCompletionStatus/);
  assert.match(
    stageService,
    /pauseReason === "campaign_budget"[\s\S]*\("partial" as const\)/,
  );
});

test("user cancellation settles its outcome before cancelling provider tasks", () => {
  const settlementIndex = controls.indexOf("finalizeCompanyResearchOutcome({");
  const cancellationIndex = controls.indexOf("cancelTriggerRuns(triggerRunIds)");
  assert.ok(settlementIndex > 0);
  assert.ok(cancellationIndex > settlementIndex);
  assert.match(controls, /completionReason: "user_stopped"/);
});

test("terminal workflow errors are classified before outcome settlement", () => {
  assert.match(orchestrator, /completionReasonForWorkflowError\(error\)/);
  assert.match(orchestrator, /completionReason === "technical_failure"/);
  assert.match(orchestrator, /: "completed_partial"/);
});

test("settlement reconciles legacy counters from canonical delivered lanes", () => {
  assert.match(
    settlementMigration,
    /count\(distinct candidate\.display_organization_id\)/,
  );
  assert.match(settlementMigration, /'recommended', 'conditional'/);
  assert.match(settlementMigration, /companies_qualified = delivered/);
  assert.match(settlementMigration, /finalize_company_research_outcome\(/);
});
