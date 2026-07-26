import assert from "node:assert/strict";
import test from "node:test";
import { runCampaignAgentLoop } from "./loop.ts";

test("Campaign Agent refines within deterministic limits and then completes", async () => {
  const seenPlans: Array<{ queries: string[]; resultsPerQuery: number }> = [];
  const result = await runCampaignAgentLoop(
    {
      plan: async ({ iteration }) => ({
        queries: Array.from({ length: 14 }, (_, index) => `query-${iteration}-${index}`),
        rationale: "Broaden public-source coverage.",
        resultsPerQuery: 100,
      }),
    },
    {
      discover: async (plan) => {
        seenPlans.push(plan);
        return {
          acceptedCompanies: 5,
          inspectedCompanies: 25,
          rejectedCompanies: 20,
        };
      },
      evaluate: async ({ state }) => ({
        evidenceSufficient: state.iteration === 2,
        reason: state.iteration === 2 ? "Coverage is sufficient." : "Refine once.",
        requiresUserInput: false,
        shouldRefine: state.iteration < 2,
      }),
    },
  );

  assert.equal(result.state.iteration, 2);
  assert.equal(result.state.phase, "complete");
  assert.equal(result.state.inspectedCompanies, 50);
  assert.equal(result.state.history.length, 2);
  assert.equal(seenPlans[0]?.queries.length, 10);
  assert.equal(seenPlans[0]?.resultsPerQuery, 50);
});

test("Campaign Agent stops at a user-input gate", async () => {
  const result = await runCampaignAgentLoop(
    {
      plan: async () => ({
        queries: ["ambiguous market"],
        rationale: "Clarification is required.",
        resultsPerQuery: 8,
      }),
    },
    {
      discover: async () => ({
        acceptedCompanies: 0,
        inspectedCompanies: 8,
        rejectedCompanies: 8,
      }),
      evaluate: async () => ({
        evidenceSufficient: false,
        reason: "Target geography is ambiguous.",
        requiresUserInput: true,
        shouldRefine: false,
      }),
    },
  );

  assert.equal(result.nextGate, "user_input");
  assert.equal(result.state.phase, "gate");
  assert.equal(result.stopReason, "Target geography is ambiguous.");
});

test("Campaign Agent cannot inspect more than the hard company ceiling", async () => {
  const result = await runCampaignAgentLoop(
    {
      plan: async ({ iteration }) => ({
        queries: [`iteration-${iteration}`],
        rationale: "Continue bounded discovery.",
        resultsPerQuery: 50,
      }),
    },
    {
      discover: async () => ({
        acceptedCompanies: 400,
        inspectedCompanies: 400,
        rejectedCompanies: 0,
      }),
      evaluate: async () => ({
        evidenceSufficient: false,
        reason: "More evidence requested.",
        requiresUserInput: false,
        shouldRefine: true,
      }),
    },
  );

  assert.equal(result.state.inspectedCompanies, 500);
  assert.equal(result.state.iteration, 2);
  assert.match(result.stopReason, /Maximum inspected-company limit/);
});

test("Campaign Agent rejects plans without a usable query", async () => {
  await assert.rejects(
    runCampaignAgentLoop(
      {
        plan: async () => ({
          queries: [" ", ""],
          rationale: "",
          resultsPerQuery: 8,
        }),
      },
      {
        discover: async () => ({
          acceptedCompanies: 0,
          inspectedCompanies: 0,
          rejectedCompanies: 0,
        }),
        evaluate: async () => ({
          evidenceSufficient: false,
          reason: "",
          requiresUserInput: false,
          shouldRefine: false,
        }),
      },
    ),
    /requires a query/,
  );
});

test("Campaign Agent persists stable checkpoints and resumes refinement", async () => {
  const checkpoints: string[] = [];
  const initialState = {
    acceptedCompanies: 2,
    history: [
      {
        evaluation: {
          evidenceSufficient: false,
          reason: "Refine.",
          requiresUserInput: false,
          shouldRefine: true,
        },
        iteration: 1,
        observation: {
          acceptedCompanies: 2,
          inspectedCompanies: 8,
          rejectedCompanies: 6,
        },
        plan: {
          queries: ["first query"],
          rationale: "Initial search.",
          resultsPerQuery: 8,
        },
      },
    ],
    inspectedCompanies: 8,
    iteration: 1,
    phase: "refine" as const,
  };
  const result = await runCampaignAgentLoop(
    {
      plan: async () => ({
        queries: ["refined query"],
        rationale: "Refined search.",
        resultsPerQuery: 8,
      }),
    },
    {
      discover: async () => ({
        acceptedCompanies: 1,
        inspectedCompanies: 4,
        rejectedCompanies: 3,
      }),
      evaluate: async () => ({
        evidenceSufficient: true,
        reason: "Enough evidence.",
        requiresUserInput: false,
        shouldRefine: false,
      }),
    },
    {
      initialState,
      onCheckpoint: async (state) => {
        checkpoints.push(`${state.iteration}:${state.phase}`);
      },
    },
  );

  assert.equal(result.state.iteration, 2);
  assert.equal(result.state.acceptedCompanies, 3);
  assert.deepEqual(checkpoints, ["2:plan", "2:evaluate", "2:complete"]);
});
