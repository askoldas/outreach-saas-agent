import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel } from "./campaign-target-model.ts";
import type { MarketResearchQuestion } from "./market-evidence.ts";

export const MARKET_RECONNAISSANCE_COMPILER_VERSION =
  "market-reconnaissance-questions/v2-adaptive-waves";

export type MarketResearchPolicy = {
  maxMarketResearchWaves: number;
  normalMarketResearchWaves: number;
  maxQueriesPerWave: number;
  maxProviderCalls: number;
  maxEvidenceItems: number;
  maxRuntimeMs: number;
};

export const DEFAULT_MARKET_RESEARCH_POLICY: MarketResearchPolicy = {
  maxMarketResearchWaves: 3,
  normalMarketResearchWaves: 2,
  maxQueriesPerWave: 3,
  maxProviderCalls: 9,
  maxEvidenceItems: 60,
  maxRuntimeMs: 120_000,
};

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
      waveNumber: 1,
      direction: "initial",
      derivedFromEvidenceIds: [],
    },
    {
      id: "market-question.market-structure",
      purpose: "market_structure",
      query: bounded(
        `${geography} ${archetypes} industry associations directories procurement market structure major operators`,
      ),
      rationale:
        "Find authoritative market sources, local vocabulary, procurement patterns, and representative operators.",
      waveNumber: 1,
      direction: "initial",
      derivedFromEvidenceIds: [],
    },
    {
      id: "market-question.scale-and-timing",
      purpose: "scale_and_timing",
      query: bounded(
        `${geography} ${archetypes} expansion opening renovation investment capacity procurement news`,
      ),
      rationale:
        "Identify observable scale drivers and current buying triggers relevant to the offering.",
      waveNumber: 1,
      direction: "initial",
      derivedFromEvidenceIds: [],
    },
  ];
}

export function compileMarketResearchFollowUpQuestions(input: {
  target: CampaignTargetModel;
  evidence: Array<{
    id: string;
    url: string;
    title: string;
    excerpt: string;
    relevanceScore: number | null;
  }>;
  waveNumber: 2 | 3;
  priorityGapKeys?: string[];
  maximum?: number;
}): MarketResearchQuestion[] {
  const maximum = Math.max(0, Math.min(input.maximum ?? 3, 3));
  const geography = input.target.geography.displayName;
  const ranked = [...input.evidence].sort(
    (left, right) =>
      (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0) ||
      left.id.localeCompare(right.id),
  );
  const questions: MarketResearchQuestion[] = [];
  if (input.waveNumber === 3) {
    for (const [index, gap] of (input.priorityGapKeys ?? [])
      .slice(0, maximum)
      .entries()) {
      questions.push({
        id: `market-question.wave-3-gap-${index + 1}`,
        purpose: "buyer_landscape",
        query: bounded(
          `${geography} ${gap} organizations market evidence directory operators`,
        ),
        rationale: `Resolve the explicit priority coverage gap: ${gap}.`,
        waveNumber: 3,
        direction: "priority_gap",
        derivedFromEvidenceIds: [],
      });
    }
    return questions;
  }
  const source = ranked.find(({ url }) => usefulSourceHost(url));
  if (source && questions.length < maximum) {
    questions.push({
      id: "market-question.wave-2-source",
      purpose: "market_structure",
      query: bounded(
        `site:${host(source.url)} ${geography} members directory exhibitors companies`,
      ),
      rationale: "Investigate a useful market source found in Wave 1.",
      waveNumber: 2,
      direction: "source_investigation",
      derivedFromEvidenceIds: [source.id],
    });
  }
  for (const [index, item] of ranked.slice(0, maximum - questions.length).entries()) {
    questions.push({
      id: `market-question.wave-2-evidence-${index + 1}`,
      purpose: index === 0 ? "buyer_landscape" : "scale_and_timing",
      query: bounded(
        `${geography} "${bounded(item.title, 180)}" operators directory expansion procurement`,
      ),
      rationale:
        "Follow evidence-discovered terminology or a promising adjacent market direction from Wave 1.",
      waveNumber: 2,
      direction: index === 0 ? "terminology" : "lane_validation",
      derivedFromEvidenceIds: [item.id],
    });
  }
  return questions;
}

export function unresolvedPriorityMarketGaps(
  target: CampaignTargetModel,
  evidence: Array<{ title: string; excerpt: string }>,
) {
  const searchable = evidence
    .map(({ title, excerpt }) => `${title} ${excerpt}`)
    .join(" ")
    .toLocaleLowerCase();
  return target.archetypes
    .filter(({ priority }) => priority === "priority")
    .filter(({ label }) => !searchable.includes(label.toLocaleLowerCase()))
    .map(({ label }) => label)
    .slice(0, 3);
}

export function marketResearchRequestHash(input: {
  target: CampaignTargetModel;
  questions: MarketResearchQuestion[];
  policy?: Record<string, unknown>;
}) {
  return hashCanonical({
    targetContentHash: input.target.version.contentHash,
    questions: input.questions,
    policy: input.policy ?? null,
    compilerVersion: MARKET_RECONNAISSANCE_COMPILER_VERSION,
  });
}

function bounded(value: string, maximum = 500) {
  return value.length <= maximum ? value : value.slice(0, maximum).trimEnd();
}

function host(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function usefulSourceHost(url: string) {
  return /association|federation|chamber|directory|registry|register|expo|event|trade/i.test(
    url,
  );
}
