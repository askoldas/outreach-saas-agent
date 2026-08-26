import {
  profileBuyerLogicOutputSchema,
  profileBuyerLogicShardOutputSchema,
  profileOfferingDecompositionOutputSchema,
} from "./task-contracts.ts";

const maxMergedUnresolvedQuestions = 12;

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
    return { offeringKey, parsed };
  });
  const rules = mergeShardRules(
    outputs.flatMap(({ offeringKey, parsed }) =>
      parsed.proposedOfferingRules.map((rule) => ({ offeringKey, rule })),
    ),
  );
  return profileBuyerLogicOutputSchema.parse({
    offeringBuyerLogic: outputs.flatMap((item) => item.parsed.offeringBuyerLogic),
    archetypes: outputs.flatMap((item) => item.parsed.archetypes),
    proposedOfferingRules: rules,
    unresolvedQuestions: [
      ...new Set(outputs.flatMap((item) => item.parsed.unresolvedQuestions)),
    ].slice(0, maxMergedUnresolvedQuestions),
  });
}

function mergeShardRules(
  entries: Array<{
    offeringKey: string;
    rule: ReturnType<
      typeof profileBuyerLogicShardOutputSchema.parse
    >["proposedOfferingRules"][number];
  }>,
) {
  const byKey = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = byKey.get(entry.rule.ruleKey) ?? [];
    group.push(entry);
    byKey.set(entry.rule.ruleKey, group);
  }
  return [...byKey.values()].flatMap((group) => {
    const distinct = new Set(group.map(({ rule }) => JSON.stringify(rule)));
    if (distinct.size === 1) return [group[0]!.rule];
    return group.map(({ offeringKey, rule }) => ({
      ...rule,
      ruleKey: scopedRuleKey(rule.ruleKey, offeringKey),
      scope: "offering" as const,
      applicability: {
        ...rule.applicability,
        offeringIds: [offeringKey],
      },
    }));
  });
}

function scopedRuleKey(ruleKey: string, offeringKey: string) {
  const suffix = `--${offeringKey}`;
  return `${ruleKey.slice(0, 160 - suffix.length)}${suffix}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
