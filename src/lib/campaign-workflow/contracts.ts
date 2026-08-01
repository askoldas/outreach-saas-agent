import { parseTargetSegments, type TargetSegment } from "./target-segments.ts";

export type CampaignGeography = {
  countryCodes: string[];
  regionLabel?: string;
  primaryLanguage?: string;
};

export type CampaignOfferingProposal = {
  profileOfferingIds: string[];
  title: string;
  summary: string;
  valueProposition: string;
  rationale: string;
};

export type CampaignTargetClient = {
  companyTypes: string[];
  industries: string[];
  employeeRange?: { min?: number; max?: number };
  characteristics: string[];
  positiveSignals: string[];
  requiredCriteria: string[];
  exclusions: string[];
  recommendedDecisionMakerRoles: string[];
  summary: string;
};

export type CampaignBriefProposal = {
  geography: CampaignGeography;
  offering: CampaignOfferingProposal;
  targetClient: CampaignTargetClient;
  targetSegments: TargetSegment[];
  ambiguity?: {
    requiresClarification: boolean;
    question?: string;
    options?: Array<{ label: string; summary: string }>;
  };
  confidence: number;
};

export type ConfirmedCampaignBrief = {
  geography: CampaignGeography;
  offering: CampaignOfferingProposal;
  targetClient: CampaignTargetClient;
  targetSegments: TargetSegment[];
  desiredQualifiedCompanies: number;
};

export const campaignBriefPromptVersion =
  "campaign-brief-proposal-v3-native-intelligence";

export function parseCampaignBriefProposal(
  value: unknown,
  validOfferingIds: ReadonlySet<string>,
): CampaignBriefProposal {
  const row = object(value, "proposal");
  const brief = parseBrief(row, validOfferingIds);
  const confidence = number(row.confidence, "confidence", 0, 1);
  const ambiguityRow =
    row.ambiguity === undefined ? undefined : object(row.ambiguity, "ambiguity");
  const options = ambiguityRow?.options;
  const clarificationQuestion = optionalString(ambiguityRow?.question);
  if (options !== undefined && !Array.isArray(options)) {
    throw new Error("Campaign proposal returned invalid ambiguity options.");
  }
  return {
    ...brief,
    ...(ambiguityRow
      ? {
          ambiguity: {
            requiresClarification:
              Boolean(ambiguityRow.requiresClarification) &&
              Boolean(clarificationQuestion),
            ...(clarificationQuestion ? { question: clarificationQuestion } : {}),
            ...(options
              ? {
                  options: options.slice(0, 4).map((option, index) => {
                    const item = object(option, `ambiguity.options.${index}`);
                    return {
                      label: requiredString(item.label, "ambiguity option label"),
                      summary: requiredString(item.summary, "ambiguity option summary"),
                    };
                  }),
                }
              : {}),
          },
        }
      : {}),
    confidence,
  };
}

export function parseConfirmedCampaignBrief(
  value: unknown,
  validOfferingIds: ReadonlySet<string>,
): ConfirmedCampaignBrief {
  const row = object(value, "confirmed brief");
  const brief = parseBrief(row, validOfferingIds);
  if (!brief.targetSegments.some((segment) => segment.status === "confirmed")) {
    throw new Error("Confirm at least one organization target before discovery.");
  }
  return {
    ...brief,
    desiredQualifiedCompanies: integer(
      row.desiredQualifiedCompanies,
      "desiredQualifiedCompanies",
      1,
      500,
    ),
  };
}

