import type { ConfirmedCampaignBrief } from "@/lib/campaign-workflow/contracts";
import {
  adaptV1StrategyToV2Draft,
  compileCampaignCommercialContext,
  compileCampaignStrategyV2,
  hashCanonical,
} from "@/lib/intelligence/campaign-strategy-v2";
import type { Campaign, CampaignStrategyVersion } from "@/types/domain";
import type { Json } from "@/types/database.types";
import {
  createCampaignStrategyV2Draft,
  getPublishedCampaignProfileContext,
  persistCampaignStrategyV2Compilation,
} from "./repository";

export async function createInitialCampaignStrategyV2(input: {
  workspaceId: string;
  campaign: Campaign;
  confirmedBrief: ConfirmedCampaignBrief;
  legacyStrategy: CampaignStrategyVersion;
  objectiveCode: string;
}) {
  const stableKey = input.confirmedBrief.offering.profileOfferingIds[0];
  if (!stableKey) throw new Error("A published offering must be selected.");
  const profile = await getPublishedCampaignProfileContext(input.workspaceId, stableKey);
  const geography = {
    mode:
      input.confirmedBrief.geography.countryCodes.length === 1
        ? ("country" as const)
        : ("multi_country" as const),
    displayName:
      input.confirmedBrief.geography.regionLabel ||
      input.confirmedBrief.geography.countryCodes.join(", "),
    countryCodes: input.confirmedBrief.geography.countryCodes,
    includedRegions: [],
    includedCities: [],
    excludedRegions: [],
    excludedCities: [],
    localLanguages: [],
    workingLanguages: [input.confirmedBrief.geography.primaryLanguage || "English"],
    userConfirmed: true,
  };
  const objectiveCode = resolveObjective(input.objectiveCode);
  const objective = {
    code: objectiveCode,
    label: objectiveLabel(objectiveCode),
    description: input.confirmedBrief.targetClient.summary,
    targetRelationshipTypes: [objectiveCode],
    normallyExcludedRelationshipTypes: ["competitor" as const, "supplier" as const],
    userConfirmed: true,
  };
  const mechanics = objectValue(profile.offeringVersion.commercial_mechanics_json);
  const context = compileCampaignCommercialContext({
    workspaceId: input.workspaceId,
    profileVersionId: profile.profileVersionId,
    offeringReferences: [
      {
        companyProfileVersionId: profile.profileVersionId,
        offeringId: profile.offeringId,
        offeringVersionId: profile.offeringVersion.id,
      },
    ],
    objective,
    geography,
    companyRoles: profile.companyRoles,
    offerings: [
      {
        offeringVersionId: profile.offeringVersion.id,
        summary: profile.offeringVersion.short_description,
        valueDelivered: stringArray(mechanics.valueProposition),
        transactionModels: stringArray(mechanics.transactionModels),
        buyerUseModes: ["use"],
      },
    ],
    buyerHypotheses: [
      {
        offeringVersionId: profile.offeringVersion.id,
        relationshipType: objectiveCode,
        summary: input.confirmedBrief.targetClient.summary,
      },
    ],
    rules: [],
    claims: [],
  });
  const campaignInput = {
    geography,
    objective,
    offeringReferences: [
      {
        companyProfileVersionId: profile.profileVersionId,
        offeringId: profile.offeringId,
        offeringVersionId: profile.offeringVersion.id,
      },
    ],
    constraints: input.confirmedBrief.targetClient.requiredCriteria,
    initialHypothesis: {
      targetClient: input.confirmedBrief.targetClient,
      targetSegments: input.confirmedBrief.targetSegments,
    },
    requestedVolume: input.confirmedBrief.desiredQualifiedCompanies,
  };
  const persisted = await createCampaignStrategyV2Draft({
    workspaceId: input.workspaceId,
    campaignExternalId: input.campaign.id,
    profileVersionId: profile.profileVersionId,
    campaignInput: campaignInput as unknown as Json,
    inputHash: hashCanonical(campaignInput),
    compiledContext: context,
  });
  const draft = adaptV1StrategyToV2Draft({
    campaignId: input.campaign.id,
    strategyDraftId: persisted.id,
    companyProfileVersionId: profile.profileVersionId,
    offeringId: profile.offeringId,
    offeringVersionId: profile.offeringVersion.id,
    memorySnapshotId: `${input.campaign.id}.memory.pending`,
    geography: {
      displayName: geography.displayName,
      countryCodes: geography.countryCodes,
      workingLanguages: geography.workingLanguages,
    },
    strategy: input.legacyStrategy,
  });
  delete draft.legacyImport;
  draft.objective = objective;
  draft.geography = geography;
  draft.strategySummary = input.confirmedBrief.targetClient.summary;
  draft.unresolvedQuestions = [];
  draft.archetypes = draft.archetypes.map((archetype) => ({
    ...archetype,
    relationshipType: objectiveCode,
    userConfirmed: true,
  }));
  draft.campaignRules = draft.campaignRules.map((rule) => ({
    ...rule,
    applicability: {
      ...rule.applicability,
      objectives: [objectiveCode],
      relationshipTypes: [objectiveCode],
    },
  }));
  draft.qualificationPolicy = {
    ...draft.qualificationPolicy,
    relationshipTaxonomy: [
      objectiveCode,
      ...draft.qualificationPolicy.relationshipTaxonomy.filter(
        (relationship) => relationship !== objectiveCode,
      ),
    ],
    eligibilityRules: draft.campaignRules,
  };
  draft.discoverySegments = draft.discoverySegments.map((segment) => ({
    ...segment,
    relationshipType: objectiveCode,
    exclusionRules: draft.campaignRules,
  }));
  const compilation = compileCampaignStrategyV2({
    draft,
    compiledContextHash: context.contextHash,
  });
  await persistCampaignStrategyV2Compilation({
    workspaceId: input.workspaceId,
    strategyDraftId: persisted.id,
    compilation,
  });
  return { strategyDraftId: persisted.id };
}

function resolveObjective(value: string) {
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

function objectiveLabel(value: ReturnType<typeof resolveObjective>) {
  return `Find ${value.replaceAll("_", " ")}`;
}

function objectValue(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringArray(value: Json | undefined) {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item))
    : [];
}
