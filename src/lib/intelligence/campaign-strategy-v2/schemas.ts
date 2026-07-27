import { z } from "zod";
import { intelligenceClaimSchema } from "../contracts/claims.ts";
import { intelligenceRuleSchema } from "../contracts/rules.ts";

const keySchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const confidenceSchema = z.number().min(0).max(1);

export const campaignRelationshipTypeSchema = z.enum([
  "direct_buyer",
  "end_user_customer",
  "distributor",
  "reseller",
  "channel_partner",
  "implementation_partner",
  "integration_partner",
  "referral_partner",
  "supplier",
  "strategic_partner",
  "marketplace_participant",
  "acquisition_target",
  "investor_target",
  "competitor",
  "other",
]);

export const campaignObjectiveV2Schema = z
  .object({
    code: z.enum([
      "direct_buyer",
      "end_user_customer",
      "distributor",
      "reseller",
      "channel_partner",
      "implementation_partner",
      "referral_partner",
      "supplier",
      "strategic_partner",
      "custom",
    ]),
    label: z.string().min(1),
    description: z.string().min(1).max(1200),
    targetRelationshipTypes: z.array(campaignRelationshipTypeSchema).min(1),
    normallyExcludedRelationshipTypes: z.array(campaignRelationshipTypeSchema),
    customDefinition: z.string().min(1).optional(),
    userConfirmed: z.boolean(),
  })
  .strict()
  .superRefine((objective, context) => {
    if (objective.code === "custom" && !objective.customDefinition) {
      context.addIssue({
        code: "custom",
        path: ["customDefinition"],
        message: "Custom objectives require a structured definition.",
      });
    }
    const target = new Set(objective.targetRelationshipTypes);
    if (
      objective.normallyExcludedRelationshipTypes.some((relationship) =>
        target.has(relationship),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["normallyExcludedRelationshipTypes"],
        message: "A target relationship cannot also be normally excluded.",
      });
    }
  });

export const campaignGeographyV2Schema = z
  .object({
    mode: z.enum(["country", "multi_country", "region", "subregion"]),
    displayName: z.string().min(1),
    countryCodes: z.array(z.string().length(2)).min(1),
    includedRegions: z.array(z.string()).default([]),
    includedCities: z.array(z.string()).default([]),
    excludedRegions: z.array(z.string()).default([]),
    excludedCities: z.array(z.string()).default([]),
    localLanguages: z.array(z.string()).default([]),
    workingLanguages: z.array(z.string()).min(1),
    requireLocalEntity: z.boolean().optional(),
    requireLocalOperations: z.boolean().optional(),
    allowCrossBorderProcurement: z.boolean().optional(),
    userConfirmed: z.boolean(),
  })
  .strict();

export const campaignOfferingReferenceV2Schema = z
  .object({
    companyProfileVersionId: z.string().min(1),
    offeringId: z.string().min(1),
    offeringVersionId: z.string().min(1),
  })
  .strict();

export const campaignOfferVariantV2Schema = z
  .object({
    baseOfferingVersionId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    includedCapabilities: z.array(z.string()),
    excludedCapabilities: z.array(z.string()),
    campaignSpecificConstraints: z.array(intelligenceRuleSchema),
    differsFromProfile: z.boolean(),
    shouldProposeProfileUpdate: z.boolean(),
  })
  .strict();

export const campaignSignalDefinitionSchema = z
  .object({
    key: keySchema,
    label: z.string().min(1),
    description: z.string().min(1),
    class: z.enum([
      "positive",
      "negative",
      "disqualifying",
      "trigger",
      "capability",
      "relationship",
    ]),
    expectedEvidenceTypes: z.array(z.string()).min(1),
    reliability: z.enum(["high", "medium", "low"]),
    requiredForQualification: z.boolean(),
  })
  .strict();

export const campaignRuleConditionSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "in",
      "not_in",
      "exists",
      "not_exists",
      "greater_than",
      "less_than",
    ]),
    value: z.unknown().optional(),
  })
  .strict();

export const campaignResearchQuestionSchema = z
  .object({
    questionKey: keySchema,
    question: z.string().min(1),
    importance: z.enum(["critical", "important", "supporting"]),
    acceptedEvidenceTypes: z.array(z.string()).min(1),
    unknownAction: z.enum([
      "lower_confidence",
      "requires_research",
      "conditional_review",
    ]),
  })
  .strict();

