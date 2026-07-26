import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceUrl = new URL("./service.ts", import.meta.url);
const taskUrl = new URL("../../trigger/discover-campaign-companies.ts", import.meta.url);

test("discovery accepts a bounded Campaign Agent plan without changing its fallback", async () => {
  const [service, task] = await Promise.all([
    readFile(serviceUrl, "utf8"),
    readFile(taskUrl, "utf8"),
  ]);

  assert.match(task, /plan\?: CampaignAgentPlan/);
  assert.match(
    task,
    /executeCampaignDiscovery\(payload\.providerExecutionId, payload\.plan\)/,
  );
  assert.match(service, /agentPlan\?\.queries\.length/);
  assert.match(service, /buildCampaignSearchQueries\(context\.campaign\)/);
  assert.match(service, /Math\.min\(/);
  assert.match(service, /inspectedCount: classified\.rawResults\.length/);
  assert.match(service, /rejectedCount: classified\.rejectedResults\.length/);
  assert.match(service, /iterationNumber/);
  assert.match(service, /loadCandidateDomains/);
  assert.match(service, /decision: iterationDecision/);
  assert.match(service, /totalQualifiedCount/);
  assert.match(service, /classifyCandidatesWithAi/);
  assert.match(service, /search_result_classification/);
  assert.match(service, /evaluatableCandidateKeys/);
  assert.match(service, /loadOrClassifyCandidateBatch/);
  assert.match(service, /existingMetadata\.classifications/);
});
