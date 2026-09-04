import assert from "node:assert/strict";
import test from "node:test";
import { sizeDiscoveryReservoir } from "./reservoir.ts";

test("reservoir breadth adapts to requested outcomes and lane priority", () => {
  const lanes = [
    { id: "hotels", priority: "priority" as const },
    { id: "cafes", priority: "exploratory" as const },
  ];
  const small = sizeDiscoveryReservoir({
    requestedCompanyCount: 5,
    maximumProviderCalls: 100,
    lanes,
  });
  const large = sizeDiscoveryReservoir({
    requestedCompanyCount: 25,
    maximumProviderCalls: 100,
    lanes,
  });
  assert.ok(large.reservoirTarget > small.reservoirTarget);
  assert.ok(large.maximumInitialProviderCalls > small.maximumInitialProviderCalls);
  assert.ok(
    large.targets.find(({ laneId }) => laneId === "hotels")!.targetUniqueCandidates >
      large.targets.find(({ laneId }) => laneId === "cafes")!.targetUniqueCandidates,
  );
});

test("reservoir accounts for market breadth, funnel loss, observed yield, and budget", () => {
  const lanes = Array.from({ length: 8 }, (_, index) => ({
    id: `lane-${index}`,
    priority: index < 2 ? ("priority" as const) : ("secondary" as const),
  }));
  const narrow = sizeDiscoveryReservoir({
    requestedCompanyCount: 25,
    lanes,
    maximumProviderCalls: 50,
    marketBreadth: "very_narrow",
    expectedDuplicateRate: 0.1,
    expectedQualificationRejectionRate: 0.2,
    observedUniqueYieldPerCall: 10,
  });
  const broadLowYield = sizeDiscoveryReservoir({
    requestedCompanyCount: 25,
    lanes,
    maximumProviderCalls: 12,
    marketBreadth: "very_broad",
    expectedDuplicateRate: 0.4,
    expectedQualificationRejectionRate: 0.65,
    observedUniqueYieldPerCall: 2,
    previousCycleCount: 1,
  });
  assert.ok(broadLowYield.reservoirTarget > narrow.reservoirTarget);
  assert.ok(broadLowYield.selectedLaneIds.length > narrow.selectedLaneIds.length);
  assert.equal(broadLowYield.maximumInitialProviderCalls, 12);
});

test("estimated market size and prior unique candidates bound additional work", () => {
  const input = {
    requestedCompanyCount: 25,
    maximumProviderCalls: 100,
    marketBreadth: "broad" as const,
    estimatedCandidateRange: { max: 40 },
    lanes: [{ id: "hotels", priority: "priority" as const }],
  };
  const fresh = sizeDiscoveryReservoir(input);
  const resumed = sizeDiscoveryReservoir({
    ...input,
    priorUniqueCandidateCount: 35,
    observedUniqueYieldPerCall: 5,
  });
  assert.equal(fresh.reservoirTarget, 40);
  assert.ok(resumed.maximumInitialProviderCalls < fresh.maximumInitialProviderCalls);
});
