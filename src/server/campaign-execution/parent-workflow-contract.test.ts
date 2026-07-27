import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(
  new URL("../research/repository.ts", import.meta.url),
  "utf8",
);
const parent = readFileSync(
  new URL("../../trigger/execute-campaign.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");

test("Campaign Run creation dispatches one deterministic parent workflow", () => {
  const enqueue = repository.slice(
    repository.indexOf("export async function enqueueCampaignDiscoveryRun"),
    repository.indexOf("export async function enqueueLeadContactEnrichmentRun"),
  );
  assert.match(enqueue, /dispatchCampaignRun/);
  assert.match(enqueue, /campaignRunId: campaignRun\.id/);
  assert.doesNotMatch(enqueue, /"discover-campaign-companies"/);
});

test("parent durably runs bounded discovery iterations and exposes the optional enrichment gate", () => {
  assert.match(parent, /discoverCampaignCompaniesTask\.triggerAndWait/);
  assert.match(parent, /if \(!discovery\.ok\)/);
  assert.match(parent, /discovery\.output/);
  assert.match(parent, /while \(iteration <= 5\)/);
  assert.match(parent, /buildDeterministicRefinementPlan/);
  assert.match(parent, /createCampaignAgentIterationExecution/);
  assert.match(parent, /linkDiscoveryTriggerRun\(context, discovery\.id, executionId\)/);
  assert.match(parent, /nextGate: "optional_enrichment"/);
  assert.match(parent, /markOptionalEnrichmentGate/);
  assert.match(parent, /discovery\.output\.totalQualifiedCount - previouslyQualified/);
  assert.doesNotMatch(parent, /totalDiscoveredCount - previouslyDiscovered/);
  assert.doesNotMatch(parent, /Promise\.all/);
});

test("parent resolves workspace and execution ownership from stored records", () => {
  assert.match(service, /\.from\("campaign_runs"\)/);
  assert.match(service, /\.from\("provider_executions"\)/);
  assert.match(service, /\.eq\("campaign_run_id", run\.id\)/);
  assert.match(service, /\.eq\("workspace_id", run\.workspace_id\)/);
  assert.match(service, /optional_enrichment_deferred/);
  assert.match(service, /status: targetReached \? "completed" : "partially_completed"/);
  assert.match(service, /current_phase: "ready_for_review"/);
  assert.match(service, /progress_percentage: 100/);
  assert.match(service, /provider_reference: triggerRunId/);
});

test("parent retries do not duplicate lifecycle events or restart cancelled work", () => {
  assert.match(parent, /await cancelQueuedDiscovery\(context\)/);
  assert.match(parent, /status: "cancelled"/);
  assert.match(service, /run\.status !== "cancelled"/);
  assert.match(service, /event_type", event\.eventType/);
  assert.match(service, /if \(existing\) return/);
  assert.match(service, /\.in\("status", \["pending", "running"\]\)/);
});

test("pause preserves the current run and continue dispatches an idempotent resume", () => {
  assert.match(parent, /pauseCampaignExecutionIfRequested/);
  assert.match(service, /campaign_execution_paused/);
  assert.match(service, /Completed discovery results were preserved/);
  assert.match(repository, /resumePausedCampaignRun/);
  assert.match(repository, /execute-campaign-resume:/);
  assert.match(repository, /\.eq\("current_phase", "paused"\)/);
});

test("Campaign Agent path is explicit, checkpointed, and disabled by default", () => {
  assert.match(parent, /isCampaignAgentEnabled\(\)/);
  assert.match(parent, /executeAgentCampaign\(context\)/);
  assert.match(parent, /runCampaignAgentLoop/);
  assert.match(parent, /createCampaignAgentPlanner/);
  assert.match(parent, /saveCampaignAgentCheckpoint/);
  assert.match(parent, /campaign-agent-discovery:/);
  assert.match(parent, /createCampaignAgentIterationExecution/);
  assert.match(parent, /completeCampaignAgentParentExecution/);
  assert.match(parent, /recordCampaignAgentPlannerRequest/);
  assert.match(parent, /onFailure:/);
  assert.match(parent, /failCampaignOrchestration\(context, error\)/);
  assert.match(parent, /executeDeterministicCampaign\(context\)/);
  assert.match(service, /\.is\("parent_execution_id", null\)/);
  assert.match(service, /\.from\("ai_requests"\)/);
  assert.match(service, /role: "campaign_planning"/);
  assert.match(service, /prompt_version: campaignAgentPlannerPromptVersion/);
  assert.match(service, /campaign_orchestration_aborted/);
  assert.match(service, /campaign_orchestration_failed/);
  assert.match(service, /selected_offering_id/);
  assert.match(service, /normalizeCampaignAgentPlanningContext/);
});
