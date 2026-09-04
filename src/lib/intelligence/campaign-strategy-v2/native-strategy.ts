import type { ConfirmedCampaignBrief } from "@/lib/campaign-workflow/contracts";
import type { TargetSegment } from "@/lib/campaign-workflow/target-segments";
import type { IntelligenceRule } from "../contracts/rules.ts";
import {
  nativeCampaignStrategyEntryContract,
  type CampaignPlanningArchetype,
  type CampaignPlanningOffering,
} from "./planning-profile.ts";
import {
  campaignStrategyV2Schema,
  type CampaignGeographyV2,
  type CampaignObjectiveV2,
  type CampaignStrategyV2,
} from "./schemas.ts";

export function buildNativeCampaignStrategyV2(input: {
  campaignId: string;
  strategyDraftId: string;
  profileVersionId: string;
  offering: CampaignPlanningOffering;
  confirmedBrief: ConfirmedCampaignBrief;
  objectiveCode: string;
  geography: CampaignGeographyV2;
  applicableProfileRules: IntelligenceRule[];
}): CampaignStrategyV2 {
  const objectiveCode = resolveCampaignObjective(input.objectiveCode);
  const objective: CampaignObjectiveV2 = {
    code: objectiveCode,
    label: objectiveLabel(objectiveCode),
    description: input.confirmedBrief.targetClient.summary,
    targetRelationshipTypes: [objectiveCode],
    normallyExcludedRelationshipTypes: (["competitor", "supplier"] as const).filter(
      (relationship) => relationship !== objectiveCode,
    ),
    userConfirmed: true,
  };
  const confirmedSegments = input.confirmedBrief.targetSegments.filter(
    (segment) => segment.status === "confirmed",
  );
  if (!confirmedSegments.length) {
    throw new Error("Confirm at least one organization target before strategy creation.");
  }
  const profileArchetypes = input.offering.archetypes.filter(
    (archetype) =>
      archetype.status !== "user_rejected" &&
      archetype.status !== "superseded" &&
      archetype.priority !== "avoid",
  );
  const campaignRules = uniqueRules([
    ...input.applicableProfileRules,
    ...campaignExclusionRules({
      exclusions: unique([
        ...input.confirmedBrief.targetClient.exclusions,
        ...confirmedSegments.flatMap((segment) => segment.exclusions),
      ]),
      objectiveCode,
      offeringVersionId: input.offering.offeringVersionId,
      geography: input.geography.countryCodes,
    }),
  ]);
  const archetypes = confirmedSegments.map((segment, index) => {
    const matchedProfileArchetype = bestProfileArchetype(
      profileArchetypes,
      segment,
      objectiveCode,
    );
    const archetypeId = `${input.strategyDraftId}.archetype.${key(
      segment.id || String(index + 1),
    )}`;
    const positiveSignalValues = unique([
      ...segment.buyingSignals,
      ...input.offering.buyerLogic.likelyTriggers,
      ...(matchedProfileArchetype?.positiveSignals ?? []),
      ...input.offering.commercialMechanics.expectedOutcomes,
    ]);
    const negativeSignalValues = unique([
      ...input.offering.buyerLogic.incompatibleConditions,
      ...(matchedProfileArchetype?.negativeSignals ?? []),
    ]);
    const requiredEvidence = unique([
      ...input.confirmedBrief.targetClient.requiredCriteria,
      ...(matchedProfileArchetype?.requiredEvidence ?? []),
    ]);
    return {
      id: archetypeId,
      strategyVersionId: input.strategyDraftId,
      label: segment.name,
      priority: index === 0 ? ("priority" as const) : ("exploratory" as const),
      relationshipType: objectiveCode,
      organizationRoles: segment.organizationTypes.length
        ? segment.organizationTypes
        : ["commercial organization"],
      businessModels: [],
      industries: segment.industries,
      useModes: [useModeForObjective(objectiveCode)],
      description: segment.summary,
      commercialRationale: unique([
        segment.rationale,
        ...(matchedProfileArchetype?.whyCompatible ?? []),
        ...input.offering.buyerLogic.whyBuy,
      ]).join(" "),
      requiredConditions: unique([
        ...input.confirmedBrief.targetClient.requiredCriteria,
        ...segment.characteristics,
        ...input.offering.buyerLogic.requiredConditions,
      ]).map((value) => condition("commercialFit", value)),
      preferredConditions: unique([
        ...input.offering.buyerLogic.preferredConditions,
        ...segment.buyingSignals,
      ]).map((value) => condition("preferredCommercialFit", value)),
      negativeConditions: negativeSignalValues.map((value) =>
        condition("negativeCommercialSignal", value),
      ),
      exclusionConditions: segment.exclusions.map((value) =>
        condition("campaignExclusion", value),
      ),
      positiveSignals: signals(positiveSignalValues, "positive", "positive"),
      negativeSignals: signals(negativeSignalValues, "negative", "negative"),
      requiredEvidenceQuestions: evidenceQuestions(requiredEvidence, index),
      evidenceIds: unique(matchedProfileArchetype?.evidenceIds ?? []),
      confidence: confidenceNumber(segment.confidence),
      userConfirmed: true,
    };
  });
  const archetypeIds = archetypes.map((archetype) => archetype.id);
  const discoverySegments = archetypes.map((archetype, index) => {
    const segment = confirmedSegments[index]!;
    return {
      id: `${input.strategyDraftId}.segment.${key(segment.id || String(index + 1))}`,
      strategyVersionId: input.strategyDraftId,
      archetypeId: archetype.id,
      label: segment.name,
      rationale: segment.rationale,
      geography: input.geography,
      businessCharacteristics: {
        organizationRoles: archetype.organizationRoles,
        businessModels: archetype.businessModels,
        industries: archetype.industries,
        keywords: unique([
          ...segment.characteristics,
          ...segment.buyingSignals,
          input.offering.name,
        ]),
        ...(segment.companySize
          ? {
              sizeRange: {
                ...(segment.companySize.minimumEmployees
                  ? { minEmployees: segment.companySize.minimumEmployees }
                  : {}),
                ...(segment.companySize.maximumEmployees
                  ? { maxEmployees: segment.companySize.maximumEmployees }
                  : {}),
              },
            }
          : {}),
      },
      relationshipType: objectiveCode,
      useModes: archetype.useModes,
      positiveSignals: archetype.positiveSignals,
      negativeSignals: archetype.negativeSignals,
      exclusionRules: campaignRules,
      priority: Math.max(1, 100 - index * 10),
      explorationBudgetClass: index === 0 ? ("high" as const) : ("medium" as const),
    };
  });
  const requiredEvidence = [
    ...(input.geography.countryCodes.includes("WORLDWIDE")
      ? []
      : [
          {
            questionKey: "target_geography",
            question:
              `Is there reliable public evidence that the organization is legally based in or demonstrably operates in ${input.geography.displayName} ` +
              `(${input.geography.countryCodes.join(", ")})?`,
            importance: "critical" as const,
            acceptedEvidenceTypes: [
              "company_website",
              "official_document",
              "legal_registry",
              "reliable_public_source",
            ],
            unknownAction: "requires_research" as const,
          },
        ]),
    {
      questionKey: "relationship-compatibility",
      question: `Is there reliable public evidence that the organization can act as a ${objectiveCode.replaceAll("_", " ")} for ${input.offering.name}?`,
      importance: "critical" as const,
      acceptedEvidenceTypes: ["company_website", "reliable_public_source"],
      unknownAction: "requires_research" as const,
    },
    {
      questionKey: "offering-need",
      question: `Is there evidence of a need, use case, or trigger for ${input.offering.name}?`,
      importance: "important" as const,
      acceptedEvidenceTypes: ["company_website", "reliable_public_source"],
      unknownAction: "lower_confidence" as const,
    },
  ];
  return campaignStrategyV2Schema.parse({
    schemaVersion: 2,
    creationContract: nativeCampaignStrategyEntryContract,
    id: input.strategyDraftId,
    campaignId: input.campaignId,
    versionNumber: 1,
    status: "review",
    companyProfileVersionId: input.profileVersionId,
    offeringReferences: [
      {
        companyProfileVersionId: input.profileVersionId,
        offeringId: input.offering.offeringId,
        offeringVersionId: input.offering.offeringVersionId,
      },
    ],
    objective,
    geography: input.geography,
    strategySummary: input.confirmedBrief.targetClient.summary,
    archetypes,
    qualificationPolicy: {
      relationshipTaxonomy: unique([
        objectiveCode,
        "competitor",
        "supplier",
      ] as CampaignStrategyV2["qualificationPolicy"]["relationshipTaxonomy"]),
      factorDefinitions: [
        factor(
          "relationship-compatibility",
          "Relationship compatibility",
          input.geography.countryCodes.includes("WORLDWIDE") ? 40 : 30,
          `The organization can act as a ${objectiveCode.replaceAll("_", " ")}.`,
          "critical",
        ),
        factor(
          "offering-need",
          "Offering need and use fit",
          input.geography.countryCodes.includes("WORLDWIDE") ? 35 : 25,
          `The organization has a supported need or use case for ${input.offering.name}.`,
          "important",
        ),
        ...(input.geography.countryCodes.includes("WORLDWIDE")
          ? []
          : [
              factor(
                "target_geography",
                `Presence in ${input.geography.displayName}`,
                25,
                `The organization is legally based in or demonstrably operates in ${input.geography.displayName} (${input.geography.countryCodes.join(", ")}).`,
                "critical",
              ),
            ]),
        factor(
          "evidence-quality",
          "Evidence quality",
          input.geography.countryCodes.includes("WORLDWIDE") ? 25 : 20,
          "Material commercial conclusions are supported by reliable public evidence.",
          "important",
        ),
      ],
      hardExclusionRules: campaignRules.filter(
        (rule) => rule.ruleType === "hard_exclusion" && rule.strength === "hard",
      ),
      eligibilityRules: campaignRules,
      minimumEvidenceRequirements: requiredEvidence,
      unknownHandling: "requires_research",
      qualificationThresholds: {
        recommendedFit: 70,
        minimumConfidence: 0.55,
        minimumEvidenceCoverage: 0.5,
      },
      rankingObjectives: ["commercial_fit", "confidence"],
    },
    campaignRules,
    assumptions: profileArchetypes.slice(0, 5).map((archetype, index) => ({
      claimId: `profile-buyer-hypothesis-${index + 1}`,
      fieldPath: `profile.offerings.${input.offering.stableKey}.buyerArchetypes`,
      statement:
        archetype.whyCompatible.join(" ") ||
        `${archetype.name} may be commercially compatible with ${input.offering.name}.`,
      epistemicStatus: "hypothesis",
      confidence: archetype.confidence,
      evidenceIds: archetype.evidenceIds,
      counterEvidenceIds: [],
      conciseRationale: archetype.description,
    })),
    unresolvedQuestions: [],
    sourcePlan: {
      primaryProviderTypes: ["web_search"],
      supportingProviderTypes: ["public_business_directory"],
      verificationProviderTypes: ["company_website"],
      providerRationale: [
        {
          providerType: "web_search",
          segmentIds: discoverySegments.map((segment) => segment.id),
          reason:
            "Broad discovery is followed by first-party website verification against the confirmed target strategy.",
        },
      ],
      currentEnabledProviders: ["web_search", "company_website"],
      missingProviderCapabilities: ["structured_company_database"],
    },
    discoverySegments,
    coverageTarget: {
      targetArchetypeCoverage: archetypeIds.length > 1 ? 0.75 : 1,
      maximumDuplicateRate: 0.25,
    },
    stoppingPolicy: {
      stopWhenAny: [
        "target_qualified_volume_reached",
        "market_exhaustion_detected",
        "marginal_yield_below_threshold",
      ],
      maximumDiscoveryPasses: 10,
      maximumRunMinutes: 45,
      minimumMarginalQualifiedYield: 0.05,
    },
    memorySnapshotId: `${input.campaignId}.memory.pending`,
    userConfirmation: { confirmed: false },
  });
}

