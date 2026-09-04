import { z } from "zod";
import { intelligenceClaimSchema } from "../contracts/claims.ts";
import { intelligenceRuleSchema } from "../contracts/rules.ts";
import {
  confidenceSchema,
  referenceIdSchema,
  signalSchema,
  unknownSchema,
} from "./shared.ts";
import { intelligenceArtifactVersionSchema } from "./versioning.ts";

export const commercialRelationshipTypeSchema = z.enum([
  "buyer",
  "end_user",
  "manufacturer",
  "supplier",
  "distributor",
  "retailer",
  "reseller",
  "channel_partner",
  "implementation_partner",
  "integration_partner",
  "referral_partner",
  "strategic_partner",
  "competitor",
  "other",
]);

export const commercialArchetypeHypothesisSchema = z
  .object({
    id: referenceIdSchema,
    label: z.string().min(1).max(200),
    organizationType: z.string().min(1).max(300),
    businessRoles: z.array(z.string().min(1).max(160)).default([]),
    businessModels: z.array(z.string().min(1).max(240)).default([]),
    industries: z.array(z.string().min(1).max(240)).default([]),
    sourcePriority: z.enum(["priority", "conditional", "low_priority"]),
    rationale: z.string().min(1).max(1000),
    operationalUseCases: z.array(z.string().min(1).max(500)).min(1),
    requiredConditions: z.array(z.string().min(1).max(500)).default([]),
    preferredConditions: z.array(z.string().min(1).max(500)).default([]),
    negativeConditions: z.array(z.string().min(1).max(500)).default([]),
    likelyBuyerRoles: z.array(z.string().min(1).max(200)).default([]),
    possibleRelationships: z.array(commercialRelationshipTypeSchema).min(1),
    positiveSignals: z.array(signalSchema).default([]),
    negativeSignals: z.array(signalSchema).default([]),
    scaleSignals: z.array(signalSchema).default([]),
    buyingSignals: z.array(signalSchema).default([]),
    origin: z
      .enum(["company_profile", "campaign_strategy", "market_research"])
      .default("company_profile"),
    status: z.enum(["hypothesis", "supported", "weak", "rejected"]).default("hypothesis"),
    evidenceIds: z.array(referenceIdSchema).max(40).default([]),
    confidence: confidenceSchema,
  })
  .strict();

export const commercialOfferingSchema = z
  .object({
    offeringId: referenceIdSchema,
    offeringVersionId: referenceIdSchema,
    name: z.string().min(1).max(240),
    summary: z.string().min(1).max(1200),
    valueProposition: z.array(z.string().min(1).max(500)).default([]),
    capabilities: z.array(z.string().min(1).max(500)).default([]),
    useCases: z.array(z.string().min(1).max(500)).default([]),
    expectedOutcomes: z.array(z.string().min(1).max(500)).default([]),
    customerProblems: z.array(z.string().min(1).max(500)).default([]),
    operationalUseCases: z.array(z.string().min(1).max(500)).default([]),
    requiredBuyerConditions: z.array(z.string().min(1).max(500)).default([]),
    preferredBuyerConditions: z.array(z.string().min(1).max(500)).default([]),
    negativeBuyerConditions: z.array(z.string().min(1).max(500)).default([]),
    likelyBuyerRoles: z.array(z.string().min(1).max(200)).default([]),
    procurementPatterns: z.array(z.string().min(1).max(500)).default([]),
    possibleCustomerArchetypes: z.array(commercialArchetypeHypothesisSchema),
    possibleRelationships: z.array(commercialRelationshipTypeSchema),
    positiveSignals: z.array(signalSchema).default([]),
    negativeSignals: z.array(signalSchema).default([]),
    scaleDrivers: z.array(signalSchema).default([]),
    buyingTriggers: z.array(signalSchema).default([]),
    ruleKeys: z.array(referenceIdSchema).default([]),
    evidenceIds: z.array(referenceIdSchema).max(50).default([]),
    confidence: confidenceSchema,
  })
  .strict();

export const commercialIntelligenceSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    companyProfileVersionId: referenceIdSchema,
    seller: z
      .object({
        name: z.string().min(1).max(240),
        businessRoles: z.array(z.string().min(1).max(120)).min(1),
        capabilities: z.array(z.string().min(1).max(500)).default([]),
      })
      .strict(),
    offerings: z.array(commercialOfferingSchema).min(1),
    rules: z.array(intelligenceRuleSchema).default([]),
    claims: z.array(intelligenceClaimSchema).default([]),
    unknowns: z.array(unknownSchema).default([]),
    evidenceIds: z.array(referenceIdSchema).max(100).default([]),
    confidence: confidenceSchema,
    version: intelligenceArtifactVersionSchema,
  })
  .strict();

export type CommercialIntelligence = z.infer<typeof commercialIntelligenceSchema>;
export type CommercialRelationshipType = z.infer<typeof commercialRelationshipTypeSchema>;
