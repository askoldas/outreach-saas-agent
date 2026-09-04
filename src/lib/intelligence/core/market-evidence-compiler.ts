import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel } from "./campaign-target-model.ts";
import type { MarketResearchQuestion } from "./market-evidence.ts";

export const MARKET_RECONNAISSANCE_COMPILER_VERSION =
  "market-reconnaissance-questions/v1";

export function compileMarketResearchQuestions(
  target: CampaignTargetModel,
): MarketResearchQuestion[] {
  const geography = target.geography.displayName;
  const archetypes = target.archetypes
    .filter(({ priority }) => priority !== "incompatible")
    .map(({ label }) => label)
    .slice(0, 6)
    .join(", ");
  const objective = target.objective.description;
  return [
    {
      id: "market-question.buyer-landscape",
      purpose: "buyer_landscape",
      query: bounded(
        `${geography} business sectors organizations buyers use cases related to ${objective}; include adjacent sectors beyond ${archetypes}`,
      ),
      rationale:
        "Identify real buyer sectors and commercially adjacent organization types in the selected geography.",
    },
    {
      id: "market-question.market-structure",
      purpose: "market_structure",
      query: bounded(
        `${geography} ${archetypes} industry associations directories procurement market structure major operators`,
      ),
      rationale:
        "Find authoritative market sources, local vocabulary, procurement patterns, and representative operators.",
    },
    {
      id: "market-question.scale-and-timing",
      purpose: "scale_and_timing",
      query: bounded(
        `${geography} ${archetypes} expansion opening renovation investment capacity procurement news`,
      ),
      rationale:
        "Identify observable scale drivers and current buying triggers relevant to the offering.",
    },
  ];
}

export function marketResearchRequestHash(input: {
  target: CampaignTargetModel;
  questions: MarketResearchQuestion[];
}) {
  return hashCanonical({
    targetContentHash: input.target.version.contentHash,
    questions: input.questions,
    compilerVersion: MARKET_RECONNAISSANCE_COMPILER_VERSION,
  });
}

function bounded(value: string) {
  return value.length <= 500 ? value : value.slice(0, 500).trimEnd();
}
