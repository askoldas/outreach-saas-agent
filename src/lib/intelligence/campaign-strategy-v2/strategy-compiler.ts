import { campaignStrategyV2Schema, type CampaignStrategyV2 } from "./schemas.ts";
import { hashCanonical } from "./context-compiler.ts";

export const campaignStrategyCompilerVersion = "campaign-strategy/v2.0";

export type CampaignStrategyCompilation = {
  strategy: CampaignStrategyV2;
  compiledContextHash: string;
  contentHash: string;
  compilerVersion: typeof campaignStrategyCompilerVersion;
  normalizedRecords: {
    objective: CampaignStrategyV2["objective"];
    geography: CampaignStrategyV2["geography"];
    archetypes: CampaignStrategyV2["archetypes"];
    qualificationPolicy: CampaignStrategyV2["qualificationPolicy"];
    campaignRules: CampaignStrategyV2["campaignRules"];
    sourcePlan: CampaignStrategyV2["sourcePlan"];
  };
};

export function compileCampaignStrategyV2(input: {
  draft: unknown;
  compiledContextHash: string;
}): CampaignStrategyCompilation {
  const strategy = campaignStrategyV2Schema.parse(input.draft);
  if (strategy.status === "confirmed") {
    throw new Error("A draft compiler cannot publish or confirm a strategy.");
  }
  const normalizedStrategy: CampaignStrategyV2 = {
    ...strategy,
    status: "review",
    archetypes: [...strategy.archetypes].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    campaignRules: [...strategy.campaignRules].sort((left, right) =>
      left.ruleKey.localeCompare(right.ruleKey),
    ),
    assumptions: [...strategy.assumptions].sort((left, right) =>
      left.claimId.localeCompare(right.claimId),
    ),
    discoverySegments: [...strategy.discoverySegments].sort(
      (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
    ),
  };
  campaignStrategyV2Schema.parse(normalizedStrategy);
  return {
    strategy: normalizedStrategy,
    compiledContextHash: input.compiledContextHash,
    contentHash: hashCanonical(normalizedStrategy),
    compilerVersion: campaignStrategyCompilerVersion,
    normalizedRecords: {
      objective: normalizedStrategy.objective,
      geography: normalizedStrategy.geography,
      archetypes: normalizedStrategy.archetypes,
      qualificationPolicy: normalizedStrategy.qualificationPolicy,
      campaignRules: normalizedStrategy.campaignRules,
      sourcePlan: normalizedStrategy.sourcePlan,
    },
  };
}
