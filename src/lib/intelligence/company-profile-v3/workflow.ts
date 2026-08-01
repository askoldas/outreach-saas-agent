export type ProfileV3DraftState = "ready_for_review" | "needs_input";

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