export function resolveCampaignObjective(value: string) {
  const supported = [
    "direct_buyer",
    "end_user_customer",
    "distributor",
    "reseller",
    "channel_partner",
    "implementation_partner",
    "referral_partner",
    "supplier",
    "strategic_partner",
  ] as const;
  return supported.find((candidate) => candidate === value) ?? "direct_buyer";
}

function objectiveLabel(value: ReturnType<typeof resolveCampaignObjective>) {
  return `Find ${value.replaceAll("_", " ")}`;
}

function campaignExclusionRules(input: {
  exclusions: string[];
  objectiveCode: ReturnType<typeof resolveCampaignObjective>;
  offeringVersionId: string;
  geography: string[];
}): IntelligenceRule[] {
  return input.exclusions.map((exclusion, index) => ({
    ruleKey: `campaign-exclusion-${index + 1}`,
    label: exclusion,
    description: exclusion,
    ruleType: "soft_exclusion",
    scope: "campaign",
    strength: "soft",
    applicability: {
      objectives: [input.objectiveCode],
      offeringIds: [input.offeringVersionId],
      geographies: input.geography,
      relationshipTypes: [input.objectiveCode],
      archetypeIds: [],
    },
    status: "confirmed",
    source: "user",
    evidenceIds: [],
    confidence: 1,
  }));
}

