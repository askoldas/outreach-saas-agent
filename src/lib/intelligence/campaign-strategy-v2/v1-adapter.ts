import type { CampaignStrategyVersion } from "@/types/domain";
import { campaignStrategyV2Schema, type CampaignStrategyV2 } from "./schemas.ts";

export function adaptV1StrategyToV2Draft(input: {
  campaignId: string;
  strategyDraftId: string;
  companyProfileVersionId: string;
  offeringId: string;
  offeringVersionId: string;
  memorySnapshotId: string;
  geography: {
    displayName: string;
    countryCodes: string[];
    workingLanguages: string[];
  };
  strategy: CampaignStrategyVersion;
}): CampaignStrategyV2 {
  const archetypeId = `${input.strategyDraftId}.legacy-primary`;
  const campaignRules = input.strategy.exclusions.map((exclusion, index) => ({
    ruleKey: `legacy-exclusion-${index + 1}`,
    label: exclusion,
    description: exclusion,
    ruleType: "soft_exclusion" as const,
    scope: "campaign" as const,
    strength: "soft" as const,
    applicability: {
      objectives: ["direct_buyer"],
      offeringIds: [input.offeringVersionId],
      geographies: input.geography.countryCodes,
      relationshipTypes: ["direct_buyer"],
      archetypeIds: [archetypeId],
    },
    status: "proposed" as const,
    source: "campaign" as const,
    evidenceIds: [],
    confidence: 0.25,
  }));
  const positiveSignals = input.strategy.positiveSignals.map((signal, index) => ({
    key: `legacy-positive-${index + 1}`,
    label: signal,
    description: signal,
    class: "positive" as const,
    expectedEvidenceTypes: ["company_public_source"],
    reliability: "low" as const,
    requiredForQualification: false,
  }));
  const geography = {
    mode:
      input.geography.countryCodes.length === 1
        ? ("country" as const)
        : ("multi_country" as const),
    displayName: input.geography.displayName,
    countryCodes: input.geography.countryCodes,
    includedRegions: [],
    includedCities: [],
    excludedRegions: [],
    excludedCities: [],
    localLanguages: [],
    workingLanguages: input.geography.workingLanguages,
    userConfirmed: false,
  };
  const strategy: CampaignStrategyV2 = {
    schemaVersion: 2,
    id: input.strategyDraftId,
    campaignId: input.campaignId,
    versionNumber: input.strategy.version,
    status: "review",
    companyProfileVersionId: input.companyProfileVersionId,
    offeringReferences: [
      {
        companyProfileVersionId: input.companyProfileVersionId,
        offeringId: input.offeringId,
        offeringVersionId: input.offeringVersionId,
      },
    ],
    objective: {
      code: "direct_buyer",
      label: "Direct buyer",
      description:
        "Provisional direct-buyer objective inferred from the legacy target strategy.",
      targetRelationshipTypes: ["direct_buyer"],
      normallyExcludedRelationshipTypes: ["competitor", "supplier"],
      userConfirmed: false,
    },
    geography,
    strategySummary:
      input.strategy.refinementSummary.join(" ") ||
      "Legacy strategy imported for structured review.",
    archetypes: [
      {
        id: archetypeId,
        strategyVersionId: input.strategyDraftId,
        label: input.strategy.companyTypes.join(", ") || "Legacy target organizations",
        priority: "priority",
        relationshipType: "direct_buyer",
        organizationRoles: input.strategy.companyTypes.length
          ? input.strategy.companyTypes
          : ["unknown"],
        businessModels: [],
        industries: input.strategy.industries,
        useModes: ["use"],
        description:
          input.strategy.characteristics.join("; ") ||
          "Legacy organization characteristics require review.",
        commercialRationale:
          input.strategy.relevanceReasons.join("; ") ||
          "Legacy relevance rationale requires user confirmation.",
        requiredConditions: input.strategy.qualificationCriteria.map((criterion) => ({
          field: "legacyQualificationCriterion",
          operator: "contains" as const,
          value: criterion,
        })),
        preferredConditions: [],
        negativeConditions: [],
        exclusionConditions: input.strategy.exclusions.map((exclusion) => ({
          field: "legacyExclusion",
          operator: "contains" as const,
          value: exclusion,
        })),
        positiveSignals,
        negativeSignals: [],
        requiredEvidenceQuestions: [
          {
            questionKey: "legacy-commercial-compatibility",
            question:
              "What observable evidence proves that this organization can buy the selected offering?",
            importance: "critical",
            acceptedEvidenceTypes: ["company_public_source"],
            unknownAction: "requires_research",
          },
        ],
        confidence: 0.25,
        userConfirmed: false,
      },
    ],
    qualificationPolicy: {
      relationshipTaxonomy: ["direct_buyer", "competitor", "supplier"],
      factorDefinitions: [
        factor(
          "relationship-compatibility",
          "Relationship compatibility",
          40,
          "The organization can act as a direct buyer.",
        ),
        factor(
          "commercial-need",
          "Commercial need",
          35,
          "The organization has a supported need for the offering.",
        ),
        factor(
          "evidence-quality",
          "Evidence quality",
          25,
          "Material conclusions are supported by reliable evidence.",
        ),
      ],
      hardExclusionRules: [],
      eligibilityRules: campaignRules,
      minimumEvidenceRequirements: [
        {
          questionKey: "legacy-buyer-evidence",
          question: "Is there public evidence of buyer compatibility?",
          importance: "critical",
          acceptedEvidenceTypes: ["company_public_source"],
          unknownAction: "requires_research",
        },
      ],
      unknownHandling: "requires_research",
      qualificationThresholds: {},
      rankingObjectives: ["commercial_fit", "confidence"],
    },
    campaignRules,
    assumptions: input.strategy.opportunityAssumptions.map((assumption, index) => ({
      claimId: `legacy-assumption-${index + 1}`,
      fieldPath: "campaign.assumptions",
      statement: assumption,
      epistemicStatus: "hypothesis",
      confidence: 0.2,
      evidenceIds: [],
      counterEvidenceIds: [],
    })),
    unresolvedQuestions: [
      {
        questionKey: "confirm-legacy-objective",
        question:
          "Confirm the commercial objective and target relationship inferred from the legacy strategy.",
        importance: "critical",
        acceptedEvidenceTypes: ["user_confirmation"],
        unknownAction: "conditional_review",
      },
    ],
    sourcePlan: {
      primaryProviderTypes: ["web_search"],
      supportingProviderTypes: [],
      verificationProviderTypes: ["company_website"],
      providerRationale: [
        {
          providerType: "web_search",
          segmentIds: [`${input.strategyDraftId}.legacy-segment`],
          reason: "Preserves broad legacy discovery intent without carrying raw queries.",
        },
      ],
      currentEnabledProviders: ["web_search", "company_website"],
      missingProviderCapabilities: ["structured_company_database"],
    },
    discoverySegments: [
      {
        id: `${input.strategyDraftId}.legacy-segment`,
        strategyVersionId: input.strategyDraftId,
        archetypeId,
        label: "Legacy target segment",
        rationale:
          "Provider-neutral segment compiled from the legacy organization target.",
        geography,
        businessCharacteristics: {
          organizationRoles: input.strategy.companyTypes.length
            ? input.strategy.companyTypes
            : ["unknown"],
          businessModels: [],
          industries: input.strategy.industries,
          keywords: input.strategy.characteristics,
        },
        relationshipType: "direct_buyer",
        useModes: ["use"],
        positiveSignals,
        negativeSignals: [],
        exclusionRules: campaignRules,
        targetCandidateCount: input.strategy.targetCompanyCount || undefined,
        priority: 50,
        explorationBudgetClass: "low",
      },
    ],
    coverageTarget: {
      minimumQualifiedCandidates:
        input.strategy.targetCompanyCount > 0
          ? input.strategy.targetCompanyCount
          : undefined,
    },
    stoppingPolicy: {
      stopWhenAny: [
        "target_qualified_volume_reached",
        "market_exhaustion_detected",
        "marginal_yield_below_threshold",
      ],
      maximumDiscoveryPasses: 3,
      minimumMarginalQualifiedYield: 0.05,
    },
    memorySnapshotId: input.memorySnapshotId,
    userConfirmation: { confirmed: false },
    legacyImport: {
      sourceStrategyVersion: input.strategy.version,
      requiresUserReview: true,
      warnings: [
        "Legacy flat targeting was converted into a provisional direct-buyer hypothesis.",
        "Legacy search terms were intentionally not copied into provider-neutral discovery segments.",
        "Legacy exclusions remain soft and campaign-scoped until reviewed.",
      ],
    },
  };
  return campaignStrategyV2Schema.parse(strategy);
}

function factor(key: string, label: string, weight: number, definition: string) {
  return {
    factorKey: key,
    label,
    definition,
    weight,
    criticality:
      key === "relationship-compatibility"
        ? ("critical" as const)
        : ("important" as const),
    positiveDefinition: definition,
    negativeDefinition: `Evidence contradicts: ${definition}`,
    unknownPolicy:
      key === "relationship-compatibility"
        ? ("gate_if_critical" as const)
        : ("requires_research" as const),
    acceptedEvidenceTypes: ["company_public_source"],
  };
}
