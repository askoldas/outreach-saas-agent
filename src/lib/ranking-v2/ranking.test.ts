import assert from "node:assert/strict";
import test from "node:test";
import type { RankableCandidate } from "./contracts.ts";
import { validateComparativeAssessment } from "./comparative.ts";
import { detectConsistencyAnomalies } from "./consistency.ts";
import { createStableRankEntries, rankCandidates } from "./ranking.ts";

const candidate = (overrides: Partial<RankableCandidate>): RankableCandidate => ({
  campaignCandidateId: "candidate-a",
  evaluationVersionId: "evaluation-a",
  organizationId: "organization-a",
  lane: "recommended",
  eligibility: "eligible",
  relationship: "probable_buyer",
  fitScore: 80,
  potentialScore: 70,
  confidence: 85,
  strongestEvidenceDirectness: 1,
  freshness: 1,
  evidenceCoverage: 0.9,
  factorEvaluations: [],
  hardExclusionTriggered: false,
  merged: false,
  ...overrides,
});

test("ranking is lane-first and stable under exact ties", () => {
  const ranked = rankCandidates([
    candidate({ campaignCandidateId: "candidate-b", lane: "conditional", fitScore: 100 }),
    candidate({ campaignCandidateId: "candidate-c" }),
    candidate({ campaignCandidateId: "candidate-a" }),
  ]);
  assert.deepEqual(
    ranked.map((item) => item.campaignCandidateId),
    ["candidate-a", "candidate-c", "candidate-b"],
  );
});

test("rank snapshots retain overall and within-lane positions", () => {
  const entries = createStableRankEntries([
    candidate({ campaignCandidateId: "a" }),
    candidate({ campaignCandidateId: "b", lane: "conditional" }),
  ]);
  assert.deepEqual(
    entries.map((entry) => [entry.rankOverall, entry.rankWithinLane]),
    [
      [1, 1],
      [2, 1],
    ],
  );
});

test("opportunity timing breaks equal fit and potential before confidence", () => {
  const ranked = rankCandidates([
    candidate({ campaignCandidateId: "easy", freshness: 0, confidence: 99 }),
    candidate({ campaignCandidateId: "expanding", freshness: 85, confidence: 70 }),
  ]);
  assert.equal(ranked[0]?.campaignCandidateId, "expanding");
});

test("deterministic checks block impossible recommendations", () => {
  const anomalies = detectConsistencyAnomalies(
    [
      candidate({
        eligibility: "excluded",
        hardExclusionTriggered: true,
        relationship: "competitor",
      }),
    ],
    75,
  );
  assert.equal(
    anomalies.every((anomaly) => anomaly.blocksFinalization),
    true,
  );
  assert.equal(
    anomalies.some((anomaly) => anomaly.type === "hard_exclusion_ignored"),
    true,
  );
});

test("duplicate buying organizations are isolated for merge review", () => {
  const anomalies = detectConsistencyAnomalies(
    [
      candidate({ campaignCandidateId: "a", buyingOrganizationId: "buyer" }),
      candidate({ campaignCandidateId: "b", buyingOrganizationId: "buyer" }),
    ],
    75,
  );
  assert.equal(
    anomalies.some(
      (anomaly) =>
        anomaly.type === "parent_subsidiary_double_count" &&
        anomaly.recommendedAction === "merge_review",
    ),
    true,
  );
});

test("comparative output cannot omit candidates or reorder across lanes", () => {
  const candidates = [
    candidate({ campaignCandidateId: "a" }),
    candidate({ campaignCandidateId: "b" }),
  ];
  assert.equal(
    validateComparativeAssessment(
      {
        campaignId: "campaign",
        batchId: "batch",
        preferredOrder: ["b", "a"],
        anomalies: [],
        pairwiseRationales: [],
      },
      candidates,
    ).preferredOrder[0],
    "b",
  );
  assert.throws(
    () =>
      validateComparativeAssessment(
        {
          campaignId: "campaign",
          batchId: "batch",
          preferredOrder: ["a"],
          anomalies: [],
          pairwiseRationales: [],
        },
        candidates,
      ),
    /every batch candidate exactly once/,
  );
});
