import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const coverageRepository = source("src/server/discovery-v2/coverage-repository.ts");
const planDiscovery = source("src/server/discovery-v2/plan-discovery.ts");
const providerService = source("src/server/discovery-v2/provider-service.ts");
const initialStage = source("src/server/discovery-v2/initial-discovery-stage.ts");
const semanticContext = source("src/server/discovery-v2/semantic-context.ts");

test("Campaign Run plans load and parse their persisted canonical snapshot", () => {
  assert.match(coverageRepository, /export async function loadCampaignDiscoveryPlan/);
  assert.match(coverageRepository, /load_campaign_discovery_plan_v2/);
  assert.match(coverageRepository, /target_campaign_run_id: input\.campaignRunId/);
  assert.match(planDiscovery, /export function parsePersistedFrozenDiscoveryPlan/);
  assert.match(planDiscovery, /hashCanonical\(hashablePlan\) !== plan\.contentHash/);
  assert.match(planDiscovery, /input\.record\.campaign_run_id !== input\.campaignRunId/);
});

test("frozen Memory and plan state load before mutable retrieval or provider settings", () => {
  assert.ok(
    semanticContext.indexOf("if (existingSnapshot)") <
      semanticContext.indexOf('.from("intelligence_memories")'),
  );
  assert.ok(
    initialStage.indexOf("const existingPlanRecord = await loadCampaignDiscoveryPlan") <
      initialStage.indexOf("await loadEnabledDiscoveryProviderIds"),
  );
});

test("query plans freeze provider identity, request, and generated queries", () => {
  assert.match(coverageRepository, /export async function freezeDiscoveryQueryPlan/);
  assert.match(coverageRepository, /freeze_discovery_query_plan_v2/);
  assert.match(
    coverageRepository,
    /providerId: input\.providerId,[\s\S]+providerVersion: input\.providerVersion,[\s\S]+request,[\s\S]+queries/,
  );
  assert.match(coverageRepository, /record\.content_hash !== frozenHash/);
});

test("pass finalization sends the exact expected Segment Run identities", () => {
  assert.match(coverageRepository, /expectedSegmentRunIds: string\[\]/);
  assert.match(
    coverageRepository,
    /target_expected_segment_run_ids: input\.expectedSegmentRunIds/,
  );
});

test("provider replay checks frozen cache before requiring a live adapter", () => {
  const cacheLookup = providerService.indexOf(
    "const cached = await findPersistedProviderExecution",
  );
  const adapterRequirement = providerService.indexOf("if (!input.provider)");
  const liveCapabilities = providerService.indexOf(
    "await input.provider.getCapabilities()",
  );
  const configurationCheck = providerService.indexOf("await input.assertConfigured?.()");
  assert.ok(cacheLookup >= 0);
  assert.ok(adapterRequirement > cacheLookup);
  assert.ok(liveCapabilities > adapterRequirement);
  assert.ok(configurationCheck > liveCapabilities);
  assert.match(providerService, /providerKey: input\.providerId/);
  assert.match(providerService, /adapterVersion: input\.providerVersion/);
});

test("provider calls consume the frozen execution plan and do not persist total retryable failure", () => {
  assert.match(providerService, /executionPlan: input\.executionPlan \?\? null/);
  assert.match(
    providerService,
    /input\.provider\.search\(request, input\.executionPlan\)/,
  );
  const retryableGuard = providerService.indexOf(
    "response.errors.every(({ retryable }) => retryable)",
  );
  const persistence = providerService.indexOf(
    "const execution = await persistProviderResponse",
  );
  assert.ok(retryableGuard >= 0);
  assert.ok(persistence > retryableGuard);
});
