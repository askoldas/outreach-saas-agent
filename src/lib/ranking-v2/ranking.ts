import type { CandidateReviewLane } from "../qualification-v2/contracts.ts";
import type { RankableCandidate } from "./contracts.ts";

const LANE_ORDER: Record<CandidateReviewLane, number> = {
  recommended: 0,
  conditional: 1,
  requires_research: 2,
  rejected: 3,
  excluded: 4,
  invalid: 5,
  duplicate: 6,
};

function descending(left: number | null, right: number | null): number {
  return (right ?? -1) - (left ?? -1);
}

export function rankCandidates(candidates: RankableCandidate[]): RankableCandidate[] {
  return [...candidates].sort(
    (left, right) =>
      LANE_ORDER[left.lane] - LANE_ORDER[right.lane] ||
      descending(left.fitScore, right.fitScore) ||
      descending(left.potentialScore, right.potentialScore) ||
      right.confidence - left.confidence ||
      right.strongestEvidenceDirectness - left.strongestEvidenceDirectness ||
      right.freshness - left.freshness ||
      left.campaignCandidateId.localeCompare(right.campaignCandidateId),
  );
}

export function createStableRankEntries(candidates: RankableCandidate[]) {
  return rankCandidates(candidates).map((candidate, index) => ({
    campaignCandidateId: candidate.campaignCandidateId,
    evaluationVersionId: candidate.evaluationVersionId,
    lane: candidate.lane,
    rankOverall: index + 1,
    rankWithinLane:
      rankCandidates(candidates.filter((item) => item.lane === candidate.lane)).findIndex(
        (item) => item.campaignCandidateId === candidate.campaignCandidateId,
      ) + 1,
  }));
}
