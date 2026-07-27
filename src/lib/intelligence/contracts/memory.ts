import { z } from "zod";

export const intelligenceMemorySchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    userId: z.string().min(1).optional(),
    scope: z.enum(["user", "workspace", "offering", "campaign", "candidate", "run"]),
    scopeId: z.string().min(1),
    kind: z.enum([
      "fact",
      "preference",
      "exclusion",
      "correction",
      "strategy_pattern",
      "market_finding",
      "discovery_lesson",
      "evaluation_lesson",
      "hypothesis",
    ]),
    statement: z.string().min(1).max(1200),
    applicability: z
      .object({
        objectiveCodes: z.array(z.string()).optional(),
        offeringIds: z.array(z.string()).optional(),
        geographyCodes: z.array(z.string()).optional(),
        archetypeIds: z.array(z.string()).optional(),
        candidateIds: z.array(z.string()).optional(),
        relationshipTypes: z.array(z.string()).optional(),
        qualificationFactorKeys: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    applicabilityStatus: z.enum(["known", "unknown"]).optional(),
    strength: z.enum(["hard", "soft"]),
    status: z.enum([
      "proposed",
      "provisional",
      "confirmed",
      "rejected",
      "superseded",
      "expired",
      "archived",
    ]),
    source: z.enum(["user", "ai", "system", "import"]),
    confidence: z.number().min(0).max(1),
    originCampaignId: z.string().optional(),
    originRunId: z.string().optional(),
    originCandidateId: z.string().optional(),
    evidenceIds: z.array(z.string()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    lastAppliedAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export type IntelligenceMemory = z.infer<typeof intelligenceMemorySchema>;
