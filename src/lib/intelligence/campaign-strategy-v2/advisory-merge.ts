import { campaignStrategyV2Schema, type CampaignStrategyV2 } from "./schemas.ts";
import type { StrategyAdvisoryDeltaOutput } from "./market-strategy.ts";

export type AdvisoryOperationDisposition = {
  operationIndex: number;
  operation:
    | StrategyAdvisoryDeltaOutput["operations"][number]["operation"]
    | "omitted_observation";
  status: "applied" | "rejected" | "requires_user_review" | "omitted_by_budget";
  reason: string;
};

export function mergeCampaignStrategyAdvisoryDelta(input: {
  baseline: CampaignStrategyV2;
  advisory: StrategyAdvisoryDeltaOutput;
}) {
  const strategy = structuredClone(input.baseline);
  const dispositions: AdvisoryOperationDisposition[] = [];
  const archetypeIds = new Set(strategy.archetypes.map((item) => item.id));
  const factorKeys = new Set(
    strategy.qualificationPolicy.factorDefinitions.map((item) => item.factorKey),
  );
  const evidenceIds = new Set(
    strategy.assumptions.flatMap((item) => [
      ...item.evidenceIds,
      ...item.counterEvidenceIds,
    ]),
  );

  input.advisory.operations.forEach((operation, operationIndex) => {
    const reject = (reason: string): void => {
      dispositions.push({
        operationIndex,
        operation: operation.operation,
        status: "rejected",
        reason,
      });
    };
    if ("archetypeId" in operation && !archetypeIds.has(operation.archetypeId)) {
      reject(`Unknown frozen archetype ${operation.archetypeId}.`);
      return;
    }
    if (operation.operation === "adjust_factor_weight") {
      dispositions.push({
        operationIndex,
        operation: operation.operation,
        status: factorKeys.has(operation.factorKey)
          ? "requires_user_review"
          : "rejected",
        reason: factorKeys.has(operation.factorKey)
          ? "Weight changes require an explicit balancing decision during review."
          : `Unknown frozen factor ${operation.factorKey}.`,
      });
      return;
    }
    if (operation.operation === "identify_market_risk") {
      const unknownEvidence = operation.evidenceIds.filter((id) => !evidenceIds.has(id));
      if (unknownEvidence.length) {
        reject(`Unknown evidence reference(s): ${unknownEvidence.join(", ")}.`);
        return;
      }
      strategy.unresolvedQuestions.push({
        questionKey: `advisory-risk-${operationIndex + 1}`,
        question: operation.risk,
        importance: "important",
        acceptedEvidenceTypes: ["reliable_public_source"],
        unknownAction: "requires_research",
      });
      applied(operationIndex, operation.operation, dispositions, "Added as an unresolved market risk.");
      return;
    }
    const archetype = strategy.archetypes.find((item) => item.id === operation.archetypeId)!;
    const segment = strategy.discoverySegments.find(
      (item) => item.archetypeId === operation.archetypeId,
    );
    if (operation.operation === "clarify_archetype") {
      if (operation.label) {
        archetype.label = operation.label;
        if (segment) segment.label = operation.label;
      }
      if (operation.rationale) {
        archetype.commercialRationale = operation.rationale;
        if (segment) segment.rationale = operation.rationale;
      }
    } else if (operation.operation === "add_local_terminology") {
      if (!segment) {
        reject("The archetype has no frozen discovery segment.");
        return;
      }
      segment.businessCharacteristics.keywords = unique([
        ...segment.businessCharacteristics.keywords,
        ...operation.terms,
      ]);
    } else if (operation.operation === "propose_signal") {
      const collection =
        operation.polarity === "positive"
          ? archetype.positiveSignals
          : archetype.negativeSignals;
      const signal = {
        key: `advisory-${operation.polarity}-${operationIndex + 1}`,
        label: operation.signal,
        description: operation.rationale,
        class: operation.polarity,
        expectedEvidenceTypes: ["company_website", "reliable_public_source"],
        reliability: "medium" as const,
        requiredForQualification: false,
      };
      collection.push(signal);
      if (segment) {
        (operation.polarity === "positive"
          ? segment.positiveSignals
          : segment.negativeSignals
        ).push(signal);
      }
    } else if (operation.operation === "propose_evidence_question") {
      archetype.requiredEvidenceQuestions.push({
        questionKey: `advisory-evidence-${operationIndex + 1}`,
        question: operation.question,
        importance: operation.importance,
        acceptedEvidenceTypes: ["company_website", "reliable_public_source"],
        unknownAction: "requires_research",
      });
    }
    applied(operationIndex, operation.operation, dispositions, "Validated and applied to the deterministic baseline.");
  });

  if (input.advisory.omittedObservationCount > 0) {
    dispositions.push({
      operationIndex: input.advisory.operations.length,
      operation: "omitted_observation",
      status: "omitted_by_budget",
      reason: `${input.advisory.omittedObservationCount} lower-priority market observation(s) were omitted by the bounded advisory contract.`,
    });
  }

  return { strategy: campaignStrategyV2Schema.parse(strategy), dispositions };
}

function applied(
  operationIndex: number,
  operation: AdvisoryOperationDisposition["operation"],
  dispositions: AdvisoryOperationDisposition[],
  reason: string,
) {
  dispositions.push({ operationIndex, operation, status: "applied", reason });
}

function unique(values: string[]) {
  return [...new Set(values)];
}