export const campaignArchetypeV2Schema = z
  .object({
    id: z.string().min(1),
    strategyVersionId: z.string().min(1),
    label: z.string().min(1),
    priority: z.enum(["priority", "conditional", "exploratory", "incompatible"]),
    relationshipType: campaignRelationshipTypeSchema,
    organizationRoles: z.array(z.string()).min(1),
    businessModels: z.array(z.string()),
    industries: z.array(z.string()).default([]),
    useModes: z.array(
      z.enum(["use", "consume", "resell", "distribute", "integrate", "refer"]),
    ),
    description: z.string().min(1),
    commercialRationale: z.string().min(1),
    requiredConditions: z.array(campaignRuleConditionSchema),
    preferredConditions: z.array(campaignRuleConditionSchema),
    negativeConditions: z.array(campaignRuleConditionSchema),
    exclusionConditions: z.array(campaignRuleConditionSchema),
    positiveSignals: z.array(campaignSignalDefinitionSchema),
    negativeSignals: z.array(campaignSignalDefinitionSchema),
    requiredEvidenceQuestions: z.array(campaignResearchQuestionSchema),
    confidence: confidenceSchema,
    userConfirmed: z.boolean(),
  })
  .strict()
  .superRefine((archetype, context) => {
    if (
      archetype.priority === "conditional" &&
      archetype.requiredConditions.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredConditions"],
        message: "Conditional archetypes require an explicit condition.",
      });
    }
    if (archetype.priority === "priority" && !archetype.commercialRationale.trim()) {
      context.addIssue({
        code: "custom",
        path: ["commercialRationale"],
        message: "Priority archetypes require a commercial rationale.",
      });
    }
  });

export const campaignFactorDefinitionSchema = z
  .object({
    factorKey: keySchema,
    label: z.string().min(1),
    definition: z.string().min(1),
    weight: z.number().min(0).max(100),
    criticality: z.enum(["critical", "important", "supporting"]),
    positiveDefinition: z.string().min(1),
    negativeDefinition: z.string().min(1),
    unknownPolicy: z.enum(["confidence_only", "requires_research", "gate_if_critical"]),
    acceptedEvidenceTypes: z.array(z.string()).min(1),
  })
  .strict();

export const campaignQualificationPolicyV2Schema = z
  .object({
    relationshipTaxonomy: z.array(campaignRelationshipTypeSchema).min(1),
    factorDefinitions: z.array(campaignFactorDefinitionSchema).min(1),
    hardExclusionRules: z.array(intelligenceRuleSchema),
    eligibilityRules: z.array(intelligenceRuleSchema),
    minimumEvidenceRequirements: z.array(campaignResearchQuestionSchema),
    unknownHandling: z.enum([
      "lower_confidence",
      "requires_research",
      "conditional_review",
    ]),
    qualificationThresholds: z
      .object({
        recommendedFit: z.number().min(0).max(100).optional(),
        minimumConfidence: confidenceSchema.optional(),
        minimumEvidenceCoverage: confidenceSchema.optional(),
      })
      .strict(),
    rankingObjectives: z
      .array(
        z.enum([
          "commercial_fit",
          "commercial_potential",
          "confidence",
          "strategic_priority",
        ]),
      )
      .min(1),
  })
  .strict()
  .superRefine((policy, context) => {
    const totalWeight = policy.factorDefinitions.reduce(
      (total, factor) => total + factor.weight,
      0,
    );
    if (Math.abs(totalWeight - 100) > 0.001) {
      context.addIssue({
        code: "custom",
        path: ["factorDefinitions"],
        message: "Qualification factor weights must total 100.",
      });
    }
    if (
      policy.hardExclusionRules.some(
        (rule) => rule.ruleType !== "hard_exclusion" || rule.strength !== "hard",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["hardExclusionRules"],
        message: "Hard-exclusion policy entries must be hard exclusion rules.",
      });
    }
  });

