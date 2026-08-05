import {
  profileBuyerLogicOutputSchema,
  profileBuyerLogicShardOutputSchema,
  profileOfferingDecompositionOutputSchema,
} from "./task-contracts.ts";

export function buyerLogicShardContexts(context: unknown) {
  const source = objectValue(context);
  const previous = Array.isArray(source.previousStageOutputs)
    ? source.previousStageOutputs
    : [];
  const offeringStage = previous.find(
    (stage) => objectValue(stage).taskId === "profile.offering_decomposition",
  );
  const offeringOutput = profileOfferingDecompositionOutputSchema.parse(
    objectValue(offeringStage).output,
  );
  const sharedPrevious = previous.filter(
    (stage) => objectValue(stage).taskId === "profile.commercial_synthesis",
  );
  return offeringOutput.offerings.map((offering) => ({
    offeringKey: offering.offeringKey,
    context: {
      ...source,
      previousStageOutputs: [
        ...sharedPrevious,
        {
          taskId: "profile.offering_decomposition",
          outputHash: objectValue(offeringStage).outputHash ?? null,
          output: { ...offeringOutput, offerings: [offering] },
        },
      ],
    },
  }));
}

export function mergeBuyerLogicShardOutputs(
  shards: ReadonlyArray<{ offeringKey: string; output: unknown }>,
) {
  const outputs = shards.map(({ offeringKey, output }) => {
    const parsed = profileBuyerLogicShardOutputSchema.parse(output);
    if (
      parsed.offeringBuyerLogic.length !== 1 ||
      parsed.offeringBuyerLogic[0]?.offeringKey !== offeringKey ||
      parsed.archetypes.some((archetype) => archetype.offeringKey !== offeringKey)
    ) {
      throw new Error(`Buyer-logic shard returned data outside offering ${offeringKey}.`);
    }
    return parsed;
  });
  const rules = new Map<string, (typeof outputs)[number]["proposedOfferingRules"][number]>();
  for (const rule of outputs.flatMap((output) => output.proposedOfferingRules)) {
    const existing = rules.get(rule.ruleKey);
    if (existing && JSON.stringify(existing) !== JSON.stringify(rule)) {
      throw new Error(`Buyer-logic shards returned conflicting rule ${rule.ruleKey}.`);
    }
    rules.set(rule.ruleKey, rule);
  }
  return profileBuyerLogicOutputSchema.parse({
    offeringBuyerLogic: outputs.flatMap((item) => item.offeringBuyerLogic),
    archetypes: outputs.flatMap((item) => item.archetypes),
    proposedOfferingRules: [...rules.values()],
    unresolvedQuestions: [
      ...new Set(outputs.flatMap((item) => item.unresolvedQuestions)),
    ],
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
