import { z } from "zod";
import type { DiscoveryCoverageCell, DiscoveryCoverageMetrics } from "./coverage.ts";

export const discoveryGapActionSchema = z
  .object({
    type: z.enum([
      "run_new_queries",
      "translate_queries",
      "activate_provider",
      "expand_directory",
      "expand_from_seed",
      "broaden_segment",
      "narrow_segment",
      "request_user_clarification",
      "stop_segment",
    ]),
    reason: z.string().min(1),
    expectedImprovement: z.string().min(1),
    maxCalls: z.number().int().positive().optional(),
    maxEstimatedCostMinor: z.number().nonnegative().optional(),
  })
  .strict();

export const discoveryGapSchema = z
  .object({
    id: z.string().min(1),
    campaignId: z.string().min(1),
    discoverySegmentId: z.string().min(1).optional(),
    type: z.enum([
      "geography_undercovered",
      "archetype_undercovered",
      "language_not_attempted",
      "source_diversity_low",
      "unique_yield_low",
      "plausible_yield_low",
      "known_anchor_missing",
      "candidate_mix_unbalanced",
      "provider_failure",
      "strategy_ambiguity",
      "other",
    ]),
    description: z.string().min(1),
    supportingMetrics: z.record(
      z.string(),
      z.union([z.number(), z.string(), z.boolean(), z.null()]),
    ),
    severity: z.enum(["critical", "high", "normal", "low"]),
    recommendedActions: z.array(discoveryGapActionSchema).min(1),
    status: z.enum(["open", "addressing", "resolved", "accepted", "blocked"]),
  })
  .strict();

export type DiscoveryGap = z.infer<typeof discoveryGapSchema>;

export function analyzeDiscoveryGaps(input: {
  cell: DiscoveryCoverageCell;
  metrics: DiscoveryCoverageMetrics;
  remainingCallBudget: number;
}): DiscoveryGap[] {
  const { cell, metrics } = input;
  if (cell.status === "sufficient" || cell.status === "exhausted") return [];
  const gaps: DiscoveryGap[] = [];
  const add = (
    type: DiscoveryGap["type"],
    description: string,
    severity: DiscoveryGap["severity"],
    action: DiscoveryGap["recommendedActions"][number],
    supportingMetrics: DiscoveryGap["supportingMetrics"],
  ) => {
    gaps.push(
      discoveryGapSchema.parse({
        id: `${cell.discoverySegmentId}:${type}`,
        campaignId: cell.campaignId,
        discoverySegmentId: cell.discoverySegmentId,
        type,
        description,
        supportingMetrics,
        severity,
        recommendedActions: [action],
        status: input.remainingCallBudget > 0 ? "open" : "blocked",
      }),
    );
  };
  const missingLanguages = metrics.expectedLocalLanguages.filter(
    (language) => !metrics.languagesAttempted.includes(language),
  );
  if (missingLanguages.length) {
    add(
      "language_not_attempted",
      `Local-language coverage is missing: ${missingLanguages.join(", ")}.`,
      "high",
      {
        type: "translate_queries",
        reason: "Relevant local market terminology has not been attempted.",
        expectedImprovement: "Improve unique local-organization coverage.",
        maxCalls: Math.min(4, Math.max(1, input.remainingCallBudget)),
      },
      { missingLanguageCount: missingLanguages.length },
    );
  }
  if (cell.sourceDiversityCount < 2) {
    add(
      "source_diversity_low",
      "Only one source family has contributed to this segment.",
      "normal",
      {
        type: "expand_directory",
        reason: "A second source family is needed to test coverage bias.",
        expectedImprovement:
          "Increase source diversity and uncover missed organizations.",
        maxCalls: Math.min(2, Math.max(1, input.remainingCallBudget)),
      },
      { sourceDiversityCount: cell.sourceDiversityCount },
    );
  }
  if (
    metrics.targetUniqueCandidates !== undefined &&
    metrics.uniqueCandidateHints < metrics.targetUniqueCandidates &&
    cell.status !== "blocked"
  ) {
    add(
      "archetype_undercovered",
      `The segment has ${metrics.uniqueCandidateHints} of ${metrics.targetUniqueCandidates} target unique candidates.`,
      "high",
      {
        type: "run_new_queries",
        reason: "The priority archetype remains below its explicit coverage target.",
        expectedImprovement: "Add unique candidate organizations for this archetype.",
        maxCalls: Math.min(3, Math.max(1, input.remainingCallBudget)),
      },
      {
        uniqueCandidateHints: metrics.uniqueCandidateHints,
        targetUniqueCandidates: metrics.targetUniqueCandidates,
      },
    );
  }
  if (cell.providerCalls > 0 && cell.uniqueYieldPerCall < 0.5) {
    add(
      "unique_yield_low",
      "Recent provider work produces fewer than 0.5 unique candidates per call.",
      "normal",
      {
        type: "narrow_segment",
        reason: "Repeated broad retrieval is producing weak unique yield.",
        expectedImprovement:
          "Test one more precise segment without repeating prior queries.",
        maxCalls: 2,
      },
      { uniqueYieldPerCall: cell.uniqueYieldPerCall },
    );
  }
  if (cell.status === "blocked") {
    add(
      "provider_failure",
      "Provider failures blocked discovery for this segment.",
      "critical",
      {
        type: "activate_provider",
        reason: "The current provider route could not execute.",
        expectedImprovement: "Restore a usable discovery source.",
      },
      { providerFailureCount: metrics.providerFailureCount },
    );
  }
  return gaps;
}
