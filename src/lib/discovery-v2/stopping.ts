import { z } from "zod";
import type { DiscoveryCoverageCell } from "./coverage.ts";
import { discoveryGapActionSchema, type DiscoveryGap } from "./gaps.ts";

export const selectedDiscoveryGapActionSchema = discoveryGapActionSchema.extend({
  gapId: z.string().min(1),
});

export type SelectedDiscoveryGapAction = z.infer<typeof selectedDiscoveryGapActionSchema>;

export const discoveryContinuationDecisionSchema = z
  .object({
    decision: z.enum(["continue", "stop", "pause", "request_user_input"]),
    reasonCode: z.enum([
      "target_reached",
      "coverage_sufficient",
      "budget_exhausted",
      "deadline_reached",
      "user_stopped",
      "fatal_provider_failure",
      "marginal_yield_low",
      "market_exhausted",
      "no_actionable_gaps",
      "safety_pass_ceiling",
      "actionable_gap",
      "strategy_ambiguity",
    ]),
    rationale: z.string().min(1),
    selectedGapIds: z.array(z.string()),
    selectedActions: z.array(z.string()),
    selectedActionPlans: z.array(selectedDiscoveryGapActionSchema).default([]),
  })
  .strict();

export type DiscoveryContinuationDecision = z.infer<
  typeof discoveryContinuationDecisionSchema
>;

export function decideDiscoveryContinuation(input: {
  cells: DiscoveryCoverageCell[];
  gaps: DiscoveryGap[];
  requestedCandidateCount: number;
  currentPlausibleCandidateCount: number;
  remainingCalls: number;
  deadlineReached: boolean;
  userState: "running" | "paused" | "cancelled";
  fatalProviderFailure: boolean;
  passNumber: number;
  maximumPasses: number;
  consecutiveLowYieldPasses: number;
  maximumConsecutiveLowYieldPasses: number;
}) {
  const stop = (
    reasonCode: DiscoveryContinuationDecision["reasonCode"],
    rationale: string,
  ) =>
    discoveryContinuationDecisionSchema.parse({
      decision: "stop",
      reasonCode,
      rationale,
      selectedGapIds: [],
      selectedActions: [],
      selectedActionPlans: [],
    });
  if (input.userState === "paused") {
    return discoveryContinuationDecisionSchema.parse({
      decision: "pause",
      reasonCode: "user_stopped",
      rationale: "The user paused discovery.",
      selectedGapIds: [],
      selectedActions: [],
      selectedActionPlans: [],
    });
  }
  if (input.userState === "cancelled")
    return stop("user_stopped", "The user cancelled discovery.");
  if (input.currentPlausibleCandidateCount >= input.requestedCandidateCount)
    return stop("target_reached", "The requested candidate volume has been reached.");
  if (input.remainingCalls <= 0)
    return stop("budget_exhausted", "The provider-call budget is exhausted.");
  if (input.deadlineReached)
    return stop("deadline_reached", "The discovery deadline has been reached.");
  if (input.fatalProviderFailure)
    return stop("fatal_provider_failure", "No productive provider route remains.");
  if (input.passNumber >= input.maximumPasses)
    return stop("safety_pass_ceiling", "The configured safety pass ceiling was reached.");
  if (input.cells.length && input.cells.every(({ status }) => status === "sufficient"))
    return stop(
      "coverage_sufficient",
      "All discovery segments have sufficient coverage.",
    );
  if (
    input.cells.length &&
    input.cells.every(({ status }) => ["sufficient", "exhausted"].includes(status))
  )
    return stop("market_exhausted", "Every segment is sufficient or exhausted.");
  if (input.consecutiveLowYieldPasses >= input.maximumConsecutiveLowYieldPasses)
    return stop(
      "marginal_yield_low",
      "Marginal unique yield remained low across the configured window.",
    );
  const actionable = input.gaps.filter(
    (gap) => gap.status === "open" && gap.recommendedActions.length > 0,
  );
  const ambiguity = actionable.find(({ type }) => type === "strategy_ambiguity");
  if (ambiguity) {
    return discoveryContinuationDecisionSchema.parse({
      decision: "request_user_input",
      reasonCode: "strategy_ambiguity",
      rationale: ambiguity.description,
      selectedGapIds: [ambiguity.id],
      selectedActions: ambiguity.recommendedActions.map(({ type }) => type),
      selectedActionPlans: ambiguity.recommendedActions.map((action) => ({
        gapId: ambiguity.id,
        ...action,
      })),
    });
  }
  if (!actionable.length)
    return stop("no_actionable_gaps", "No material gap has a concrete next action.");
  const selected = selectActionsWithinCallBudget(actionable, input.remainingCalls);
  if (!selected.gapIds.length)
    return stop(
      "no_actionable_gaps",
      "No material gap has an action within the remaining provider-call budget.",
    );
  return discoveryContinuationDecisionSchema.parse({
    decision: "continue",
    reasonCode: "actionable_gap",
    rationale: "A material coverage gap has a bounded non-duplicate action.",
    selectedGapIds: selected.gapIds,
    selectedActions: selected.actionTypes,
    selectedActionPlans: selected.actionPlans,
  });
}

function selectActionsWithinCallBudget(gaps: DiscoveryGap[], remainingCalls: number) {
  const severityOrder: Record<DiscoveryGap["severity"], number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  const ordered = [...gaps].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      compareText(left.id, right.id),
  );
  const gapIds: string[] = [];
  const actionTypes: string[] = [];
  const actionPlans: SelectedDiscoveryGapAction[] = [];
  let callsAvailable = Math.max(0, Math.floor(remainingCalls));
  for (const gap of ordered) {
    let selectedForGap = false;
    for (const action of gap.recommendedActions) {
      const calls = action.maxCalls ?? 1;
      if (calls > callsAvailable) continue;
      callsAvailable -= calls;
      actionTypes.push(action.type);
      actionPlans.push(
        selectedDiscoveryGapActionSchema.parse({
          gapId: gap.id,
          ...action,
          maxCalls: calls,
        }),
      );
      selectedForGap = true;
    }
    if (selectedForGap) gapIds.push(gap.id);
    if (callsAvailable === 0) break;
  }
  return { actionPlans, actionTypes, gapIds };
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
