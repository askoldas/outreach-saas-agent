export type ProfileV3DraftState = "ready_for_review" | "needs_input";

export function resolveProfileV3DraftState(input: {
  publishRecommendation: string;
  clarificationQuestions: Array<{ impact: string; skipAllowed: boolean }>;
}): ProfileV3DraftState {
  const hasBlockingQuestion = input.clarificationQuestions.some(
    (question) => question.impact === "blocking" && !question.skipAllowed,
  );
  if (hasBlockingQuestion) return "needs_input";
  return input.publishRecommendation === "ready" ||
    input.publishRecommendation === "ready_with_warnings"
    ? "ready_for_review"
    : "needs_input";
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
