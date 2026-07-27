import { task } from "@trigger.dev/sdk";
import { isCampaignAgentEnabled } from "@/lib/campaign-agent/feature-flag";
import {
  runCampaignAgentLoop,
  type CampaignAgentPlan,
  type CampaignAgentObservation,
} from "@/lib/campaign-agent/loop";
import { createCampaignAgentPlanner } from "@/lib/campaign-agent/planner";
import {
  campaignDiscoveryToolName,
  createCampaignDiscoveryTool,
} from "@/lib/campaign-agent/discovery-tool";
import { createCampaignAgentToolRegistry } from "@/lib/campaign-agent/tool-registry";
import { buildDeterministicRefinementPlan } from "@/lib/discovery/iteration-refinement";
import {
  loadLatestCampaignAgentCheckpoint,
  saveCampaignAgentCheckpoint,
} from "@/server/campaign-agent/checkpoint-repository";
import {
  cancelQueuedDiscovery,
  completeCampaignDispatch,
  completeCampaignAgentParentExecution,
  createCampaignAgentIterationExecution,
  failCampaignOrchestration,
  loadCampaignAgentPlanningContext,
  loadCampaignExecutionContext,
  linkDiscoveryTriggerRun,
  loadPersistedCampaignAgentPlan,
  markCampaignOrchestrationStarted,
  markCampaignAgentWaitingForInput,
  markOptionalEnrichmentGate,
  pauseCampaignExecutionIfRequested,
  recordCampaignAgentPlannerRequest,
  saveCampaignAgentLearnings,
} from "@/server/campaign-execution/service";
import { discoverCampaignCompaniesTask } from "./discover-campaign-companies";

export type ExecuteCampaignPayload = {
  campaignRunId: string;
};

export const executeCampaignTask = task({
  id: "execute-campaign",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 60_000,
    factor: 2,
    randomize: true,
  },
  onFailure: async ({ payload, error }) => {
    const context = await loadCampaignExecutionContext(payload.campaignRunId);
    await failCampaignOrchestration(context, error);
  },
  run: async (payload: ExecuteCampaignPayload) => {
    if (!payload.campaignRunId) throw new Error("campaignRunId is required.");
    const context = await loadCampaignExecutionContext(payload.campaignRunId);
    if (await cancelQueuedDiscovery(context)) {
      await completeCampaignDispatch(context);
      return {
        campaignRunId: context.campaignRunId,
        status: "cancelled",
      };
    }
    await markCampaignOrchestrationStarted(context);

    const result = isCampaignAgentEnabled()
      ? await executeAgentCampaign(context)
      : await executeDeterministicCampaign(context);
    await completeCampaignDispatch(context);
    return result;
  },
});

async function executeDeterministicCampaign(
  context: Awaited<ReturnType<typeof loadCampaignExecutionContext>>,
) {
  let iteration = 1;
  let executionId = context.discoveryExecutionId;
  let plan: CampaignAgentPlan | undefined;
  let lastOutput:
    | {
        decision: string;
        queriesExecuted: string[];
        totalDiscoveredCount: number;
        totalQualifiedCount: number;
      }
    | undefined;

  while (iteration <= 5) {
    const stopBeforeIteration = await pauseCampaignExecutionIfRequested(context);
    if (stopBeforeIteration) {
      return {
        campaignRunId: context.campaignRunId,
        iterations: iteration - 1,
        status: stopBeforeIteration,
      };
    }
    const discovery = await discoverCampaignCompaniesTask.triggerAndWait(
      { ...(plan ? { plan } : {}), providerExecutionId: executionId },
      {
        idempotencyKey: `campaign-discovery:${executionId}:iteration:${iteration}:v2`,
        tags: [
          `workspace:${context.workspaceId}`,
          `campaign_run:${context.campaignRunId}`,
          `discovery_iteration:${iteration}`,
        ],
      },
    );
    await linkDiscoveryTriggerRun(context, discovery.id, executionId);
    if (!discovery.ok) {
      throw new Error(
        `Campaign discovery child failed: ${errorMessage(discovery.error)}`,
      );
    }
    lastOutput = discovery.output;
    const stopAfterIteration = await pauseCampaignExecutionIfRequested(context);
    if (stopAfterIteration) {
      return {
        campaignRunId: context.campaignRunId,
        discovery: lastOutput,
        iterations: iteration,
        status: stopAfterIteration,
      };
    }
    if (
      discovery.output.decision !== "continue" &&
      discovery.output.decision !== "refine_queries"
    ) {
      break;
    }
    iteration += 1;
    if (iteration > 5) break;
    plan = buildDeterministicRefinementPlan({
      iteration,
      previousQueries: discovery.output.queriesExecuted,
    });
    const iterationExecution = await createCampaignAgentIterationExecution({
      context,
      iteration,
      plan,
    });
    executionId = iterationExecution.executionId;
    plan = iterationExecution.plan;
  }

  await markOptionalEnrichmentGate(context);
  return {
    campaignRunId: context.campaignRunId,
    discovery: lastOutput,
    iterations: iteration,
    nextGate: "optional_enrichment",
    status: "waiting_for_optional_enrichment",
  };
}

