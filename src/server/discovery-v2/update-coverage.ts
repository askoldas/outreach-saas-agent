import {
  analyzeDiscoveryGaps,
  calculateDiscoveryCoverage,
  decideDiscoveryContinuation,
  type DiscoveryCoverageCell,
  type DiscoveryCoverageMetrics,
  type DiscoveryGap,
} from "@/lib/discovery-v2";
import type { Json } from "@/types/database.types";
import { persistDiscoverySegmentCoverageOnce } from "./coverage-repository";

export async function calculateAndPersistCoverage(input: {
  workspaceId: string;
  runId: string;
  segmentRunId: string;
  metrics: DiscoveryCoverageMetrics;
  remainingCallBudget: number;
  campaignState: {
    cells: DiscoveryCoverageCell[];
    existingGaps: DiscoveryGap[];
    requestedCandidateCount: number;
    currentPlausibleCandidateCount: number;
    deadlineReached: boolean;
    userState: "running" | "paused" | "cancelled";
    fatalProviderFailure: boolean;
    passNumber: number;
    maximumPasses: number;
    consecutiveLowYieldPasses: number;
    maximumConsecutiveLowYieldPasses: number;
  };
}) {
  const coverage = calculateDiscoveryCoverage(input.metrics);
  const gaps = analyzeDiscoveryGaps({
    cell: coverage,
    metrics: input.metrics,
    remainingCallBudget: input.remainingCallBudget,
  });
  const cells = [
    ...input.campaignState.cells.filter(
      ({ discoverySegmentId }) => discoverySegmentId !== coverage.discoverySegmentId,
    ),
    coverage,
  ];
  const decision = decideDiscoveryContinuation({
    cells,
    gaps: [...input.campaignState.existingGaps, ...gaps],
    requestedCandidateCount: input.campaignState.requestedCandidateCount,
    currentPlausibleCandidateCount: input.campaignState.currentPlausibleCandidateCount,
    remainingCalls: input.remainingCallBudget,
    deadlineReached: input.campaignState.deadlineReached,
    userState: input.campaignState.userState,
    fatalProviderFailure: input.campaignState.fatalProviderFailure,
    passNumber: input.campaignState.passNumber,
    maximumPasses: input.campaignState.maximumPasses,
    consecutiveLowYieldPasses: input.campaignState.consecutiveLowYieldPasses,
    maximumConsecutiveLowYieldPasses:
      input.campaignState.maximumConsecutiveLowYieldPasses,
  });
  await persistDiscoverySegmentCoverageOnce({
    workspaceId: input.workspaceId,
    runId: input.runId,
    segmentRunId: input.segmentRunId,
    coverage: coverage as unknown as Json,
    gaps: gaps as unknown as Json,
  });
  return { coverage, gaps, decision };
}