function bestProfileArchetype(
  archetypes: CampaignPlanningArchetype[],
  segment: TargetSegment,
  objectiveCode: ReturnType<typeof resolveCampaignObjective>,
) {
  const relationshipMatches = archetypes.filter(
    (archetype) =>
      normalizeProfileRelationship(archetype.relationshipType) === objectiveCode,
  );
  const candidates = relationshipMatches.length ? relationshipMatches : archetypes;
  const terms =
    `${segment.name} ${segment.summary} ${segment.organizationTypes.join(" ")}`
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 3);
  return [...candidates].sort((left, right) => {
    const score = (archetype: CampaignPlanningArchetype) =>
      terms.filter((term) =>
        `${archetype.name} ${archetype.description}`.toLowerCase().includes(term),
      ).length +
      (archetype.priority === "priority" ? 2 : 0) +
      archetype.confidence;
    return score(right) - score(left);
  })[0];
}

function normalizeProfileRelationship(value: string) {
  if (value === "end_user") return "end_user_customer";
  const supported = [
    "direct_buyer",
    "distributor",
    "reseller",
    "channel_partner",
    "implementation_partner",
    "referral_partner",
    "supplier",
    "strategic_partner",
  ] as const;
  return supported.find((candidate) => candidate === value) ?? "direct_buyer";
}