export const campaignSourcePlanV2Schema = z
  .object({
    primaryProviderTypes: z.array(z.string()).min(1),
    supportingProviderTypes: z.array(z.string()),
    verificationProviderTypes: z.array(z.string()).min(1),
    providerRationale: z.array(
      z
        .object({
          providerType: z.string().min(1),
          segmentIds: z.array(z.string()).min(1),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    currentEnabledProviders: z.array(z.string()),
    missingProviderCapabilities: z.array(z.string()),
  })
  .strict();

export const campaignCoverageTargetSchema = z
  .object({
    minimumUniqueCandidates: z.number().int().positive().optional(),
    minimumPlausibleCandidates: z.number().int().positive().optional(),
    minimumQualifiedCandidates: z.number().int().positive().optional(),
    targetGeographyCoverage: confidenceSchema.optional(),
    targetArchetypeCoverage: confidenceSchema.optional(),
    maximumDuplicateRate: confidenceSchema.optional(),
  })
  .strict();

export const campaignStoppingPolicySchema = z
  .object({
    stopWhenAny: z.array(
      z.enum([
        "target_qualified_volume_reached",
        "market_exhaustion_detected",
        "marginal_yield_below_threshold",
        "budget_limit_reached",
        "time_limit_reached",
      ]),
    ),
    maximumDiscoveryPasses: z.number().int().min(1).max(10),
    maximumProviderCost: z.number().nonnegative().optional(),
    maximumRunMinutes: z.number().int().positive().optional(),
    minimumMarginalQualifiedYield: confidenceSchema.optional(),
  })
  .strict();

export const discoverySegmentRequestV2Schema = z
  .object({
    id: z.string().min(1),
    strategyVersionId: z.string().min(1),
    archetypeId: z.string().min(1),
    label: z.string().min(1),
    rationale: z.string().min(1),
    geography: campaignGeographyV2Schema,
    businessCharacteristics: z
      .object({
        organizationRoles: z.array(z.string()).min(1),
        businessModels: z.array(z.string()),
        industries: z.array(z.string()).default([]),
        keywords: z.array(z.string()).default([]),
        sizeRange: z
          .object({
            minEmployees: z.number().int().positive().optional(),
            maxEmployees: z.number().int().positive().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    relationshipType: campaignRelationshipTypeSchema,
    useModes: z.array(z.string()),
    positiveSignals: z.array(campaignSignalDefinitionSchema),
    negativeSignals: z.array(campaignSignalDefinitionSchema),
    exclusionRules: z.array(intelligenceRuleSchema),
    targetCandidateCount: z.number().int().positive().optional(),
    priority: z.number().int().min(1).max(100),
    explorationBudgetClass: z.enum(["low", "medium", "high"]),
  })
  .strict()
  .superRefine((segment, context) => {
    const range = segment.businessCharacteristics.sizeRange;
    if (
      range?.minEmployees !== undefined &&
      range.maxEmployees !== undefined &&
      range.minEmployees > range.maxEmployees
    ) {
      context.addIssue({
        code: "custom",
        path: ["businessCharacteristics", "sizeRange"],
        message: "Employee range minimum must not exceed maximum.",
      });
    }
  });

export const campaignStrategyV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().min(1),
    campaignId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    status: z.enum(["draft", "review", "confirmed", "superseded", "cancelled"]),
    companyProfileVersionId: z.string().min(1),
    offeringReferences: z.array(campaignOfferingReferenceV2Schema).min(1),
    offerVariant: campaignOfferVariantV2Schema.optional(),
    objective: campaignObjectiveV2Schema,
    geography: campaignGeographyV2Schema,
    strategySummary: z.string().min(1),
    archetypes: z.array(campaignArchetypeV2Schema).min(1),
    qualificationPolicy: campaignQualificationPolicyV2Schema,
    campaignRules: z.array(intelligenceRuleSchema),
    assumptions: z.array(intelligenceClaimSchema),
    unresolvedQuestions: z.array(campaignResearchQuestionSchema),
    sourcePlan: campaignSourcePlanV2Schema,
    discoverySegments: z.array(discoverySegmentRequestV2Schema).min(1),
    coverageTarget: campaignCoverageTargetSchema,
    stoppingPolicy: campaignStoppingPolicySchema,
    memorySnapshotId: z.string().min(1),
    userConfirmation: z
      .object({
        confirmed: z.boolean(),
        confirmedByUserId: z.string().min(1).optional(),
        confirmedAt: z.string().datetime().optional(),
      })
      .strict(),
    legacyImport: z
      .object({
        sourceStrategyVersion: z.number().int().positive(),
        requiresUserReview: z.literal(true),
        warnings: z.array(z.string()).min(1),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((strategy, context) => {
    const archetypeIds = new Set(strategy.archetypes.map((item) => item.id));
    if (archetypeIds.size !== strategy.archetypes.length) {
      context.addIssue({
        code: "custom",
        path: ["archetypes"],
        message: "Campaign archetype IDs must be unique.",
      });
    }
    if (!strategy.archetypes.some((item) => item.priority === "priority")) {
      context.addIssue({
        code: "custom",
        path: ["archetypes"],
        message: "A strategy requires at least one priority archetype.",
      });
    }
    for (const segment of strategy.discoverySegments) {
      if (!archetypeIds.has(segment.archetypeId)) {
        context.addIssue({
          code: "custom",
          path: ["discoverySegments"],
          message: `Discovery segment references unknown archetype ${segment.archetypeId}.`,
        });
      }
      const archetype = strategy.archetypes.find(
        (item) => item.id === segment.archetypeId,
      );
      if (archetype?.priority === "incompatible") {
        context.addIssue({
          code: "custom",
          path: ["discoverySegments"],
          message: "Incompatible archetypes cannot receive discovery segments.",
        });
      }
    }
    if (
      strategy.offeringReferences.some(
        (reference) =>
          reference.companyProfileVersionId !== strategy.companyProfileVersionId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["offeringReferences"],
        message: "Offering references must belong to the frozen profile version.",
      });
    }
    if (strategy.status === "confirmed") {
      if (
        !strategy.objective.userConfirmed ||
        !strategy.geography.userConfirmed ||
        !strategy.userConfirmation.confirmed
      ) {
        context.addIssue({
          code: "custom",
          path: ["userConfirmation"],
          message: "Confirmed strategies require explicit user confirmation.",
        });
      }
      if (strategy.legacyImport) {
        context.addIssue({
          code: "custom",
          path: ["legacyImport"],
          message: "Legacy imports require review before confirmation.",
        });
      }
    }
  });

export type CampaignStrategyV2 = z.infer<typeof campaignStrategyV2Schema>;
