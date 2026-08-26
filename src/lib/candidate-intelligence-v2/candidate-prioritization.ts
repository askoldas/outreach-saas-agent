import type { CampaignResearchCandidateInput } from "./research-runtime.ts";

export const CANDIDATE_PRIORITIZATION_VERSION = "candidate-priority-v1";

export type CandidatePrioritySignal = {
  key: string;
  contribution: number;
  explanation: string;
};

export type CandidatePrioritization = {
  version: typeof CANDIDATE_PRIORITIZATION_VERSION;
  score: number;
  signals: CandidatePrioritySignal[];
};

export function prioritizeResearchCandidate(
  candidate: CampaignResearchCandidateInput,
): CandidatePrioritization {
  const signals: CandidatePrioritySignal[] = [];
  add(signals, "canonical_domain", candidate.canonicalDomain ? 20 : 0,
    candidate.canonicalDomain ? "A canonical domain supports reliable identity research." : "No canonical domain is resolved yet.");
  add(signals, "canonical_url", candidate.canonicalUrl ? 5 : 0,
    candidate.canonicalUrl ? "A canonical URL is available for first-party research." : "No canonical URL is available.");
  add(signals, "source_diversity", Math.min(20, new Set(candidate.discoverySourceIds).size * 5),
    `${new Set(candidate.discoverySourceIds).size} distinct discovery source(s) support this candidate.`);
  add(signals, "archetype_match", Math.min(25, candidate.matchedArchetypeIds.length * 15),
    `${candidate.matchedArchetypeIds.length} frozen campaign archetype match(es) are attached.`);
  add(signals, "organization_identity", candidate.organizationType === "unknown" ? 0 : 10,
    candidate.organizationType === "unknown" ? "Organization type remains unknown." : "A usable organization type is resolved.");
  add(signals, "reusable_intelligence", candidate.currentIntelligenceVersionId ? 10 : 0,
    candidate.currentIntelligenceVersionId ? "Reusable Candidate Intelligence already exists." : "No reusable Candidate Intelligence is available.");
  add(signals, "unresolved_questions", -Math.min(10, candidate.unresolvedQuestionKeys.length * 2),
    `${candidate.unresolvedQuestionKeys.length} unresolved reusable question(s) reduce cheap-stage confidence.`);
  add(signals, "evidence_conflicts", -Math.min(15, candidate.conflictKeys.length * 5),
    `${candidate.conflictKeys.length} known evidence conflict(s) require resolution.`);

  return {
    version: CANDIDATE_PRIORITIZATION_VERSION,
    score: Math.max(0, Math.min(100, signals.reduce((sum, item) => sum + item.contribution, 20))),
    signals,
  };
}

function add(
  signals: CandidatePrioritySignal[],
  key: string,
  contribution: number,
  explanation: string,
) {
  signals.push({ key, contribution, explanation });
}
