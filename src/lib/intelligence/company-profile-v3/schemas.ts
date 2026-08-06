import { z } from "zod";
import { intelligenceRuleSchema } from "../contracts/rules.ts";

const keySchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const confidenceSchema = z.number().min(0).max(1);
const evidenceIdsSchema = z.array(z.string().min(1)).max(50).default([]);

export const companyLocationSchema = z
  .object({
    countryCode: z.string().min(2).max(3),
    region: z.string().optional(),
    city: z.string().optional(),
  })
  .strict();

export const geographyRefSchema = z
  .object({
    code: z.string().min(2),
    label: z.string().min(1),
    level: z.enum(["country", "region", "city", "global"]),
  })
  .strict();

export const workspaceCompanyIdentityV3Schema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    publicName: z.string().min(1),
    legalName: z.string().optional(),
    tradingNames: z.array(z.string()).default([]),
    brands: z.array(z.string()).default([]),
    canonicalDomain: z.string().min(1),
    additionalDomains: z.array(z.string()).default([]),
    headquarters: companyLocationSchema.optional(),
    operatingLocations: z.array(companyLocationSchema).default([]),
    marketsServed: z.array(geographyRefSchema).default([]),
    parentCompanyName: z.string().optional(),
    legalEntityIds: z.array(z.string()).optional(),
    primaryLanguage: z.string().optional(),
    supportedLanguages: z.array(z.string()).default([]),
  })
  .strict();