function useModeForObjective(
  objective: ReturnType<typeof resolveCampaignObjective>,
): "use" | "consume" | "resell" | "distribute" | "integrate" | "refer" {
  if (objective === "distributor") return "distribute";
  if (objective === "reseller" || objective === "channel_partner") return "resell";
  if (objective === "implementation_partner") return "integrate";
  if (objective === "referral_partner") return "refer";
  return "use";
}

function condition(field: string, value: string) {
  return { field, operator: "contains" as const, value };
}

function signals(values: string[], className: "positive" | "negative", prefix: string) {
  return unique(values)
    .slice(0, 20)
    .map((value, index) => ({
      key: `${prefix}-${index + 1}`,
      label: value,
      description: value,
      class: className,
      expectedEvidenceTypes: ["company_website", "reliable_public_source"],
      reliability: "medium" as const,
      requiredForQualification: false,
    }));
}

function evidenceQuestions(values: string[], segmentIndex: number) {
  const questions = unique(values)
    .slice(0, 5)
    .map((value, index) => ({
      questionKey: `segment-${segmentIndex + 1}-requirement-${index + 1}`,
      question: `What public evidence shows that this organization meets: ${value}?`,
      importance: index === 0 ? ("critical" as const) : ("important" as const),
      acceptedEvidenceTypes: ["company_website", "reliable_public_source"],
      unknownAction: "requires_research" as const,
    }));
  return questions.length
    ? questions
    : [
        {
          questionKey: `segment-${segmentIndex + 1}-commercial-fit`,
          question: "What public evidence supports this organization's commercial fit?",
          importance: "critical" as const,
          acceptedEvidenceTypes: ["company_website", "reliable_public_source"],
          unknownAction: "requires_research" as const,
        },
      ];
}

function factor(
  factorKey: string,
  label: string,
  weight: number,
  definition: string,
  criticality: "critical" | "important",
) {
  return {
    factorKey,
    label,
    definition,
    weight,
    criticality,
    positiveDefinition: definition,
    negativeDefinition: `Reliable evidence contradicts: ${definition}`,
    unknownPolicy:
      criticality === "critical"
        ? ("gate_if_critical" as const)
        : ("requires_research" as const),
    acceptedEvidenceTypes: ["company_website", "reliable_public_source"],
  };
}

function confidenceNumber(value: "high" | "medium" | "low") {
  return value === "high" ? 0.85 : value === "medium" ? 0.65 : 0.4;
}

function key(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "target"
  );
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function uniqueRules(rules: IntelligenceRule[]) {
  const byKey = new Map<string, IntelligenceRule>();
  for (const rule of rules) {
    if (!byKey.has(rule.ruleKey)) byKey.set(rule.ruleKey, rule);
  }
  return [...byKey.values()];
}
