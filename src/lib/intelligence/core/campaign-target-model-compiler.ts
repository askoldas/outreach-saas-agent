import type {
  CampaignGeographyV2,
  CampaignObjectiveV2,
  CampaignStrategyV2,
} from "../campaign-strategy-v2/schemas.ts";
import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import {
  campaignTargetModelSchema,
  type CampaignTargetModel,
  type TargetArchetype,
} from "./campaign-target-model.ts";
import type {
  CommercialIntelligence,
  CommercialRelationshipType,
} from "./commercial-intelligence.ts";

export const CAMPAIGN_TARGET_MODEL_SCHEMA_VERSION = "campaign-target-model/v1";
export const CAMPAIGN_TARGET_MODEL_COMPILER_VERSION =
  "commercial-intelligence-target-compiler/v1";

export function compileCampaignTargetModel(input: {
  artifactId: string;
  workspaceId: string;
  campaignId: string;
  profileSnapshotId: string;
  commercialIntelligenceVersionId: string;
  commercialIntelligence: CommercialIntelligence;
  selectedOfferingIds: string[];
  objective: CampaignObjectiveV2;
  geography: CampaignGeographyV2;
  confirmedConstraints: string[];
  strategyProjection?: CampaignStrategyV2;
  createdAt: string;
}): CampaignTargetModel {
  assertCommercialInput(input);
  const selectedOfferings = input.selectedOfferingIds.map((id) => {
    const offering = input.commercialIntelligence.offerings.find(
      ({ offeringId, offeringVersionId }) =>
        offeringId === id || offeringVersionId === id,
    );
    if (!offering)
      throw new Error(`Selected offering ${id} is absent from Commercial Intelligence.`);
    return offering;
  });
  const desiredRelationships = uniqueSorted(
    input.objective.targetRelationshipTypes.map(normalizeCampaignRelationship),
  );
  const commercialArchetypes = selectedOfferings
    .flatMap(({ possibleCustomerArchetypes }) => possibleCustomerArchetypes)
    .filter((archetype) =>
      archetype.possibleRelationships.some((relationship) =>
        desiredRelationships.includes(relationship),
      ),
    )
    .map(
      (archetype): TargetArchetype => ({
        id: archetype.id,
        label: archetype.label,
        organizationType: archetype.organizationType,
        businessModel: uniqueSorted([
          ...archetype.businessRoles,
          ...archetype.businessModels,
          ...archetype.industries,
        ]),
        priority: targetPriority(archetype.sourcePriority),
        whyItCanBuyOrUse: archetype.rationale,
        operationalEvidenceOfNeed: uniqueSorted(archetype.operationalUseCases),
        positiveSignals: archetype.positiveSignals,
        negativeSignals: archetype.negativeSignals,
        scaleSignals: [],
        geographyRequirements: geographyRequirements(input.geography),
        hardExclusionRuleKeys: [],
        likelyRelationships: uniqueSorted(archetype.possibleRelationships),
        optionalOrUnknown: [],
        evidenceIds: archetype.evidenceIds,
        confidence: archetype.confidence,
      }),
    );
  const strategyProjection = input.strategyProjection;
  const archetypes = strategyProjection
    ? strategyProjection.archetypes
        .filter(({ priority }) => priority !== "incompatible")
        .map(
          (archetype): TargetArchetype => ({
            id: archetype.id,
            label: boundedText(archetype.label, 200),
            organizationType: boundedText(
              uniqueSorted(archetype.organizationRoles).join(", "),
              300,
            ),
            businessModel: uniqueSorted([
              ...archetype.businessModels,
              ...archetype.industries,
            ]).map((value) => boundedText(value, 240)),
            priority:
              archetype.priority === "priority"
                ? "priority"
                : archetype.priority === "conditional"
                  ? "secondary"
                  : "exploratory",
            whyItCanBuyOrUse: boundedText(archetype.commercialRationale, 1200),
            operationalEvidenceOfNeed:
              archetype.requiredEvidenceQuestions.length > 0
                ? archetype.requiredEvidenceQuestions.map(({ question }) =>
                    boundedText(question, 500),
                  )
                : [boundedText(archetype.description, 500)],
            positiveSignals: archetype.positiveSignals.map(strategySignal),
            negativeSignals: archetype.negativeSignals.map(strategySignal),
            scaleSignals: [],
            geographyRequirements: geographyRequirements(input.geography),
            hardExclusionRuleKeys: strategyProjection.campaignRules
              .filter(
                ({ ruleType, strength, status, applicability }) =>
                  ruleType === "hard_exclusion" &&
                  strength === "hard" &&
                  status === "confirmed" &&
                  (!applicability.archetypeIds.length ||
                    applicability.archetypeIds.includes(archetype.id)),
              )
              .map(({ ruleKey }) => ruleKey),
            likelyRelationships: [
              normalizeCampaignRelationship(archetype.relationshipType),
            ],
            optionalOrUnknown: [],
            evidenceIds: [],
            confidence: archetype.confidence,
          }),
        )
    : commercialArchetypes;
  if (!archetypes.length) {
    throw new Error(
      "No selected-offering archetype supports the confirmed Campaign objective.",
    );
  }
  ensurePriorityArchetype(archetypes);
  const applicableRules = input.commercialIntelligence.rules.filter(
    (rule) =>
      rule.status === "confirmed" &&
      (rule.scope === "workspace" ||
        rule.applicability.offeringIds.some((id) =>
          input.selectedOfferingIds.includes(id),
        )) &&
      (!rule.applicability.objectives.length ||
        rule.applicability.objectives.includes(input.objective.code)),
  );
  const hardExclusions = applicableRules.filter(
    ({ ruleType, strength }) => ruleType === "hard_exclusion" && strength === "hard",
  );
  const softExclusions = applicableRules.filter(
    ({ ruleType }) => ruleType === "soft_exclusion",
  );
  const hardKeys = new Set(hardExclusions.map(({ ruleKey }) => ruleKey));
  for (const archetype of archetypes) {
    archetype.hardExclusionRuleKeys = uniqueSorted([
      ...archetype.hardExclusionRuleKeys,
      ...hardKeys,
    ]);
  }
  const body = {
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    profileSnapshotId: input.profileSnapshotId,
    commercialIntelligenceVersionId: input.commercialIntelligenceVersionId,
    offeringIds: uniqueSorted(input.selectedOfferingIds),
    objective: {
      code: input.objective.code,
      description: input.objective.description,
      desiredRelationships,
    },
    geography: {
      displayName: input.geography.displayName,
      countryCodes: uniqueSorted(input.geography.countryCodes),
      regions: uniqueSorted(input.geography.includedRegions),
      cities: uniqueSorted(input.geography.includedCities),
      localLanguages: uniqueSorted(input.geography.localLanguages),
      workingLanguages: uniqueSorted(input.geography.workingLanguages),
    },
    archetypes,
    requiredSignals: [],
    positiveSignals: dedupeSignals(
      selectedOfferings.flatMap(({ positiveSignals }) => positiveSignals),
    ),
    negativeSignals: dedupeSignals(
      selectedOfferings.flatMap(({ negativeSignals }) => negativeSignals),
    ),
    hardExclusions,
    softExclusions,
    qualificationRequirements: input.commercialIntelligence.unknowns,
    confirmedConstraints: uniqueSorted(input.confirmedConstraints),
    unresolvedQuestions: input.commercialIntelligence.unknowns,
    confidence: aggregateConfidence(archetypes.map(({ confidence }) => confidence)),
  };
  return campaignTargetModelSchema.parse({
    id: input.artifactId,
    ...body,
    version: {
      schemaVersion: CAMPAIGN_TARGET_MODEL_SCHEMA_VERSION,
      compilerVersion: CAMPAIGN_TARGET_MODEL_COMPILER_VERSION,
      inputHash: hashCanonical({
        commercialIntelligenceContentHash:
          input.commercialIntelligence.version.contentHash,
        selectedOfferingIds: body.offeringIds,
        objective: input.objective,
        geography: input.geography,
        confirmedConstraints: body.confirmedConstraints,
        strategyProjection: input.strategyProjection ?? null,
        compilerVersion: CAMPAIGN_TARGET_MODEL_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
    },
  });
}

export function assertCampaignTargetStrategyProjection(input: {
  target: CampaignTargetModel;
  strategy: CampaignStrategyV2;
  campaignIdentityVerifiedByRun?: boolean;
}) {
  const strategyOfferingIds = uniqueSorted(
    input.strategy.offeringReferences.flatMap(({ offeringId, offeringVersionId }) => [
      offeringId,
      offeringVersionId,
    ]),
  );
  if (
    input.target.campaignId !== input.strategy.campaignId &&
    !input.campaignIdentityVerifiedByRun
  )
    throw new Error("Campaign Target Model and Strategy reference different Campaigns.");
  if (input.target.offeringIds.some((id) => !strategyOfferingIds.includes(id)))
    throw new Error(
      "Campaign Strategy does not project every selected Target Model offering.",
    );
  if (
    input.target.geography.countryCodes.join("|") !==
    uniqueSorted(input.strategy.geography.countryCodes).join("|")
  )
    throw new Error("Campaign Strategy geography diverges from the Target Model.");
  const strategyRelationships = uniqueSorted(
    input.strategy.objective.targetRelationshipTypes.map(normalizeCampaignRelationship),
  );
  if (
    input.target.objective.desiredRelationships.some(
      (relationship) => !strategyRelationships.includes(relationship),
    )
  )
    throw new Error("Campaign Strategy objective diverges from the Target Model.");
  const targetArchetypeIds = new Set(input.target.archetypes.map(({ id }) => id));
  if (input.strategy.archetypes.some(({ id }) => !targetArchetypeIds.has(id)))
    throw new Error("Campaign Strategy contains an archetype outside the Target Model.");
  return input.strategy;
}

function assertCommercialInput(input: Parameters<typeof compileCampaignTargetModel>[0]) {
  if (input.commercialIntelligence.workspaceId !== input.workspaceId)
    throw new Error("Commercial Intelligence belongs to another workspace.");
  if (input.commercialIntelligence.id !== input.commercialIntelligenceVersionId)
    throw new Error("Commercial Intelligence version identity mismatch.");
  if (!input.objective.userConfirmed || !input.geography.userConfirmed)
    throw new Error("Campaign Target Model requires confirmed objective and geography.");
  if (!input.selectedOfferingIds.length)
    throw new Error("Campaign Target Model requires a selected offering.");
}

function normalizeCampaignRelationship(value: string): CommercialRelationshipType {
  if (value === "direct_buyer") return "buyer";
  if (value === "end_user_customer") return "end_user";
  const supported = [
    "distributor",
    "reseller",
    "channel_partner",
    "implementation_partner",
    "integration_partner",
    "referral_partner",
    "supplier",
    "strategic_partner",
    "competitor",
  ] as const;
  return supported.includes(value as (typeof supported)[number])
    ? (value as CommercialRelationshipType)
    : "other";
}

function targetPriority(value: "priority" | "conditional" | "low_priority") {
  return value === "priority"
    ? ("priority" as const)
    : value === "conditional"
      ? ("secondary" as const)
      : ("exploratory" as const);
}

function ensurePriorityArchetype(archetypes: TargetArchetype[]) {
  if (archetypes.some(({ priority }) => priority === "priority")) return;
  const strongest = [...archetypes].sort(
    (a, b) => b.confidence - a.confidence || compareText(a.id, b.id),
  )[0];
  if (strongest) strongest.priority = "priority";
}

function geographyRequirements(geography: CampaignGeographyV2) {
  if (geography.countryCodes.includes("WORLDWIDE")) return [];
  return [
    `Reliable evidence of legal or operating presence in ${geography.displayName}.`,
  ];
}

function dedupeSignals<T extends { key: string }>(signals: T[]) {
  return [...new Map(signals.map((signal) => [signal.key, signal])).values()].sort(
    (a, b) => compareText(a.key, b.key),
  );
}

function strategySignal(
  signal: CampaignStrategyV2["archetypes"][number]["positiveSignals"][number],
) {
  return {
    key: signal.key,
    statement: boundedText(signal.description, 800),
    evidenceIds: [],
    confidence:
      signal.reliability === "high" ? 0.85 : signal.reliability === "medium" ? 0.65 : 0.4,
  };
}

function boundedText(value: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  return normalized.slice(0, maximum - 1).trimEnd() + "…";
}

function aggregateConfidence(values: number[]) {
  return values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
    : 0;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
