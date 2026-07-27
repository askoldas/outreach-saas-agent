import assert from "node:assert/strict";
import test from "node:test";
import { parseCampaignAgentPlan } from "./planner.ts";
import { createCampaignAgentPlanner } from "./planner.ts";
import { enforceCampaignAgentQueryQuality } from "./planner.ts";

test("Campaign Agent planner validates structured output", () => {
  assert.deepEqual(
    parseCampaignAgentPlan(
      JSON.stringify({
        queries: ["industrial distributors Latvia", "medical distributors Estonia"],
        rationale: "Test adjacent regional segments.",
        resultsPerQuery: 8,
      }),
    ),
    {
      queries: ["industrial distributors Latvia", "medical distributors Estonia"],
      rationale: "Test adjacent regional segments.",
      resultsPerQuery: 8,
    },
  );
});

test("Campaign Agent planner rejects incomplete output", () => {
  assert.throws(
    () => parseCampaignAgentPlan('{"queries":[],"rationale":"","resultsPerQuery":0}'),
    /invalid queries/,
  );
});

test("Campaign Agent planner exposes validated audit data through its result hook", async () => {
  const source = createCampaignAgentPlanner.toString();
  assert.match(source, /options\.onResult/);
  assert.match(source, /modelCall: result/);
  assert.match(source, /rawOutput: result\.data/);
  assert.match(source, /promptVersion: campaignAgentPlannerPromptVersion/);
});

test("Campaign Agent queries cannot target the seller, omit geography, or repeat", () => {
  const state = {
    acceptedCompanies: 2,
    inspectedCompanies: 8,
    iteration: 1,
    phase: "refine" as const,
    history: [
      {
        iteration: 1,
        plan: {
          queries: ["pharmaceutical distributors Germany company directory"],
          rationale: "Initial query.",
          resultsPerQuery: 8,
        },
        observation: {
          acceptedCompanies: 2,
          inspectedCompanies: 8,
          rejectedCompanies: 6,
        },
        evaluation: {
          evidenceSufficient: false,
          reason: "Refine.",
          requiresUserInput: false,
          shouldRefine: true,
        },
      },
    ],
  };
  const plan = enforceCampaignAgentQueryQuality(
    {
      queries: [
        "Seller Incorporated",
        "pharmaceutical distributors",
        "pharmaceutical distributors Germany company directory",
      ],
      rationale: "Refine sources.",
      resultsPerQuery: 8,
    },
    {
      campaign: { targetGeography: "Germany" },
      companyProfile: {
        companyName: "Seller Incorporated",
        selectedOffering: {
          name: "API manufacturing",
          targetIndustries: ["pharmaceutical"],
        },
      },
      strategy: { companyTypes: ["distributors"] },
    },
    state,
  );

  assert.deepEqual(plan.queries, ["pharmaceutical distributors Germany"]);
});
