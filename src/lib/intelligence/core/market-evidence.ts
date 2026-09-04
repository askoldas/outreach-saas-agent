import { z } from "zod";
import { marketSourceFamilySchema } from "./market-intelligence.ts";
import { referenceIdSchema } from "./shared.ts";

export const marketResearchQuestionSchema = z
  .object({
    id: referenceIdSchema,
    purpose: z.enum(["buyer_landscape", "market_structure", "scale_and_timing"]),
    query: z.string().min(1).max(500),
    rationale: z.string().min(1).max(500),
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

export const marketEvidenceCorpusSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    campaignRunId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    questions: z.array(marketResearchQuestionSchema).min(1).max(6),
    evidence: z.array(marketEvidenceItemSchema).max(30),
    provider: z.literal("tavily"),
    providerRequestIds: z.array(z.string().min(1)).default([]),
    providerCredits: z.number().nonnegative(),
    requestHash: z.string().length(64),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type MarketResearchQuestion = z.infer<typeof marketResearchQuestionSchema>;
export type MarketEvidenceCorpus = z.infer<typeof marketEvidenceCorpusSchema>;