async function executeAgentCampaign(
  context: Awaited<ReturnType<typeof loadCampaignExecutionContext>>,
) {
  const planner = createCampaignAgentPlanner(
    await loadCampaignAgentPlanningContext(context.campaignRunId),
    {
      loadPersistedPlan: async ({ iteration }) =>
        loadPersistedCampaignAgentPlan({ context, iteration }),
      onResult: async (result) => recordCampaignAgentPlannerRequest({ context, result }),
    },
  );
  const initialState = await loadLatestCampaignAgentCheckpoint({
    campaignRunId: context.campaignRunId,
    workspaceId: context.workspaceId,
  });
  let childIteration = initialState?.iteration ?? 0;
  let previouslyQualified = initialState?.acceptedCompanies ?? 0;
  const toolRegistry = createCampaignAgentToolRegistry().register(
    createCampaignDiscoveryTool(async (plan, toolContext) => {
      const iterationExecution = await createCampaignAgentIterationExecution({
        context,
        iteration: toolContext.iteration,
        plan,
      });
      const discovery = await discoverCampaignCompaniesTask.triggerAndWait(
        {
          plan: iterationExecution.plan,
          providerExecutionId: iterationExecution.executionId,
        },
        {
          idempotencyKey: `campaign-agent-discovery:${iterationExecution.executionId}:v1`,
          tags: [
            `workspace:${context.workspaceId}`,
            `campaign_run:${context.campaignRunId}`,
            `agent_iteration:${toolContext.iteration}`,
            `agent_tool:${campaignDiscoveryToolName}`,
          ],
        },
      );
      await linkDiscoveryTriggerRun(
        context,
        discovery.id,
        iterationExecution.executionId,
      );
      if (!discovery.ok)
        throw new Error(
          `Campaign Agent discovery child failed: ${errorMessage(discovery.error)}`,
        );
      const newlyQualified = Math.max(
        0,
        discovery.output.totalQualifiedCount - previouslyQualified,
      );
      previouslyQualified = discovery.output.totalQualifiedCount;
      return {
        acceptedCompanies: newlyQualified,
        inspectedCompanies: discovery.output.inspectedCount,
        rejectedCompanies: discovery.output.rejectedCount,
      };
    }),
  );
  const result = await runCampaignAgentLoop(
    planner,
    {
      discover: async (plan): Promise<CampaignAgentObservation> => {
        childIteration += 1;
        const receipt = await toolRegistry.invoke<CampaignAgentObservation>(
          campaignDiscoveryToolName,
          plan,
          {
            campaignRunId: context.campaignRunId,
            iteration: childIteration,
            workspaceId: context.workspaceId,
          },
        );
        return receipt.output;
      },
      evaluate: async ({ observation }) => ({
        evidenceSufficient: previouslyQualified >= context.desiredCompanyCount,
        reason:
          previouslyQualified >= context.desiredCompanyCount
            ? "The requested company target was reached."
            : observation.inspectedCompanies === 0
              ? "No additional public results were available."
              : "The target was not reached; refine the discovery plan.",
        requiresUserInput:
          previouslyQualified < context.desiredCompanyCount &&
          observation.acceptedCompanies === 0,
        shouldRefine:
          previouslyQualified < context.desiredCompanyCount &&
          observation.inspectedCompanies > 0 &&
          observation.acceptedCompanies > 0,
      }),
    },
    {
      ...(initialState ? { initialState } : {}),
      onCheckpoint: async (state) =>
        saveCampaignAgentCheckpoint({
          campaignRunId: context.campaignRunId,
          state,
          workspaceId: context.workspaceId,
        }),
    },
  );
  if (result.nextGate === "user_input") {
    await markCampaignAgentWaitingForInput(context, {
      iteration: result.state.iteration,
      reason: result.stopReason,
    });
    return {
      campaignRunId: context.campaignRunId,
      agent: result,
      nextGate: "user_input",
      status: "waiting_for_input",
    };
  }
  await saveCampaignAgentLearnings(context, result.state);
  await markOptionalEnrichmentGate(context);
  await completeCampaignAgentParentExecution(context, {
    acceptedCompanies: result.state.acceptedCompanies,
    inspectedCompanies: result.state.inspectedCompanies,
    iteration: result.state.iteration,
  });
  return {
    campaignRunId: context.campaignRunId,
    agent: result,
    nextGate: "optional_enrichment",
    status: "waiting_for_optional_enrichment",
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown child task failure";
}
