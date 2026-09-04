import { z } from "zod";
import {
  createStableRankEntries,
  detectConsistencyAnomalies,
  type RankableCandidate,
} from "@/lib/ranking-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import type { StageResult } from "@/lib/workflow-v2";
import type { Json } from "@/types/database.types";
import { loadRankingContext, persistRankingResult } from "./repository";

export const RANKING_RUNTIME_CONTRACT_VERSION = "ranking-runtime-v2.1";
export const RANKING_ORDERING_POLICY_VERSION = "lane-first-stable-v2.1";
const COMPARATIVE_BATCH_SIZE = 20;

const finalSnapshotSchema = z.object({
  relationship: z.object({
    primaryRelationship: z.enum([
      "probable_buyer",
      "possible_buyer",
      "end_user",
      "reseller",
      "distributor",
      "channel_partner",
      "integration_partner",
      "referral_partner",
      "supplier",
      "competitor",
      "strategic_partner",
      "investor_or_acquirer",
      "existing_customer",
      "former_customer",
      "irrelevant_adjacent",
      "unknown",
    ]),
  }),
  factorEvaluations: z.array(
    z.object({
      factorKey: z.string(),
      applicability: z.enum(["applicable", "not_applicable"]),
      state: z.enum(["positive", "negative", "unknown", "conflicting", "not_applicable"]),
      signedValue: z.number().min(-1).max(1).optional(),
      potentialValue: z.number().min(0).max(1).optional(),
      confidence: z.number().min(0).max(1),
      evidenceQuality: z.number().min(0).max(1),
      evidenceIds: z.array(z.string()),
      counterEvidenceIds: z.array(z.string()),
      criticalGateState: z
        .enum(["passed", "failed", "unresolved", "not_applicable"])
        .optional(),
    }),
  ),
  exclusions: z.array(
    z.object({
      strength: z.enum(["hard", "soft", "informational"]),
      state: z.enum([
        "triggered",
        "suspected",
        "not_triggered",
        "unknown",
        "not_applicable",
      ]),
    }),
  ),
  fit: z.object({ score: z.number().min(0).max(100).nullable() }),
  commercialPotential: z.object({
    score: z.number().min(0).max(100).nullable(),
  }),
  confidence: z.object({
    score: z.number().min(0).max(100),
    evidenceCoverage: z.number().min(0).max(1),
  }),
  opportunityTiming: z
    .object({
      score: z.number().min(0).max(100),
      freshnessClass: z.enum(["current", "recent", "aging", "none"]),
      confidence: z.number().min(0).max(1),
      evidenceIds: z.array(z.string()),
    })
    .optional(),
  eligibility: z.enum([
    "eligible",
    "conditional",
    "requires_research",
    "excluded",
    "rejected",
    "invalid_entity",
    "duplicate_or_merged",
  ]),
  lane: z.enum([
    "recommended",
    "conditional",
    "requires_research",
    "rejected",
    "excluded",
    "invalid",
    "duplicate",
  ]),
});

const inputSnapshotSchema = z.object({
  merged: z.boolean(),
  organization: z.object({
    id: z.string().uuid(),
  }),
});

export async function executeRankingStage(input: {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber?: number;
}): Promise<StageResult> {
  const context = await loadRankingContext(input);
  const candidates = context.candidates.map((candidate) =>
    toRankableCandidate(candidate),
  );
  const inputHash = hashCanonical({
    campaignRunId: context.campaignRunId,
    qualificationBatchId: context.qualificationBatchId,
    contractVersion: RANKING_RUNTIME_CONTRACT_VERSION,
    orderingPolicyVersion: RANKING_ORDERING_POLICY_VERSION,
    candidates,
  });
  const stableEntries = createStableRankEntries(candidates);
  const anomalies = detectConsistencyAnomalies(
    candidates,
    context.minimumRecommendedConfidence,
  );
  const batches = createComparativeBatches(candidates, stableEntries);
  const result = await persistRankingResult({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    qualificationBatchId: context.qualificationBatchId,
    contractVersion: RANKING_RUNTIME_CONTRACT_VERSION,
    orderingPolicyVersion: RANKING_ORDERING_POLICY_VERSION,
    inputHash,
    batches: batches as unknown as Json,
    anomalies: anomalies as unknown as Json,
    entries: stableEntries.map((entry) => ({
      ...entry,
      orderingTrace: orderingTrace(
        candidates.find(
          ({ campaignCandidateId }) => campaignCandidateId === entry.campaignCandidateId,
        )!,
      ),
    })) as unknown as Json,
  });
  return {
    stage: "rank_candidates",
    status: result.blockingAnomalyCount > 0 ? "partial" : "completed",
    outputReferences: {
      ...result,
      orderingPolicyVersion: RANKING_ORDERING_POLICY_VERSION,
      stageScope: "deterministic_lane_first_comparative_consistency",
    },
    progressDelta: {
      candidatesRanked: result.candidateCount,
      comparativeAnomalies: result.anomalyCount,
      blockingComparativeAnomalies: result.blockingAnomalyCount,
    },
    usageEventIds: [],
  };
}