function parseBrief(
  row: Record<string, unknown>,
  validOfferingIds: ReadonlySet<string>,
): Omit<ConfirmedCampaignBrief, "desiredQualifiedCompanies"> {
  const geographyRow = object(row.geography, "geography");
  const offeringRow = object(row.offering, "offering");
  const targetRow = object(row.targetClient, "targetClient");
  const countryCodes = strings(geographyRow.countryCodes, "geography.countryCodes");
  if (!countryCodes.length) {
    throw new Error("Campaign brief requires at least one country or region.");
  }
  const profileOfferingIds = strings(
    offeringRow.profileOfferingIds,
    "offering.profileOfferingIds",
  );
  if (
    profileOfferingIds.length !== 1 ||
    profileOfferingIds.some((id) => !validOfferingIds.has(id))
  ) {
    throw new Error(
      "Campaign proposal must reference exactly one known Company Profile offering.",
    );
  }
  const employeeRow =
    targetRow.employeeRange === undefined
      ? undefined
      : object(targetRow.employeeRange, "targetClient.employeeRange");
  const min =
    employeeRow?.min === undefined
      ? undefined
      : integer(employeeRow.min, "employeeRange.min", 1, 1_000_000);
  const max =
    employeeRow?.max === undefined
      ? undefined
      : integer(employeeRow.max, "employeeRange.max", 1, 1_000_000);
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error("Campaign proposal returned an invalid employee range.");
  }
  const targetClient = {
    companyTypes: strings(targetRow.companyTypes, "targetClient.companyTypes"),
    industries: strings(targetRow.industries, "targetClient.industries"),
    ...(employeeRow
      ? { employeeRange: { ...(min ? { min } : {}), ...(max ? { max } : {}) } }
      : {}),
    characteristics: strings(targetRow.characteristics, "targetClient.characteristics"),
    positiveSignals: strings(targetRow.positiveSignals, "targetClient.positiveSignals"),
    requiredCriteria: strings(
      targetRow.requiredCriteria,
      "targetClient.requiredCriteria",
    ),
    exclusions: strings(targetRow.exclusions, "targetClient.exclusions"),
    recommendedDecisionMakerRoles: strings(
      targetRow.recommendedDecisionMakerRoles,
      "targetClient.recommendedDecisionMakerRoles",
    ),
    summary: requiredString(targetRow.summary, "targetClient.summary"),
  };
  const targetSegments =
    row.targetSegments === undefined
      ? parseTargetSegments([
          {
            id: "primary_organization_segment",
            name: targetClient.companyTypes[0] ?? "Target organizations",
            summary: targetClient.summary,
            relationshipType: "customer",
            organizationTypes: targetClient.companyTypes,
            industries: targetClient.industries,
            ...(employeeRow
              ? {
                  companySize: {
                    ...(min ? { minimumEmployees: min } : {}),
                    ...(max ? { maximumEmployees: max } : {}),
                  },
                }
              : {}),
            geographies: countryCodes,
            characteristics: targetClient.characteristics,
            buyingSignals: targetClient.positiveSignals,
            likelyBuyerRoles: targetClient.recommendedDecisionMakerRoles,
            exclusions: targetClient.exclusions,
            rationale: "Derived from the confirmed campaign target.",
            supportingEvidence: [],
            discoverability: "medium",
            source: "ai_suggested",
            confidence: "medium",
            status: "confirmed",
          },
        ])
      : parseTargetSegments(row.targetSegments);
  return {
    geography: {
      countryCodes,
      ...(optionalString(geographyRow.regionLabel)
        ? { regionLabel: optionalString(geographyRow.regionLabel) }
        : {}),
      ...(optionalString(geographyRow.primaryLanguage)
        ? { primaryLanguage: optionalString(geographyRow.primaryLanguage) }
        : {}),
    },
    offering: {
      profileOfferingIds,
      title: requiredString(offeringRow.title, "offering.title"),
      summary: requiredString(offeringRow.summary, "offering.summary"),
      valueProposition: requiredString(
        offeringRow.valueProposition,
        "offering.valueProposition",
      ),
      rationale: requiredString(offeringRow.rationale, "offering.rationale"),
    },
    targetClient,
    targetSegments,
  };
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value.trim();
}
function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function strings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}
function number(value: unknown, field: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return parsed;
}

function integer(value: unknown, field: string, min: number, max: number) {
  const parsed = number(value, field, min, max);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return parsed;
}
