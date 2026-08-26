import { z } from "zod";
import { intelligenceClaimSchema } from "../contracts/claims.ts";
import { commercialRelationshipTypeSchema } from "./commercial-intelligence.ts";
import {
  confidenceSchema,
  referenceIdSchema,
  signalSchema,
  unknownSchema,
} from "./shared.ts";
import { intelligenceArtifactVersionSchema } from "./versioning.ts";

export const companyIntelligenceSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    organizationId: referenceIdSchema,
    identity: z
      .object({
        canonicalName: z.string().min(1).max(300),
        aliases: z.array(z.string().min(1).max(300)).default([]),
        officialDomain: z.string().min(3).max(253).nullable(),
        officialWebsite: z.url().nullable(),
        identityConfidence: confidenceSchema,
        identityReviewState: z.enum([
          "confirmed",
          "probable",
          "unresolved",
          "conflicting",
          "invalid",
        ]),
      })
      .strict(),
    businessModel: z.array(z.string().min(1).max(600)).default([]),
    organizationRoles: z.array(commercialRelationshipTypeSchema).default([]),
    industries: z.array(z.string().min(1).max(240)).default([]),
    productsServices: z.array(z.string().min(1).max(600)).default([]),
    operations: z.array(z.string().min(1).max(600)).default([]),
    operatingGeographies: z.array(z.string().min(1).max(240)).default([]),
    scale: z.array(z.string().min(1).max(400)).default([]),
    locations: z.array(z.string().min(1).max(400)).default([]),
    facilities: z.array(z.string().min(1).max(400)).default([]),
    customerTypes: z.array(z.string().min(1).max(400)).default([]),
    operationalCharacteristics: z.array(z.string().min(1).max(600)).default([]),
    offeringUseCompatibility: z.array(signalSchema).default([]),
    procurementCharacteristics: z.array(z.string().min(1).max(600)).default([]),
    relevantCapabilities: z.array(z.string().min(1).max(600)).default([]),
    positiveSignals: z.array(signalSchema).default([]),
    negativeSignals: z.array(signalSchema).default([]),
    contradictions: z.array(z.string().min(1).max(600)).default([]),
    unknowns: z.array(unknownSchema).default([]),
    claims: z.array(intelligenceClaimSchema).default([]),
    evidenceIds: z.array(referenceIdSchema).max(200).default([]),
    researchBlueprintVersionIds: z.array(referenceIdSchema).min(1),
    confidence: confidenceSchema,
    version: intelligenceArtifactVersionSchema,
  })
  .strict()
  .superRefine((intelligence, context) => {
    if (
      (intelligence.identity.officialDomain === null) !==
      (intelligence.identity.officialWebsite === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["identity"],
        message: "Official domain and website must be resolved or unresolved together.",
      });
    }
  });

export type CompanyIntelligence = z.infer<typeof companyIntelligenceSchema>;
