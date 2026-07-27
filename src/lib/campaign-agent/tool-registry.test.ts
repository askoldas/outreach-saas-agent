import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignDiscoveryTool } from "./discovery-tool.ts";
import { createCampaignAgentToolRegistry } from "./tool-registry.ts";

const context = { campaignRunId: "run", iteration: 1, workspaceId: "workspace" };
const plan = {
  queries: ["Latvia manufacturer directory"],
  rationale: "Test",
  resultsPerQuery: 5,
};

test("Campaign Agent invokes only registered tools and returns a typed receipt", async () => {
  const registry = createCampaignAgentToolRegistry().register(
    createCampaignDiscoveryTool(async () => ({
      acceptedCompanies: 1,
      inspectedCompanies: 2,
      rejectedCompanies: 1,
    })),
  );
  const receipt = await registry.invoke<{ acceptedCompanies: number }>(
    "discover_companies",
    plan,
    context,
  );
  assert.equal(receipt.output.acceptedCompanies, 1);
  assert.deepEqual(receipt.tool, { name: "discover_companies", version: "v1" });
  await assert.rejects(
    () => registry.invoke("delete_workspace", {}, context),
    /not approved/,
  );
});

test("Campaign Agent discovery tool enforces runtime input and output bounds", async () => {
  const invalidInputRegistry = createCampaignAgentToolRegistry().register(
    createCampaignDiscoveryTool(async () => ({
      acceptedCompanies: 0,
      inspectedCompanies: 0,
      rejectedCompanies: 0,
    })),
  );
  await assert.rejects(
    () =>
      invalidInputRegistry.invoke(
        "discover_companies",
        { ...plan, resultsPerQuery: 999 },
        context,
      ),
    /invalid result bounds/,
  );
  const invalidOutputRegistry = createCampaignAgentToolRegistry().register(
    createCampaignDiscoveryTool(async () => ({
      acceptedCompanies: -1,
      inspectedCompanies: 0,
      rejectedCompanies: 0,
    })),
  );
  await assert.rejects(
    () => invalidOutputRegistry.invoke("discover_companies", plan, context),
    /invalid acceptedCompanies/,
  );
});