export const commercialConstraintSchema = z
  .object({
    key: keySchema,
    statement: z.string().min(1).max(1200),
    scope: z.enum(["workspace", "offering"]),
    scopeId: z.string().min(1),
    strength: z.enum(["hard", "soft"]),
    status: z.enum(["proposed", "confirmed", "rejected", "superseded"]),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const businessRoleSchema = z
  .object({
    role: z.enum([
      "manufacturer",
      "software_provider",
      "service_provider",
      "consultancy",
      "agency",
      "wholesaler",
      "distributor",
      "reseller",
      "retailer",
      "marketplace",
      "integrator",
      "managed_service_provider",
      "logistics_provider",
      "broker",
      "other",
    ]),
    importance: z.enum(["primary", "secondary", "supporting"]),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
    explanation: z.string().min(1).max(1200),
  })
  .strict();

export const companyBusinessModelV3Schema = z
  .object({
    summary: z.string().max(1800),
    roles: z.array(businessRoleSchema),
    valueCreation: z.array(z.string()).default([]),
    valueDelivery: z.array(z.string()).default([]),
    valueCapture: z.array(z.string()).default([]),
    customerRelationshipModels: z.array(z.string()).default([]),
    salesMotions: z.array(z.string()).default([]),
    revenuePatterns: z.array(z.string()).default([]),
    sellsForOwnUse: z.boolean().nullable(),
    sellsForResale: z.boolean().nullable(),
    sellsThroughPartners: z.boolean().nullable(),
    directSalesImportance: z.enum(["low", "medium", "high", "unknown"]).optional(),
    channelSalesImportance: z.enum(["low", "medium", "high", "unknown"]).optional(),
    constraints: z.array(commercialConstraintSchema).default([]),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const commercialValueRangeSchema = z
  .object({
    minimum: z.number().nonnegative().optional(),
    maximum: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    unit: z.string().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.minimum === undefined ||
      value.maximum === undefined ||
      value.minimum <= value.maximum,
    "Commercial range minimum must not exceed maximum.",
  );

export const durationRangeSchema = z
  .object({
    minimum: z.number().nonnegative().optional(),
    maximum: z.number().nonnegative().optional(),
    unit: z.enum(["days", "weeks", "months"]),
  })
  .strict()
  .refine(
    (value) =>
      value.minimum === undefined ||
      value.maximum === undefined ||
      value.minimum <= value.maximum,
    "Duration minimum must not exceed maximum.",
  );

export const offeringCommercialMechanicsSchema = z
  .object({
    transactionModels: z.array(
      z.enum([
        "subscription",
        "one_time_purchase",
        "project_contract",
        "retainer",
        "recurring_order",
        "wholesale_order",
        "licence",
        "commission",
        "usage_based",
        "tender",
        "other",
      ]),
    ),
    purchaseMotion: z.enum([
      "self_service",
      "sales_assisted",
      "procurement_led",
      "partner_led",
      "tender_led",
      "mixed",
      "unknown",
    ]),
    customerUseMode: z.enum([
      "own_use",
      "resale",
      "distribution",
      "integration",
      "implementation_for_clients",
      "mixed",
      "unknown",
    ]),
    typicalRelationship: z.enum([
      "transactional",
      "recurring",
      "long_term_contract",
      "project_based",
      "channel_relationship",
      "mixed",
      "unknown",
    ]),
    pricingPosition: z
      .enum(["budget", "mid_market", "premium", "enterprise", "mixed", "unknown"])
      .optional(),
    minimumOrderOrContract: commercialValueRangeSchema.optional(),
    typicalOrderOrContract: commercialValueRangeSchema.optional(),
    salesCycle: durationRangeSchema.optional(),
    implementationRequired: z.boolean().nullable().optional(),
    onboardingRequired: z.boolean().nullable().optional(),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const buyerConditionSchema = z
  .object({
    key: keySchema,
    statement: z.string().min(1),
    conditionType: z.enum(["required", "preferred", "conditional", "incompatible"]),
    conditions: z.array(z.string()).default([]),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const buyerRoleHypothesisSchema = z
  .object({
    roleType: z.enum([
      "economic_buyer",
      "decision_maker",
      "operational_user",
      "technical_evaluator",
      "procurement",
      "champion",
      "beneficiary",
      "partner_owner",
      "other",
    ]),
    jobFunctions: z.array(z.string()),
    seniority: z.array(z.string()).optional(),
    department: z.array(z.string()).optional(),
    relevance: z.enum(["primary", "secondary", "conditional"]),
    conditions: z.array(z.string()).optional(),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const evidenceSignalSchema = z
  .object({
    key: keySchema,
    description: z.string().min(1),
    observableIn: z.array(z.string()).default([]),
  })
  .strict();

export const offeringBuyerLogicSchema = z
  .object({
    whyBuy: z.array(z.string()),
    buyingTriggers: z.array(
      z
        .object({
          key: keySchema,
          description: z.string().min(1),
          confidence: confidenceSchema,
          evidenceIds: evidenceIdsSchema,
        })
        .strict(),
    ),
    requiredCapabilities: z.array(buyerConditionSchema),
    preferredCharacteristics: z.array(buyerConditionSchema),
    incompatibleCharacteristics: z.array(buyerConditionSchema),
    buyerRoles: z.array(buyerRoleHypothesisSchema),
    procurementModel: z
      .object({
        motion: z.enum([
          "self_service",
          "department_purchase",
          "central_procurement",
          "tender",
          "partner_led",
          "unknown",
        ]),
        participants: z.array(z.string()).default([]),
        confidence: confidenceSchema,
        evidenceIds: evidenceIdsSchema,
      })
      .strict(),
    likelyAlternatives: z.array(z.string()),
    likelyObjections: z.array(z.string()),
    positiveEvidenceSignals: z.array(evidenceSignalSchema),
    negativeEvidenceSignals: z.array(evidenceSignalSchema),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const offeringRelationshipOptionSchema = z
  .object({
    relationshipType: z.enum([
      "direct_buyer",
      "end_user",
      "distributor",
      "reseller",
      "channel_partner",
      "implementation_partner",
      "integration_partner",
      "referral_partner",
      "supplier",
      "strategic_partner",
      "competitor",
      "other",
    ]),
    relevance: z.enum(["primary", "secondary", "possible", "avoid"]),
    rationale: z.string().min(1),
    requiredConditions: z.array(buyerConditionSchema),
    incompatibleConditions: z.array(buyerConditionSchema),
    confidence: confidenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const offeringIntelligenceV3Schema = z
  .object({
    id: z.string().min(1),
    profileVersionId: z.string().min(1),
    name: z.string().min(1),
    slug: keySchema,
    shortDescription: z.string().min(1),
    category: z.string().optional(),
    offeringType: z.enum([
      "physical_product",
      "digital_product",
      "software",
      "service",
      "managed_service",
      "project",
      "subscription",
      "wholesale_supply",
      "marketplace_access",
      "licence",
      "partnership_program",
      "other",
    ]),
    parentOfferingId: z.string().optional(),
    variants: z.array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    ),
    customerProblem: z.array(z.string()),
    promisedOutcomes: z.array(z.string()),
    useCases: z.array(z.string()),
    commercialMechanics: offeringCommercialMechanicsSchema,
    buyerLogic: offeringBuyerLogicSchema,
    relationshipOptions: z.array(offeringRelationshipOptionSchema),
    availability: z
      .object({
        geographies: z.array(geographyRefSchema).default([]),
        excludedGeographies: z.array(geographyRefSchema).default([]),
        notes: z.array(z.string()).default([]),
      })
      .strict(),
    constraints: z.array(commercialConstraintSchema),
    status: z.enum(["active", "inactive", "uncertain"]),
    confidence: confidenceSchema,
    claimIds: z.array(z.string()),
    evidenceIds: evidenceIdsSchema,
  })
  .strict()
  .superRefine((offering, context) => {
    if (offering.status === "active" && offering.relationshipOptions.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["relationshipOptions"],
        message: "Active offerings require at least one relationship option.",
      });
    }
    if (
      offering.commercialMechanics.customerUseMode === "own_use" &&
      offering.commercialMechanics.transactionModels.includes("wholesale_order")
    ) {
      context.addIssue({
        code: "custom",
        path: ["commercialMechanics", "customerUseMode"],
        message: "Own-use offerings cannot be wholesale-only without mixed use.",
      });
    }
  });

export const profileBuyerArchetypeSchema = z
  .object({
    id: z.string().min(1),
    offeringId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    relationshipType: z.string().min(1),
    priority: z.enum(["priority", "conditional", "low_priority", "avoid"]),
    businessRoles: z.array(z.string()),
    businessModels: z.array(z.string()),
    industries: z.array(z.string()),
    commercialNeed: z.array(z.string()),
    whyCompatible: z.array(z.string()),
    requiredConditions: z.array(buyerConditionSchema),
    preferredConditions: z.array(buyerConditionSchema),
    incompatibleConditions: z.array(buyerConditionSchema),
    positiveEvidenceSignals: z.array(evidenceSignalSchema),
    negativeEvidenceSignals: z.array(evidenceSignalSchema),
    likelyBuyerRoles: z.array(buyerRoleHypothesisSchema),
    status: z.enum(["proposed", "user_confirmed", "user_rejected", "superseded"]),
    confidence: confidenceSchema,
    claimIds: z.array(z.string()),
    evidenceIds: evidenceIdsSchema,
  })
  .strict()
  .superRefine((archetype, context) => {
    if (archetype.priority === "priority" && archetype.whyCompatible.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["whyCompatible"],
        message: "Priority archetypes require a compatibility rationale.",
      });
    }
  });

export const companyIntelligenceV3Schema = z
  .object({
    schemaVersion: z.literal(3),
    profileVersionId: z.string().min(1),
    status: z.enum(["draft", "published", "superseded", "archived"]),
    identity: workspaceCompanyIdentityV3Schema,
    businessModel: companyBusinessModelV3Schema,
    offerings: z.array(offeringIntelligenceV3Schema).max(12),
    buyerArchetypes: z.array(profileBuyerArchetypeSchema),
    rules: z.array(intelligenceRuleSchema),
    unresolvedCriticalConflictIds: z.array(z.string()).default([]),
    legacyImport: z
      .object({
        sourceSchemaVersion: z.literal(2),
        requiresUserReview: z.literal(true),
        warnings: z.array(z.string()),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((profile, context) => {
    const offeringIds = new Set(profile.offerings.map((offering) => offering.id));
    if (offeringIds.size !== profile.offerings.length) {
      context.addIssue({
        code: "custom",
        path: ["offerings"],
        message: "Duplicate offering IDs.",
      });
    }
    for (const archetype of profile.buyerArchetypes) {
      if (!offeringIds.has(archetype.offeringId)) {
        context.addIssue({
          code: "custom",
          path: ["buyerArchetypes"],
          message: `Archetype references unknown offering ${archetype.offeringId}.`,
        });
      }
    }
    for (const offering of profile.offerings) {
      if (offering.profileVersionId !== profile.profileVersionId) {
        context.addIssue({
          code: "custom",
          path: ["offerings"],
          message: `Offering ${offering.id} belongs to a different profile version.`,
        });
      }
    }
    if (profile.rules.some((rule) => !["workspace", "offering"].includes(rule.scope))) {
      context.addIssue({
        code: "custom",
        path: ["rules"],
        message: "Company Profile rules may use only workspace or offering scope.",
      });
    }
    if (profile.status === "published" && profile.legacyImport) {
      context.addIssue({
        code: "custom",
        path: ["legacyImport"],
        message: "A legacy-import draft cannot be published before user review.",
      });
    }
  });

export type CompanyIntelligenceV3 = z.infer<typeof companyIntelligenceV3Schema>;
export type OfferingIntelligenceV3 = z.infer<typeof offeringIntelligenceV3Schema>;
