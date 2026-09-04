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
import { commercialRelationshipTypeSchema } from "./commercial-intelligence.ts";

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

export const marketOpportunityLaneSchema = z
  .object({
    id: referenceIdSchema,
    sourceArchetypeId: referenceIdSchema.optional(),
    label: z.string().min(1).max(200),
    organizationType: z.string().min(1).max(300),
    businessModels: z.array(z.string().min(1).max(240)).default([]),
    industries: z.array(z.string().min(1).max(240)).default([]),
    origin: z.enum(["initial_target", "market_research"]),
    disposition: z.enum(["priority", "secondary", "exploratory", "weak", "rejected"]),
    rationale: z.string().min(1).max(800),
    relationships: z.array(commercialRelationshipTypeSchema).min(1),
    evidenceIds: z.array(referenceIdSchema).max(30).default([]),
    counterEvidenceIds: z.array(referenceIdSchema).max(30).default([]),
    scaleDrivers: z.array(z.string().min(1).max(400)).default([]),
    buyingTriggers: z.array(z.string().min(1).max(400)).default([]),
    vocabulary: z.array(z.string().min(1).max(160)).default([]),
    confidence: confidenceSchema,
  })
  .strict();

export const marketAnalysisSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    commercialIntelligenceVersionId: referenceIdSchema,
    geography: geographyScopeSchema,
    selectedOfferingIds: z.array(referenceIdSchema).min(1),
    marketBreadth: z
      .enum(["very_narrow", "narrow", "medium", "broad", "very_broad"])
      .default("medium"),
    estimatedCandidateRange: z
      .object({
        min: z.number().int().nonnegative().optional(),
        max: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
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
    // Default keeps historical immutable v1 Market Analysis documents readable.
    // New compiler versions always emit at least one lane.
    opportunityLanes: z.array(marketOpportunityLaneSchema).default([]),
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
    archetypeIds: z.array(referenceIdSchema).default([]),
    opportunityLaneIds: z.array(referenceIdSchema).default([]),
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
  .strict()
  .superRefine((route, context) => {
    if (!route.archetypeIds.length && !route.opportunityLaneIds.length) {
      context.addIssue({
        code: "custom",
        path: ["opportunityLaneIds"],
        message: "A discovery route requires an opportunity lane or legacy archetype.",
      });
    }
  });

export const marketResearchPlanSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    marketAnalysisVersionId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    providerCapabilitySnapshotIds: z.array(referenceIdSchema).default([]),
    marketBreadth: z
      .enum(["very_narrow", "narrow", "medium", "broad", "very_broad"])
      .default("medium"),
    estimatedCandidateRange: z
      .object({
        min: z.number().int().nonnegative().optional(),
        max: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    opportunityLanes: z.array(marketOpportunityLaneSchema).default([]),
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
