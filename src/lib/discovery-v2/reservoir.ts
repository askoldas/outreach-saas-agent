export const DISCOVERY_RESERVOIR_POLICY_VERSION =
  "discovery-reservoir/v2-market-yield-budget";

export type DiscoveryLaneSizingInput = {
  id: string;
  priority: "priority" | "secondary" | "exploratory";
};

export function sizeDiscoveryReservoir(input: {
  requestedCompanyCount: number;
  lanes: DiscoveryLaneSizingInput[];
  maximumProviderCalls: number;
  marketBreadth?: "very_narrow" | "narrow" | "medium" | "broad" | "very_broad";
  estimatedCandidateRange?: { min?: number; max?: number };
  expectedDuplicateRate?: number;
  expectedQualificationRejectionRate?: number;
  observedUniqueYieldPerCall?: number;
  priorUniqueCandidateCount?: number;
  previousCycleCount?: number;
}) {
  const requested = Math.max(1, Math.floor(input.requestedCompanyCount));
  const lanes = [...input.lanes].sort(
    (left, right) =>
      laneWeight(right.priority) - laneWeight(left.priority) ||
      left.id.localeCompare(right.id),
  );
  if (!lanes.length) throw new Error("Discovery reservoir requires at least one lane.");
  const duplicateRate = boundedRate(input.expectedDuplicateRate ?? 0.25);
  const rejectionRate = boundedRate(input.expectedQualificationRejectionRate ?? 0.5);
  const conversionAdjusted = Math.ceil(
    requested / Math.max(0.1, (1 - duplicateRate) * (1 - rejectionRate)),
  );
  const uncappedTarget = Math.max(
    requested + 10,
    Math.ceil(conversionAdjusted * breadthFactor(input.marketBreadth ?? "medium")),
  );
  const estimatedMaximum = input.estimatedCandidateRange?.max;
  const reservoirTarget = estimatedMaximum
    ? Math.min(uncappedTarget, Math.max(requested, estimatedMaximum))
    : uncappedTarget;
  const totalWeight = lanes.reduce((sum, lane) => sum + laneWeight(lane.priority), 0);
  const targets = lanes.map((lane) => ({
    laneId: lane.id,
    targetUniqueCandidates: Math.max(
      3,
      Math.ceil((reservoirTarget * laneWeight(lane.priority)) / Math.max(1, totalWeight)),
    ),
  }));
  const breadthLaneAllowance = ["broad", "very_broad"].includes(
    input.marketBreadth ?? "medium",
  )
    ? 2
    : input.marketBreadth === "very_narrow"
      ? -1
      : 0;
  const selectedLaneCount = Math.min(
    lanes.length,
    Math.max(
      1,
      Math.min(
        12,
        Math.ceil(requested / 5) +
          breadthLaneAllowance +
          Math.max(0, input.previousCycleCount ?? 0),
      ),
    ),
  );
  const selectedLaneIds = lanes.slice(0, selectedLaneCount).map(({ id }) => id);
  const remainingCandidateTarget = Math.max(
    0,
    reservoirTarget - Math.max(0, input.priorUniqueCandidateCount ?? 0),
  );
  const expectedYieldPerCall = Math.max(0.5, input.observedUniqueYieldPerCall ?? 10);
  const targetCalls = Math.max(
    selectedLaneCount,
    Math.ceil(remainingCandidateTarget / expectedYieldPerCall),
  );
  return {
    policyVersion: DISCOVERY_RESERVOIR_POLICY_VERSION,
    reservoirTarget,
    selectedLaneIds,
    maximumInitialProviderCalls: Math.min(
      Math.max(1, input.maximumProviderCalls),
      Math.max(selectedLaneCount, targetCalls),
    ),
    maximumResultsPerLane: Math.min(
      100,
      Math.max(20, Math.ceil(reservoirTarget / selectedLaneCount)),
    ),
    targets,
  };
}

function breadthFactor(
  breadth: NonNullable<Parameters<typeof sizeDiscoveryReservoir>[0]["marketBreadth"]>,
) {
  return {
    very_narrow: 0.75,
    narrow: 0.9,
    medium: 1,
    broad: 1.15,
    very_broad: 1.3,
  }[breadth];
}

function boundedRate(value: number) {
  return Math.min(0.9, Math.max(0, value));
}

function laneWeight(priority: DiscoveryLaneSizingInput["priority"]) {
  return priority === "priority" ? 3 : priority === "secondary" ? 2 : 1;
}
