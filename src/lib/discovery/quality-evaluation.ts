export type BinaryEvaluationMetrics = {
  accuracy: number;
  falseNegatives: number;
  falsePositives: number;
  precision: number;
  recall: number;
  total: number;
  trueNegatives: number;
  truePositives: number;
};

export function evaluateBinaryDecisions(
  decisions: Array<{ actual: boolean; expected: boolean }>,
): BinaryEvaluationMetrics {
  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  for (const decision of decisions) {
    if (decision.actual && decision.expected) truePositives += 1;
    else if (!decision.actual && !decision.expected) trueNegatives += 1;
    else if (decision.actual) falsePositives += 1;
    else falseNegatives += 1;
  }
  const total = decisions.length;
  return {
    accuracy: ratio(truePositives + trueNegatives, total),
    falseNegatives,
    falsePositives,
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
    total,
    trueNegatives,
    truePositives,
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}
