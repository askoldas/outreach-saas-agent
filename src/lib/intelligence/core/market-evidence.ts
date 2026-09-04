import { z } from "zod";
import { marketSourceFamilySchema } from "./market-intelligence.ts";
import { referenceIdSchema } from "./shared.ts";

export const marketResearchQuestionSchema = z
  .object({
    id: referenceIdSchema,
    purpose: z.enum(["buyer_landscape", "market_structure", "scale_and_timing"]),
    query: z.string().min(1).max(500),
    rationale: z.string().min(1).max(500),
    waveNumber: z.number().int().min(1).max(3).default(1),
    direction: z
      .enum([
        "initial",
        "lane_validation",
        "terminology",
        "source_investigation",
        "priority_gap",
      ])
      .default("initial"),
    derivedFromEvidenceIds: z.array(referenceIdSchema).default([]),
  })
  .strict();

export const marketEvidenceItemSchema = z
  .object({
    id: referenceIdSchema,
    questionId: referenceIdSchema,
    sourceFamily: marketSourceFamilySchema,
    url: z.url(),
    title: z.string().min(1).max(500),
    excerpt: z.string().min(1).max(1600),
    relevanceScore: z.number().min(0).max(1).nullable(),
    retrievedAt: z.iso.datetime(),
  })
  .strict();

const waveFindingSchema = z.object({
  label: z.string().min(1).max(240),
  relationshipType: z.string().min(1).max(80),
  rationale: z.string().min(1).max(600),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(referenceIdSchema).max(8),
}).strict();

export const marketResearchWaveSummarySchema = z.object({
  waveNumber: z.literal(1),
  discoveredLaneHypotheses: z.array(waveFindingSchema).max(6),
  strengthenedLaneHypotheses: z.array(waveFindingSchema).max(6),
  weakenedLaneHypotheses: z.array(waveFindingSchema).max(6),
  localTerminology: z.array(waveFindingSchema).max(6),
  importantSourceLeads: z.array(waveFindingSchema).max(6),
  scaleDriverFindings: z.array(waveFindingSchema).max(6),
  buyingSignalFindings: z.array(waveFindingSchema).max(6),
  marketStructureFindings: z.array(waveFindingSchema).max(6),
  evidenceGaps: z.array(waveFindingSchema).max(6),
  followUpQuestions: z.array(z.string().min(1).max(500)).max(6),
  evidenceIds: z.array(referenceIdSchema).max(24),
}).strict();

export const marketEvidenceCorpusSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    campaignRunId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    questions: z.array(marketResearchQuestionSchema).min(1).max(18),
    evidence: z.array(marketEvidenceItemSchema).max(72),
    waves: z
      .array(
        z
          .object({
            waveNumber: z.number().int().min(1).max(3),
            questionIds: z.array(referenceIdSchema),
            evidenceIds: z.array(referenceIdSchema),
            priorityGapKeys: z.array(z.string().min(1).max(200)),
          })
          .strict(),
      )
      .max(3)
      .default([]),
    waveSummaries: z.array(marketResearchWaveSummarySchema).max(1).default([]),
    policy: z
      .object({
        maxMarketResearchWaves: z.number().int().min(1).max(3),
        maxQueriesPerWave: z.number().int().positive(),
        maxProviderCalls: z.number().int().positive(),
        maxEvidenceItems: z.number().int().positive(),
        maxRuntimeMs: z.number().int().positive(),
      })
      .strict()
      .optional(),
    provider: z.literal("tavily"),
    providerRequestIds: z.array(z.string().min(1)).default([]),
    providerCredits: z.number().nonnegative(),
    requestHash: z.string().length(64),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type MarketResearchQuestion = z.infer<typeof marketResearchQuestionSchema>;
export type MarketEvidenceCorpus = z.infer<typeof marketEvidenceCorpusSchema>;
export type MarketResearchWaveSummary = z.infer<typeof marketResearchWaveSummarySchema>;
