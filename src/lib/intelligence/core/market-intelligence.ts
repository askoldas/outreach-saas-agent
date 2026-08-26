import { z } from "zod";
import { intelligenceClaimSchema } from "../contracts/claims.ts";
import { providerSourceTypeSchema } from "../../discovery-v2/contracts.ts";
import {
  confidenceSchema,
  geographyScopeSchema,
  referenceIdSchema,
  signalSchema,
  unknownSchema,
} from "./shared.ts";
import { intelligenceArtifactVersionSchema } from "./versioning.ts";

export const marketSourceFamilySchema = z.enum([
  "local_business",
  "official_website",
  "company_database",
  "registry",
  "industry_directory",
  "association",
  "certification_list",
  "trade_event",
  "marketplace",
  "partner_ecosystem",
  "funding_database",
  "jobs",
  "news",
  "web_search",
  "other",
]);

export const marketAnalysisSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    commercialIntelligenceVersionId: referenceIdSchema,
    geography: geographyScopeSchema,
    selectedOfferingIds: z.array(referenceIdSchema).min(1),
    marketSummary: z.string().min(1).max(2400),
    targetArchetypes: z
      .array(
        z
          .object({
            archetypeId: referenceIdSchema,
            priority: z.enum(["priority", "secondary", "exploratory"]),
            rationale: z.string().min(1).max(800),
          })
          .strict(),
      )
      .min(1),
    marketStructure: z.array(intelligenceClaimSchema).default([]),
    localTerminology: z
      .array(
        z
          .object({
            language: z.string().min(1).max(80),
            term: z.string().min(1).max(160),
            meaning: z.string().min(1).max(400),
            archetypeIds: z.array(referenceIdSchema).default([]),
          })
          .strict(),
      )
      .default([]),
    localLanguages: z.array(z.string().min(1).max(80)).default([]),
    majorSourceFamilies: z.array(marketSourceFamilySchema).min(1),
    importantMarketSources: z
      .array(
        z
          .object({
            name: z.string().min(1).max(240),
            url: z.url().optional(),
            sourceFamily: marketSourceFamilySchema,
            relevance: z.string().min(1).max(800),
            evidenceIds: z.array(referenceIdSchema).default([]),
            confidence: confidenceSchema,
          })
          .strict(),
      )
      .default([]),
    qualificationSignals: z.array(signalSchema).default([]),
    misleadingSignals: z.array(signalSchema).default([]),
    coverageRisks: z.array(unknownSchema).default([]),
    opportunityNotes: z.array(z.string().min(1).max(800)).default([]),
    evidenceIds: z.array(referenceIdSchema).max(100).default([]),
    unknowns: z.array(unknownSchema).default([]),
    confidence: confidenceSchema,
    requiresUserConfirmation: z.boolean(),
    version: intelligenceArtifactVersionSchema,
  })
  .strict();

export const discoveryRouteSchema = z
  .object({
    id: referenceIdSchema,
    archetypeIds: z.array(referenceIdSchema).min(1),
    providerCapabilitySnapshotIds: z.array(referenceIdSchema).min(1),
    sourceFamily: marketSourceFamilySchema,
    providerSourceTypes: z.array(providerSourceTypeSchema).min(1),
    role: z.enum(["primary", "supporting", "verification"]),
    priority: z.number().int().positive(),
    rationale: z.string().min(1).max(800),
    languages: z.array(z.string().min(1).max(80)).min(1),
    vocabulary: z.array(z.string().min(1).max(160)).default([]),
    sourceHints: z.array(z.string().min(1).max(500)).default([]),
    expansionMode: z.enum(["none", "bounded", "resumable"]),
    expectedCoverage: z.enum(["low", "medium", "high", "unknown"]),
  })
  .strict();

export const marketResearchPlanSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    marketAnalysisVersionId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    providerCapabilitySnapshotIds: z.array(referenceIdSchema).default([]),
    discoveryRoutes: z.array(discoveryRouteSchema).min(1),
    verificationRoutes: z.array(discoveryRouteSchema).default([]),
    expectedCoverageRisks: z.array(unknownSchema).default([]),
    redirectCriteria: z.array(z.string().min(1).max(600)).default([]),
    stopSignals: z.array(z.string().min(1).max(600)).default([]),
    version: intelligenceArtifactVersionSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if (!plan.discoveryRoutes.some(({ role }) => role === "primary")) {
      context.addIssue({
        code: "custom",
        path: ["discoveryRoutes"],
        message: "A Market Research Plan requires at least one primary discovery route.",
      });
    }
  });

export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;
export type MarketResearchPlan = z.infer<typeof marketResearchPlanSchema>;
export type DiscoveryRoute = z.infer<typeof discoveryRouteSchema>;
