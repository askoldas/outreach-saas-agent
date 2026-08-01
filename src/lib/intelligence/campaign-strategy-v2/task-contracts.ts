import { z } from "zod";
import { intelligenceClaimSchema } from "../contracts/claims.ts";
import { intelligenceRuleSchema } from "../contracts/rules.ts";

export const campaignMarketContextOutputSchema = z
  .object({
    summary: z.string().min(1),
    marketBreadth: z.enum(["very_narrow", "narrow", "medium", "broad", "very_broad"]),
    estimatedCandidateRange: z
      .object({
        min: z.number().int().nonnegative().optional(),
        max: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    marketStructures: z.array(
      z
        .object({
          structureKey: z.string().min(1),
          label: z.string().min(1),
          relevance: z.string().min(1),
          epistemicStatus: z.enum([
            "explicit_fact",
            "evidence_backed_inference",
            "hypothesis",
          ]),
          evidenceIds: z.array(z.string()),
        })
        .strict(),
    ),
    localTerminology: z.array(
      z
        .object({
          language: z.string().min(1),
          term: z.string().min(1),
          meaning: z.string().min(1),
          targetUse: z.enum([
            "company_type",
            "business_model",
            "source_type",
            "buying_signal",
          ]),
        })
        .strict(),
    ),
    procurementPatterns: z.array(intelligenceClaimSchema),
    likelySourceTypes: z.array(z.string()),
    dataChallenges: z.array(z.string()),
    underCoverageRisks: z.array(z.string()),
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
    for (const structure of market.marketStructures) {
      if (
        structure.epistemicStatus !== "hypothesis" &&
        structure.evidenceIds.length === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["marketStructures"],
          message: "Market facts and inferences require evidence.",
        });
      }
    }
  });

export const campaignStrategyCompilerOutputSchema = z
  .object({
    strategySummary: z.string().min(1),
    targetArchetypes: z
      .array(
        z
          .object({
            archetypeKey: z.string().min(1),
            name: z.string().min(1),
            relationshipType: z.string().min(1),
            priority: z.number().int().min(1).max(100),
            rationale: z.string().min(1),
            requiredConditions: z.array(z.string()),
            positiveSignals: z.array(z.string()),
            negativeSignals: z.array(z.string()),
            requiredEvidenceQuestions: z.array(z.string()),
            likelyDecisionRoles: z.array(z.string()),
            geography: z.array(z.string()),
          })
          .strict(),
      )
      .min(1),
    conditionalArchetypes: z.array(z.string()),
    qualificationPolicy: z
      .object({
        factors: z
          .array(
            z
              .object({
                factorKey: z.string().min(1),
                label: z.string().min(1),
                definition: z.string().min(1),
                weight: z.number().min(0).max(100),
                criticality: z.enum(["critical", "important", "supporting"]),
                positiveDefinition: z.string().min(1),
                negativeDefinition: z.string().min(1),
                unknownPolicy: z.enum([
                  "confidence_only",
                  "requires_research",
                  "gate_if_critical",
                ]),
                acceptedEvidenceTypes: z.array(z.string()).min(1),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    campaignRules: z.array(intelligenceRuleSchema),
    assumptions: z.array(intelligenceClaimSchema),
    requiredSourceCapabilities: z.array(z.string()).min(1),
    warnings: z.array(z.string()),
  })
  .strict()
  .superRefine((output, context) => {
    const archetypeKeys = output.targetArchetypes.map((item) => item.archetypeKey);
    if (new Set(archetypeKeys).size !== archetypeKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["targetArchetypes"],
        message: "Compiled archetype keys must be unique.",
      });
    }
    const total = output.qualificationPolicy.factors.reduce(
      (sum, factor) => sum + factor.weight,
      0,
    );
    if (Math.abs(total - 100) > 0.001) {
      context.addIssue({
        code: "custom",
        path: ["qualificationPolicy", "factors"],
        message: "Compiled factor weights must total 100.",
      });
    }
  });

export const campaignV2TaskContracts = {
  marketContext: {
    taskId: "campaign.market_context",
    promptVersion: "campaign-market-context/v2.0",
    schemaVersion: "campaign-market-context/v2.0",
    contextCompilerVersion: "campaign-context/v2.1-native",
    outputSchema: campaignMarketContextOutputSchema,
  },
  strategyCompiler: {
    taskId: "campaign.strategy_compiler",
    promptVersion: "campaign-strategy-compiler/v2.0",
    schemaVersion: "campaign-strategy-compiler/v2.0",
    contextCompilerVersion: "campaign-context/v2.1-native",
    outputSchema: campaignStrategyCompilerOutputSchema,
  },
} as const;
