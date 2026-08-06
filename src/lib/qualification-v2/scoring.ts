import type {
  ConfidenceCalculation,
  FactorDefinition,
  FactorEvaluation,
  ScoreCalculation,
} from "./contracts.ts";

function calculateWeightedScore(
  definitions: FactorDefinition[],
  evaluations: FactorEvaluation[],
  purpose: "fit" | "commercial_potential",
): ScoreCalculation {
  const evaluationByKey = new Map(evaluations.map((item) => [item.factorKey, item]));
  const trace: ScoreCalculation["trace"] = [];
  const excludedFactorKeys: string[] = [];
  for (const definition of definitions.filter((item) =>
    item.purposes.includes(purpose),
  )) {
    const evaluation = evaluationByKey.get(definition.key);
    const value =
      purpose === "fit" ? evaluation?.signedValue : evaluation?.potentialValue;
    if (
      !evaluation ||
      evaluation.applicability !== "applicable" ||
      !["positive", "negative"].includes(evaluation.state) ||
      value === undefined
    ) {
      excludedFactorKeys.push(definition.key);
      continue;
    }
    trace.push({
      factorKey: definition.key,
      weight: definition.weight,
      value: Math.max(purpose === "fit" ? -1 : 0, Math.min(1, value)),
    });
  }
  const denominator = trace.reduce((sum, item) => sum + item.weight, 0);
  if (denominator === 0) {
    return {
      score: null,
      rawWeightedMean: null,
      denominator: 0,
      includedFactorKeys: [],
      excludedFactorKeys: excludedFactorKeys.sort(),
      trace: [],
    };
  }
  const raw =
    trace.reduce((sum, item) => sum + item.weight * item.value, 0) / denominator;
  const normalized = purpose === "fit" ? (raw + 1) / 2 : raw;
  return {
    score: Math.round(100 * normalized),
    rawWeightedMean: raw,
    denominator,
    includedFactorKeys: trace.map((item) => item.factorKey),
    excludedFactorKeys: excludedFactorKeys.sort(),
    trace,
  };
}

export function calculateFit(
  definitions: FactorDefinition[],
  evaluations: FactorEvaluation[],
): ScoreCalculation {
  return calculateWeightedScore(definitions, evaluations, "fit");
}

export function calculatePotential(
  definitions: FactorDefinition[],
  evaluations: FactorEvaluation[],
): ScoreCalculation {
  return calculateWeightedScore(definitions, evaluations, "commercial_potential");
}

export function suppressFitWhenEvidenceIsInsufficient(
  fit: ScoreCalculation,
  evidenceCoverage: number,
  minimumEvidenceCoverage: number,
): ScoreCalculation {
  if (evidenceCoverage >= minimumEvidenceCoverage) return fit;
  return {
    ...fit,
    score: null,
    rawWeightedMean: null,
    includedFactorKeys: [],
    excludedFactorKeys: [
      ...new Set([...fit.excludedFactorKeys, ...fit.includedFactorKeys]),
    ].sort(),
    trace: [],
  };
}

export function calculateConfidence(input: {
  definitions: FactorDefinition[];
  evaluations: FactorEvaluation[];
  identityConfidence: number;
  relationshipConfidence: number;
  procurementConfidence: number;
  procurementCritical: boolean;
  unresolvedIdentity: boolean;
  suspectedHardExclusion: boolean;
}): ConfidenceCalculation {
  const applicable = input.definitions.filter((definition) =>
    definition.purposes.includes("fit"),
  );
  const byKey = new Map(input.evaluations.map((item) => [item.factorKey, item]));
  const totalWeight = applicable.reduce((sum, item) => sum + item.weight, 0);
  const observed = applicable.filter((definition) => {
    const state = byKey.get(definition.key)?.state;
    return state === "positive" || state === "negative";
  });
  const observedWeight = observed.reduce((sum, item) => sum + item.weight, 0);
  const evidenceCoverage = totalWeight === 0 ? 0 : observedWeight / totalWeight;
  const evidenceQuality =
    observed.length === 0
      ? 0
      : observed.reduce(
          (sum, definition) => sum + (byKey.get(definition.key)?.evidenceQuality ?? 0),
          0,
        ) / observed.length;
  const conflicts = input.evaluations.filter(
    (item) => item.state === "conflicting",
  ).length;
  const evidenceConsistency =
    input.evaluations.length === 0 ? 0 : 1 - conflicts / input.evaluations.length;
  let score =
    0.35 * evidenceCoverage +
    0.25 * evidenceQuality +
    0.15 * evidenceConsistency +
    0.15 * input.identityConfidence +
    0.1 * input.relationshipConfidence;
  const caps: Array<{ key: string; value: number }> = [];
  if (input.unresolvedIdentity) caps.push({ key: "unresolved_identity", value: 0.4 });
  if (input.suspectedHardExclusion)
    caps.push({ key: "suspected_hard_exclusion", value: 0.5 });
  if (input.relationshipConfidence < 0.6)
    caps.push({ key: "weak_relationship", value: 0.55 });
  if (input.procurementCritical && input.procurementConfidence < 0.6)
    caps.push({ key: "unresolved_procurement", value: 0.55 });
  const requiredUnknown = applicable.some((definition) => {
    const state = byKey.get(definition.key)?.state;
    return definition.criticality === "required" && (!state || state === "unknown");
  });
  if (requiredUnknown) caps.push({ key: "unresolved_required_factor", value: 0.6 });
  const requiredConflict = applicable.some(
    (definition) =>
      definition.criticality === "required" &&
      byKey.get(definition.key)?.state === "conflicting",
  );
  if (requiredConflict) caps.push({ key: "conflicting_required_factor", value: 0.5 });
  score = Math.min(score, ...caps.map((cap) => cap.value));
  return {
    score: Math.round(Math.max(0, Math.min(1, score)) * 100),
    evidenceCoverage,
    evidenceQuality,
    evidenceConsistency,
    caps: caps.map((cap) => cap.key),
  };
}
