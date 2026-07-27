import type { CandidateRelationship, RelationshipAssessment } from "./contracts.ts";

export function classifyRelationship(input: {
  desiredRelationships: CandidateRelationship[];
  observations: Array<{
    relationship: CandidateRelationship;
    confidence: number;
    evidenceIds: string[];
    direct: boolean;
  }>;
}): RelationshipAssessment {
  const ordered = [...input.observations].sort(
    (left, right) =>
      Number(input.desiredRelationships.includes(right.relationship)) -
        Number(input.desiredRelationships.includes(left.relationship)) ||
      right.confidence - left.confidence ||
      left.relationship.localeCompare(right.relationship),
  );
  const primary = ordered[0];
  if (!primary) {
    return {
      primaryRelationship: "unknown",
      secondaryRelationships: [],
      confidence: 0,
      evidenceIds: [],
      counterEvidenceIds: [],
      unresolvedQuestions: ["commercial_relationship"],
      decisionBasis: "insufficient_evidence",
    };
  }
  return {
    primaryRelationship: primary.relationship,
    secondaryRelationships: [
      ...new Set(ordered.slice(1).map((item) => item.relationship)),
    ],
    confidence: primary.confidence,
    evidenceIds: [...new Set(primary.evidenceIds)].sort(),
    counterEvidenceIds: [],
    unresolvedQuestions: primary.confidence < 0.6 ? ["commercial_relationship"] : [],
    decisionBasis: primary.direct
      ? "direct_evidence"
      : primary.confidence >= 0.8
        ? "strong_inference"
        : primary.confidence >= 0.5
          ? "weak_inference"
          : "insufficient_evidence",
  };
}