function toRankableCandidate(input: {
  campaignCandidateId: string;
  evaluationVersionId: string;
  organizationId: string;
  inputSnapshot: Record<string, unknown>;
  finalSnapshot: Record<string, unknown>;
}): RankableCandidate {
  const snapshot = finalSnapshotSchema.parse(input.finalSnapshot);
  const frozenInput = inputSnapshotSchema.parse(input.inputSnapshot);
  return {
    campaignCandidateId: input.campaignCandidateId,
    evaluationVersionId: input.evaluationVersionId,
    organizationId: input.organizationId,
    buyingOrganizationId: frozenInput.organization.id,
    lane: snapshot.lane,
    eligibility: snapshot.eligibility,
    relationship: snapshot.relationship.primaryRelationship,
    fitScore: snapshot.fit.score,
    potentialScore: snapshot.commercialPotential.score,
    confidence: snapshot.confidence.score,
    strongestEvidenceDirectness: Math.max(
      0,
      ...snapshot.factorEvaluations.map(({ evidenceQuality }) => evidenceQuality),
    ),
    freshness: opportunityTimingScore(snapshot),
    evidenceCoverage: snapshot.confidence.evidenceCoverage,
    factorEvaluations: snapshot.factorEvaluations,
    hardExclusionTriggered: snapshot.exclusions.some(
      ({ state, strength }) => strength === "hard" && state === "triggered",
    ),
    merged: frozenInput.merged,
  };
}

function opportunityTimingScore(snapshot: z.infer<typeof finalSnapshotSchema>) {
  if (snapshot.opportunityTiming) return snapshot.opportunityTiming.score;
  const timingFactors = snapshot.factorEvaluations.filter(({ factorKey }) =>
    /(?:timing|freshness|expansion|opening|renovation|procurement|investment)/i.test(
      factorKey,
    ),
  );
  if (!timingFactors.length) return 0;
  const supported = timingFactors.filter(
    ({ state, evidenceIds }) => state === "positive" && evidenceIds.length > 0,
  );
  if (!supported.length) return 0;
  return (
    Math.round(
      (supported.reduce(
        (sum, factor) =>
          sum +
          (factor.potentialValue ?? Math.max(0, factor.signedValue ?? 0)) *
            factor.confidence *
            100,
        0,
      ) /
        supported.length) *
        100,
    ) / 100
  );
}

function createComparativeBatches(
  candidates: RankableCandidate[],
  entries: ReturnType<typeof createStableRankEntries>,
) {
  const byId = new Map(
    candidates.map((candidate) => [candidate.campaignCandidateId, candidate]),
  );
  const laneGroups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const laneEntries = laneGroups.get(entry.lane) ?? [];
    laneEntries.push(entry);
    laneGroups.set(entry.lane, laneEntries);
  }
  return [...laneGroups.entries()].flatMap(([lane, laneEntries]) => {
    const batches = [];
    for (let index = 0; index < laneEntries.length; index += COMPARATIVE_BATCH_SIZE) {
      const members = laneEntries.slice(index, index + COMPARATIVE_BATCH_SIZE);
      batches.push({
        lane,
        batchNumber: Math.floor(index / COMPARATIVE_BATCH_SIZE) + 1,
        members: members.map((entry) => ({
          campaignCandidateId: entry.campaignCandidateId,
          evaluationVersionId: entry.evaluationVersionId,
          deterministicPosition: entry.rankWithinLane,
          input: orderingTrace(byId.get(entry.campaignCandidateId)!),
        })),
      });
    }
    return batches;
  });
}

function orderingTrace(candidate: RankableCandidate) {
  return {
    lane: candidate.lane,
    fitScore: candidate.fitScore,
    potentialScore: candidate.potentialScore,
    confidence: candidate.confidence,
    strongestEvidenceDirectness: candidate.strongestEvidenceDirectness,
    freshness: candidate.freshness,
    stableTieBreaker: candidate.campaignCandidateId,
    policyVersion: RANKING_ORDERING_POLICY_VERSION,
  };
}
