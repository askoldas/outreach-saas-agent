export type ProfileV3DraftState = "ready_for_review" | "needs_input";

export const profileV3StageDependencies: Record<string, readonly string[]> = {
  "profile.whole_company_analysis": [],
  "profile.fact_extraction": [],
  "profile.commercial_synthesis": ["profile.fact_extraction"],
  "profile.offering_decomposition": [
    "profile.fact_extraction",
    "profile.commercial_synthesis",
  ],
  "profile.buyer_logic": [
    "profile.fact_extraction",
    "profile.commercial_synthesis",
    "profile.offering_decomposition",
  ],
  "profile.clarification": [
    "profile.fact_extraction",
    "profile.commercial_synthesis",
    "profile.offering_decomposition",
    "profile.buyer_logic",
  ],
  "profile.consistency_audit": [
    "profile.fact_extraction",
    "profile.commercial_synthesis",
    "profile.offering_decomposition",
    "profile.buyer_logic",
    "profile.clarification",
  ],
};

export function assertProfileStageDependencies(
  taskId: string,
  completed: ReadonlyArray<{ taskId: string }>,
) {
  const available = new Set(completed.map((stage) => stage.taskId));
  const missing = (profileV3StageDependencies[taskId] ?? []).filter(
    (dependency) => !available.has(dependency),
  );
  if (missing.length) {
    throw new Error(
      `Company Intelligence stage ${taskId} is missing required predecessor output(s): ${missing.join(", ")}.`,
    );
  }
}

export function resolveProfileV3DraftState(input: {
  publishRecommendation: string;
}): ProfileV3DraftState {
  return input.publishRecommendation === "invalid"
    ? "needs_input"
    : "ready_for_review";
}

export async function runProfileV3Workflow<TStageId extends string>(input: {
  stageIds: readonly TStageId[];
  runStage: (stageId: TStageId) => Promise<{ taskRunId: string; cached: boolean }>;
  finalize: () => Promise<{ state: ProfileV3DraftState }>;
}) {
  const taskRunIds: string[] = [];
  const cachedStageIds: TStageId[] = [];
  for (const stageId of input.stageIds) {
    const result = await input.runStage(stageId);
    taskRunIds.push(result.taskRunId);
    if (result.cached) cachedStageIds.push(stageId);
  }
  const final = await input.finalize();
  return { ...final, taskRunIds, cachedStageIds };
}
