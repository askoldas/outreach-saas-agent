import { CAMPAIGN_EXECUTION_LIMITS } from "./execution-policy.ts";

export type CampaignAgentPhase =
  | "perceive"
  | "retrieve"
  | "plan"
  | "act"
  | "evaluate"
  | "refine"
  | "gate"
  | "complete";

export type CampaignAgentPlan = {
  queries: string[];
  rationale: string;
  resultsPerQuery: number;
};

export type CampaignAgentObservation = {
  acceptedCompanies: number;
  inspectedCompanies: number;
  rejectedCompanies: number;
};

export type CampaignAgentEvaluation = {
  evidenceSufficient: boolean;
  reason: string;
  requiresUserInput: boolean;
  shouldRefine: boolean;
};

export type CampaignAgentState = {
  acceptedCompanies: number;
  history: Array<{
    evaluation: CampaignAgentEvaluation;
    iteration: number;
    observation: CampaignAgentObservation;
    plan: CampaignAgentPlan;
  }>;
  inspectedCompanies: number;
  iteration: number;
  phase: CampaignAgentPhase;
};

export type CampaignAgentPlanner = {
  plan(input: {
    iteration: number;
    priorState: CampaignAgentState;
  }): Promise<CampaignAgentPlan>;
};

export type CampaignAgentTools = {
  discover(plan: CampaignAgentPlan): Promise<CampaignAgentObservation>;
  evaluate(input: {
    observation: CampaignAgentObservation;
    plan: CampaignAgentPlan;
    state: CampaignAgentState;
  }): Promise<CampaignAgentEvaluation>;
};

export type CampaignAgentResult = {
  nextGate: "complete" | "user_input";
  state: CampaignAgentState;
  stopReason: string;
};

export type CampaignAgentLoopOptions = {
  initialState?: CampaignAgentState;
  onCheckpoint?: (state: CampaignAgentState) => Promise<void>;
};

export async function runCampaignAgentLoop(
  planner: CampaignAgentPlanner,
  tools: CampaignAgentTools,
  options: CampaignAgentLoopOptions = {},
): Promise<CampaignAgentResult> {
  let state = options.initialState
    ? validateInitialState(options.initialState)
    : initialState();

  while (state.iteration < CAMPAIGN_EXECUTION_LIMITS.maxDiscoveryIterations) {
    const iteration = state.iteration + 1;
    state = { ...state, iteration, phase: "plan" };
    const plan = validatePlan(await planner.plan({ iteration, priorState: state }));
    await checkpoint(options, state);

    state = { ...state, phase: "act" };
    const observation = boundObservation(await tools.discover(plan), state);

    state = {
      ...state,
      acceptedCompanies: state.acceptedCompanies + observation.acceptedCompanies,
      inspectedCompanies: state.inspectedCompanies + observation.inspectedCompanies,
      phase: "evaluate",
    };
    const evaluation = await tools.evaluate({ observation, plan, state });
    state = {
      ...state,
      history: [...state.history, { evaluation, iteration, observation, plan }],
    };
    await checkpoint(options, state);

    if (evaluation.requiresUserInput) {
      return finish(
        {
          nextGate: "user_input",
          state: { ...state, phase: "gate" },
          stopReason: evaluation.reason,
        },
        options,
      );
    }
    if (evaluation.evidenceSufficient || !evaluation.shouldRefine) {
      return finish(
        {
          nextGate: "complete",
          state: { ...state, phase: "complete" },
          stopReason: evaluation.reason,
        },
        options,
      );
    }
    if (state.inspectedCompanies >= CAMPAIGN_EXECUTION_LIMITS.maxCompaniesInspected) {
      return finish(
        {
          nextGate: "complete",
          state: { ...state, phase: "complete" },
          stopReason: "Maximum inspected-company limit reached.",
        },
        options,
      );
    }
    state = { ...state, phase: "refine" };
    await checkpoint(options, state);
  }

  return finish(
    {
      nextGate: "complete",
      state: { ...state, phase: "complete" },
      stopReason: "Maximum discovery-iteration limit reached.",
    },
    options,
  );
}

function initialState(): CampaignAgentState {
  return {
    acceptedCompanies: 0,
    history: [],
    inspectedCompanies: 0,
    iteration: 0,
    phase: "perceive",
  };
}

function validateInitialState(state: CampaignAgentState) {
  if (
    !Number.isInteger(state.iteration) ||
    state.iteration < 0 ||
    state.iteration > CAMPAIGN_EXECUTION_LIMITS.maxDiscoveryIterations
  )
    throw new Error("Campaign Agent checkpoint has an invalid iteration.");
  if (state.history.length !== state.iteration)
    throw new Error("Campaign Agent checkpoint history does not match its iteration.");
  if (state.phase !== "refine" && state.phase !== "gate" && state.phase !== "perceive")
    throw new Error("Campaign Agent can resume only from a stable checkpoint.");
  return {
    ...state,
    acceptedCompanies: nonNegativeInteger(state.acceptedCompanies),
    inspectedCompanies: Math.min(
      nonNegativeInteger(state.inspectedCompanies),
      CAMPAIGN_EXECUTION_LIMITS.maxCompaniesInspected,
    ),
  };
}

async function checkpoint(options: CampaignAgentLoopOptions, state: CampaignAgentState) {
  await options.onCheckpoint?.(structuredClone(state));
}

async function finish(result: CampaignAgentResult, options: CampaignAgentLoopOptions) {
  await checkpoint(options, result.state);
  return result;
}

function validatePlan(plan: CampaignAgentPlan): CampaignAgentPlan {
  const queries = uniqueNonEmpty(plan.queries).slice(
    0,
    CAMPAIGN_EXECUTION_LIMITS.maxQueriesPerIteration,
  );
  if (queries.length === 0) throw new Error("Campaign Agent plan requires a query.");
  return {
    queries,
    rationale: plan.rationale.trim(),
    resultsPerQuery: Math.min(
      positiveInteger(plan.resultsPerQuery),
      CAMPAIGN_EXECUTION_LIMITS.maxResultsPerQuery,
    ),
  };
}

function boundObservation(
  observation: CampaignAgentObservation,
  state: CampaignAgentState,
) {
  const remaining =
    CAMPAIGN_EXECUTION_LIMITS.maxCompaniesInspected - state.inspectedCompanies;
  const inspectedCompanies = Math.min(
    nonNegativeInteger(observation.inspectedCompanies),
    remaining,
  );
  return {
    acceptedCompanies: Math.min(
      nonNegativeInteger(observation.acceptedCompanies),
      inspectedCompanies,
    ),
    inspectedCompanies,
    rejectedCompanies: Math.min(
      nonNegativeInteger(observation.rejectedCompanies),
      inspectedCompanies,
    ),
  };
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function positiveInteger(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function nonNegativeInteger(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}
