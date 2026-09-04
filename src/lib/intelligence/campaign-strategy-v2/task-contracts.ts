import { z } from "zod";
import { intelligenceClaimSchema } from "../contracts/claims.ts";

export const marketOpportunityLaneProposalSchema = z
  .object({
    laneKey: z.string().min(1).max(120),
    sourceArchetypeId: z.string().min(1).max(200).optional(),
    label: z.string().min(1).max(200),
    organizationType: z.string().min(1).max(300),
    businessModels: z.array(z.string().min(1).max(240)).max(6).default([]),
    industries: z.array(z.string().min(1).max(240)).max(6).default([]),
    rationale: z.string().min(1).max(800),
    disposition: z.enum(["priority", "secondary", "exploratory", "weak", "rejected"]),
    evidenceIds: z.array(z.string().min(1).max(200)).max(20).default([]),
    counterEvidenceIds: z.array(z.string().min(1).max(200)).max(20).default([]),
    scaleDrivers: z.array(z.string().min(1).max(400)).max(6).default([]),
    buyingTriggers: z.array(z.string().min(1).max(400)).max(6).default([]),
    vocabulary: z.array(z.string().min(1).max(160)).max(8).default([]),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((lane, context) => {
    if (lane.disposition === "priority" && lane.evidenceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["evidenceIds"],
        message: "Priority opportunity lanes require market evidence.",
      });
    }
  });

export const campaignMarketContextOutputSchema = z
  .object({
    summary: z.string().min(1).max(1200),
    marketBreadth: z.enum(["very_narrow", "narrow", "medium", "broad", "very_broad"]),
    estimatedCandidateRange: z
      .object({
        min: z.number().int().nonnegative().optional(),
        max: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    marketStructures: z
      .array(
        z
          .object({
            structureKey: z.string().min(1).max(80),
            label: z.string().min(1).max(160),
            relevance: z.string().min(1).max(600),
            epistemicStatus: z.enum([
              "explicit_fact",
              "evidence_backed_inference",
              "hypothesis",
            ]),
            evidenceIds: z.array(z.string()).max(12),
            conciseRationale: z.string().min(1).max(600).optional(),
          })
          .strict(),
      )
      .max(4),
    localTerminology: z
      .array(
        z
          .object({
            language: z.string().min(1).max(80),
            term: z.string().min(1).max(120),
            meaning: z.string().min(1).max(300),
            targetUse: z.enum([
              "company_type",
              "business_model",
              "source_type",
              "buying_signal",
            ]),
          })
          .strict(),
      )
      .max(8),
    procurementPatterns: z.array(intelligenceClaimSchema).max(4),
    opportunityLanes: z.array(marketOpportunityLaneProposalSchema).max(12).default([]),
    likelySourceTypes: z.array(z.string().max(120)).max(6),
    dataChallenges: z.array(z.string().max(500)).max(4),
    underCoverageRisks: z.array(z.string().max(500)).max(4),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((market, context) => {
    const range = market.estimatedCandidateRange;
    if (range?.min !== undefined && range.max !== undefined && range.min > range.max) {
      context.addIssue({
        code: "custom",
        path: ["estimatedCandidateRange"],
        message: "Estimated candidate range is inverted.",
      });
    }
    for (const [index, structure] of market.marketStructures.entries()) {
      if (
        structure.epistemicStatus !== "hypothesis" &&
        structure.evidenceIds.length === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["marketStructures", index, "evidenceIds"],
          message: "Market facts and inferences require evidence.",
        });
      }
      if (
        structure.epistemicStatus === "evidence_backed_inference" &&
        !structure.conciseRationale
      ) {
        context.addIssue({
          code: "custom",
          path: ["marketStructures", index, "conciseRationale"],
          message: "Evidence-backed market inferences require a rationale.",
        });
      }
    }
  });

const advisoryOperationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("clarify_archetype"),
      archetypeId: z.string().min(1).max(160),
      label: z.string().min(1).max(180).optional(),
      rationale: z.string().min(1).max(600).optional(),
    })
    .strict()
    .refine((value) => value.label !== undefined || value.rationale !== undefined, {
      message: "An archetype clarification must propose a label or rationale.",
    }),
  z
    .object({
      operation: z.literal("add_local_terminology"),
      archetypeId: z.string().min(1).max(160),
      terms: z.array(z.string().min(1).max(120)).min(1).max(4),
    })
    .strict(),
  z
    .object({
      operation: z.literal("propose_signal"),
      archetypeId: z.string().min(1).max(160),
      polarity: z.enum(["positive", "negative"]),
      signal: z.string().min(1).max(300),
      rationale: z.string().min(1).max(400),
    })
    .strict(),
  z
    .object({
      operation: z.literal("propose_evidence_question"),
      archetypeId: z.string().min(1).max(160),
      question: z.string().min(1).max(400),
      importance: z.enum(["critical", "important"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("adjust_factor_weight"),
      factorKey: z.string().min(1).max(80),
      delta: z.number().int().min(-10).max(10),
      rationale: z.string().min(1).max(400),
    })
    .strict(),
  z
    .object({
      operation: z.literal("identify_market_risk"),
      risk: z.string().min(1).max(400),
      rationale: z.string().min(1).max(500),
      evidenceIds: z.array(z.string().min(1).max(160)).max(8),
    })
    .strict(),
]);

export const campaignStrategyAdvisoryDeltaOutputSchema = z
  .object({
    summary: z.string().min(1).max(800),
    operations: z.array(advisoryOperationSchema).max(12),
    omittedObservationCount: z.number().int().nonnegative(),
  })
  .strict();

export const campaignV2TaskContracts = {
  marketContext: {
    taskId: "campaign.market_context",
    promptVersion: "campaign-market-context/v4-open-opportunity-map",
    schemaVersion: "campaign-market-context/v4-open-opportunity-map",
    contextCompilerVersion: "campaign-context/v2.2-market-specific",
    outputSchema: campaignMarketContextOutputSchema,
  },
  advisoryDelta: {
    taskId: "campaign.strategy_advisory_delta",
    promptVersion: "campaign-strategy-advisory-delta/v1",
    schemaVersion: "campaign-strategy-advisory-delta/v1",
    contextCompilerVersion: "campaign-context/v2.2-market-specific",
    outputSchema: campaignStrategyAdvisoryDeltaOutputSchema,
  },
} as const;
