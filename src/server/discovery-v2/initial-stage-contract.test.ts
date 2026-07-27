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

test("initial V2 discovery is bounded globally and preserves priority breadth", () => {
  assert.match(stage, /maximumInitialProviderCalls = 12/);
  assert.match(stage, /maximumInitialSegments = 6/);
  assert.match(stage, /maximumResultsPerSegment = 25/);
  assert.match(stage, /\.slice\(0, maximumInitialSegments\)/);
  assert.match(stage, /mapWithConcurrency\(requests, 2/);
  assert.match(stage, /Math\.floor\(maximumInitialProviderCalls/);
});

test("worker context uses the run's exact confirmed strategy and internal Campaign ID", () => {
  assert.match(context, /\.eq\("id", campaignRun\.strategy_version_id\)/);
  assert.match(context, /strategyVersion\.campaign_id !== campaignRun\.campaign_id/);
  assert.match(context, /confirmation_status !== "confirmed"/);
  assert.match(context, /campaignInternalId: campaignRun\.campaign_id/);
  assert.match(context, /if \(value === "web"\) return "web_search"/);
});

test("provider retries reuse completed request hashes before another paid search", () => {
  assert.match(providerService, /findPersistedProviderExecution/);
  assert.match(providerService, /if \(cached\) return/);
  assert.match(providerRepository, /\.eq\("request_hash", input\.requestHash\)/);
  assert.match(providerRepository, /\.eq\("status", "completed"\)/);
});

test("discovery escalates total transient failure and checks worker configuration", () => {
  assert.match(stage, /TAVILY_API_KEY/);
  assert.match(stage, /throwForTotalRetryableFailure/);
  assert.match(stage, /code: "provider_unavailable", retryable: true/);
  assert.match(workflowStage, /input\.stage === "discover"/);
  assert.match(workflowStage, /executeInitialDiscoveryStage/);
});

test("initial breadth is explicitly partial until semantic coverage is attached", () => {
  assert.match(stage, /status: "partial"/);
  assert.match(stage, /stageScope: "initial_breadth"/);
  assert.match(stage, /cachedExecutionCount/);
});
