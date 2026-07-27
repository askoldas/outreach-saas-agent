import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stage = source("src/server/discovery-v2/initial-discovery-stage.ts");
const context = source("src/server/discovery-v2/stage-context.ts");
const providerService = source("src/server/discovery-v2/provider-service.ts");
const providerRepository = source("src/server/discovery-v2/provider-repository.ts");
const workflowStage = source("src/server/workflow-v2/stage-service.ts");
const targetedStage = source("src/server/discovery-v2/targeted-discovery-stage.ts");

test("initial V2 discovery is bounded globally and preserves priority breadth", () => {
  assert.match(stage, /maximumInitialProviderCalls = 12/);
  assert.match(stage, /maximumInitialSegments = 6/);
  assert.match(stage, /maximumResultsPerSegment = 25/);
  assert.match(stage, /\.slice\(0, maximumInitialSegments\)/);
  assert.match(stage, /mapWithConcurrency\(\s*executionRequests,\s*2/);
  assert.match(stage, /Math\.floor\(\s*input\.maximumCalls/);
});

test("worker context uses the run's exact confirmed strategy and internal Campaign ID", () => {
  assert.match(context, /\.eq\("id", parsedCampaignRun\.strategy_version_id\)/);
  assert.match(
    context,
    /parsedStrategyVersion\.campaign_id !== parsedCampaignRun\.campaign_id/,
  );
  assert.match(context, /confirmation_status !== "confirmed"/);
  assert.match(context, /campaignInternalId: parsedCampaignRun\.campaign_id/);
  assert.match(context, /if \(value === "web"\) return "web_search"/);
});

test("provider retries reuse completed request hashes before another paid search", () => {
  assert.match(providerService, /findPersistedProviderExecution/);
  assert.match(providerService, /if \(cached\) \{[\s\S]+return/);
  assert.match(providerRepository, /\.eq\("request_hash", input\.requestHash\)/);
  assert.match(providerRepository, /\.eq\("status", "completed"\)/);
});

test("discovery settles provider failure evidence and checks worker configuration", () => {
  assert.match(stage, /TAVILY_API_KEY/);
  assert.match(stage, /fatalProviderFailure/);
  assert.match(stage, /decideDiscoveryContinuation/);
  assert.doesNotMatch(stage, /throwForTotalRetryableFailure/);
  assert.match(workflowStage, /input\.stage === "discover"/);
  assert.match(workflowStage, /executeSemanticDiscoveryStage/);
  assert.match(targetedStage, /executeInitialDiscoveryStage/);
});

test("initial breadth durably attaches semantic audit and remains partial", () => {
  assert.match(stage, /prepareSemanticDiscoveryContext/);
  assert.match(stage, /compileAndPersistDiscoveryPlan/);
  assert.match(stage, /startCampaignDiscoveryRun/);
  assert.match(stage, /startDiscoverySegmentPassOnce/);
  assert.match(stage, /recordDiscoveryQueryAudit/);
  assert.match(stage, /persistDiscoverySegmentCoverageOnce/);
  assert.match(stage, /finalizeDiscoveryPass/);
  assert.match(stage, /status: "partial"/);
  assert.match(stage, /stageScope: "initial_semantic_breadth"/);
  assert.match(stage, /cachedExecutionCount/);
});
